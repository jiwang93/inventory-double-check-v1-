export type CustomerField = "box" | "workOrder" | "customer" | "power" | "grade";
export type CustomerRow = Record<CustomerField, string>;
export type ColumnMap = Record<CustomerField, number>;
export type InventoryBox = { box: string; workOrder?: string; power?: string; grade?: string };
export const fields: CustomerField[] = ["box", "workOrder", "customer", "power", "grade"];
export const labels: Record<CustomerField, string> = { box: "箱号", workOrder: "工单号", customer: "客户", power: "功率", grade: "品级" };
export const englishLabels: Record<CustomerField, string> = { box: "Box Number", workOrder: "Work Order", customer: "Customer Name", power: "Power", grade: "Grade" };
export const englishStatus: Record<string, string> = { "已找到": "Found", "未找到": "Not Found", "未找到客户": "Customer Not Found", "信息不完整": "Incomplete", "对应冲突，需核实": "Conflicting Matches" };
export const clean = (value: unknown) => String(value ?? "").trim();
export const keyOf = (value: string) => value.trim().toUpperCase();
const headerKey = (value: unknown) => clean(value).toLowerCase().replace(/[\s._（）()：:#-]/g, "");
const aliases: Record<CustomerField, string[]> = {
  box: ["箱号", "包装箱号", "托盘号", "box", "box no", "box number", "carton no", "pallet no"],
  workOrder: ["工单", "工单号", "工单编号", "生产工单", "生产工单号", "work order", "work order no", "work order number", "wo", "mo"],
  customer: ["客户", "客户名称", "客户简称", "客户名", "customer", "customer name", "client"],
  power: ["功率", "功率档", "功率档位", "标称功率", "额定功率", "功率(W)", "power", "power(w)", "wattage"],
  grade: ["品级", "等级", "箱等级", "产品等级", "质量等级", "组件等级", "grade", "quality grade"],
};
export function detectColumns(row: unknown[]): ColumnMap {
  return Object.fromEntries(fields.map(field => [field, row.findIndex(value => {
    const names = [clean(value), ...clean(value).replace(/[（(][^）)]*[）)]/g, "").split(/[/／]/)];
    return aliases[field].some(alias => names.some(name => headerKey(alias) === headerKey(name)));
  })])) as ColumnMap;
}
export function detectHeader(rows: unknown[][]) {
  let best = 0, score = -1;
  rows.slice(0, 50).forEach((row, index) => {
    const columns = detectColumns(row);
    const current = Object.values(columns).filter(col => col >= 0).length;
    if (current > score) { best = index; score = current; }
  });
  return best;
}
export function parseCustomerRows(rows: unknown[][], header: number, columns: ColumnMap): CustomerRow[] {
  if (columns.box < 0 && columns.workOrder < 0) throw new Error("请选择箱号或工单号列，至少选择一项。");
  if (columns.customer < 0) throw new Error("请选择客户名称列。功率和品级可从系统箱信息读取，无需在客户表中选择。");
  const selected = Object.values(columns).filter(col => col >= 0);
  if (new Set(selected).size !== selected.length) throw new Error("不同字段不能使用同一列，请检查列对应关系。");
  const unique = new Map<string, CustomerRow>();
  rows.slice(header + 1).forEach(row => {
    const record = Object.fromEntries(fields.map(field => [field, columns[field] < 0 ? "" : clean(row[columns[field]])])) as CustomerRow;
    if (!record.box && !record.workOrder) return;
    unique.set(JSON.stringify(fields.map(field => record[field])), record);
  });
  if (!unique.size) throw new Error("所选表头下没有有效记录，请检查工作表和表头行。");
  return [...unique.values()];
}
export function queryBoxes(input: string) {
  return [...new Set(input.split(/[\s,，;；、]+/u).map(value => keyOf(value.replace(/^["'“”]+|["'“”]+$/g, ""))).filter(Boolean))];
}
export function createCustomerIndex(rows: CustomerRow[], inventory: InventoryBox[]) {
  const boxes = new Map<string, CustomerRow[]>(), orders = new Map<string, CustomerRow[]>();
  const inventoryByBox = new Map<string, InventoryBox[]>();
  const add = (map: Map<string, CustomerRow[]>, key: string, row: CustomerRow) => {
    if (key) map.set(keyOf(key), [...(map.get(keyOf(key)) ?? []), row]);
  };
  rows.forEach(row => { add(boxes, row.box, row); if (!row.box) add(orders, row.workOrder, row); });
  inventory.forEach(row => {
    const key = keyOf(row.box);
    if (!inventoryByBox.has(key)) inventoryByBox.set(key, []);
    inventoryByBox.get(key)!.push(row);
  });
  return (box: string) => {
    const stock = inventoryByBox.get(keyOf(box)) ?? [];
    const orderIds = [...new Set(stock.map(row => row.workOrder ?? "").filter(Boolean))];
    const direct = boxes.get(keyOf(box)) ?? [];
    const candidates: CustomerRow[] = stock.length ? stock.flatMap(item => {
      const matches = [...direct, ...(orders.get(keyOf(item.workOrder ?? "")) ?? [])];
      if (!matches.length) return [{ box, workOrder: item.workOrder ?? "", customer: "", power: item.power ?? "", grade: item.grade ?? "" }];
      return matches.map(row => ({ ...row, box, workOrder: item.workOrder || row.workOrder, power: item.power || row.power, grade: item.grade || row.grade }));
    }) : direct;
    const unique = [...new Map(candidates.map(row => [JSON.stringify([keyOf(row.customer), keyOf(row.power), keyOf(row.grade)]), row])).values()];
    const status = !unique.length ? "未找到" : unique.length > 1 ? "对应冲突，需核实" : !unique[0].customer ? "未找到客户" : !unique[0].power || !unique[0].grade ? "信息不完整" : "已找到";
    return { box, rows: unique, status, workOrders: [...new Set([...orderIds, ...candidates.map(row => row.workOrder).filter(Boolean)])].join(" / ") };
  };
}
