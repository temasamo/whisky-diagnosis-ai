export function parseVolume(t: string): number | null {
  const m = t.match(/(\d{3,4})\s?m?l/i);
  return m ? Math.max(50, Math.min(5000, parseInt(m[1], 10))) : null;
}
export function parseAbv(t: string): number | null {
  const m = t.match(/(\d{2})(?:\.\d)?\s?%/);
  return m ? parseInt(m[1], 10) : null;
}
export function parseAge(t: string): string {
  const m = t.match(/(\d{1,2})\s?年|\b(\d{1,2})\s?yo/i);
  return m ? (m[1] || m[2]) : "NAS";
}

const DROP = /【|】|\[|\]|\(|\)|（|）|限定|数量|箱無|箱あり|正規|並行|国内|海外|ラベル|特価|セット|福袋|訳あり|アウトレット/gi;

export function canonicalKey(title: string) {
  const t = title.toLowerCase().replace(DROP, " ").replace(/\s+/g, " ").trim();
  const v = parseVolume(t) ?? 700;
  const a = parseAbv(t) ?? 40;
  const y = parseAge(t);
  const brandTokens = t.split(" ").slice(0, 6).join(" ");
  return `${brandTokens}|${v}ml|${a}%|${y}`;
}
