"use client";

import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";

import CustomerLookup from "./CustomerLookup";
import { detectColumns } from "./customer-data";

type BoxRow = { box: string; location: string; workOrder?: string; power?: string; grade?: string };
type CheckRow = { box: string; systemLocation: string; scannedLocation: string; scans: number; status: "match" | "misplaced" | "missing" | "unregistered" | "duplicate"; action: string; actionZh: string };

const demoSystem: BoxRow[] = [
  { box: "H350126090227220067", location: "C04" }, { box: "H350126090227220065", location: "C04" },
  { box: "H350126090237210228", location: "E58" }, { box: "H350126090137210083", location: "E07" },
  { box: "H350126090227220042", location: "C05" }, { box: "R326J0500074", location: "C09" },
];
const demoScan: BoxRow[] = [
  { box: "H350126090227220067", location: "C05" }, { box: "H350126090227220065", location: "C05" },
  { box: "H350126090237210228", location: "F12" }, { box: "H350126090137210083", location: "F07" },
  { box: "H350126090227220042", location: "C05" }, { box: "H350126090227220042", location: "C05" },
  { box: "H350126090237210230", location: "F12" },
];

const text = (value: unknown) => String(value ?? "").trim();
const norm = (value: string) => value.trim().toUpperCase();
const boxHeaders = ["箱号", "scanned box n.", "扫描箱号", "box", "box no", "box number", "c19"];
const scanLocHeaders = ["scanned location", "查验库位名称", "扫描库位", "实盘库位"];
const systemLocHeaders = ["库位编码", "库位名称", "system location", "location", "仓位", "货位"];

function headerIndex(rows: unknown[][], aliases: string[]) {
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const c = rows[r].findIndex((v) => aliases.includes(text(v).toLowerCase()));
    if (c >= 0) return { row: r, col: c };
  }
  return null;
}

function parseRows(rows: unknown[][], kind: "system" | "scan") {
  const boxCell = headerIndex(rows, kind === "system" ? ["箱号", "box", "box no", "box number"] : boxHeaders);
  const locCell = headerIndex(rows, kind === "system" ? systemLocHeaders : scanLocHeaders);
  if (!boxCell || !locCell) throw new Error(kind === "system" ? "Could not find Box Number and Location columns · 找不到箱号和库位列" : "Could not find Scanned Box and Scanned Location columns · 找不到扫描箱号和扫描库位列");
  const start = Math.max(boxCell.row, locCell.row) + 1;
  const metadata = detectColumns(rows[boxCell.row]);
  const workOrderCol = kind === "system" ? metadata.workOrder : -1;
  let currentLocation = "";
  const result: BoxRow[] = [];
  for (let i = start; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const location = text(row[locCell.col]);
    if (location) currentLocation = location;
    const box = text(row[boxCell.col]);
    if (box) result.push({ box, location: kind === "scan" ? currentLocation : location, workOrder: workOrderCol >= 0 ? text(row[workOrderCol]) : undefined, power: kind === "system" && metadata.power >= 0 ? text(row[metadata.power]) : undefined, grade: kind === "system" && metadata.grade >= 0 ? text(row[metadata.grade]) : undefined });
  }
  return result;
}

