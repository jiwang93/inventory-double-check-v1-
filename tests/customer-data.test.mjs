import test from "node:test";
import assert from "node:assert/strict";
import { createCustomerIndex, detectColumns, detectHeader, parseCustomerRows, queryBoxes } from "../app/customer-data.ts";

const row = (values = {}) => ({ box: "", workOrder: "", customer: "客户甲", power: "650W", grade: "A", ...values });
test("detects title rows and preserves text identifiers and power units", () => {
  const rows = [["客户工单表"], ["箱号", "工单号", "客户名称", "功率(W)", "品级"], ["000123456789012345", "0008", "客户甲", "650W", "A"]];
  const header = detectHeader(rows);
  assert.equal(header, 1);
  assert.deepEqual(parseCustomerRows(rows, header, detectColumns(rows[header])), [row({ box: "000123456789012345", workOrder: "0008" })]);
});
test("rejects missing and duplicate mappings", () => {
  const rows = [["箱号", "客户", "功率", "品级"], ["B1", "甲", "650", "A"]];
  assert.throws(() => parseCustomerRows(rows, 0, { box: 0, workOrder: -1, customer: -1, power: 2, grade: 3 }), /客户/);
  assert.throws(() => parseCustomerRows(rows, 0, { box: 0, workOrder: -1, customer: 1, power: 1, grade: 3 }), /同一列/);
});
test("batch input accepts Excel whitespace and Chinese separators without fuzzy matching", () => {
  assert.deepEqual(queryBoxes('b1\r\nB2\tB1，B3;"0004"'), ["B1", "B2", "B3", "0004"]);
  const lookup = createCustomerIndex([row({ box: "B10" })], []);
  assert.equal(lookup("B1").status, "未找到");
});
test("joins box to work order while retaining missing and incomplete results", () => {
  const lookup = createCustomerIndex([row({ workOrder: "WO1" }), row({ box: "B2", grade: "" })], [{ box: "B1", workOrder: "wo1" }]);
  assert.equal(lookup("b1").rows[0].customer, "客户甲");
  assert.equal(lookup("B1").status, "已找到");
  assert.equal(lookup("B2").status, "信息不完整");
  assert.equal(lookup("B3").status, "未找到");
});
test("does not assign a box-specific record to every box in the same work order", () => {
  const lookup = createCustomerIndex([row({ box: "B1", workOrder: "W1" })], [{ box: "B2", workOrder: "W1" }]);
  assert.equal(lookup("B2").status, "未找到客户");
});
test("deduplicates identical matches and exposes competing mappings", () => {
  const a = row({ box: "B1" });
  assert.equal(createCustomerIndex([a, a], [])("B1").rows.length, 1);
  const lookup = createCustomerIndex([a, row({ workOrder: "W1", customer: "客户乙" })], [{ box: "B1", workOrder: "W1" }]);
  assert.equal(lookup("B1").status, "对应冲突，需核实");
  assert.equal(lookup("B1").rows.length, 2);
});

test("customer-only template links each box's own power and grade", () => {
  const rows = [["序号 (可留空)", "工单号 / 销售单号 (必填-列B)", "辅助信息列1 (可留空)", "辅助信息列2 (可留空)", "辅助信息列3 (可留空)", "客户简称 / 客户名称 (必填-列F)"], [1, "ZJ22683721", "", "", "", "Clenera3"]];
  const columns = detectColumns(rows[0]);
  assert.equal(columns.box, -1);
  assert.equal(columns.workOrder, 1);
  assert.equal(columns.customer, 5);
  const mapping = parseCustomerRows(rows, 0, columns);
  const lookup = createCustomerIndex(mapping, [
    { box: "B1", workOrder: "ZJ22683721", power: "595", grade: "A" },
    { box: "B2", workOrder: "ZJ22683721", power: "590", grade: "B" },
  ]);
  assert.deepEqual(lookup("B1").rows, [row({box: "B1", workOrder: "ZJ22683721", customer: "Clenera3", power: "595"})]);
  assert.equal(lookup("B2").rows[0].power, "590");
  assert.equal(lookup("B2").rows[0].grade, "B");
  assert.equal(lookup("B2").status, "已找到");
  assert.deepEqual(detectColumns(["箱号", "功率档", "工单号", "箱等级"]), {box:0, workOrder:2, customer:-1, power:1, grade:3});
});
test("unmapped customers retain known box attributes and duplicate inventory conflicts stay visible", () => {
  const stock = [{box:"B1", workOrder:"W1", power:"595", grade:"A"}];
  const missing = createCustomerIndex([], stock)("B1");
  assert.equal(missing.status, "未找到客户");
  assert.equal(missing.rows[0].power, "595");
  assert.equal(missing.rows[0].grade, "A");
  const lookup = createCustomerIndex([row({workOrder:"W1"})], [...stock, {...stock[0],power:"590"}]);
  assert.equal(lookup("B1").status, "对应冲突，需核实");
});
