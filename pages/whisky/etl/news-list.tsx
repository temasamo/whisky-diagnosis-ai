import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";

interface NewsItem {
  id: string;
  title: string;
  link: string;
  source: string;
  pub_date: string | null;
  created_at: string;
}

export default function NewsListPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const itemsPerPage = 50;

  useEffect(() => {
    fetchNews();
  }, [page, sortBy]);

  const fetchNews = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/whisky/news/list?page=${page}&limit=${itemsPerPage}&sort=${sortBy}`
      );
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "APIエラーが発生しました");
      }
      const json = await res.json();
      setNews(json.items || []);
      setTotalCount(json.total || 0);
    } catch (err: any) {
      setError(err.message);
      console.error("Failed to fetch news:", err);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  if (loading && news.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-lg text-gray-700">ロード中...</p>
      </div>
    );
  }

  if (error && news.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">エラー:</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <Head>
        <title>ニュース記事一覧</title>
      </Head>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">📰 ニュース記事一覧</h1>
            <p className="text-sm text-gray-600">
              総数: {totalCount.toLocaleString()}件
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/whisky/etl/status"
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors text-sm"
            >
              ← ステータスに戻る
            </Link>
            <button
              onClick={fetchNews}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
            >
              🔄 更新
            </button>
          </div>
        </div>

        {/* ソートとフィルター */}
        <div className="mb-4 flex items-center justify-between bg-white p-4 rounded-lg shadow">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">並び順:</label>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as "newest" | "oldest");
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="newest">新しい順</option>
              <option value="oldest">古い順</option>
            </select>
          </div>
          <div className="text-sm text-gray-600">
            {((page - 1) * itemsPerPage + 1).toLocaleString()} - {Math.min(page * itemsPerPage, totalCount).toLocaleString()} / {totalCount.toLocaleString()}件
          </div>
        </div>

        {/* ニュース一覧 */}
        <div className="space-y-3">
          {news.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-lg shadow-md border border-gray-200 p-4 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-lg font-medium text-blue-600 hover:text-blue-800 hover:underline block mb-2"
                  >
                    {item.title}
                  </a>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                      {item.source}
                    </span>
                    {item.pub_date && (
                      <span>
                        公開日: {new Date(item.pub_date).toLocaleDateString("ja-JP")}
                      </span>
                    )}
                    <span>
                      取得日: {new Date(item.created_at).toLocaleDateString("ja-JP")}
                    </span>
                  </div>
                </div>
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-sm flex-shrink-0"
                >
                  🔗 開く
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ← 前へ
            </button>
            <span className="px-4 py-2 text-sm text-gray-700">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              次へ →
            </button>
          </div>
        )}

        {loading && news.length > 0 && (
          <div className="mt-4 text-center text-sm text-gray-500">
            読み込み中...
          </div>
        )}
      </div>
    </div>
  );
}

