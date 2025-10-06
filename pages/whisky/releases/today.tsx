import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

interface ReleaseItem {
  id: string;
  expression_name: string;
  brand_name: string;
  brand_region: string;
  market: string;
  price_display: string;
  announced_date: string;
  on_sale_date: string;
  source_url: string;
}

export default function TodayReleases() {
  const [items, setItems] = useState<ReleaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/whisky/releases/today');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setItems(data.items || []);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">読み込み中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <h3 className="text-lg font-medium text-red-800">エラーが発生しました</h3>
              <p className="mt-2 text-red-600">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="mb-4 text-blue-600 hover:text-blue-800 flex items-center"
          >
            ← 戻る
          </button>
          <h1 className="text-3xl font-bold text-gray-900">今日の新着ウイスキー</h1>
          <p className="mt-2 text-gray-600">
            {items.length > 0 
              ? `${items.length}件の新着情報があります` 
              : '本日の新着情報はありません'
            }
          </p>
        </div>

        {/* Content */}
        {items.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, index) => (
              <article key={index} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                <div className="mb-4">
                  <div className="text-sm text-gray-500 mb-1">
                    {item.brand_name} / {item.market || 'Global'}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {item.expression_name}
                  </h3>
                  {item.brand_region && (
                    <div className="text-sm text-gray-600 mb-2">
                      地域: {item.brand_region}
                    </div>
                  )}
                  {item.price_display && (
                    <div className="text-lg font-bold text-blue-600 mb-2">
                      {item.price_display}
                    </div>
                  )}
                </div>
                
                <div className="space-y-2 text-sm text-gray-500">
                  {item.announced_date && (
                    <div>公式発表: {item.announced_date}</div>
                  )}
                  {item.on_sale_date && (
                    <div>販売開始: {item.on_sale_date}</div>
                  )}
                </div>

                {item.source_url && (
                  <div className="mt-4">
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      情報元リンク →
                    </a>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🥃</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              本日の新着情報はありません
            </h3>
            <p className="text-gray-600">
              新しいウイスキーの情報が入り次第、こちらに表示されます。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
