// 診断回答の型と、検索語テンプレート
export type WhiskyAnswers = {
  use: "self" | "gift";
  region?: "islay" | "speyside" | "highland" | "japan" | "ireland" | "bourbon" | "rye" | "campbeltown" | "lowland" | "any";
  type?: "single_malt" | "blended" | "grain" | "bourbon" | "rye" | "cask_strength" | "any";
  peat?: "none" | "light" | "medium" | "heavy" | "any";
  cask?: ("bourbon" | "sherry" | "mizunara" | "wine" | "rum" | "port" | "any")[];
  age?: "nas" | "10" | "12" | "15" | "18" | "21" | "25" | "any";
  drinking?: "straight" | "rock" | "highball" | "mizuwari" | "any";
  budget?: 3000 | 5000 | 8000 | 15000 | 30000 | 60000;
  volume?: 500 | 700 | 750 | 1000; // 表示用
};

const REGION_JA: Record<string,string> = {
  islay: "アイラ", speyside:"スペイサイド", highland:"ハイランド", japan:"ジャパニーズ",
  ireland:"アイリッシュ", bourbon:"バーボン", rye:"ライ", campbeltown:"キャンベルタウン",
  lowland:"ローランド", any:""
};
const TYPE_JA: Record<string,string> = {
  single_malt:"シングルモルト", blended:"ブレンデッド", grain:"グレーン",
  bourbon:"バーボン", rye:"ライウイスキー", cask_strength:"カスクストレングス", any:""
};
const PEAT_JA: Record<string,string> = {
  none:"ノンピート", light:"ピート控えめ", medium:"ピート", heavy:"ヘビリーピーテッド", any:""
};

export function buildQueryFromAnswers(a: WhiskyAnswers): string {
  const parts: string[] = [];
  if (a.region && REGION_JA[a.region]) parts.push(REGION_JA[a.region]);
  if (a.type && TYPE_JA[a.type]) parts.push(TYPE_JA[a.type]);
  if (a.peat && PEAT_JA[a.peat]) parts.push(PEAT_JA[a.peat]);
  if (a.cask && a.cask.length && !a.cask.includes("any")) parts.push(a.cask.map(c => ({
    bourbon:"バーボン樽", sherry:"シェリー樽", mizunara:"ミズナラ樽", wine:"ワイン樽",
    rum:"ラム樽", port:"ポート樽", any:""
  }[c])).filter(Boolean).join(" "));
  if (a.age && a.age !== "any") parts.push(a.age === "nas" ? "ノンエイジ" : `${a.age}年`);
  if (a.volume) parts.push(`${a.volume}ml`);
  // 価格は絞り過ぎないため表示用にのみ
  parts.push("ウイスキー");
  return parts.filter(Boolean).join(" ");
}
