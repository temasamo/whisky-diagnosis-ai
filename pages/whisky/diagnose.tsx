import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import WhiskyChatWizard from "@/components/WhiskyChatWizard";
import { buildQueryFromAnswers, WhiskyAnswers } from "@/lib/diagnosis";
import { answersFromPreset } from "@/lib/presets";
import type { Mall, GroupedResult, SearchResponse } from "@/types/search";

export default function DiagnosePage() {
  const [items, setItems] = useState<GroupedResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { preset } = router.query;

  const initial = preset && typeof preset === "string" 
    ? answersFromPreset(preset as any) 
    : undefined;

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
      setItems((j.items || []).filter(g => g && g.cheapest));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (preset && typeof preset === "string") {
      const answers = answersFromPreset(preset as any);
      const query = buildQueryFromAnswers(answers);
      run(query, answers);
    }
  }, [preset]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-gray-100">
      {/* ヘッダー */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-800">🥃 ウイスキー診断チャット</h1>
            <Link href="/whisky/search" className="text-sm text-green-600 hover:text-green-700 font-medium">
              キーワード検索へ
            </Link>
          </div>
        </div>
      </div>

      {/* チャットエリア */}
      <div className="max-w-4xl mx-auto">
        <WhiskyChatWizard onSearch={run} initialAnswers={initial} />
      </div>

      {/* 検索結果エリア */}
      {loading && (
        <div className="max-w-4xl mx-auto p-4">
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-3"></div>
            <p className="text-gray-600 font-medium">検索中…</p>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="max-w-6xl mx-auto p-4">
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">診断結果</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map((g) => {
                const c = g.cheapest!;
                return (
                  <div key={g.key} className="border border-gray-200 rounded-xl p-4 flex flex-col hover:shadow-md transition-shadow">
                    {c.image && (
                      <div className="relative w-full h-32 mb-3 flex items-center justify-center bg-gray-50 rounded-lg">
                        <Image
                          src={c.image}
                          alt={c.title || "whisky"}
                          width={120}
                          height={120}
                          className="object-contain max-w-full max-h-full"
                          sizes="(max-width: 768px) 100vw, 33vw"
                        />
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mb-2 font-medium">最安モール: {c.mall?.toUpperCase() || "N/A"}</div>
                    <div className="font-semibold line-clamp-2 text-gray-800 mb-2">{c.title || "-"}</div>
                    <div className="mb-3 text-green-600 font-bold">
                      {typeof c.price === "number" ? `${c.price.toLocaleString()} 円` : "価格不明"}
                    </div>
                    <div className="mt-auto flex gap-2">
                      <button 
                        onClick={() => out(c.mall, c.url)} 
                        className="flex-1 border-2 border-green-200 rounded-full px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50 hover:border-green-300 transition-all"
                      >
                        最安で買う
                      </button>
                      <button
                        onClick={() => out("rakuten", g.offers?.find((o:any)=>o.mall==="rakuten")?.url ?? buildMallSearchUrl("rakuten", c.title || ""))}
                        className="flex-1 border-2 border-gray-200 rounded-full px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all"
                      >
                        楽天
                      </button>
                      <button
                        onClick={() => out("yahoo", g.offers?.find((o:any)=>o.mall==="yahoo")?.url ?? buildMallSearchUrl("yahoo", c.title || ""))}
                        className="flex-1 border-2 border-gray-200 rounded-full px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all"
                      >
                        Yahoo
                      </button>
                      <button 
                        onClick={() => out("amazon")} 
                        className="flex-1 border-2 border-gray-200 rounded-full px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all"
                      >
                        Amazon
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* フッター */}
      <div className="max-w-4xl mx-auto p-4">
        <div className="text-center text-sm text-gray-500">
          入口リンク：
          <a className="underline mx-2 text-green-600 hover:text-green-700" target="_blank" href={process.env.NEXT_PUBLIC_RAKUTEN_ENTRANCE_URL}>楽天</a>
          /
          <a className="underline mx-2 text-green-600 hover:text-green-700" target="_blank" href={process.env.NEXT_PUBLIC_AMAZON_ENTRANCE_URL}>Amazon</a>
          /
          <a className="underline ml-2 text-green-600 hover:text-green-700" target="_blank" href="https://shopping.yahoo.co.jp/">Yahoo</a>
        </div>
      </div>
    </div>
  );
}
