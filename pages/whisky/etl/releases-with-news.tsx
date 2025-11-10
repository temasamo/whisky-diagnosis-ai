import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";

interface ReleaseWithNews {
  release_id: string;
  brand_name: string | null;
  expression_name: string | null;
  on_sale_date: string | null;
  announced_date: string | null;
  matched_news_count: number;
  matched_news: Array<{
    id: string;
    title: string;
    link: string;
  }>;
}

export default function ReleasesWithNewsPage() {
  const [data, setData] = useState<{ total_releases: number; results: ReleaseWithNews[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedReleaseId, setExpandedReleaseId] = useState<string | null>(null);
  const [selectedReleaseIds, setSelectedReleaseIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [fetchingNews, setFetchingNews] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/whisky/releases/find-news");
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "APIエラーが発生しました");
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
      console.error("Failed to fetch releases with news:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedReleaseIds.size === 0) {
      alert("削除するリリース情報を選択してください");
      return;
    }

    if (!confirm(`選択した${selectedReleaseIds.size}件のリリース情報を削除しますか？`)) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch("/api/whisky/releases/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ releaseIds: Array.from(selectedReleaseIds) }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "削除に失敗しました");
      }

      alert("削除が完了しました");
      setSelectedReleaseIds(new Set());
      await fetchData();
    } catch (err: any) {
      alert(`削除エラー: ${err.message}`);
      console.error("Failed to delete releases:", err);
    } finally {
      setDeleting(false);
    }
  };

  const handleFetchNews = async () => {
    setFetchingNews(true);
    try {
      const res = await fetch("/api/whisky/etl/fetch-news");
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "ニュース取得に失敗しました");
      }
      const json = await res.json();
      alert(`ニュース取得を完了しました。\n合計${json.totalInserted}件の新しいニュース記事を取得しました。`);
    } catch (err: any) {
      alert(`ニュース取得エラー: ${err.message}`);
      console.error("Failed to fetch news:", err);
    } finally {
      setFetchingNews(false);
    }
  };

  const toggleSelectRelease = (releaseId: string) => {
    const newSet = new Set(selectedReleaseIds);
    if (newSet.has(releaseId)) {
      newSet.delete(releaseId);
    } else {
      newSet.add(releaseId);
    }
    setSelectedReleaseIds(newSet);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-lg text-gray-700">ロード中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">エラー:</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-lg text-gray-700">データがありません。</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <Head>
        <title>リリース情報とニュース記事の紐づけ</title>
      </Head>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">📋 リリース情報とニュース記事の紐づけ</h1>
            <p className="text-sm text-gray-600">
              リリース情報が正しいかどうかを、元のニュース記事と照合して確認できます
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
              onClick={handleFetchNews}
              disabled={fetchingNews}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm disabled:opacity-50"
            >
              {fetchingNews ? "取得中..." : "📰 ニュース取得"}
            </button>
            {selectedReleaseIds.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm disabled:opacity-50"
              >
                {deleting ? "削除中..." : `🗑️ 削除 (${selectedReleaseIds.size}件)`}
              </button>
            )}
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
            >
              🔄 更新
            </button>
          </div>
        </div>

        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-blue-800">
            <strong>総数:</strong> {data.total_releases}件のリリース情報についてニュース記事を検索しました
          </div>
        </div>

        <div className="space-y-4">
          {data.results.map((item) => (
            <div
              key={item.release_id}
              className={`bg-white rounded-lg shadow-md border overflow-hidden ${
                selectedReleaseIds.has(item.release_id)
                  ? "border-red-500 border-2"
                  : "border-gray-200"
              }`}
            >
              <div className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <input
                    type="checkbox"
                    checked={selectedReleaseIds.has(item.release_id)}
                    onChange={() => toggleSelectRelease(item.release_id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                  />
                  <div
                    className="flex-1 cursor-pointer hover:bg-gray-50 transition-colors -m-4 p-4"
                    onClick={() => {
                      setExpandedReleaseId(
                        expandedReleaseId === item.release_id ? null : item.release_id
                      );
                    }}
                  >
                    <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-lg text-gray-800">
                        {item.brand_name || "（ブランド不明）"} {item.expression_name || "（商品名不明）"}
                      </span>
                      {item.matched_news_count > 0 ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          {item.matched_news_count}件のニュース記事を発見
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                          ニュース記事が見つかりません
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      発売日: {item.on_sale_date 
                        ? new Date(item.on_sale_date).toLocaleDateString("ja-JP")
                        : item.announced_date
                        ? new Date(item.announced_date).toLocaleDateString("ja-JP") + "（発表日）"
                        : "不明"}
                    </div>
                  </div>
                  <div className="ml-4">
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        expandedReleaseId === item.release_id ? "transform rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>
              </div>
                </div>

              {expandedReleaseId === item.release_id && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  {item.matched_news_count > 0 ? (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">
                        📰 対応するニュース記事（{item.matched_news_count}件）
                      </h3>
                      <div className="space-y-2">
                        {item.matched_news.map((news) => (
                          <div
                            key={news.id}
                            className="bg-white p-3 rounded border border-gray-200 hover:border-blue-300 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <a
                                  href={news.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  {news.title}
                                </a>
                              </div>
                              <a
                                href={news.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-gray-500 hover:text-gray-700 flex-shrink-0"
                              >
                                🔗 開く
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600">
                      <p className="mb-2">⚠️ このリリース情報に対応するニュース記事が見つかりませんでした。</p>
                      <p className="text-xs text-gray-500">
                        考えられる原因：
                      </p>
                      <ul className="text-xs text-gray-500 list-disc list-inside mt-1 ml-2">
                        <li>ニュース記事のタイトルにブランド名や商品名が含まれていない</li>
                        <li>ニュース記事がまだ取得されていない</li>
                        <li>リリース情報が手動で追加された</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}
              </div>
            </div>
          ))}
        </div>

        {/* 統計情報 */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">📊 統計情報</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {data.results.filter((r) => r.matched_news_count > 0).length}
              </div>
              <div className="text-sm text-gray-600">ニュース記事が見つかったリリース</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {data.results.filter((r) => r.matched_news_count === 0).length}
              </div>
              <div className="text-sm text-gray-600">ニュース記事が見つからないリリース</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {data.results.reduce((sum, r) => sum + r.matched_news_count, 0)}
              </div>
              <div className="text-sm text-gray-600">発見されたニュース記事の総数</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

