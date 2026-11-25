// Run: node tests/iconpixels.test.cjs
const assert = require("assert");
const vm = require("vm"), fs = require("fs"), path = require("path");
const box = { module: { exports: {} }, Math, Number, String, Object, Array, Infinity, Uint8ClampedArray, Uint8Array, Int32Array };
box.globalThis = box;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/lib/iconPixels.js"), "utf8"), box);
const P = box.module.exports;
let pass = 0;
function t(name, fn) { fn(); pass++; console.log("ok  " + name); }

/** Builds an image from rows of characters: . transparent, w white, k black, r red, R dark red. */
const COL = { w: [255, 255, 255, 255], k: [0, 0, 0, 255], r: [255, 0, 0, 255], R: [235, 20, 20, 255], ".": [0, 0, 0, 0] };
function img(rows) {
  const h = rows.length, w = rows[0].length, o = P.make(w, h);
  rows.forEach((row, y) => [...row].forEach((c, x) => o.data.set(COL[c], (y * w + x) * 4)));
  return o;
}
const alpha = (im, x, y) => im.data[(y * im.w + x) * 4 + 3];

t("bounds finds the box around the visible pixels", () => {
  const b = P.bounds(img(["......", "..kk..", "..kk..", "......"]));
  assert.strictEqual(JSON.stringify(b), JSON.stringify({ x: 2, y: 1, w: 2, h: 2 }));
});
t("bounds is null for an empty image", () => {
  assert.strictEqual(P.bounds(img(["...", "..."])), null);
});
t("trim removes transparent margins", () => {
  const o = P.trim(img(["......", "..kr..", "..rk..", "......"]));
  assert.strictEqual(o.w, 2); assert.strictEqual(o.h, 2);
  assert.strictEqual(o.data[0], 0); assert.strictEqual(o.data[4], 255);
});
t("crop keeps the chosen pixels in place", () => {
  const o = P.crop(img(["wkw", "krk", "wkw"]), { x: 1, y: 1, w: 2, h: 2 });
  assert.strictEqual(o.w, 2); assert.strictEqual(o.h, 2);
  assert.strictEqual(o.data[0], 255); assert.strictEqual(o.data[1], 0);
});
t("crop clamps to the image and rejects empty rectangles", () => {
  const o = P.crop(img(["wk", "kw"]), { x: -5, y: 1, w: 30, h: 30 });
  assert.strictEqual(o.w, 2); assert.strictEqual(o.h, 1);
  assert.strictEqual(P.crop(img(["wk"]), { x: 5, y: 0, w: 2, h: 1 }), null);
});
t("contiguous removal keeps an island of the same colour inside an outline", () => {
  const im = img(["wwwww", "wkkkw", "wkwkw", "wkkkw", "wwwww"]);
  const n = P.removeColour(im, 0, 0, 0, true);
  assert.strictEqual(n, 16);
  assert.strictEqual(alpha(im, 0, 0), 0); assert.strictEqual(alpha(im, 2, 2), 255);
});
t("global removal also takes the island", () => {
  const im = img(["wwwww", "wkkkw", "wkwkw", "wkkkw", "wwwww"]);
  assert.strictEqual(P.removeColour(im, 0, 0, 0, false), 17);
  assert.strictEqual(alpha(im, 2, 2), 0); assert.strictEqual(alpha(im, 1, 1), 255);
});
t("tolerance 0 needs an exact colour, higher tolerance takes near colours", () => {
  const a = img(["rRr"]); assert.strictEqual(P.removeColour(a, 0, 0, 0, true), 1);
  const b = img(["rRr"]); assert.strictEqual(P.removeColour(b, 0, 0, 10, true), 3);
});
t("removal does not leak across a different colour", () => {
  const im = img(["rkr"]);
  assert.strictEqual(P.removeColour(im, 0, 0, 20, true), 1);
  assert.strictEqual(alpha(im, 2, 0), 255);
});
t("clicking a transparent pixel or outside the image changes nothing", () => {
  const im = img([".w"]);
  assert.strictEqual(P.removeColour(im, 0, 0, 50, true), 0);
  assert.strictEqual(P.removeColour(im, 9, 9, 50, true), 0);
});
t("corner removal clears a white background around a shape", () => {
  const im = img(["wwwww", "wkkkw", "wkkkw", "wwwww"]);
  assert.strictEqual(P.removeFromCorners(im, 5), 14);
  assert.strictEqual(P.opaque(im), 6);
});
t("erase circle clears pixels within the radius only", () => {
  const im = img(["wwwww", "wwwww", "wwwww", "wwwww", "wwwww"]);
  const n = P.eraseCircle(im, 2.5, 2.5, 1.2);
  assert.strictEqual(alpha(im, 2, 2), 0); assert.strictEqual(alpha(im, 0, 0), 255);
  assert.strictEqual(n, 25 - P.opaque(im));
});
t("erase line leaves no gaps in a fast stroke", () => {
  const im = img(["wwwwwwwwwwwwwwww", "wwwwwwwwwwwwwwww", "wwwwwwwwwwwwwwww"]);
  P.eraseLine(im, 0.5, 1.5, 15.5, 1.5, 0.6);
  for (let x = 0; x < 16; x++) assert.strictEqual(alpha(im, x, 1), 0, "x=" + x);
  assert.strictEqual(alpha(im, 8, 0), 255);
});
t("erase polygon clears the inside of a triangle", () => {
  const im = img(["wwwwww", "wwwwww", "wwwwww", "wwwwww", "wwwwww", "wwwwww"]);
  P.erasePolygon(im, [[0, 0], [6, 0], [0, 6]]);
  assert.strictEqual(alpha(im, 0, 0), 0); assert.strictEqual(alpha(im, 1, 1), 0);
  assert.strictEqual(alpha(im, 5, 5), 255); assert.strictEqual(alpha(im, 4, 4), 255);
});
t("erase polygon needs three points and copy does not share data", () => {
  const im = img(["ww"]);
  assert.strictEqual(P.erasePolygon(im, [[0, 0], [2, 2]]), 0);
  const c = P.copy(im); P.eraseCircle(c, 0.5, 0.5, 5);
  assert.strictEqual(alpha(im, 0, 0), 255);
});
console.log(pass + " passed");
