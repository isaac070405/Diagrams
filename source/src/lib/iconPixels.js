/*
 * SDIconPixels: pixel edits for the icon editor (12b).
 * An image is { w, h, data } where data holds w * h RGBA bytes, the same layout as canvas ImageData.
 * crop, trim and copy return a new image. The erase and remove functions change the image they are given,
 * so the editor snapshots with copy() before each step to support undo.
 */
(function (SD) {
  "use strict";

  function make(w, h) { return { w: w, h: h, data: new Uint8ClampedArray(w * h * 4) }; }

  function copy(img) {
    var o = make(img.w, img.h);
    o.data.set(img.data);
    return o;
  }

  /** Box around every pixel with alpha above minAlpha (default 8 of 255), or null when the image is empty. */
  function bounds(img, minAlpha) {
    var a = minAlpha == null ? 8 : minAlpha, x0 = img.w, y0 = img.h, x1 = -1, y1 = -1, x, y;
    for (y = 0; y < img.h; y++) {
      for (x = 0; x < img.w; x++) {
        if (img.data[(y * img.w + x) * 4 + 3] > a) {
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  /** Crops to rect { x, y, w, h }. The rectangle is clamped to the image; returns null when nothing is left. */
  function crop(img, r) {
    var x0 = Math.max(0, Math.round(r.x)), y0 = Math.max(0, Math.round(r.y));
    var x1 = Math.min(img.w, Math.round(r.x + r.w)), y1 = Math.min(img.h, Math.round(r.y + r.h));
    var w = x1 - x0, h = y1 - y0, y;
    if (w < 1 || h < 1) return null;
    var o = make(w, h);
    for (y = 0; y < h; y++) {
      o.data.set(img.data.subarray(((y0 + y) * img.w + x0) * 4, ((y0 + y) * img.w + x0 + w) * 4), y * w * 4);
    }
    return o;
  }

  /** Crops away the transparent margins. Returns null for an empty image. */
  function trim(img, minAlpha) {
    var b = bounds(img, minAlpha);
    return b ? crop(img, b) : null;
  }

  /** Largest allowed distance between two RGB colours (0 to 441.67) for a tolerance of 0 to 100 percent. */
  function limit(tol) { return Math.max(0, Math.min(100, tol)) / 100 * 441.6729559300637; }

  /**
   * Makes the pixels that match the colour at (x, y) transparent. A pixel matches when its RGB distance
   * from that colour is at most the tolerance (0 to 100 percent). With contiguous true only pixels
   * connected to (x, y) are removed, so an island of the same colour inside an outline stays.
   * Returns the number of pixels removed.
   */
  function removeColour(img, x, y, tol, contiguous) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= img.w || y >= img.h) return 0;
    var d = img.data, w = img.w, h = img.h, p0 = (y * w + x) * 4;
    if (d[p0 + 3] === 0) return 0;
    var r = d[p0], g = d[p0 + 1], b = d[p0 + 2], lim = limit(tol), lim2 = lim * lim, n = 0, i;
    function hit(p) {
      if (d[p + 3] === 0) return false;
      var dr = d[p] - r, dg = d[p + 1] - g, db = d[p + 2] - b;
      return dr * dr + dg * dg + db * db <= lim2;
    }
    if (!contiguous) {
      for (i = 0; i < w * h; i++) { if (hit(i * 4)) { d[i * 4 + 3] = 0; n++; } }
      return n;
    }
    var seen = new Uint8Array(w * h), stack = new Int32Array(w * h), top = 0;
    stack[top++] = y * w + x; seen[y * w + x] = 1;
    while (top > 0) {
      i = stack[--top];
      d[i * 4 + 3] = 0; n++;
      var cx = i % w, cy = (i - cx) / w, j;
      if (cx > 0) { j = i - 1; if (!seen[j] && hit(j * 4)) { seen[j] = 1; stack[top++] = j; } }
      if (cx < w - 1) { j = i + 1; if (!seen[j] && hit(j * 4)) { seen[j] = 1; stack[top++] = j; } }
      if (cy > 0) { j = i - w; if (!seen[j] && hit(j * 4)) { seen[j] = 1; stack[top++] = j; } }
      if (cy < h - 1) { j = i + w; if (!seen[j] && hit(j * 4)) { seen[j] = 1; stack[top++] = j; } }
    }
    return n;
  }

  /** Removes the background by flood filling from each corner that is not already transparent. */
  function removeFromCorners(img, tol) {
    var n = 0, w = img.w, h = img.h;
    [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].forEach(function (c) { n += removeColour(img, c[0], c[1], tol, true); });
    return n;
  }

  /** Makes every pixel whose centre lies within radius r of (cx, cy) transparent. */
  function eraseCircle(img, cx, cy, r) {
    var x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(img.w - 1, Math.ceil(cx + r));
    var y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(img.h - 1, Math.ceil(cy + r)), x, y, n = 0;
    for (y = y0; y <= y1; y++) {
      for (x = x0; x <= x1; x++) {
        var dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r && img.data[(y * img.w + x) * 4 + 3] !== 0) { img.data[(y * img.w + x) * 4 + 3] = 0; n++; }
      }
    }
    return n;
  }

  /** Erases along a line from (x0, y0) to (x1, y1) with a round brush, so a fast drag leaves no gaps. */
  function eraseLine(img, x0, y0, x1, y1, r) {
    var len = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0)), steps = Math.max(1, Math.ceil(len / Math.max(0.5, r / 2))), i, n = 0;
    for (i = 0; i <= steps; i++) n += eraseCircle(img, x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps, r);
    return n;
  }

  /** Makes every pixel whose centre lies inside the polygon (list of [x, y]) transparent. Even-odd rule. */
  function erasePolygon(img, pts) {
    if (pts.length < 3) return 0;
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, k, x, y, n = 0;
    for (k = 0; k < pts.length; k++) {
      minX = Math.min(minX, pts[k][0]); maxX = Math.max(maxX, pts[k][0]);
      minY = Math.min(minY, pts[k][1]); maxY = Math.max(maxY, pts[k][1]);
    }
    var x0 = Math.max(0, Math.floor(minX)), x1 = Math.min(img.w - 1, Math.ceil(maxX));
    var y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(img.h - 1, Math.ceil(maxY));
    for (y = y0; y <= y1; y++) {
      for (x = x0; x <= x1; x++) {
        var px = x + 0.5, py = y + 0.5, inside = false, j = pts.length - 1;
        for (k = 0; k < pts.length; k++) {
          var xi = pts[k][0], yi = pts[k][1], xj = pts[j][0], yj = pts[j][1];
          if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
          j = k;
        }
        if (inside && img.data[(y * img.w + x) * 4 + 3] !== 0) { img.data[(y * img.w + x) * 4 + 3] = 0; n++; }
      }
    }
    return n;
  }

  /** Number of pixels that are not transparent. */
  function opaque(img) {
    var n = 0, i;
    for (i = 3; i < img.data.length; i += 4) if (img.data[i] !== 0) n++;
    return n;
  }

  SD.make = make; SD.copy = copy; SD.bounds = bounds; SD.crop = crop; SD.trim = trim;
  SD.removeColour = removeColour; SD.removeFromCorners = removeFromCorners;
  SD.eraseCircle = eraseCircle; SD.eraseLine = eraseLine; SD.erasePolygon = erasePolygon; SD.opaque = opaque;
  if (typeof module !== "undefined" && module.exports) module.exports = SD;
})(typeof window !== "undefined" ? (window.SDIconPixels = window.SDIconPixels || {}) : (globalThis.SDIconPixels = globalThis.SDIconPixels || {}));
