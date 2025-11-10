import { useEffect, useState } from "react";
import Link from "next/link";

interface StatusData {
  status: {
    period: {
      start: string;
      end: string;
      days: number;
    };
    news: {
      total: number;
      recent7days: number;
      hasData: boolean;
      description: string;
      inReleasePeriod?: number;
      releasePeriod?: { start: string; end: string };
    };
    releases: {
      total: number;
      recent7days: number;
      hasData: boolean;
      whiskyCount: number;
      nonWhiskyCount: number;
      uncertainCount?: number;
      description: string;
      totalPeriod?: { start: string | null; end: string | null; isSingleDay: boolean };
      saleDateRange?: { start: string; end: string; isSingleDay: boolean } | null;
      samples: any[];
      nonWhiskySamples?: any[];
      uncertainSamples?: any[];
    };
    nextSteps: string[];
  };
  message: string;
}

export default function EtlStatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchingNews, setFetchingNews] = useState(false);

  useEffect(() => {
    fetch("/api/whisky/etl/check-status")
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">読み込み中...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h2 className="text-red-800 font-bold">エラー</h2>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { status } = data;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">📊 発売情報取得の状態</h1>

        {/* ニュース記事の状態 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <span className="mr-2">📰</span>
            ニュース記事
          </h2>
          <div className="mb-4 text-sm text-gray-600">
            {status.news.description || "RSSフィードから取得した生のニュース記事"}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600">総数</div>
              <div className="text-2xl font-bold text-blue-600">
                {status.news.total.toLocaleString()}件
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">直近7日</div>
              <div className="text-2xl font-bold text-green-600">
                {status.news.recent7days.toLocaleString()}件
              </div>
            </div>
          </div>
          {/* 矛盾チェック表示 */}
          {status.releases.total > 0 && status.news.total === 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
              <div className="text-sm text-red-800 font-semibold">
                ⚠️ 矛盾: リリース情報が{status.releases.total}件あるのに、ニュース記事が0件です
              </div>
              <div className="text-xs text-red-600 mt-1">
                リリース情報はニュース記事から作成されるため、元のニュース記事が存在するはずです。
                <br />
                ニュース記事が削除された可能性、またはリリース情報が手動で追加された可能性があります。
              </div>
            </div>
          )}
          {status.news.releasePeriod && status.news.inReleasePeriod !== undefined && (
            <div className="mt-2 text-xs text-gray-500">
              リリース情報の作成期間（{status.news.releasePeriod.start} ～ {status.news.releasePeriod.end}）のニュース記事: {status.news.inReleasePeriod}件
            </div>
          )}
          <div className="mt-4">
            {status.news.hasData ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                ✅ データあり
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                ❌ データなし
              </span>
            )}
          </div>
        </div>

        {/* 期間表示 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="text-sm text-blue-800">
            <strong>期間:</strong> {data.status.period?.start || "不明"} ～ {data.status.period?.end || "不明"}（直近7日間）
          </div>
        </div>

        {/* リリース情報の状態 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <span className="mr-2">📦</span>
            リリース情報
          </h2>
          <div className="mb-4 text-sm text-gray-600">
            {status.releases.description || "ニュース記事から抽出した商品リリース情報（構造化データ）"}
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-sm text-gray-600">総数</div>
              <div className="text-2xl font-bold text-blue-600">
                {status.releases.total.toLocaleString()}件
              </div>
              {status.releases.totalPeriod?.start && status.releases.totalPeriod?.end && (
                <div className="text-xs text-gray-500 mt-1">
                  {status.releases.totalPeriod.isSingleDay ? (
                    <span>
                      <span className="font-medium">{status.releases.totalPeriod.start}</span>
                      <span className="ml-1 text-orange-600">（同日のみ）</span>
                    </span>
                  ) : (
                    <span>
                      登録日: {status.releases.totalPeriod.start} ～ {status.releases.totalPeriod.end}
                    </span>
                  )}
                </div>
              )}
              {status.releases.saleDateRange && (
                <div className="text-xs text-gray-500 mt-1">
                  {status.releases.saleDateRange.isSingleDay ? (
                    <span>
                      発売日: <span className="font-medium">{status.releases.saleDateRange.start}</span>
                      <span className="ml-1 text-orange-600">（同日のみ）</span>
                    </span>
                  ) : (
                    <span>
                      発売日: {status.releases.saleDateRange.start} ～ {status.releases.saleDateRange.end}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div>
              <div className="text-sm text-gray-600">直近7日</div>
              <div className="text-2xl font-bold text-green-600">
                {status.releases.recent7days.toLocaleString()}件
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">ウイスキー関連</div>
              <div className="text-2xl font-bold text-purple-600">
                {(status.releases.whiskyCount || 0).toLocaleString()}件
              </div>
            </div>
          </div>
          
          {/* ウイスキー以外の件数を常に表示 */}
          {status.releases.total > 0 && (
            <div className="mt-3 p-3 bg-gray-50 rounded border-l-4 border-gray-400">
              <div className="text-sm text-gray-700">
                <strong>内訳:</strong>
                <span className="ml-2 text-purple-600">
                  ウイスキー関連: {(status.releases.whiskyCount || 0).toLocaleString()}件
                </span>
                {status.releases.nonWhiskyCount > 0 && (
                  <span className="ml-3 text-red-600 font-semibold">
                    ⚠️ ウイスキー以外: {status.releases.nonWhiskyCount.toLocaleString()}件
                  </span>
                )}
                {(status.releases.uncertainCount || 0) > 0 && (
                  <span className="ml-3 text-orange-600 font-semibold">
                    ⚠️ 判定不明: {(status.releases.uncertainCount || 0).toLocaleString()}件
                  </span>
                )}
              </div>
            </div>
          )}
          
          {/* 判定不明の商品が含まれている場合の警告 */}
          {(status.releases.uncertainCount || 0) > 0 && (
            <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded">
              <div className="text-sm text-orange-800 font-semibold mb-2">
                ⚠️ 判定不明: {status.releases.uncertainCount}件のリリース情報がウイスキー関連かどうか判定できません
              </div>
              <div className="text-xs text-orange-600 mb-3">
                ブランド名や商品名からウイスキー関連キーワードが見つかりませんでした。以下の商品を確認してください：
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {status.releases.uncertainSamples?.slice(0, 10).map((sample: any, index: number) => (
                  <div key={index} className="text-xs bg-white p-2 rounded border border-orange-200">
                    <div className="font-medium text-gray-800">
                      {sample.brand || "（ブランド不明）"} {sample.expression || "（商品名不明）"}
                    </div>
                    <div className="text-gray-500 mt-1">
                      発売日: {sample.on_sale_date || sample.announced_date || "不明"}
                    </div>
                    {sample.source_url && (
                      <div className="text-gray-400 mt-1 text-xs truncate">
                        元記事: {sample.source_url}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ウイスキー以外の商品が含まれている場合の警告 */}
          {status.releases.nonWhiskyCount > 0 && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
              <div className="text-sm text-red-800 font-semibold mb-2">
                ⚠️ 問題: リリース情報にウイスキー以外の商品が{status.releases.nonWhiskyCount}件含まれています
              </div>
              <div className="text-xs text-red-600 mb-3">
                リリース情報はウイスキー関連のみであるべきですが、以下の商品が含まれています：
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {status.releases.nonWhiskySamples?.slice(0, 10).map((sample: any, index: number) => (
                  <div key={index} className="text-xs bg-white p-2 rounded border border-red-200">
                    <div className="font-medium text-gray-800">
                      {sample.brand} {sample.expression}
                    </div>
                    <div className="text-gray-500 mt-1">
                      発売日: {sample.on_sale_date || sample.announced_date || "不明"}
                    </div>
                    {sample.source_url && (
                      <div className="text-gray-400 mt-1 text-xs truncate">
                        元記事: {sample.source_url}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4">
            {status.releases.hasData ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                ✅ データあり
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                ❌ データなし
              </span>
            )}
          </div>

          {/* サンプル表示 */}
          {status.releases.samples && status.releases.samples.length > 0 && (
            <div className="mt-6 border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">サンプル（最新5件）</h3>
              <div className="space-y-2">
                {status.releases.samples.map((sample: any, index: number) => (
                  <div key={index} className="text-sm bg-gray-50 p-3 rounded">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{sample.brand}</span>
                        <span className="text-gray-600"> {sample.expression}</span>
                        {sample.isWhisky && (
                          <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded">
                            ウイスキー
                          </span>
                        )}
                      </div>
                      <div className="text-gray-500 text-xs">
                        {sample.on_sale_date || sample.announced_date || "日付不明"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 次のステップ */}
        {status.nextSteps.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <span className="mr-2">🚀</span>
              次のステップ
            </h2>
            <ul className="space-y-2">
              {status.nextSteps.map((step, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-2 text-yellow-600">•</span>
                  <span className="text-gray-800">{step}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* データの流れと違いの説明 */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">💡 データの流れとフィルタリングルール</h2>
          <div className="mb-4">
            <div className="flex items-center space-x-2 text-sm mb-2">
              <span className="text-blue-600 font-bold">1.</span>
              <span className="text-gray-700">RSSフィード取得</span>
              <span className="text-gray-400">→</span>
              <span className="text-gray-700">📰 ニュース記事（whisky_news）</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <span className="text-blue-600 font-bold">2.</span>
              <span className="text-gray-700">ニュース記事を解析・フィルタリング</span>
              <span className="text-gray-400">→</span>
              <span className="text-gray-700">📦 リリース情報（releases）</span>
            </div>
          </div>
          
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-semibold mb-3 text-gray-800">📰 ニュース記事（whisky_news）の範囲</h3>
            <div className="text-sm text-gray-700 mb-3 bg-white p-3 rounded border-l-4 border-blue-500">
              <strong className="text-gray-800">取得対象:</strong>
              <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                <li>サントリー、ニッカ、アサヒなどのRSSフィードから取得</li>
                <li>ブランド関連のニュース全般（ウイスキー、ビール、天然水など含む）</li>
                <li>商品リリース以外のニュース（採用、イベント、CSRなど）も含まれる</li>
              </ul>
              <div className="mt-2 text-xs text-gray-500">
                例: 「サントリー 新商品発売」「プレミアムモルツ 新発売」「天然水 新商品」など
              </div>
            </div>

            <h3 className="text-sm font-semibold mb-3 text-gray-800 mt-4">📦 リリース情報（releases）の範囲</h3>
            <div className="text-sm text-gray-700 mb-3 bg-white p-3 rounded border-l-4 border-purple-500">
              <strong className="text-gray-800">変換対象（厳格なフィルタリング）:</strong>
              <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                <li><strong className="text-purple-600">ウイスキー関連の商品リリースのみ</strong></li>
                <li>商品リリースキーワード（発売、新商品など）を含む</li>
                <li>ウイスキー関連キーワード（ウイスキー、スコッチ、バーボン、ハイボールなど）を含む</li>
              </ul>
              <div className="mt-2">
                <strong className="text-red-600">除外される商品:</strong>
                <div className="text-xs text-gray-600 mt-1">
                  ビール、ワイン、焼酎、日本酒、チューハイ、ブランデー、ラム、ウォッカ、ジン、テキーラ、ソフトドリンクなど
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                例: 「サントリー 白州 新発売」「ニッカ 竹鶴 限定発売」など（ウイスキー関連のみ）
              </div>
            </div>

            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <div className="text-xs text-yellow-800">
                <strong>💡 まとめ:</strong>
                <br />
                ニュース記事 = ブランド関連のニュース全般（ウイスキー以外も含む）
                <br />
                リリース情報 = ウイスキー関連の商品リリースのみ（厳格にフィルタリング）
              </div>
            </div>
          </div>
        </div>

        {/* 全体の状態サマリー */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">📈 全体の状態</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-700">ニュース記事の取得</span>
              {status.news.hasData ? (
                <span className="text-green-600 font-semibold">✅ 正常</span>
              ) : (
                <span className="text-red-600 font-semibold">❌ 要対応</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700">リリース情報の保存</span>
              {status.releases.hasData ? (
                <span className="text-green-600 font-semibold">✅ 正常</span>
              ) : (
                <span className="text-red-600 font-semibold">❌ 要対応</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700">ウイスキー関連リリース</span>
              {(status.releases.whiskyCount || 0) > 0 ? (
                <span className="text-purple-600 font-semibold">
                  ✅ {status.releases.whiskyCount}件
                </span>
              ) : (
                <span className="text-gray-500 font-semibold">-</span>
              )}
            </div>
          </div>
        </div>

        {/* アクションボタン */}
        <div className="mt-6 flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/whisky/etl/news-list"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors inline-flex items-center gap-2"
          >
            📰 ニュース記事一覧
          </Link>
          <Link
            href="/whisky/etl/releases-with-news"
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors inline-flex items-center gap-2"
          >
            📋 リリース情報とニュース記事の紐づけを確認
          </Link>
          <button
            onClick={async () => {
              setFetchingNews(true);
              try {
                const res = await fetch("/api/whisky/etl/fetch-news");
                if (!res.ok) {
                  const errorData = await res.json();
                  throw new Error(errorData.error || "ニュース取得に失敗しました");
                }
                const json = await res.json();
                alert(`ニュース取得を完了しました。\n合計${json.totalInserted}件の新しいニュース記事を取得しました。`);
                // ステータスを更新
                setLoading(true);
                fetch("/api/whisky/etl/check-status")
                  .then((res) => res.json())
                  .then((data) => {
                    setData(data);
                    setLoading(false);
                  })
                  .catch((err) => {
                    setError(err.message);
                    setLoading(false);
                  });
              } catch (err: any) {
                alert(`ニュース取得エラー: ${err.message}`);
                console.error("Failed to fetch news:", err);
              } finally {
                setFetchingNews(false);
              }
            }}
            disabled={fetchingNews}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors disabled:opacity-50"
          >
            {fetchingNews ? "取得中..." : "📰 ニュース取得"}
          </button>
          <button
            onClick={() => {
              setLoading(true);
              fetch("/api/whisky/etl/check-status")
                .then((res) => res.json())
                .then((data) => {
                  setData(data);
                  setLoading(false);
                })
                .catch((err) => {
                  setError(err.message);
                  setLoading(false);
                });
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            🔄 更新
          </button>
        </div>
      </div>
    </div>
  );
}

