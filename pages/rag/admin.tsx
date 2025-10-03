import { useState, useEffect } from 'react';
import Link from 'next/link';

interface WhiskyKnowledge {
  id: string;
  brand: string;
  name: string;
  category: string;
  characteristics: {
    taste: string[];
    smokiness: 'none' | 'light' | 'medium' | 'strong';
    fruitiness: 'none' | 'light' | 'medium' | 'strong';
    aftertaste: string;
    uniqueness: string;
  };
  availability: {
    level: 'easy' | 'moderate' | 'difficult';
    description: string;
    recentTrend: string;
  };
  priceRange: {
    min: number;
    max: number;
    category: 'budget' | 'mid' | 'premium' | 'luxury';
  };
  description: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  source: string;
  confidence: number;
}

interface LearningHistory {
  id: string;
  action: 'add' | 'update' | 'delete' | 'search';
  targetId?: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface Stats {
  totalKnowledge: number;
  categories: Record<string, number>;
  recentActivity: number;
}

export default function RAGAdmin() {
  const [knowledge, setKnowledge] = useState<WhiskyKnowledge[]>([]);
  const [history, setHistory] = useState<LearningHistory[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'knowledge' | 'history' | 'stats'>('knowledge');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 知識データの取得
      const knowledgeRes = await fetch('/api/rag/knowledge');
      const knowledgeData = await knowledgeRes.json();
      setKnowledge(knowledgeData.knowledge || []);

      // 履歴データの取得
      const historyRes = await fetch('/api/rag/history');
      const historyData = await historyRes.json();
      setHistory(historyData.history || []);
      setStats(historyData.stats || null);

    } catch (error) {
      console.error('データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP');
  };

  const getSmokinessLabel = (level: string) => {
    const labels = {
      none: 'なし',
      light: '軽い',
      medium: '中程度',
      strong: '強い',
    };
    return labels[level as keyof typeof labels] || level;
  };

  const getAvailabilityLabel = (level: string) => {
    const labels = {
      easy: '入手容易',
      moderate: '入手可能',
      difficult: '入手困難',
    };
    return labels[level as keyof typeof labels] || level;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">データを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">RAG知識ベース管理</h1>
              <p className="mt-2 text-gray-600">ウイスキーの専門知識を管理・学習履歴を確認</p>
            </div>
            <Link
              href="/"
              className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
            >
              ホームに戻る
            </Link>
          </div>
        </div>

        {/* タブナビゲーション */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('knowledge')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'knowledge'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              知識ベース ({knowledge.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'history'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              学習履歴 ({history.length})
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'stats'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              統計情報
            </button>
          </nav>
        </div>

        {/* コンテンツ */}
        {activeTab === 'knowledge' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">ウイスキー知識ベース</h2>
              <p className="mt-1 text-sm text-gray-500">
                現在 {knowledge.length} 件の知識が登録されています
              </p>
            </div>
            <div className="divide-y divide-gray-200">
              {knowledge.map((item) => (
                <div key={item.id} className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-medium text-gray-900">
                          {item.brand} {item.name}
                        </h3>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          {item.category}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{item.description}</p>
                      
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700">味わい</h4>
                          <p className="text-sm text-gray-600">
                            スモーキー: {getSmokinessLabel(item.characteristics.smokiness)}<br/>
                            フルーティ: {getSmokinessLabel(item.characteristics.fruitiness)}<br/>
                            後味: {item.characteristics.aftertaste}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-700">入手しやすさ</h4>
                          <p className="text-sm text-gray-600">
                            {getAvailabilityLabel(item.availability.level)}<br/>
                            {item.availability.description}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-700">価格帯</h4>
                          <p className="text-sm text-gray-600">
                            ¥{item.priceRange.min.toLocaleString()} - ¥{item.priceRange.max.toLocaleString()}<br/>
                            {item.priceRange.category}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="ml-4 text-right text-xs text-gray-500">
                      <p>信頼度: {(item.confidence * 100).toFixed(0)}%</p>
                      <p>更新: {formatDate(item.updatedAt)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">学習履歴</h2>
              <p className="mt-1 text-sm text-gray-500">
                システムの学習・更新履歴を表示
              </p>
            </div>
            <div className="divide-y divide-gray-200">
              {history.map((item) => (
                <div key={item.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        アクション: {item.action} | {formatDate(item.timestamp)}
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      item.action === 'add' ? 'bg-green-100 text-green-800' :
                      item.action === 'update' ? 'bg-blue-100 text-blue-800' :
                      item.action === 'delete' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {item.action}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'stats' && stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900">総知識数</h3>
              <p className="text-3xl font-bold text-amber-600 mt-2">
                {stats.totalKnowledge}
              </p>
              <p className="text-sm text-gray-500 mt-1">登録済みの知識</p>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900">最近の活動</h3>
              <p className="text-3xl font-bold text-blue-600 mt-2">
                {stats.recentActivity}
              </p>
              <p className="text-sm text-gray-500 mt-1">過去24時間の活動</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900">カテゴリ別</h3>
              <div className="mt-2 space-y-1">
                {Object.entries(stats.categories).map(([category, count]) => (
                  <div key={category} className="flex justify-between text-sm">
                    <span className="text-gray-600">{category}</span>
                    <span className="font-medium text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