function reconcile(system: BoxRow[], scan: BoxRow[]): CheckRow[] {
  const sys = new Map(system.map((r) => [norm(r.box), r]));
  const scannedLocations = new Set(scan.map((r) => norm(r.location)).filter(Boolean));
  const scanGroups = new Map<string, BoxRow[]>();
  scan.forEach((r) => scanGroups.set(norm(r.box), [...(scanGroups.get(norm(r.box)) ?? []), r]));
  const output: CheckRow[] = [];
  scanGroups.forEach((items, key) => {
    const scanned = items[items.length - 1]; const systemRow = sys.get(key);
    let status: CheckRow["status"] = "match";
    if (items.length > 1) status = "duplicate";
    else if (!systemRow) status = "unregistered";
    else if (norm(systemRow.location) !== norm(scanned.location)) status = "misplaced";
    const action = status === "match" ? "No action needed" : status === "duplicate" ? `Review duplicate scan (${items.length} times)` : status === "unregistered" ? "Verify box number, then register inbound" : `Verify physically, then move system location ${systemRow!.location} to ${scanned.location}`;
    const actionZh = status === "match" ? "无需处理" : status === "duplicate" ? `复核重复扫描（${items.length} 次）` : status === "unregistered" ? "核对箱号，确认后补录入库" : `确认实物后，将系统库位 ${systemRow!.location} 调整为 ${scanned.location}`;
    output.push({ box: scanned.box, systemLocation: systemRow?.location ?? "—", scannedLocation: scanned.location || "—", scans: items.length, status, action, actionZh });
  });
  system.forEach((r) => {
    if (scannedLocations.has(norm(r.location)) && !scanGroups.has(norm(r.box))) output.push({ box: r.box, systemLocation: r.location, scannedLocation: "—", scans: 0, status: "missing", action: "Location scanned; find box or adjust outbound", actionZh: "库位内未发现此箱" });
  });
  const priority: Record<CheckRow["status"], number> = { misplaced: 0, unregistered: 1, duplicate: 2, missing: 3, match: 4 };
  return output.sort((a, b) => priority[a.status] - priority[b.status] || a.box.localeCompare(b.box));
}

const statusText: Record<CheckRow["status"], string> = { match: "Matched", misplaced: "Wrong location", missing: "Not scanned", unregistered: "Not in system", duplicate: "Duplicate" };
const statusZh: Record<CheckRow["status"], string> = { match: "库位一致", misplaced: "库位不符", missing: "未扫描", unregistered: "系统无此箱", duplicate: "重复扫描" };

