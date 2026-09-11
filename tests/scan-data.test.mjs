import test from "node:test";
import assert from "node:assert/strict";
import { parseScanRows, scanColumns, selectScanSheet } from "../app/scan-data.ts";

test("merged workbook selects the main scans instead of later notes or out-of-scope records", () => {
  const rows = [["location", "box NO"], ["C01", "B1"]];
  assert.equal(selectScanSheet([{ name: "库位箱号", rows }, { name: "原表备注", rows }, { name: "范围外记录", rows }]), "库位箱号");
  assert.equal(selectScanSheet([{ name: "0909", rows }, { name: "0911", rows }, { name: "原表备注", rows }]), "0911");
  assert.equal(selectScanSheet([{ name: "范围外记录", rows }]), null);
  assert.equal(selectScanSheet([{ name: "库位箱号", rows: rows.slice(0, 1) }, { name: "0911", rows }]), "0911");
});

test("imports location / box NO without altering box identifiers or duplicates", () => {
  assert.deepEqual(parseScanRows([["location", "box NO"], ["C60", "000123456789012345"], ["C60", "000123456789012345"]]), [
    { location: "C60", box: "000123456789012345" },
    { location: "C60", box: "000123456789012345" },
  ]);
});

test("accepts Chinese headers and either column order", () => {
  for (const location of ["位置", "库位", "库位名称", "扫描库位", "实盘库位", "查验库位名称"]) {
    assert.deepEqual(parseScanRows([["箱号", location], ["BOX1", "D58"]]), [{ box: "BOX1", location: "D58" }]);
  }
});

test("preserves existing scan format, title rows and merged-location fill down", () => {
  assert.deepEqual(parseScanRows([["Daily Scan"], ["Scanned Box N.", "Scanned Location"], ["B1", "C04"], ["B2", ""], [], ["", "D58"], ["B3", ""]]), [
    { box: "B1", location: "C04" }, { box: "B2", location: "C04" }, { box: "B3", location: "D58" },
  ]);
});

test("worksheet detection accepts the new format and rejects unrelated sheets", () => {
  const sheets = [[["notes"]], [[" LOCATION ", "Box No."]], [["库位", "数量"]]];
  assert.deepEqual(sheets.map(rows => !!scanColumns(rows)), [false, true, false]);
  assert.throws(() => parseScanRows(sheets[2]), /找不到箱号和库位列/);
});
