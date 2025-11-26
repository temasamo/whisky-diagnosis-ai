import Link from "next/link";
import useSWR from "swr";
import WhiskyNewsCard from "@/components/WhiskyNewsCard";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function WeeklyWhiskyNews() {
  const { data, error, isLoading } = useSWR<{ items: any[]; count: number }>(
    "/api/whisky/news/weekly",
    fetcher,
    { refreshInterval: 0, revalidateOnFocus: false }
  );

  if (error) return <div className="text-sm text-red-500">読み込みに失敗しました</div>;
  if (isLoading) return <div className="text-sm text-gray-500">読み込み中…</div>;

  const items = data?.items ?? [];
  if (!items.length) {
    return (
      <div className="text-sm text-gray-500">
        今週のニュースはまだありません
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.slice(0, 8).map((it) => (
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
  );
}

export default function WhiskyLanding() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* 2カラムレイアウト */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 左カラム：既存コンテンツ */}
        <main className="space-y-10">
      {/* Hero */}
      <section className="text-center space-y-4">
        <h1 className="text-3xl md:text-5xl font-extrabold">ウイスキー診断</h1>
        <p className="text-gray-600 text-lg">
          3分で、あなたにぴったりの一本が見つかる。楽天・Yahoo・Amazonを横断して最安も提示。
        </p>

        {/* 横並び3つのボタン：flex-row + gap */}
        <div className="flex flex-row items-center justify-center gap-3 mt-2 flex-wrap">
          <Link href="/whisky/diagnose" className="inline-flex items-center px-5 py-3 rounded-xl bg-black text-white hover:bg-gray-800 transition-colors">
            <span className="mr-2">⚫️</span>
            診断を始める
          </Link>
          <Link href="/whisky/search" className="inline-flex items-center px-5 py-3 rounded-xl border hover:bg-gray-50 transition-colors">
            <span className="mr-2">⚫️</span>
            キーワード検索へ
          </Link>
          <Link href="/whisky/diagnose-detailed" className="inline-flex items-center px-5 py-3 rounded-xl border hover:bg-gray-50 transition-colors">
            <span className="mr-2">⚫️</span>
            詳細選択診断
          </Link>
          {/* 追加：新チャットUI */}
          <Link href="/whisky/chat" className="inline-flex items-center px-5 py-3 rounded-xl border hover:bg-gray-50 transition-colors">
            <span className="mr-2">🥃</span>
            チャット診断（新UI）
          </Link>
          <Link href="/whisky/chat-rag" className="inline-flex items-center px-5 py-3 rounded-xl border hover:bg-gray-50 transition-colors bg-amber-50 border-amber-200">
            <span className="mr-2">🧠</span>
            RAGチャット（知識検索）
          </Link>
          <Link href="/whisky/chat-agent" className="inline-flex items-center px-5 py-3 rounded-xl border hover:bg-gray-50 transition-colors bg-blue-50 border-blue-200">
            <span className="mr-2">🤖</span>
            エージェントチャット
          </Link>
          <Link href="/whisky/releases/calendar" className="inline-flex items-center px-5 py-3 rounded-xl border hover:bg-gray-50 transition-colors">
            <span className="mr-2">📅</span>
            発売日カレンダー
          </Link>
        </div>
      </section>

      {/* Popular shortcuts */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold">人気のショートカット</h2>

        {/* ポイント：ulに flex-wrap + gap、各Linkをinline-block */}
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link href="/whisky/diagnose?preset=peat_strong"
              className="inline-block px-4 py-2 rounded-full border hover:bg-gray-50 transition-colors">ピート強め</Link>
          </li>
          <li>
            <Link href="/whisky/diagnose?preset=fruity"
              className="inline-block px-4 py-2 rounded-full border hover:bg-gray-50 transition-colors">フルーティ</Link>
          </li>
          <li>
            <Link href="/whisky/diagnose?preset=gift_5000"
              className="inline-block px-4 py-2 rounded-full border hover:bg-gray-50 transition-colors">ギフト 5,000円</Link>
          </li>
          <li>
            <Link href="/whisky/diagnose?preset=japanese_10000"
              className="inline-block px-4 py-2 rounded-full border hover:bg-gray-50 transition-colors">ジャパニーズ 1万円</Link>
          </li>
          <li>
            <Link href="/whisky/diagnose?preset=beginner_mild"
              className="inline-block px-4 py-2 rounded-full border hover:bg-gray-50 transition-colors">初心者向け まろやか</Link>
          </li>
        </ul>
      </section>

      {/* How it works */}
      <section className="grid md:grid-cols-3 gap-4">
        {[
          ["質問に答える", "好み・シーン・予算を選ぶだけ"],
          ["おすすめ表示", "候補を1〜3本に絞って提示"],
          ["最安で購入", "楽天・Yahoo・Amazonの最安リンク"],
        ].map(([title, desc]) => (
          <div key={title} className="border rounded-xl p-4 hover:shadow-md transition-shadow">
            <div className="font-semibold mb-2">{title}</div>
            <div className="text-sm text-gray-600">{desc}</div>
          </div>
        ))}
      </section>

      {/* Features */}
      <section className="bg-gray-50 rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4">このサイトの特徴</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="font-semibold mb-1">🎯 診断機能</div>
            <div className="text-gray-600">5つの質問で最適なウイスキーを提案</div>
          </div>
          <div>
            <div className="font-semibold mb-1">💰 最安価格</div>
            <div className="text-gray-600">楽天・Yahoo・Amazonを横断比較</div>
          </div>
          <div>
            <div className="font-semibold mb-1">🛡️ 信頼性</div>
            <div className="text-gray-600">価格外れ値抑制・NG店舗除外</div>
          </div>
          <div>
            <div className="font-semibold mb-1">🔄 重複排除</div>
            <div className="text-gray-600">同一商品の重複表示を防止</div>
          </div>
        </div>
      </section>

      {/* Entrances & Disclosure */}
      <footer className="text-sm text-gray-600 space-y-2">
        <div>
          入口リンク：
          <a className="underline mr-2" href={process.env.NEXT_PUBLIC_RAKUTEN_ENTRANCE_URL} target="_blank" rel="noopener noreferrer">楽天</a> /
          <a className="underline mx-2" href={process.env.NEXT_PUBLIC_AMAZON_ENTRANCE_URL} target="_blank" rel="noopener noreferrer">Amazon</a> /
          <a className="underline ml-2" href="https://shopping.yahoo.co.jp/" target="_blank" rel="noopener noreferrer">Yahoo</a>
        </div>
        <div>※本サイトは各モールのアフィリエイトプログラムを利用しています。</div>
      </footer>
        </main>

        {/* 右カラム：今週の新着ウイスキー */}
        <aside className="space-y-6">
          <div className="sticky top-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">今週の新着ウイスキー</h2>
              <a href="/whisky/news/weekly" className="text-sm text-blue-600 hover:underline">もっと見る →</a>
            </div>
            <WeeklyWhiskyNews />
          </div>
        </aside>
      </div>
    </div>
  );
}