export default function Home() {
  const [system, setSystem] = useState<BoxRow[]>(demoSystem); const [scan, setScan] = useState<BoxRow[]>(demoScan);
  const [systemFile, setSystemFile] = useState("System inventory · 演示"); const [scanFile, setScanFile] = useState("Daily scan 0904 · 演示"); const [scanSheet, setScanSheet] = useState("Demo · 演示");
  const [filter, setFilter] = useState("all"); const [query, setQuery] = useState(""); const [notice, setNotice] = useState("Demo data loaded · 已载入与你文件结构一致的演示数据");
  const [dragTarget, setDragTarget] = useState<"system" | "scan" | null>(null);
  const systemInput = useRef<HTMLInputElement>(null); const scanInput = useRef<HTMLInputElement>(null);
  const results = useMemo(() => reconcile(system, scan), [system, scan]);
  const visible = results.filter((r) => (filter === "all" || r.status === filter) && `${r.box}${r.systemLocation}${r.scannedLocation}`.toLowerCase().includes(query.toLowerCase()));
  const count = (status: CheckRow["status"]) => results.filter((r) => r.status === status).length;
  const issues = results.filter((r) => r.status !== "match").length; const accuracy = results.length ? Math.round(count("match") / results.length * 100) : 0;

  async function readFile(file: File, kind: "system" | "scan") {
    try {
      if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error("Please use Excel or CSV · 请选择 Excel 或 CSV 文件");
      const XLSX = await import("xlsx"); const wb = XLSX.read(await file.arrayBuffer(), { type: "array" }); let sheetName = wb.SheetNames[0];
      if (kind === "scan") {
        const valid = wb.SheetNames.filter((name) => { const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: "" }); return !!headerIndex(rows, boxHeaders) && !!headerIndex(rows, scanLocHeaders); });
        sheetName = valid[valid.length - 1] ?? sheetName;
      }
      const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: "", raw: false }); const parsed = parseRows(rows, kind);
      if (!parsed.length) throw new Error("No valid box numbers found · 没有识别到有效箱号");
      if (kind === "system") { setSystem(parsed); setSystemFile(file.name); } else { setScan(parsed); setScanFile(file.name); setScanSheet(sheetName); }
      setNotice(`Loaded ${file.name}${kind === "scan" ? ` · Sheet ${sheetName}` : ""} · ${parsed.length.toLocaleString()} records / 已读取 ${parsed.length.toLocaleString()} 条记录`);
    } catch (error) { setNotice(`File error · 读取失败：${error instanceof Error ? error.message : "Please check the file format · 请检查文件格式"}`); }
  }
  function onFile(event: ChangeEvent<HTMLInputElement>, kind: "system" | "scan") { const file = event.target.files?.[0]; if (file) readFile(file, kind); event.target.value = ""; }
  function onDragOver(event: DragEvent<HTMLButtonElement>, kind: "system" | "scan") {
    event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragTarget(kind);
  }
  function onDragLeave(event: DragEvent<HTMLButtonElement>) {
    if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragTarget(null);
  }
  function onDrop(event: DragEvent<HTMLButtonElement>, kind: "system" | "scan") {
    event.preventDefault(); setDragTarget(null);
    if (event.dataTransfer.files.length !== 1) { setNotice("Please drop one file at a time · 每个区域请一次拖入一个文件"); return; }
    void readFile(event.dataTransfer.files[0], kind);
  }
  async function exportResults() { const XLSX = await import("xlsx"); const rows = results.filter((r) => r.status !== "match").map((r) => ({ "Box Number 箱号": r.box, "System Location 系统库位": r.systemLocation, "Scanned Location 扫描库位": r.scannedLocation, "Scan Count 扫描次数": r.scans, "Issue Type 差异类型": `${statusText[r.status]} / ${statusZh[r.status]}`, "Recommended Action 处理建议": `${r.action} / ${r.actionZh}` })); const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "Reconciliation 对账"); XLSX.writeFile(book, `box-reconciliation_${scanSheet}.xlsx`); }

  return <main><aside className="sidebar"><div className="brand"><span>R</span><div><b>RUNERGY</b><small>Daily Inbound Verification · 每日入库核验</small></div></div><nav><a className="active">⌁ <span>Box Reconciliation<small>逐箱核对</small></span></a><a>▦ <span>Count History<small>盘点历史</small></span></a><a>◎ <span>Location Analysis<small>库位分析</small></span></a><a>⚙ <span>Field Settings<small>字段设置</small></span></a></nav><div className="side-card"><div className="pulse"/><b>Processed on this device</b><small>数据仅在本机处理</small><p>Your inventory files never leave this browser.<br/><small>上传文件不会离开浏览器。</small></p></div><div className="operator"><span>JW</span><div><b>Warehouse Admin</b><small>仓库管理员 · Daily Count</small></div></div></aside>
    <section className="workspace"><header><div><p className="eyebrow">BOX INVENTORY RECONCILIATION <small>逐箱库存核对</small></p><h1>Every box, in the right place.</h1><p className="title-zh">每一个箱，都在正确的位置。</p><p className="subtitle">Connect system inventory to physical scans by box number.<small>通过箱号连接系统库存与现场扫描，定位错库位、漏扫与未入账。</small></p></div><div className="date"><small>SCAN WORKSHEET<br/><i>扫描工作表</i></small><b>{scanSheet}</b></div></header>
      <div className="upload-grid"><button className={`upload-card${dragTarget === "system" ? " dragging" : ""}`} onDragOver={(e) => onDragOver(e, "system")} onDragLeave={onDragLeave} onDrop={(e) => onDrop(e, "system")} onClick={() => systemInput.current?.click()}><span className="step">01</span><span className="file-icon">▤</span><span className="upload-copy"><b>System Box Inventory</b><small>系统箱信息 · {systemFile}</small><span className="upload-hint">{dragTarget === "system" ? "Drop file here · 松开即可导入" : "Drag a file here or click to select · 拖拽文件或点击选择"}</span></span><span className="change">CHANGE 更换 →</span></button><button className={`upload-card scan${dragTarget === "scan" ? " dragging" : ""}`} onDragOver={(e) => onDragOver(e, "scan")} onDragLeave={onDragLeave} onDrop={(e) => onDrop(e, "scan")} onClick={() => scanInput.current?.click()}><span className="step">02</span><span className="file-icon">⌗</span><span className="upload-copy"><b>Daily Physical Scan</b><small>每日现场扫描 · {scanFile}</small><span className="upload-hint">{dragTarget === "scan" ? "Drop file here · 松开即可导入" : "Drag a file here or click to select · 拖拽文件或点击选择"}</span></span><span className="change">CHANGE 更换 →</span></button><input ref={systemInput} hidden type="file" accept=".xlsx,.xls,.csv" onChange={(e) => onFile(e, "system")}/><input ref={scanInput} hidden type="file" accept=".xlsx,.xls,.csv" onChange={(e) => onFile(e, "scan")}/></div><p className="notice" role="status">● {notice}</p>
      <CustomerLookup inventory={system} />
      <div className="metrics"><article><small>UNIQUE BOXES <i>扫描箱数</i></small><strong>{new Set(scan.map((r) => norm(r.box))).size.toLocaleString()}</strong><span>{scan.length.toLocaleString()} scans · 次扫描</span></article><article><small>ACTION REQUIRED <i>需要处理</i></small><strong className="danger">{issues}</strong><span>issues in this count · 本次差异</span></article><article><small>LOCATION ACCURACY <i>库位准确率</i></small><strong>{accuracy}<i>%</i></strong><span className="bar"><i style={{width:`${accuracy}%`}}/></span></article><article><small>WRONG LOCATION <i>库位不符</i></small><strong className="danger">{count("misplaced")}</strong><span>location moves suggested · 建议调拨</span></article></div>
      <section className="results"><div className="results-head"><div><p className="eyebrow">RECONCILIATION RESULTS <small>核对结果</small></p><h2>Box-Level Exceptions</h2><p className="section-zh">逐箱差异明细</p></div><button className="export" onClick={exportResults}>⇩ Export Action List <small>导出处理清单</small></button></div><div className="toolbar"><div className="filters">{[["all","All","全部"],["misplaced","Wrong Location","库位不符"],["unregistered","Not in System","系统无此箱"],["missing","Not Scanned","未扫描"],["duplicate","Duplicate","重复扫描"],["match","Matched","一致"]].map(([v,en,zh])=><button key={v} className={filter===v?"selected":""} onClick={()=>setFilter(v)}>{en}<small>{zh}</small></button>)}</div><label className="search">⌕<input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search box or location · 搜索箱号或库位"/></label></div><div className="table-wrap"><table><thead><tr><th>Box Number<small>箱号</small></th><th>System Location<small>系统库位</small></th><th>Scanned Location<small>扫描库位</small></th><th>Scans<small>扫描次数</small></th><th>Status<small>状态</small></th><th>Recommended Action<small>处理建议</small></th></tr></thead><tbody>{visible.map((r)=><tr key={`${r.box}-${r.status}`}><td><b>{r.box}</b></td><td><code>{r.systemLocation}</code></td><td><code>{r.scannedLocation}</code></td><td>{r.scans}</td><td><span className={`status ${r.status}`}>{statusText[r.status]}<small>{statusZh[r.status]}</small></span></td><td className="suggestion"><b>{r.action}</b><small>{r.actionZh}</small></td></tr>)}</tbody></table>{!visible.length&&<div className="empty">No records match this filter.<small>当前筛选条件下没有记录。</small></div>}</div></section><footer>RUNERGY · Daily Inbound Verification <span>润阳 · 每日入库核验 · Auto-selects the latest valid scan worksheet</span></footer>
    </section></main>;
}
