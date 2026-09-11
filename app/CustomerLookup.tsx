"use client";

import { useMemo, useRef, useState } from "react";
import { createCustomerIndex, detectColumns, detectHeader, fields, labels, englishLabels, englishStatus, parseCustomerRows, queryBoxes } from "./customer-data";
import type { ColumnMap, CustomerRow, InventoryBox } from "./customer-data";

type Sheet = { name: string; rows: unknown[][] };
const PAGE_SIZE = 100;

export default function CustomerLookup({ inventory }: { inventory: InventoryBox[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [header, setHeader] = useState(0);
  const [columns, setColumns] = useState<ColumnMap>(detectColumns([]));
  const [pendingName, setPendingName] = useState("");
  const [source, setSource] = useState("");
  const [records, setRecords] = useState<CustomerRow[]>([]);
  const [message, setMessage] = useState("Import a customer work order file to create the lookup table.|请导入客户工单表，建立客户对应关系。");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [mapPage, setMapPage] = useState(0);
  const lookup = useMemo(() => createCustomerIndex(records, inventory), [records, inventory]);
  const results = useMemo(() => queryBoxes(query).map(lookup), [query, lookup]);
  const sheet = sheets[sheetIndex];
  const preview = useMemo(() => {
    if (!sheet) return { rows: [], error: "" };
    try { return { rows: parseCustomerRows(sheet.rows, header, columns), error: "" }; }
    catch (error) { return { rows: [], error: (error as Error).message }; }
  }, [sheet, header, columns]);

  function selectSheet(index: number, items = sheets) {
    const nextHeader = detectHeader(items[index].rows);
    setSheetIndex(index); setHeader(nextHeader); setColumns(detectColumns(items[index].rows[nextHeader] ?? []));
  }
  async function read(file: File) {
    if (busy) return;
    setBusy(true); setMessage("Reading customer work orders…|正在读取客户工单表…");
    try {
      if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error("Use an .xlsx, .xls or .csv file. / 请选择 Excel 或 CSV 文件。");
      if (file.size > 25 * 1024 * 1024) throw new Error("File exceeds 25 MB. Please split it before importing. / 文件超过 25 MB，请拆分后导入。");
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const items = workbook.SheetNames.map(name => {
        const ws = workbook.Sheets[name];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: false, blankrows: true });
        // Only expand actual merged cells; never carry values into unrelated blank rows.
        for (const merge of ws["!merges"] ?? []) {
          const value = rows[merge.s.r]?.[merge.s.c] ?? "";
          for (let r = merge.s.r; r <= merge.e.r && r < rows.length; r++) {
            for (let c = merge.s.c; c <= merge.e.c; c++) {
              if (rows[r]) rows[r][c] = value;
            }
          }
        }
        return { name, rows };
      }).filter(item => item.rows.length);
      if (!items.length) throw new Error("No readable data found. / 文件没有可读取的数据。");
      const preferred = items.findIndex(item => {
        const found = detectColumns(item.rows[detectHeader(item.rows)] ?? []);
        return found.customer >= 0 && (found.box >= 0 || found.workOrder >= 0);
      });
      setSheets(items); selectSheet(Math.max(0, preferred), items); setPendingName(file.name);
      setMessage("Check the worksheet and columns, then select Build Customer Map. Queries use the current map until confirmed.|请核对工作表和列对应关系，再点击建立客户对应表。确认前仍使用当前对应表。");
    } catch (error) { setMessage(`Import failed. The current map is unchanged.|读取失败：${(error as Error).message} 已导入的对应表保持不变。`); }
    finally { setBusy(false); }
  }
  function apply() {
    if (preview.error || !preview.rows.length) return;
    setRecords(preview.rows); setSource(`${pendingName} · ${sheet.name}`); setSheets([]); setPage(0); setMapPage(0);
    setMessage(`Customer map ready: ${preview.rows.length.toLocaleString()} records. Duplicates removed; conflicts flagged.|已建立 ${preview.rows.length.toLocaleString()} 条客户对应记录，已去重并保留冲突提示。`);
  }

  async function exportQuery() {
    try {
      const { downloadQueryResults } = await import("./customer-export");
      downloadQueryResults(results);
      setMessage(`Excel download started: ${results.length} boxes, all result pages included.|已开始下载 ${results.length} 个箱号的全部查询结果。`);
    } catch { setMessage("Download failed. Please try again.|下载失败，请重试。"); }
  }

  return <section className="customer-panel results" aria-labelledby="customer-title">
    <div className="results-head"><div><p className="eyebrow">CUSTOMER LOOKUP</p><h2 id="customer-title">Customer &amp; Box Lookup</h2><p className="section-zh">客户对应与箱号查询</p></div></div>
    <div className="customer-body">
      <button type="button" disabled={busy} className={`upload-card customer-upload${dragging ? " dragging" : ""}`}
        onClick={() => input.current?.click()}
        onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }}
        onDragLeave={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
        onDrop={event => { event.preventDefault(); setDragging(false); if (busy) return; if (event.dataTransfer.files.length !== 1) { setMessage("Drop one customer file at a time.|请一次拖入一个客户工单文件。"); return; } void read(event.dataTransfer.files[0]); }}>
        <span className="step">03</span><span className="file-icon">▤</span><span className="upload-copy"><b>{busy ? "Reading…" : "Customer Work Orders"}</b><small>客户工单表</small><span className="upload-hint"><Dual en={dragging ? "Drop file here" : "Drag Excel / CSV here or click to select"} zh={dragging ? "松开即可读取" : "拖拽文件或点击选择"} /></span></span>
      </button>
      <input ref={input} type="file" hidden accept=".xlsx,.xls,.csv" onChange={event => { const file = event.target.files?.[0]; if (file) void read(file); event.target.value = ""; }} />
      <p className="customer-message" role="status"><Dual en={message.includes("|") ? message.split("|")[0] : "Customer map status"} zh={message.includes("|") ? message.split("|").slice(1).join("|") : message} /></p>
      {sheet && <div className="customer-mapping">
        <p><b><Dual en={`Selected file: ${pendingName}`} zh="待导入文件" /></b></p>
        <div className="customer-columns"><label><Dual en="Worksheet" zh="工作表" /><select value={sheetIndex} onChange={event => selectSheet(Number(event.target.value))}>{sheets.map((item, index) => <option key={item.name} value={index}>{item.name}</option>)}</select></label>
          <label><Dual en="Header Row" zh="表头所在行" /><input type="number" min={1} max={sheet.rows.length} value={header + 1} onChange={event => { const next = Math.min(sheet.rows.length - 1, Math.max(0, Number(event.target.value) - 1)); setHeader(next); setColumns(detectColumns(sheet.rows[next] ?? [])); }} /></label></div>
        <div className="customer-columns">{fields.map(field => <label key={field}><Dual en={`${englishLabels[field]}${field === "customer" ? " *" : field === "power" || field === "grade" ? " (optional)" : " (select at least one)"}`} zh={labels[field]} /><select value={columns[field]} onChange={event => setColumns({ ...columns, [field]: Number(event.target.value) })}><option value={-1}>{field === "power" || field === "grade" ? "Use System Inventory / 从系统箱信息读取" : "Select Column / 请选择列"}</option>{Array.from({ length: (sheet.rows[header] ?? []).length }, (_, index) => <option key={index} value={index}>{index + 1} · {String(sheet.rows[header][index] || "Unnamed Column / 未命名列")}</option>)}</select></label>)}</div>
        <p className="customer-help"><Dual en="Select Work Order and Customer Name. Power and grade come from System Inventory (step 01). Keep box and work order numbers as text in Excel." zh="客户表只需工单号和客户名称；功率、品级从第 01 区系统箱信息读取。箱号、工单号请在 Excel 中保存为文本。" /></p>
        {preview.error ? <p role="alert" className="danger"><Dual en="Check the column selection: select a box or work order column and a customer column; use a different column for each field." zh={preview.error} /></p> : <><p><Dual en={`Preview: first 5 of ${preview.rows.length.toLocaleString()} records. Confirm to replace the current map.`} zh="预览前 5 条，确认后替换当前对应表。" /></p><MappingTable rows={preview.rows.slice(0, 5)} /></>}
        <div className="customer-actions"><button type="button" className="export" disabled={!!preview.error || !preview.rows.length || busy} onClick={apply}><Dual en="Build Customer Map" zh="建立客户对应表" /></button><button type="button" onClick={() => { setSheets([]); setMessage("Import cancelled. The current map is unchanged.|已取消导入，当前对应表保持不变。"); }}><Dual en="Cancel" zh="取消" /></button></div>
      </div>}
      <div className="customer-summary"><b><Dual en={`Customer Map: ${records.length.toLocaleString()} records`} zh="当前客户对应表" /></b><span>{source || "No file imported / 尚未导入"}</span></div>
      <p className="customer-help"><Dual en={`Box → Work Order → Customer. Power and grade use System Inventory. ${inventory.filter(row => row.workOrder).length.toLocaleString()} linked box records · ${inventory.filter(row => row.power).length.toLocaleString()} with power · ${inventory.filter(row => row.grade).length.toLocaleString()} with grade. Re-import files after refreshing or changing devices.`} zh="箱号通过工单关联客户，功率和品级取自系统箱信息。刷新或换电脑后请重新导入文件。" /></p>
      {!!records.length && records.some(row => !row.box && row.workOrder) && !inventory.some(row => row.workOrder) && <p className="customer-prerequisite" role="alert"><Dual en="System Inventory is missing work orders. Import your box inventory in step 01 to match customers. The customer map alone cannot link these boxes." zh="当前系统箱信息没有工单号。请在第 01 区重新导入真实箱信息；仅上传客户表还无法关联箱号。" /></p>}
      {!!records.length && <details><summary><Dual en="View Customer Map" zh="查看客户对应表" /></summary><MappingTable rows={records.slice(mapPage * PAGE_SIZE, (mapPage + 1) * PAGE_SIZE)} /><Pagination page={mapPage} total={records.length} change={setMapPage} /></details>}
      <label className="customer-query" htmlFor="customer-boxes"><Dual en="Paste Box Numbers" zh="粘贴一个或多个箱号" /><textarea id="customer-boxes" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder={"One box per line, or paste a column from Excel. / 每行一个箱号，也可粘贴 Excel 一列。"} rows={4} /></label>
      <div className="customer-summary" aria-live="polite"><Dual en={results.length ? `${results.length} boxes · ${results.filter(row => row.status === "已找到").length} found · ${results.filter(row => row.status !== "已找到").length} to review` : "Results appear automatically. Duplicate box numbers are removed."} zh={results.length ? `${results.length} 个箱号 · 已找到 ${results.filter(row => row.status === "已找到").length} · 待核实 ${results.filter(row => row.status !== "已找到").length}` : "粘贴后自动查询，重复箱号只显示一次。"} /><div className="customer-actions"><button type="button" onClick={() => { setQuery(""); setPage(0); }} disabled={!query}><Dual en="Clear" zh="清空查询" /></button><button type="button" className="export" onClick={exportQuery} disabled={!records.length || !results.length}><Dual en="Download Excel" zh="下载全部查询结果" /></button></div></div>
      {!records.length ? <div className="empty"><Dual en="Import a customer file and build the map to get started." zh="请先导入并建立客户对应表。" /></div> : !results.length ? <div className="empty"><Dual en="Ready for box numbers" zh="等待输入箱号" /></div> : <div className="table-wrap"><table className="customer-table"><thead><tr>{fields.map(field => <th key={field}><Dual en={englishLabels[field]} zh={labels[field]} /></th>)}<th><Dual en="Query Status" zh="查询状态" /></th></tr></thead><tbody>{results.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).flatMap(result => (result.rows.length ? result.rows : [null]).map((row, index) => <tr key={`${result.box}-${index}`}><td>{result.box}</td><td>{row?.workOrder || result.workOrders || "—"}</td><td>{row?.customer || "—"}</td><td>{row?.power || "—"}</td><td>{row?.grade || "—"}</td><td><span className={`status ${result.status === "已找到" ? "match" : result.status === "未找到" ? "missing" : "duplicate"}`}><Dual en={englishStatus[result.status] ?? result.status} zh={result.status} /></span></td></tr>))}</tbody></table></div>}
      {!!records.length && <Pagination page={page} total={results.length} change={setPage} />}
    </div>
  </section>;
}

function MappingTable({ rows }: { rows: CustomerRow[] }) {
  return <div className="table-wrap"><table className="customer-table"><thead><tr>{fields.map(field => <th key={field}><Dual en={englishLabels[field]} zh={labels[field]} /></th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{fields.map(field => <td key={field}>{row[field] || "—"}</td>)}</tr>)}</tbody></table></div>;
}
function Pagination({ page, total, change }: { page: number; total: number; change: (page: number) => void }) {
  if (total <= PAGE_SIZE) return null;
  return <div className="customer-actions"><button type="button" disabled={page === 0} onClick={() => change(page - 1)}><Dual en="Previous" zh="上一页" /></button><span><Dual en={`Page ${page + 1} of ${Math.ceil(total / PAGE_SIZE)}`} zh={`第 ${page + 1} / ${Math.ceil(total / PAGE_SIZE)} 页`} /></span><button type="button" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => change(page + 1)}><Dual en="Next" zh="下一页" /></button></div>;
}

function Dual({ en, zh }: { en: string; zh: string }) {
  return <span className="customer-dual">{en}<small>{zh}</small></span>;
}
