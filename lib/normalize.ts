export function parseVolume(t: string): number | null {
  // より厳密な内容量解析
  const patterns = [
    /(\d{2,4})\s*ml/i,           // 標準的な形式
    /(\d{2,4})\s*ミリリットル/i,   // 日本語
    /(\d{2,4})\s*cc/i,           // cc表記
    /(\d{2,4})\s*cl/i,           // cl表記（clをmlに変換）
  ];
  
  for (const pattern of patterns) {
    const m = t.match(pattern);
    if (m) {
      let volume = parseInt(m[1], 10);
      
      // clをmlに変換
      if (pattern.source.includes('cl')) {
        volume = volume * 10;
      }
      
      // 合理的な範囲内に制限
      return Math.max(50, Math.min(5000, volume));
    }
  }
  
  return null;
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
