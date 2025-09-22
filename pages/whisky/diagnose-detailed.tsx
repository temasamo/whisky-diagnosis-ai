import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import WhiskyDiagnosis from "@/components/WhiskyDiagnosis";
import type { Mall, GroupedResult, SearchResponse } from "@/types/search";
import { WhiskyAnswers } from "@/lib/diagnosis";

export default function DiagnoseDetailedPage() {
  const [items, setItems] = useState<GroupedResult[]>([]);
  const [loading, setLoading] = useState(false);

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

  const run = async (q: string, answers: WhiskyAnswers) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}&budget=${answers?.budget ?? ""}`);
      const j: SearchResponse = await r.json();
      setItems((j.items || []).filter(g => g && g.cheapest)); // フロントガード
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ウイスキー診断（詳細選択）</h1>
        <Link href="/whisky" className="text-sm underline">トップページへ</Link>
      </div>

      <WhiskyDiagnosis onSearch={run} />

      {loading && <div>検索中…</div>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((g) => {
          const c = g.cheapest!; // 上でフィルタ済み
          return (
            <div key={g.key} className="border rounded-xl p-3 flex flex-col">
              {c.image && (
                <div className="w-full h-32 mb-2 flex items-center justify-center bg-gray-50 rounded">
                  <Image
                    src={c.image}
                    alt={c.title || "whisky"}
                    width={120}
                    height={120}
                    className="object-contain max-w-full max-h-full"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
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
        <a className="underline mr-2" target="_blank" href={process.env.NEXT_PUBLIC_RAKUTEN_ENTRANCE_URL}>楽天</a>
        /
        <a className="underline mx-2" target="_blank" href={process.env.NEXT_PUBLIC_AMAZON_ENTRANCE_URL}>Amazon</a>
        /
        <a className="underline ml-2" target="_blank" href="https://shopping.yahoo.co.jp/">Yahoo</a>
      </div>
    </div>
  );
}
