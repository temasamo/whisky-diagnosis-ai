export type WhiskyAnswers = {
  use: "self" | "gift";
  region?: "islay" | "speyside" | "highland" | "japan" | "ireland" | "bourbon" | "rye" | "campbeltown" | "lowland" | "any";
  type?: "single_malt" | "blended" | "grain" | "bourbon" | "rye" | "cask_strength" | "any";
  peat?: "none" | "light" | "medium" | "heavy" | "any";
  cask?: ("bourbon" | "sherry" | "mizunara" | "wine" | "rum" | "port" | "any")[];
  age?: "nas" | "10" | "12" | "15" | "18" | "21" | "25" | "any";
  drinking?: "straight" | "rock" | "highball" | "mizuwari" | "any";
  budget?: 3000 | 5000 | 8000 | 10000 | 15000 | 30000 | 60000;
  volume?: 500 | 700 | 750 | 1000;
};

export function buildQueryFromAnswers(a: WhiskyAnswers): string {
  const parts: string[] = [];
  
  // 地域を英語で追加
  if (a.region && a.region !== "any") {
    parts.push(a.region);
  }
  
  // タイプを英語で追加
  if (a.type && a.type !== "any") {
    parts.push(a.type);
  }
  
  // ピート情報は簡素化
  if (a.peat && a.peat !== "any" && a.peat !== "none") {
    if (a.peat === "heavy") parts.push("peat");
  }
  
  // 基本キーワード
  parts.push("whisky");
  
  return parts.filter(Boolean).join(" ");
}
