import useSWR from "swr";
import WhiskyNewsCard from "@/components/WhiskyNewsCard";
import Head from "next/head";

const fetcher = (u: string) => fetch(u).then(r => r.json());

export default function WeeklyNewsPage() {
  const { data, error, isLoading } = useSWR<{ items: any[]; count: number; dateRange: { start: string; end: string } }>("/api/whisky/news/weekly", fetcher);
  
  if (error) return <div className="text-center text-red-500 p-8">読み込みに失敗しました</div>;
  if (isLoading) return <div className="text-center text-gray-500 p-8">読み込み中…</div>;

  const items = data?.items ?? [];
  const dateRange = data?.dateRange;

  return (
    <>
      <Head>
        <title>今週のウイスキーニュース | Whisky Diagnosis AI</title>
        <meta name="description" content="今週のウイスキー関連ニュースを一覧表示します。" />
      </Head>
      
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-bold mb-6">今週のウイスキーニュース</h1>
        
        {dateRange && (
          <div className="mb-4 text-sm text-gray-600">
            {dateRange.start} 〜 {dateRange.end} の期間
          </div>
        )}

        {items.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            今週のニュースはまだありません
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((it) => (
              <WhiskyNewsCard
                key={it.id}
                title={it.title}
                link={it.link}
                source={it.source}
                pubDate={it.pub_date}
                image={it.image_url}
                brand={it.brand_hint}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
