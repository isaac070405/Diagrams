// Run: node tests/iconops.test.cjs
const assert = require("assert");
const vm = require("vm"), fs = require("fs"), path = require("path");
const box = { module: { exports: {} }, Object, Array, String, Number };
box.globalThis = box;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/lib/iconOps.js"), "utf8"), box);
const O = box.module.exports;
let pass = 0;
assert.deepStrictEqual = (a, b) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b));
function t(name, fn) { fn(); pass++; console.log("ok  " + name); }

const B = ["Receptors", "Proteins", "Cells"];
const I = [
  { key: "rtk", name: "Receptor tyrosine kinase", group: "Receptors", ratio: 0.5 },
  { key: "gpcr", name: "GPCR", group: "Receptors", ratio: 0.6 },
  { key: "kinase", name: "Kinase", group: "Proteins", ratio: 0.7 },
  { key: "cell", name: "Cell", group: "Cells", ratio: 1 },
];
const empty = { groups: [], icons: [] };
const names = lib => O.resolve(lib, B, I).tiles.map(x => x.key + ":" + x.group).join(",");
const snap = lib => JSON.stringify(lib);

t("an empty library lists the built-ins unchanged", () => {
  const r = O.resolve(empty, B, I);
  assert.deepStrictEqual(r.groups, B);
  assert.strictEqual(r.tiles.length, 4);
  assert.ok(r.tiles.every(x => !x.custom && !x.edited));
});
t("functions never change their input", () => {
  const lib = O.addGroup(empty, B, "Organelles").lib, before = snap(lib);
  O.renameGroup(lib, B, "Receptors", "Membrane"); O.deleteGroup(lib, B, I, "Cells", null);
  O.editIcon(lib, B, I, "rtk", { name: "RTK" }); O.deleteIcon(lib, I, "rtk"); O.restoreAll(lib);
  assert.strictEqual(snap(lib), before);
});
t("add group trims, rejects blanks and duplicates in any case", () => {
  assert.strictEqual(O.addGroup(empty, B, "   ").error, "Type a name for the group first");
  assert.ok(O.addGroup(empty, B, "receptors").error);
  assert.ok(O.addGroup(empty, B, "x".repeat(41)).error);
  const r = O.addGroup(empty, B, "  Organelles ");
  assert.strictEqual(r.name, "Organelles");
  assert.deepStrictEqual(O.groups(r.lib, B), [...B, "Organelles"]);
});
t("renaming a built-in group moves its icons with it", () => {
  const r = O.renameGroup(empty, B, "Receptors", "Membrane proteins");
  assert.deepStrictEqual(O.groups(r.lib, B), ["Membrane proteins", "Proteins", "Cells"]);
  assert.strictEqual(names(r.lib), "rtk:Membrane proteins,gpcr:Membrane proteins,kinase:Proteins,cell:Cells");
});
t("renaming a built-in group back to its original name clears the override", () => {
  const a = O.renameGroup(empty, B, "Cells", "Cell types").lib;
  const b = O.renameGroup(a, B, "Cell types", "Cells").lib;
  assert.strictEqual(O.changes(b), 0);
});
t("renaming a group to a taken name fails, renaming to itself is allowed", () => {
  assert.ok(O.renameGroup(empty, B, "Cells", "proteins").error);
  assert.ok(!O.renameGroup(empty, B, "Cells", "Cells").error);
});
t("renaming a user group updates its icons, including moved built-ins", () => {
  let lib = O.addGroup(empty, B, "Mine").lib;
  lib = O.editIcon(lib, B, I, "rtk", { group: "Mine" }).lib;
  lib.icons.push({ key: "custom-a", name: "A", group: "Mine", ratio: 1, data: "d" });
  const r = O.renameGroup(lib, B, "Mine", "Mine 2");
  assert.deepStrictEqual(O.groups(r.lib, B), [...B, "Mine 2"]);
  const g = Object.fromEntries(O.resolve(r.lib, B, I).tiles.map(x => [x.key, x.group]));
  assert.strictEqual(g.rtk, "Mine 2"); assert.strictEqual(g["custom-a"], "Mine 2");
});
t("moving a built-in icon changes only its group", () => {
  const r = O.editIcon(empty, B, I, "rtk", { group: "Cells" });
  assert.strictEqual(names(r.lib), "rtk:Cells,gpcr:Receptors,kinase:Proteins,cell:Cells");
  assert.strictEqual(O.resolve(r.lib, B, I).tiles[0].edited, true);
});
t("moving an icon back to its group clears the override", () => {
  const a = O.editIcon(empty, B, I, "rtk", { group: "Cells" }).lib;
  assert.strictEqual(O.changes(O.editIcon(a, B, I, "rtk", { group: "Receptors" }).lib), 0);
});
t("moving into a group that does not exist fails", () => {
  assert.ok(O.editIcon(empty, B, I, "rtk", { group: "Nope" }).error);
});
t("editing renames and replaces the image of a built-in icon", () => {
  const r = O.editIcon(empty, B, I, "gpcr", { name: "  G protein receptor ", data: "data:x", ratio: 2 });
  const t0 = O.resolve(r.lib, B, I).tiles.find(x => x.key === "gpcr");
  assert.strictEqual(t0.name, "G protein receptor"); assert.strictEqual(t0.data, "data:x"); assert.strictEqual(t0.ratio, 2);
});
t("editing a user icon changes it in place", () => {
  const lib = { groups: [], icons: [{ key: "custom-a", name: "A", group: "Cells", ratio: 1, data: "d" }] };
  const r = O.editIcon(lib, B, I, "custom-a", { name: "B", group: "Proteins" });
  const x = r.lib.icons[0]; assert.strictEqual(x.name, "B"); assert.strictEqual(x.group, "Proteins");
  assert.strictEqual(O.changes(r.lib), 0);
});
t("a blank icon name is rejected", () => {
  assert.ok(O.editIcon(empty, B, I, "rtk", { name: " " }).error);
});
t("deleting a built-in icon hides it and restore brings it back", () => {
  const a = O.deleteIcon(empty, I, "gpcr").lib;
  assert.strictEqual(O.resolve(a, B, I).tiles.length, 3);
  assert.deepStrictEqual(O.deleted(a, B, I).icons, [{ key: "gpcr", name: "GPCR" }]);
  const b = O.restoreIcon(a, I, "gpcr").lib;
  assert.strictEqual(O.resolve(b, B, I).tiles.length, 4); assert.strictEqual(O.changes(b), 0);
});
t("deleting a user icon removes it, and an unknown key fails", () => {
  const lib = { groups: [], icons: [{ key: "custom-a", name: "A", group: "Cells", ratio: 1, data: "d" }] };
  assert.strictEqual(O.deleteIcon(lib, I, "custom-a").lib.icons.length, 0);
  assert.ok(O.deleteIcon(lib, I, "zzz").error);
});
t("deleting a group with moveTo keeps every icon", () => {
  const r = O.deleteGroup(empty, B, I, "Receptors", "Proteins");
  assert.strictEqual(r.moved, 2);
  assert.deepStrictEqual(O.groups(r.lib, B), ["Proteins", "Cells"]);
  assert.strictEqual(names(r.lib), "rtk:Proteins,gpcr:Proteins,kinase:Proteins,cell:Cells");
});
t("deleting a group without moveTo deletes its icons", () => {
  const lib = { groups: ["Mine"], icons: [{ key: "custom-a", name: "A", group: "Mine", ratio: 1, data: "d" }] };
  const r = O.deleteGroup(lib, B, I, "Mine", null);
  assert.strictEqual(r.lib.icons.length, 0); assert.deepStrictEqual(r.lib.groups, []);
  const s = O.deleteGroup(empty, B, I, "Receptors", null);
  assert.strictEqual(s.deleted, 2); assert.strictEqual(O.resolve(s.lib, B, I).tiles.length, 2);
});
t("a group cannot move its icons into itself or a missing group", () => {
  assert.ok(O.deleteGroup(empty, B, I, "Cells", "Cells").error);
  assert.ok(O.deleteGroup(empty, B, I, "Cells", "Nope").error);
});
t("restoring a deleted built-in group restores its icons as shipped", () => {
  const a = O.deleteGroup(empty, B, I, "Receptors", null).lib;
  assert.deepStrictEqual(O.deleted(a, B, I).groups, [{ orig: "Receptors", name: "Receptors" }]);
  assert.deepStrictEqual(O.deleted(a, B, I).icons, []);
  const b = O.restoreGroup(a, I, "Receptors").lib;
  assert.strictEqual(O.changes(b), 0); assert.strictEqual(O.resolve(b, B, I).tiles.length, 4);
});
t("a deleted built-in group name stays reserved", () => {
  const a = O.deleteGroup(empty, B, I, "Cells", null).lib;
  assert.ok(O.addGroup(a, B, "Cells").error);
});
t("restoring one icon also shows its deleted group", () => {
  const a = O.deleteGroup(empty, B, I, "Receptors", null).lib;
  const b = O.restoreIcon(a, I, "rtk").lib;
  assert.deepStrictEqual(O.groups(b, B), B);
  assert.strictEqual(O.resolve(b, B, I).tiles.filter(x => x.group === "Receptors").length, 1);
});
t("restore all clears built-in changes and keeps user icons and groups", () => {
  let lib = O.addGroup(empty, B, "Mine").lib;
  lib.icons.push({ key: "custom-a", name: "A", group: "Mine", ratio: 1, data: "d" });
  lib = O.deleteIcon(O.renameGroup(lib, B, "Cells", "C").lib, I, "rtk").lib;
  const r = O.restoreAll(lib).lib;
  assert.strictEqual(O.changes(r), 0); assert.deepStrictEqual(r.groups, ["Mine"]); assert.strictEqual(r.icons.length, 1);
});
t("an old library without over still works and unique keys avoid built-ins", () => {
  const old = { groups: ["Mine"], icons: [{ key: "custom-rtk", name: "x", group: "Mine", ratio: 1, data: "d" }] };
  assert.strictEqual(O.resolve(old, B, I).tiles.length, 5);
  assert.strictEqual(O.uniqueKey(old, I, "rtk"), "custom-rtk-2");
});
console.log(pass + " passed");
