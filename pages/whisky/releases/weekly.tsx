import { GetServerSideProps } from "next";
import Head from "next/head";
import React from 'react';

type Release = {
  id: string;
  brand: string;
  expression: string;
  source_type: "press" | "retailer" | "db";
  announced_date?: string | null;
  on_sale_date?: string | null;
  market?: string | null;
  retailer?: string | null;
  source_org?: string | null;
  source_url?: string | null;
  price_minor?: number | null;
  currency?: string | null;
  stock_status?: string | null;
  created_at: string;
  price_display?: string | null;
};

type Props = { 
  releases: Release[];
  weekRange: { start: string; end: string };
};

const WeeklyPage: React.FC<Props> = ({ releases, weekRange }) => {
  return (
    <>
      <Head>
        <title>今週の新着ウイスキー | Whisky Diagnosis AI</title>
        <meta name="description" content="今週収集したウイスキーの新着（公式発表・販売開始・速報）を一覧表示します。" />
      </Head>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">今週の新着ウイスキー</h1>
        
        <div className="mb-4 text-sm text-gray-600">
          {weekRange.start} 〜 {weekRange.end} の期間
        </div>

        {releases.length === 0 && (
          <p className="text-gray-600">今週の新着はまだありません。</p>
        )}

        <div className="space-y-4">
          {releases.map((r) => (
            <article key={r.id} className="border rounded-xl p-4 shadow-sm hover:shadow transition">
              <header className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">
                  {r.expression} <span className="text-sm text-gray-500">({r.brand})</span>
                </h2>
                <span
                  className={[
                    "text-xs px-2 py-1 rounded-full",
                    r.source_type === "retailer"
                      ? "bg-green-100 text-green-700"
                      : r.source_type === "press"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-700",
                  ].join(" ")}
                >
                  {r.source_type === "retailer" ? "販売開始" : r.source_type === "press" ? "公式発表" : "速報"}
                </span>
              </header>

              <dl className="mt-2 text-sm text-gray-700 grid grid-cols-2 gap-x-6 gap-y-1">
                {r.on_sale_date && (
                  <>
                    <dt>発売日</dt>
                    <dd>{r.on_sale_date}</dd>
                  </>
                )}
                {r.announced_date && (
                  <>
                    <dt>発表日</dt>
                    <dd>{r.announced_date}</dd>
                  </>
                )}
                {r.market && (
                  <>
                    <dt>市場</dt>
                    <dd>{r.market}</dd>
                  </>
                )}
                {(r as any).price_display && (
                  <>
                    <dt>価格</dt>
                    <dd>{(r as any).price_display}</dd>
                  </>
                )}
                {r.stock_status && (
                  <>
                    <dt>在庫</dt>
                    <dd>{r.stock_status}</dd>
                  </>
                )}
              </dl>

              {r.source_url && (
                <a
                  href={r.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-3 text-sm text-blue-600 hover:underline"
                >
                  情報元リンク
                </a>
              )}
            </article>
          ))}
        </div>
      </main>
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async ({ req, query }) => {
  const proto = (req.headers["x-forwarded-proto"] as string) ?? "http";
  const base = `${proto}://${req.headers.host}`;
  const market = (query.market as string) ?? "ALL";
  const r = await fetch(`${base}/api/whisky/releases/weekly?market=${market}`, {
    headers: { "x-internal": "1" },
  });
  const json = await r.json();
  return { 
    props: { 
      releases: json.items ?? [],
      weekRange: json.weekRange ?? { start: "", end: "" }
    } 
  };
};

export default WeeklyPage;
