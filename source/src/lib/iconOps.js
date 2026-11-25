/*
 * SDIconOps: pure edits for the icon library (12a).
 * The library object is { groups, icons, over }.
 *   groups: names of groups the user added.
 *   icons:  icons the user added { key, name, group, ratio, data }.
 *   over:   changes to the built-in catalogue, so the PNG files never change:
 *           over.groups[originalName] = { name?, hidden? }  (rename or delete a built-in group)
 *           over.icons[key]           = { name?, group?, data?, ratio?, hidden? }  (edit or delete a built-in icon)
 * Every function returns { lib } or { error } and leaves its input untouched.
 * B is the built-in group list (names), I is the built-in icon list ({ key, name, group, ratio }).
 */
(function (SD) {
  "use strict";
  var GROUP_MAX = 40, ICON_MAX = 60;

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  /** Copy with every field present, so callers can edit the copy freely. */
  function norm(lib) {
    var over = (lib && lib.over) || {}, out = { groups: [], icons: [], over: { groups: {}, icons: {} } };
    ((lib && lib.groups) || []).forEach(function (g) { out.groups.push(g); });
    ((lib && lib.icons) || []).forEach(function (i) { out.icons.push(Object.assign({}, i)); });
    Object.keys(over.groups || {}).forEach(function (k) { out.over.groups[k] = Object.assign({}, over.groups[k]); });
    Object.keys(over.icons || {}).forEach(function (k) { out.over.icons[k] = Object.assign({}, over.icons[k]); });
    return out;
  }

  /** Drops empty override entries so a saved library stays small. */
  function tidy(lib) {
    Object.keys(lib.over.groups).forEach(function (k) { if (!Object.keys(lib.over.groups[k]).length) delete lib.over.groups[k]; });
    Object.keys(lib.over.icons).forEach(function (k) { if (!Object.keys(lib.over.icons[k]).length) delete lib.over.icons[k]; });
    return lib;
  }

  function cleanName(name, max, what) {
    var t = String(name == null ? "" : name).trim();
    if (!t) return { error: "Type a name for the " + what + " first" };
    if (t.length > max) return { error: "Use at most " + max + " characters for the " + what + " name" };
    return { name: t };
  }

  /** Display name of a built-in group. */
  function groupName(lib, orig) {
    var o = lib.over && lib.over.groups && lib.over.groups[orig];
    return (o && o.name) || orig;
  }
  function groupHidden(lib, orig) {
    var o = lib.over && lib.over.groups && lib.over.groups[orig];
    return !!(o && o.hidden);
  }

  /** Original name of the built-in group now shown as `name`, or null for a user group. */
  function builtinOf(lib, B, name) {
    for (var i = 0; i < B.length; i++) if (groupName(lib, B[i]) === name) return B[i];
    return null;
  }

  /** Group names in display order: built-in groups that are not deleted, then user groups. */
  function groups(lib, B) {
    var out = [];
    B.forEach(function (g) { if (!groupHidden(lib, g)) out.push(groupName(lib, g)); });
    (lib.groups || []).forEach(function (g) { if (out.indexOf(g) < 0) out.push(g); });
    return out;
  }

  /** True when `name` is used by any group, deleted built-in groups included, except the group called `except`. */
  function taken(lib, B, name, except) {
    var t = String(name).trim().toLowerCase(), skip = except == null ? null : String(except).toLowerCase();
    var all = B.map(function (g) { return groupName(lib, g); }).concat(lib.groups || []);
    return all.some(function (g) { var l = g.toLowerCase(); return l === t && l !== skip; });
  }

  function iconGroup(lib, B, ic, custom) {
    if (custom) return ic.group;
    var o = lib.over.icons[ic.key];
    return o && o.group ? o.group : groupName(lib, ic.group);
  }

  /** Every visible icon with its current name and group, in catalogue order. Deleted icons are left out. */
  function resolve(lib0, B, I) {
    var lib = norm(lib0), tiles = [];
    I.forEach(function (ic) {
      var o = lib.over.icons[ic.key] || {};
      if (o.hidden) return;
      tiles.push({
        key: ic.key, name: o.name || ic.name, group: iconGroup(lib, B, ic, false),
        ratio: o.ratio > 0 ? o.ratio : ic.ratio, data: o.data || null, custom: false,
        edited: !!(o.name || o.group || o.data),
      });
    });
    lib.icons.forEach(function (ic) {
      tiles.push({ key: ic.key, name: ic.name, group: ic.group, ratio: ic.ratio, data: ic.data, custom: true, edited: false });
    });
    var names = groups(lib, B);
    tiles.forEach(function (t) { if (names.indexOf(t.group) < 0) names.push(t.group); });
    return { groups: names, tiles: tiles };
  }

  function addGroup(lib0, B, name) {
    var c = cleanName(name, GROUP_MAX, "group");
    if (c.error) return c;
    var lib = norm(lib0);
    if (taken(lib, B, c.name)) return { error: "A group called “" + c.name + "” already exists" };
    lib.groups.push(c.name);
    return { lib: lib, name: c.name };
  }

  function renameGroup(lib0, B, from, to) {
    var c = cleanName(to, GROUP_MAX, "group");
    if (c.error) return c;
    var lib = norm(lib0), orig = builtinOf(lib, B, from), user = lib.groups.indexOf(from);
    if (!orig && user < 0) return { error: "That group no longer exists" };
    if (c.name === from) return { lib: lib, name: from };
    if (taken(lib, B, c.name, from)) return { error: "A group called “" + c.name + "” already exists" };
    if (orig) {
      var og = lib.over.groups[orig] || (lib.over.groups[orig] = {});
      if (c.name === orig) delete og.name; else og.name = c.name;
    } else {
      lib.groups[user] = c.name;
    }
    lib.icons.forEach(function (i) { if (i.group === from) i.group = c.name; });
    Object.keys(lib.over.icons).forEach(function (k) { if (lib.over.icons[k].group === from) lib.over.icons[k].group = c.name; });
    return { lib: tidy(lib), name: c.name };
  }

  /** Icons now shown in group `name`: { builtin: [keys], custom: [keys] }. */
  function members(lib, B, I, name) {
    var r = resolve(lib, B, I), out = { builtin: [], custom: [] };
    r.tiles.forEach(function (t) { if (t.group === name) (t.custom ? out.custom : out.builtin).push(t.key); });
    return out;
  }

  /**
   * Deletes a group. With moveTo, its icons go to that group; without it they are deleted too.
   * A built-in group is hidden, so Restore can bring it back. A user group is removed.
   */
  function deleteGroup(lib0, B, I, name, moveTo) {
    var lib = norm(lib0), orig = builtinOf(lib, B, name), user = lib.groups.indexOf(name);
    if (!orig && user < 0) return { error: "That group no longer exists" };
    if (moveTo != null && moveTo !== "") {
      if (moveTo === name || groups(lib, B).indexOf(moveTo) < 0) return { error: "Choose another group to move the icons to" };
    }
    var m = members(lib, B, I, name);
    m.builtin.forEach(function (k) {
      var o = lib.over.icons[k] || (lib.over.icons[k] = {});
      if (moveTo) o.group = moveTo; else o.hidden = true;
    });
    if (moveTo) lib.icons.forEach(function (i) { if (i.group === name) i.group = moveTo; });
    else lib.icons = lib.icons.filter(function (i) { return i.group !== name; });
    if (orig) { (lib.over.groups[orig] || (lib.over.groups[orig] = {})).hidden = true; }
    else lib.groups.splice(user, 1);
    return { lib: tidy(lib), moved: m.builtin.length + m.custom.length, deleted: moveTo ? 0 : m.builtin.length + m.custom.length };
  }

  /**
   * Edits one icon. patch may hold name, group (moves the icon), data and ratio (replaces the image).
   * A built-in icon keeps its PNG; the change is stored as an override.
   */
  function editIcon(lib0, B, I, key, patch) {
    var lib = norm(lib0), builtin = null, i;
    for (i = 0; i < I.length; i++) if (I[i].key === key) builtin = I[i];
    var custom = null;
    lib.icons.forEach(function (c) { if (c.key === key) custom = c; });
    if (!builtin && !custom) return { error: "That icon no longer exists" };
    var next = {};
    if (has(patch, "name")) {
      var c = cleanName(patch.name, ICON_MAX, "icon");
      if (c.error) return c;
      next.name = c.name;
    }
    if (has(patch, "group")) {
      if (groups(lib, B).indexOf(patch.group) < 0) return { error: "Choose a group from the list" };
      next.group = patch.group;
    }
    if (has(patch, "data")) {
      if (!patch.data) return { error: "Choose an image file first" };
      next.data = patch.data; next.ratio = patch.ratio > 0 ? patch.ratio : 1;
    }
    if (custom) { Object.assign(custom, next); return { lib: lib }; }
    var o = lib.over.icons[key] || (lib.over.icons[key] = {});
    Object.assign(o, next);
    if (o.name === builtin.name) delete o.name;
    if (o.group === groupName(lib, builtin.group)) delete o.group;
    return { lib: tidy(lib) };
  }

  /** Deletes an icon. A built-in icon is hidden, so Restore can bring it back. */
  function deleteIcon(lib0, I, key) {
    var lib = norm(lib0), n = lib.icons.length;
    lib.icons = lib.icons.filter(function (c) { return c.key !== key; });
    if (lib.icons.length !== n) return { lib: lib };
    if (!I.some(function (b) { return b.key === key; })) return { error: "That icon no longer exists" };
    (lib.over.icons[key] || (lib.over.icons[key] = {})).hidden = true;
    return { lib: tidy(lib) };
  }

  /** Puts a built-in icon back: undoes its name, group and image edits and shows it again. */
  function restoreIcon(lib0, I, key) {
    var lib = norm(lib0), b = null;
    I.forEach(function (x) { if (x.key === key) b = x; });
    if (!b) return { error: "Only built-in icons can be restored" };
    delete lib.over.icons[key];
    if (lib.over.groups[b.group]) delete lib.over.groups[b.group].hidden;
    return { lib: tidy(lib) };
  }

  /** Puts a deleted built-in group back with all its built-in icons, as shipped. */
  function restoreGroup(lib0, I, orig) {
    var lib = norm(lib0);
    delete lib.over.groups[orig];
    I.forEach(function (b) { if (b.group === orig) delete lib.over.icons[b.key]; });
    return { lib: tidy(lib) };
  }

  /** Clears every change to the built-in catalogue. Icons and groups the user added stay. */
  function restoreAll(lib0) {
    var lib = norm(lib0);
    lib.over = { groups: {}, icons: {} };
    return { lib: lib };
  }

  /** Deleted built-ins that can be restored: whole groups, and single icons whose group is still shown. */
  function deleted(lib0, B, I) {
    var lib = norm(lib0), gs = [], is = [];
    B.forEach(function (g) { if (groupHidden(lib, g)) gs.push({ orig: g, name: groupName(lib, g) }); });
    I.forEach(function (b) {
      var o = lib.over.icons[b.key];
      if (o && o.hidden && !groupHidden(lib, b.group)) is.push({ key: b.key, name: o.name || b.name });
    });
    return { groups: gs, icons: is };
  }

  /** Number of changes to the built-in catalogue. */
  function changes(lib0) {
    var lib = norm(lib0);
    return Object.keys(lib.over.groups).length + Object.keys(lib.over.icons).length;
  }

  function uniqueKey(lib, I, name) {
    var base = "custom-" + (String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "icon");
    var used = {};
    I.forEach(function (b) { used[b.key] = 1; });
    ((lib && lib.icons) || []).forEach(function (c) { used[c.key] = 1; });
    var k = base, n = 2;
    while (used[k]) k = base + "-" + n++;
    return k;
  }

  SD.norm = norm; SD.groups = groups; SD.taken = taken; SD.resolve = resolve; SD.builtinOf = builtinOf;
  SD.addGroup = addGroup; SD.renameGroup = renameGroup; SD.deleteGroup = deleteGroup; SD.members = members;
  SD.editIcon = editIcon; SD.deleteIcon = deleteIcon;
  SD.restoreIcon = restoreIcon; SD.restoreGroup = restoreGroup; SD.restoreAll = restoreAll;
  SD.deleted = deleted; SD.changes = changes; SD.uniqueKey = uniqueKey;
  if (typeof module !== "undefined" && module.exports) module.exports = SD;
})(typeof window !== "undefined" ? (window.SDIconOps = window.SDIconOps || {}) : (globalThis.SDIconOps = globalThis.SDIconOps || {}));
