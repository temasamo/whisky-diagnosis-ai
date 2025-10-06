import { useEffect, useState } from "react";
import Link from "next/link";

export default function Home() {
  const [count, setCount] = useState<number | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [weeklyCount, setWeeklyCount] = useState<number | null>(null);
  const [weeklyItems, setWeeklyItems] = useState<any[]>([]);

  useEffect(() => {
    // 今日の件数
    fetch("/api/whisky/releases/today-count").then(r => r.json()).then(d => setCount(d.todayCount));

    // 今日の直近2件
    fetch("/api/whisky/releases/today?limit=2")
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d?.items) ? d.items.slice(0,2) : []))
      .catch(() => setItems([]));

    // 今週の件数
    fetch("/api/whisky/releases/weekly-count").then(r => r.json()).then(d => setWeeklyCount(d.weeklyCount));

    // 今週の直近2件
    fetch("/api/whisky/releases/weekly?limit=2")
      .then(r => r.json())
      .then(d => setWeeklyItems(Array.isArray(d?.items) ? d.items.slice(0,2) : []))
      .catch(() => setWeeklyItems([]));
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-4xl font-extrabold mb-4">ウイスキー診断AI</h1>
      <p className="text-gray-600 mb-10">あなたにぴったりのウイスキーを見つけましょう</p>

      <div className="flex flex-col gap-4 mb-6">
        <Link 
          href="/whisky"
          className="rounded-xl bg-black text-white px-6 py-4 text-center hover:opacity-90"
        >
          ウイスキー検索を始める
        </Link>
        <Link 
          href="/rag/admin"
          className="rounded-xl bg-amber-600 text-white px-6 py-4 text-center hover:opacity-90"
        >
          RAG知識ベース管理
        </Link>
      </div>

      {/* 今日の新着ウィジェット */}
      <section className="rounded-2xl border p-4 bg-white mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">今日の新着ウイスキー</h2>
          <Link href="/whisky/releases/today" className="text-sm text-blue-600 hover:underline">
            もっと見る →
          </Link>
        </div>

        <p className="text-sm text-gray-600 mt-1">
          {count === null ? "読み込み中…" : `本日 ${count} 件の更新`}
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {items.map((x, i) => (
            <article key={i} className="rounded-xl border p-3">
              <div className="text-sm text-gray-500">{x.brand_name} / {x.market ?? "Global"}</div>
              <div className="font-medium">{x.expression_name}</div>
              <div className="text-xs text-gray-500 mt-1">
                {x.announced_date ? `公式発表: ${x.announced_date}` :
                 x.on_sale_date ? `販売開始: ${x.on_sale_date}` : ""}
              </div>
              <a href={x.source_url} target="_blank" rel="noopener noreferrer"
                 className="text-xs text-blue-600 hover:underline mt-2 inline-block">
                情報元リンク
              </a>
            </article>
          ))}
          {items.length === 0 && (
            <div className="text-sm text-gray-500">本日のニュースはまだありません</div>
          )}
        </div>
      </section>

      {/* 今週の新着ウィジェット */}
      <section className="rounded-2xl border p-4 bg-white">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">今週の新着ウイスキー</h2>
          <Link href="/whisky/releases/weekly" className="text-sm text-blue-600 hover:underline">
            もっと見る →
          </Link>
        </div>

        <p className="text-sm text-gray-600 mt-1">
          {weeklyCount === null ? "読み込み中…" : `今週 ${weeklyCount} 件の更新`}
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {weeklyItems.map((x, i) => (
            <article key={i} className="rounded-xl border p-3">
              <div className="text-sm text-gray-500">{x.brand_name} / {x.market ?? "Global"}</div>
              <div className="font-medium">{x.expression_name}</div>
              <div className="text-xs text-gray-500 mt-1">
                {x.announced_date ? `公式発表: ${x.announced_date}` :
                 x.on_sale_date ? `販売開始: ${x.on_sale_date}` : ""}
              </div>
              <a href={x.source_url} target="_blank" rel="noopener noreferrer"
                 className="text-xs text-blue-600 hover:underline mt-2 inline-block">
                情報元リンク
              </a>
            </article>
          ))}
          {weeklyItems.length === 0 && (
            <div className="text-sm text-gray-500">今週のニュースはまだありません</div>
          )}
        </div>
      </section>
    </main>
  );
}
