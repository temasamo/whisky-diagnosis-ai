export const STORE_BLACKLIST = [
  // 危なそう/実績薄の店舗名キーワードを必要に応じて追加
  "訳あり", "アウトレット(非公式)"
];

export function badStore(name?: string): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return STORE_BLACKLIST.some(k => n.includes(k.toLowerCase()));
}
