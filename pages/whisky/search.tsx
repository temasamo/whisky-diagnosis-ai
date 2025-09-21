import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Mall, GroupedResult, SearchResponse } from "@/types/search";

export default function SearchPage() {
  const [items, setItems] = useState<GroupedResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  const out = (mall: Mall, url?: string) => {
    const u = new URL("/api/out", window.location.origin);
    u.searchParams.set("mall", mall);
    if (url) u.searchParams.set("url", url);
    window.open(u.toString(), "_blank");
  };

  const buildMallSearchUrl = (mall: Extract<Mall, "rakuten" | "yahoo">, title: string) =>
    mall === "rakuten" 
      ? `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(title)}/`
      : `https://shopping.yahoo.co.jp/search?p=${encodeURIComponent(title)}`;

  const run = async () => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const j: SearchResponse = await r.json();
      setItems((j.items || []).filter(g => g && g.cheapest));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ウイスキー検索</h1>
        <Link href="/whisky/diagnose" className="text-sm underline">診断で探す</Link>
      </div>

      <div className="flex gap-2 mb-4">
        <input 
          value={q} 
          onChange={(e) => setQ(e.target.value)} 
          className="flex-1 border rounded px-3 py-2" 
          placeholder="例）アイラ シングルモルト 700ml" 
          onKeyPress={(e) => e.key === 'Enter' && run()}
        />
        <button 
          onClick={run} 
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50" 
          disabled={loading}
        >
          {loading ? "検索中…" : "検索"}
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-3">
        検索後、各カード下の「楽天」「Yahoo」は商品ページへ（/api/out経由）。「Amazon入口」は入口トップへ。
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((g) => {
          const c = g.cheapest!;
          return (
            <div key={g.key} className="border rounded-xl p-3 flex flex-col">
              {c.image && (
                <div className="relative w-full h-40 mb-2">
                  <Image
                    src={c.image}
                    alt={c.title || "whisky"}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-contain"
                  />
                </div>
              )}
              <div className="text-xs text-gray-500 mb-1">最安モール: {c.mall?.toUpperCase() || "N/A"}</div>
              <div className="font-semibold line-clamp-2">{c.title || "-"}</div>
              <div className="mb-3">
                {typeof c.price === "number" ? `${c.price.toLocaleString()} 円` : "価格不明"}
              </div>
              <div className="mt-auto flex gap-2">
                <button onClick={() => out(c.mall, c.url)} className="flex-1 border rounded px-2 py-2">最安で買う</button>
                <button
                  onClick={() => out("rakuten", g.offers.find(o => o.mall === "rakuten")?.url ?? buildMallSearchUrl("rakuten", c.title || ""))}
                  className="flex-1 border rounded px-2 py-2"
                >楽天</button>
                <button
                  onClick={() => out("yahoo", g.offers.find(o => o.mall === "yahoo")?.url ?? buildMallSearchUrl("yahoo", c.title || ""))}
                  className="flex-1 border rounded px-2 py-2"
                >Yahoo</button>
                <button onClick={() => out("amazon")} className="flex-1 border rounded px-2 py-2">Amazon入口</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-6 text-sm text-gray-600">
        入口リンク：
        <a className="underline mr-2" target="_blank" href={process.env.NEXT_PUBLIC_RAKUTEN_ENTRANCE_URL}>楽天</a> /
        <a className="underline mx-2" target="_blank" href={process.env.NEXT_PUBLIC_AMAZON_ENTRANCE_URL}>Amazon</a> /
        <a className="underline ml-2" target="_blank" href="https://shopping.yahoo.co.jp/">Yahoo</a>
      </div>
    </div>
  );
}
