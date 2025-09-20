import { useState } from "react";

type Item = {
  mall: "rakuten" | "yahoo";
  id: string;
  title: string;
  price: number | null;
  url: string;
  image: string | null;
};

export default function WhiskySearch() {
  const [q, setQ] = useState("ウイスキー 700ml シングルモルト");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const j = await r.json();
      setItems(j.items || []);
    } finally {
      setLoading(false);
    }
  };

  const out = (mall: "rakuten" | "yahoo" | "amazon", url?: string) => {
    const u = new URL("/api/out", window.location.origin);
    u.searchParams.set("mall", mall);
    if (url) u.searchParams.set("url", url);
    window.open(u.toString(), "_blank");
  };

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-3">ウイスキー診断AI（検索MVP）</h1>
      <div className="flex gap-2 mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 border rounded px-3 py-2"
          placeholder="例）アイラ シングルモルト 700ml"
        />
        <button onClick={run} className="px-4 py-2 rounded bg-black text-white disabled:opacity-50" disabled={loading}>
          {loading ? "検索中…" : "検索"}
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-3">
        検索後、各カード下の「楽天」「Yahoo」は商品ページへ（/api/out経由）。「Amazon入口」は入口トップへ。
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <div key={`${it.mall}:${it.id}`} className="border rounded-xl p-3 flex flex-col">
            {it.image && <img src={it.image} alt={it.title} className="w-full h-40 object-contain mb-2" />}
            <div className="font-semibold line-clamp-3 mb-1">{it.title}</div>
            <div className="text-sm text-gray-600 mb-3">
              {it.price ? `${it.price.toLocaleString()} 円` : "価格不明"} / {it.mall.toUpperCase()}
            </div>
            <div className="mt-auto flex gap-2">
              <button onClick={() => out("rakuten", it.url)} className="flex-1 border rounded px-2 py-2">楽天で見る</button>
              <button onClick={() => out("yahoo", it.url)} className="flex-1 border rounded px-2 py-2">Yahooで見る</button>
              <button onClick={() => out("amazon")} className="flex-1 border rounded px-2 py-2">Amazon入口</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
