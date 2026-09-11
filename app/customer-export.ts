import * as XLSX from "xlsx";
import { englishStatus } from "./customer-data";
import type { createCustomerIndex } from "./customer-data";

type Result = ReturnType<ReturnType<typeof createCustomerIndex>>;

export function createQueryWorkbook(results: Result[]) {
  const rows = results.flatMap(result => (result.rows.length ? result.rows : [null]).map(row => [
    result.box, row?.workOrder || result.workOrders || "", row?.customer || "",
    row?.power || "", row?.grade || "", `${englishStatus[result.status] ?? result.status} / ${result.status}`,
  ]));
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Box Number / 箱号", "Work Order / 工单号", "Customer Name / 客户名称", "Power / 功率", "Grade / 品级", "Query Status / 查询状态"],
    ...rows,
  ]);
  // Values remain strings: preserve long IDs, leading zeros, and literal text.
  sheet["!cols"] = [{ wch: 25 }, { wch: 24 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 40 }];
  sheet["!autofilter"] = { ref: sheet["!ref"]! };
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Box Query Results");
  return book;
}

export function downloadQueryResults(results: Result[]) {
  if (!results.length) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  XLSX.writeFile(createQueryWorkbook(results), `RUNERGY_Box_Query_${stamp}.xlsx`);
}
