export type Mall = "rakuten" | "yahoo" | "amazon";

export interface RawProduct {
  mall: Extract<Mall, "rakuten" | "yahoo">;
  id: string;
  title: string;
  price: number | null;
  url: string;
  image: string | null;
  shop?: string | null;
  volume_ml?: number | null;
  abv?: number | null;
}

export interface GroupedResult {
  key: string;
  cheapest: RawProduct | null;     // フロントで型ガード
  offers: RawProduct[];
}

export interface SearchResponse {
  query: string;
  items: GroupedResult[];
}
