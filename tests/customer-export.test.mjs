import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { createQueryWorkbook } from "../app/customer-export.ts";

test("Excel exports all pages, missing boxes, conflicts, and literal identifiers", () => {
  const results = Array.from({ length: 101 }, (_, i) => ({ box: `0000000000000000${i}`, workOrders: "001", status: "未找到", rows: [] }));
  results.push({ box: "000123456789012345", workOrders: "001", status: "对应冲突，需核实", rows: [
    {workOrder:"001",customer:"=1+1",power:"595",grade:"A"},
    {workOrder:"001",customer:"Client B",power:"590",grade:"B"},
  ]});
  const bytes = XLSX.write(createQueryWorkbook(results), {type:"buffer",bookType:"xlsx"});
  const book = XLSX.read(bytes, {type:"buffer"});
  const sheet = book.Sheets["Box Query Results"];
  const rows = XLSX.utils.sheet_to_json(sheet, {header:1,defval:""});
  assert.equal(rows.length, 104);
  assert.equal(rows[101][0], "0000000000000000100");
  assert.equal(rows[102][0], "000123456789012345");
  assert.equal(rows[102][1], "001");
  assert.equal(rows[102][2], "=1+1");
  assert.equal(sheet.C103.t, "s");
  assert.equal(sheet.C103.f, undefined);
  assert.match(rows[1][5], /Not Found/);
  assert.match(rows[103][5], /Conflicting Matches/);
});
