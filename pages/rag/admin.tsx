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
  const [activeTab, setActiveTab] = useState<'products' | 'system' | 'history' | 'stats' | 'add'>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormData, setAddFormData] = useState({
    brand: '',
    name: '',
    category: '',
    description: '',
    characteristics: {
      taste: [] as string[],
      smokiness: 'none' as 'none' | 'light' | 'medium' | 'strong',
      fruitiness: 'none' as 'none' | 'light' | 'medium' | 'strong',
      aftertaste: '',
      uniqueness: ''
    },
    availability: {
      level: 'easy' as 'easy' | 'moderate' | 'difficult',
      description: '',
      recentTrend: ''
    },
    priceRange: {
      min: 0,
      max: 0,
      category: 'budget' as 'budget' | 'mid' | 'premium' | 'luxury'
    },
    tags: [] as string[],
    source: '',
    confidence: 0.9
  });
  const [addFormLoading, setAddFormLoading] = useState(false);

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

  const handleAddKnowledge = async () => {
    try {
      setAddFormLoading(true);
      
      const response = await fetch('/api/rag/knowledge/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(addFormData),
      });

      const result = await response.json();

      if (response.ok) {
        alert('知識が正常に追加されました');
        setShowAddForm(false);
        setAddFormData({
          brand: '',
          name: '',
          category: '',
          description: '',
          characteristics: {
            taste: [],
            smokiness: 'none',
            fruitiness: 'none',
            aftertaste: '',
            uniqueness: ''
          },
          availability: {
            level: 'easy',
            description: '',
            recentTrend: ''
          },
          priceRange: {
            min: 0,
            max: 0,
            category: 'budget'
          },
          tags: [],
          source: '',
          confidence: 0.9
        });
        fetchData(); // データを再取得
      } else {
        alert(`エラー: ${result.error}`);
      }
    } catch (error) {
      console.error('知識追加エラー:', error);
      alert('知識の追加に失敗しました');
    } finally {
      setAddFormLoading(false);
    }
  };

  // 商品関連とシステム関連に分類
  const productKnowledge = knowledge.filter(k => k.category !== 'システム');
  const systemKnowledge = knowledge.filter(k => k.category === 'システム');

  // 検索フィルタリング
  const filteredProductKnowledge = productKnowledge.filter(k => 
    !searchQuery || 
    k.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
    k.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    k.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    k.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredSystemKnowledge = systemKnowledge.filter(k => 
    !searchQuery || 
    k.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    k.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    k.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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

        {/* 検索バー */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="ウイスキー名、ブランド、タグで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* タブナビゲーション */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('products')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'products'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              商品知識 ({filteredProductKnowledge.length})
            </button>
            <button
              onClick={() => setActiveTab('system')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'system'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              システムルール ({filteredSystemKnowledge.length})
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
            <button
              onClick={() => setActiveTab('add')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'add'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              知識追加
            </button>
          </nav>
        </div>

        {/* コンテンツ */}
        {activeTab === 'products' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">ウイスキー商品知識</h2>
              <p className="mt-1 text-sm text-gray-500">
                登録されているウイスキー商品の専門知識一覧 ({filteredProductKnowledge.length}件)
              </p>
            </div>
            <div className="divide-y divide-gray-200">
              {filteredProductKnowledge.map((item) => (
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
              {filteredProductKnowledge.length === 0 && (
                <div className="p-6 text-center text-gray-500">
                  {searchQuery ? '検索条件に一致する商品が見つかりませんでした' : '商品知識が登録されていません'}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">システムルール</h2>
              <p className="mt-1 text-sm text-gray-500">
                商品判定やカテゴリ分類に関するシステムルール ({filteredSystemKnowledge.length}件)
              </p>
            </div>
            <div className="divide-y divide-gray-200">
              {filteredSystemKnowledge.map((item) => (
                <div key={item.id} className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-medium text-gray-900">
                          {item.name}
                        </h3>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          システム
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{item.description}</p>
                      
                      <div className="mt-2">
                        <h4 className="text-sm font-medium text-gray-700">ルール詳細</h4>
                        <div className="bg-gray-50 p-3 rounded-md mt-1">
                          <p className="text-sm text-gray-700">{item.characteristics.uniqueness}</p>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="ml-4 text-right text-xs text-gray-500">
                      <p>信頼度: {(item.confidence * 100).toFixed(0)}%</p>
                      <p>出典: {item.source}</p>
                    </div>
                  </div>
                </div>
              ))}
              {filteredSystemKnowledge.length === 0 && (
                <div className="p-6 text-center text-gray-500">
                  {searchQuery ? '検索条件に一致するシステムルールが見つかりませんでした' : 'システムルールが登録されていません'}
                </div>
              )}
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

        {activeTab === 'add' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">新しい知識を追加</h2>
              <p className="mt-1 text-sm text-gray-500">
                ウイスキーの専門知識を新規登録します
              </p>
            </div>
            <div className="p-6">
              <form onSubmit={(e) => { e.preventDefault(); handleAddKnowledge(); }} className="space-y-6">
                {/* 基本情報 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ブランド名 *
                    </label>
                    <input
                      type="text"
                      value={addFormData.brand}
                      onChange={(e) => setAddFormData({...addFormData, brand: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      商品名 *
                    </label>
                    <input
                      type="text"
                      value={addFormData.name}
                      onChange={(e) => setAddFormData({...addFormData, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      カテゴリ *
                    </label>
                    <select
                      value={addFormData.category}
                      onChange={(e) => setAddFormData({...addFormData, category: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                      required
                    >
                      <option value="">選択してください</option>
                      <option value="サントリー">サントリー</option>
                      <option value="ニッカ">ニッカ</option>
                      <option value="その他">その他</option>
                      <option value="システム">システム</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      信頼度
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={addFormData.confidence}
                      onChange={(e) => setAddFormData({...addFormData, confidence: parseFloat(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    説明 *
                  </label>
                  <textarea
                    value={addFormData.description}
                    onChange={(e) => setAddFormData({...addFormData, description: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                    required
                  />
                </div>

                {/* 味わい特性 */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">味わい特性</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        スモーキー度
                      </label>
                      <select
                        value={addFormData.characteristics.smokiness}
                        onChange={(e) => setAddFormData({
                          ...addFormData,
                          characteristics: {...addFormData.characteristics, smokiness: e.target.value as any}
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                      >
                        <option value="none">なし</option>
                        <option value="light">軽い</option>
                        <option value="medium">中程度</option>
                        <option value="strong">強い</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        フルーティ度
                      </label>
                      <select
                        value={addFormData.characteristics.fruitiness}
                        onChange={(e) => setAddFormData({
                          ...addFormData,
                          characteristics: {...addFormData.characteristics, fruitiness: e.target.value as any}
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                      >
                        <option value="none">なし</option>
                        <option value="light">軽い</option>
                        <option value="medium">中程度</option>
                        <option value="strong">強い</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      後味
                    </label>
                    <input
                      type="text"
                      value={addFormData.characteristics.aftertaste}
                      onChange={(e) => setAddFormData({
                        ...addFormData,
                        characteristics: {...addFormData.characteristics, aftertaste: e.target.value}
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* 価格帯 */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">価格帯</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        最低価格
                      </label>
                      <input
                        type="number"
                        value={addFormData.priceRange.min}
                        onChange={(e) => setAddFormData({
                          ...addFormData,
                          priceRange: {...addFormData.priceRange, min: parseInt(e.target.value) || 0}
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        最高価格
                      </label>
                      <input
                        type="number"
                        value={addFormData.priceRange.max}
                        onChange={(e) => setAddFormData({
                          ...addFormData,
                          priceRange: {...addFormData.priceRange, max: parseInt(e.target.value) || 0}
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        価格カテゴリ
                      </label>
                      <select
                        value={addFormData.priceRange.category}
                        onChange={(e) => setAddFormData({
                          ...addFormData,
                          priceRange: {...addFormData.priceRange, category: e.target.value as any}
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                      >
                        <option value="budget">予算</option>
                        <option value="mid">中級</option>
                        <option value="premium">高級</option>
                        <option value="luxury">最高級</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* タグ */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">タグ</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      タグ（カンマ区切り）
                    </label>
                    <input
                      type="text"
                      value={addFormData.tags.join(', ')}
                      onChange={(e) => setAddFormData({
                        ...addFormData,
                        tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag)
                      })}
                      placeholder="入門, 飲みやすい, 手頃"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* 送信ボタン */}
                <div className="border-t pt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('products')}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={addFormLoading}
                    className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
                  >
                    {addFormLoading ? '追加中...' : '知識を追加'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
