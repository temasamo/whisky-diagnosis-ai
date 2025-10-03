import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md mx-auto text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-6">
          ウイスキー診断AI
        </h1>
        <p className="text-gray-600 mb-8">
          あなたにぴったりのウイスキーを見つけましょう
        </p>
        <div className="space-y-4">
          <Link 
            href="/whisky"
            className="inline-block bg-black text-white px-8 py-3 rounded-lg hover:bg-gray-800 transition-colors w-full"
          >
            ウイスキー検索を始める
          </Link>
          <Link 
            href="/rag/admin"
            className="inline-block bg-amber-600 text-white px-8 py-3 rounded-lg hover:bg-amber-700 transition-colors w-full"
          >
            RAG知識ベース管理
          </Link>
        </div>
      </div>
    </div>
  );
}
