const text = (value: unknown) => String(value ?? "").trim();
const headerKey = (value: unknown) => text(value).toLowerCase().replace(/[\s._-]/g, "");
const boxHeaders = ["箱号", "scanned box n.", "扫描箱号", "box", "box no", "box number", "c19"];
const locationHeaders = ["scanned location", "查验库位名称", "扫描库位", "实盘库位", "location", "库位", "位置", "库位编码", "库位名称", "仓位", "货位"];

export function selectScanSheet(sheets: { name: string; rows: unknown[][] }[]) {
  const valid = sheets.filter(sheet => scanColumns(sheet.rows) && parseScanRows(sheet.rows).length > 0);
  const main = valid.find(sheet => sheet.name.trim() === "库位箱号");
  if (main) return main.name;
  const scans = valid.filter(sheet => !/备注|范围外|说明|汇总|notes|out.of.scope|summary/i.test(sheet.name));
  return scans[scans.length - 1]?.name ?? null;
}

export function scanColumns(rows: unknown[][]) {
  const find = (aliases: string[]) => {
    const keys = new Set(aliases.map(headerKey));
    for (let row = 0; row < Math.min(rows.length, 10); row++) {
      const col = (rows[row] ?? []).findIndex((value) => keys.has(headerKey(value)));
      if (col >= 0) return { row, col };
    }
    return null;
  };
  const box = find(boxHeaders);
  const location = find(locationHeaders);
  return box && location && box.col !== location.col ? { box, location } : null;
}

export function parseScanRows(rows: unknown[][]): { box: string; location: string }[] {
  const columns = scanColumns(rows);
  if (!columns) throw new Error("Could not find Box Number and Location columns · 找不到箱号和库位列，请使用 location / box NO 或 库位 / 箱号 表头");
  const result: { box: string; location: string }[] = [];
  let currentLocation = "";
  for (let i = Math.max(columns.box.row, columns.location.row) + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const location = text(row[columns.location.col]);
    if (location) currentLocation = location;
    const box = text(row[columns.box.col]);
    if (box) result.push({ box, location: currentLocation });
  }
  return result;
}
