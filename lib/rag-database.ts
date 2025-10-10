// RAG用のデータベース構造とユーティリティ関数

export interface WhiskyKnowledge {
  id: string;
  brand: string;
  name: string;
  category: string; // サントリー、ニッカなど
  characteristics: {
    taste: string[]; // フルーティ、スモーキーなど
    smokiness: 'none' | 'light' | 'medium' | 'strong';
    fruitiness: 'none' | 'light' | 'medium' | 'strong';
    aftertaste: string; // すっきり、残るなど
    uniqueness: string; // 独特さの説明
  };
  availability: {
    level: 'easy' | 'moderate' | 'difficult';
    description: string;
    recentTrend: string; // 最近の入手しやすさの変化
  };
  priceRange: {
    min: number;
    max: number;
    category: 'budget' | 'mid' | 'premium' | 'luxury';
  };
  description: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  source: string; // 情報の出典
  confidence: number; // 情報の信頼度 (0-1)
}

export interface LearningHistory {
  id: string;
  action: 'add' | 'update' | 'delete' | 'search';
  targetId?: string;
  description: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// インメモリデータベース（本番では外部DBを使用）
class RAGDatabase {
  private knowledge: Map<string, WhiskyKnowledge> = new Map();
  private history: LearningHistory[] = [];

  // 知識の追加
  addKnowledge(knowledge: Omit<WhiskyKnowledge, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = `whisky_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    const newKnowledge: WhiskyKnowledge = {
      ...knowledge,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.knowledge.set(id, newKnowledge);
    this.addHistory({
      action: 'add',
      targetId: id,
      description: `新しいウイスキー知識を追加: ${knowledge.brand} ${knowledge.name}`,
      timestamp: now,
    });

    return id;
  }

  // 知識の更新
  updateKnowledge(id: string, updates: Partial<WhiskyKnowledge>): boolean {
    const existing = this.knowledge.get(id);
    if (!existing) return false;

    const updated: WhiskyKnowledge = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date(),
    };

    this.knowledge.set(id, updated);
    this.addHistory({
      action: 'update',
      targetId: id,
      description: `ウイスキー知識を更新: ${updated.brand} ${updated.name}`,
      timestamp: new Date(),
    });

    return true;
  }

  // 知識の検索
  searchKnowledge(query: string, filters?: {
    category?: string;
    taste?: string[];
    smokiness?: string;
    availability?: string;
    priceRange?: { min: number; max: number };
  }): WhiskyKnowledge[] {
    const results: WhiskyKnowledge[] = [];
    const queryLower = query.toLowerCase();

    console.log('RAG Database - Total knowledge items:', this.knowledge.size);
    console.log('RAG Database - Search query:', query);
    console.log('RAG Database - All knowledge keys:', Array.from(this.knowledge.keys()));

    for (const knowledge of this.knowledge.values()) {
      let matches = false;

      // テキスト検索
      const searchableText = [
        knowledge.brand,
        knowledge.name,
        knowledge.description,
        ...knowledge.tags,
        ...knowledge.characteristics.taste,
      ].join(' ').toLowerCase();

      console.log('RAG Database - Checking:', knowledge.brand, knowledge.name, 'Searchable text:', searchableText);

      if (searchableText.includes(queryLower)) {
        matches = true;
        console.log('RAG Database - Match found:', knowledge.brand, knowledge.name);
      }

      // フィルター適用
      if (filters) {
        if (filters.category && knowledge.category !== filters.category) {
          matches = false;
        }
        if (filters.taste && !filters.taste.some(t => knowledge.characteristics.taste.includes(t))) {
          matches = false;
        }
        if (filters.smokiness && knowledge.characteristics.smokiness !== filters.smokiness) {
          matches = false;
        }
        if (filters.availability && knowledge.availability.level !== filters.availability) {
          matches = false;
        }
        if (filters.priceRange) {
          const { min, max } = filters.priceRange;
          if (knowledge.priceRange.min > max || knowledge.priceRange.max < min) {
            matches = false;
          }
        }
      }

      if (matches) {
        results.push(knowledge);
      }
    }

    // 学習履歴に記録
    this.addHistory({
      action: 'search',
      description: `知識検索: "${query}" - ${results.length}件の結果`,
      timestamp: new Date(),
      metadata: { query, filters, resultCount: results.length },
    });

    console.log('RAG Database - Final results count:', results.length);
    console.log('RAG Database - Final results:', results.map(r => ({ brand: r.brand, name: r.name })));

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  // 推奨ウイスキーの取得
  getRecommendations(preferences: {
    taste?: string[];
    smokiness?: string;
    budget?: number;
    availability?: string;
  }): WhiskyKnowledge[] {
    const allKnowledge = Array.from(this.knowledge.values());
    const recommendations: { knowledge: WhiskyKnowledge; score: number }[] = [];

    for (const knowledge of allKnowledge) {
      let score = 0;

      // 味わいの一致度
      if (preferences.taste) {
        const tasteMatches = preferences.taste.filter(t => 
          knowledge.characteristics.taste.includes(t)
        ).length;
        score += (tasteMatches / preferences.taste.length) * 30;
      }

      // スモーキー度の一致度
      if (preferences.smokiness && knowledge.characteristics.smokiness === preferences.smokiness) {
        score += 25;
      }

      // 予算の適合度
      if (preferences.budget) {
        if (knowledge.priceRange.min <= preferences.budget && knowledge.priceRange.max >= preferences.budget) {
          score += 20;
        } else {
          const priceDiff = Math.min(
            Math.abs(knowledge.priceRange.min - preferences.budget),
            Math.abs(knowledge.priceRange.max - preferences.budget)
          );
          score += Math.max(0, 20 - (priceDiff / preferences.budget) * 20);
        }
      }

      // 入手しやすさ
      if (preferences.availability) {
        if (knowledge.availability.level === preferences.availability) {
          score += 15;
        }
      }

      // 信頼度
      score += knowledge.confidence * 10;

      if (score > 0) {
        recommendations.push({ knowledge, score });
      }
    }

    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(r => r.knowledge);
  }

  // 学習履歴の追加
  private addHistory(history: Omit<LearningHistory, 'id'>): void {
    const newHistory: LearningHistory = {
      ...history,
      id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    this.history.push(newHistory);
  }

  // 学習履歴の取得
  getLearningHistory(limit = 50): LearningHistory[] {
    return this.history
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  // 統計情報の取得
  getStats(): {
    totalKnowledge: number;
    categories: Record<string, number>;
    recentActivity: number;
  } {
    const categories: Record<string, number> = {};
    for (const knowledge of this.knowledge.values()) {
      categories[knowledge.category] = (categories[knowledge.category] || 0) + 1;
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentActivity = this.history.filter(h => h.timestamp > oneDayAgo).length;

    return {
      totalKnowledge: this.knowledge.size,
      categories,
      recentActivity,
    };
  }
}

// シングルトンインスタンス
export const ragDatabase = new RAGDatabase();

// 初期データの投入
export function initializeRAGDatabase(): void {
  // サントリーウイスキーの知識を追加
  const suntoryWhiskies = [
    {
      brand: 'サントリー',
      name: '角ウイスキー',
      category: 'サントリー',
      characteristics: {
        taste: ['癖がない', '飲みやすい'],
        smokiness: 'none' as const,
        fruitiness: 'light' as const,
        aftertaste: 'すっきり',
        uniqueness: '癖がなく飲みやすい',
      },
      availability: {
        level: 'easy' as const,
        description: '価格も手頃で、手に入りやすい',
        recentTrend: '安定して入手可能',
      },
      priceRange: {
        min: 1000,
        max: 2000,
        category: 'budget' as const,
      },
      description: '癖がなく飲みやすい。価格も手頃で、手に入りやすい。',
      tags: ['入門', '飲みやすい', '手頃'],
      source: 'ユーザー提供',
      confidence: 0.9,
    },
    {
      brand: 'サントリー',
      name: '白州',
      category: 'サントリー',
      characteristics: {
        taste: ['フルーティー', '癖がない', 'すっきり'],
        smokiness: 'none' as const,
        fruitiness: 'strong' as const,
        aftertaste: 'すっきり',
        uniqueness: 'フルーティーでスモーキーさが無い',
      },
      availability: {
        level: 'moderate' as const,
        description: '最近は徐々に手に入りやすくはなってきた',
        recentTrend: '徐々に入手しやすくなってきている',
      },
      priceRange: {
        min: 3000,
        max: 8000,
        category: 'mid' as const,
      },
      description: 'フルーティーですが、癖がなくてスモーキーさが無いため、飲みやすく後味もすっきりしている。最近は徐々に手に入りやすくはなってきた。',
      tags: ['フルーティー', 'すっきり', '人気'],
      source: 'ユーザー提供',
      confidence: 0.9,
    },
    {
      brand: 'サントリー',
      name: '山崎',
      category: 'サントリー',
      characteristics: {
        taste: ['スモーキー', '鼻に残る'],
        smokiness: 'strong' as const,
        fruitiness: 'light' as const,
        aftertaste: 'スモーキーな感覚が鼻に残る',
        uniqueness: 'フルーティーというよりはスモーキー寄り',
      },
      availability: {
        level: 'moderate' as const,
        description: '白州と同様で徐々に手に入りやすくはなってきた',
        recentTrend: '徐々に入手しやすくなってきている',
      },
      priceRange: {
        min: 5000,
        max: 15000,
        category: 'premium' as const,
      },
      description: 'フルーティーというよりはスモーキー寄りのウイスキー。飲んだ後にスモーキーな感覚が鼻に残る。白州と同様で徐々に手に入りやすくはなってきた。',
      tags: ['スモーキー', '高級', '人気'],
      source: 'ユーザー提供',
      confidence: 0.9,
    },
    {
      brand: 'サントリー',
      name: '響',
      category: 'サントリー',
      characteristics: {
        taste: ['スモーキー', '樽の香り'],
        smokiness: 'strong' as const,
        fruitiness: 'medium' as const,
        aftertaste: '樽の香りが鼻に残る',
        uniqueness: '樽の香りが白州や山崎に比べ鼻に残る感覚がある',
      },
      availability: {
        level: 'difficult' as const,
        description: '高級品で入手困難',
        recentTrend: '入手困難な状況が続いている',
      },
      priceRange: {
        min: 15000,
        max: 50000,
        category: 'luxury' as const,
      },
      description: 'スモーキー寄りのウイスキーですが、樽の香りが白州や山崎に比べ鼻に残る感覚がある。',
      tags: ['スモーキー', '樽香', '高級'],
      source: 'ユーザー提供',
      confidence: 0.9,
    },
    {
      brand: 'サントリー',
      name: '知多',
      category: 'サントリー',
      characteristics: {
        taste: ['すっきり', '飲みやすい'],
        smokiness: 'none' as const,
        fruitiness: 'light' as const,
        aftertaste: 'スッキリした味わい',
        uniqueness: '独特さは無く、飲みやすい',
      },
      availability: {
        level: 'easy' as const,
        description: '最近は店頭でも見かける為、手に入りやすくなった',
        recentTrend: '店頭でも見かけるようになった',
      },
      priceRange: {
        min: 2000,
        max: 4000,
        category: 'mid' as const,
      },
      description: '上記3種類のウイスキーに比べ、後味がスッキリした味わい。独特さは無く、飲みやすい。最近は店頭でも見かける為、手に入りやすくなった。',
      tags: ['すっきり', '飲みやすい', '手頃'],
      source: 'ユーザー提供',
      confidence: 0.9,
    },
  ];

  // ニッカウイスキーの知識を追加
  const nikkaWhiskies = [
    {
      brand: 'ニッカ',
      name: '竹鶴',
      category: 'ニッカ',
      characteristics: {
        taste: ['スモーキー', '鼻を通る'],
        smokiness: 'strong' as const,
        fruitiness: 'none' as const,
        aftertaste: '鼻を通るスモーキーな感覚が残る',
        uniqueness: 'スモーキーさが強い',
      },
      availability: {
        level: 'moderate' as const,
        description: '最近は手に入りやすくはなってきたが、店頭ではなかなか見かけない',
        recentTrend: '徐々に入手しやすくなってきている',
      },
      priceRange: {
        min: 4000,
        max: 10000,
        category: 'mid' as const,
      },
      description: 'スモーキーさが強いウイスキー。飲んだ後鼻を通るスモーキーな感覚が残る。最近は手に入りやすくはなってきたが、店頭ではなかなか見かけない。',
      tags: ['スモーキー', '強い', 'ニッカ'],
      source: 'ユーザー提供',
      confidence: 0.9,
    },
    {
      brand: 'ニッカ',
      name: 'トリス',
      category: 'ニッカ',
      characteristics: {
        taste: ['フルーティー', 'すっきり', '飲みやすい'],
        smokiness: 'none' as const,
        fruitiness: 'medium' as const,
        aftertaste: 'すっきり',
        uniqueness: 'ニッカウイスキーの中でも入門的',
      },
      availability: {
        level: 'easy' as const,
        description: 'ニッカウイスキーの中でも手に入りやすい',
        recentTrend: '安定して入手可能',
      },
      priceRange: {
        min: 1500,
        max: 3000,
        category: 'budget' as const,
      },
      description: 'ニッカウイスキーの中でも入門的なウイスキー。飲みやすく味わいもすっきりしている。フルーティーな部類ですが、サントリーの角ウイスキーに感覚は近い。ニッカウイスキーの中でも手に入りやすい。',
      tags: ['入門', 'フルーティー', '飲みやすい'],
      source: 'ユーザー提供',
      confidence: 0.9,
    },
    {
      brand: 'ニッカ',
      name: '余市',
      category: 'ニッカ',
      characteristics: {
        taste: ['薬のような香り', '独特な味わい'],
        smokiness: 'medium' as const,
        fruitiness: 'none' as const,
        aftertaste: '薬のような香りと味わいが鼻を通る',
        uniqueness: '独特な味わいで、薬のような香り',
      },
      availability: {
        level: 'moderate' as const,
        description: '竹鶴よりは手に入りやすく、店頭でもたまに見かける',
        recentTrend: '店頭でもたまに見かけるようになった',
      },
      priceRange: {
        min: 3000,
        max: 8000,
        category: 'mid' as const,
      },
      description: '独特な味わいで、薬のような香りと味わいが鼻を通る。フルーティーよりはスモーキーな感じ。竹鶴よりは手に入りやすく、店頭でもたまに見かける。',
      tags: ['独特', '薬香', 'スモーキー'],
      source: 'ユーザー提供',
      confidence: 0.9,
    },
  ];

  // 商品カテゴリ判定ルールを追加
  const categoryRules = [
    {
      brand: 'システム',
      name: 'ウイスキー関連商品判定ルール',
      category: 'システム',
      characteristics: {
        taste: [],
        smokiness: 'none' as const,
        fruitiness: 'none' as const,
        aftertaste: '',
        uniqueness: '商品カテゴリの自動判定ルール',
      },
      availability: {
        level: 'easy' as const,
        description: '常に利用可能',
        recentTrend: 'ルールが更新される',
      },
      priceRange: {
        min: 0,
        max: 0,
        category: 'budget' as const,
      },
      description: 'ウイスキー関連商品の判定ルール。ハイボールはウイスキーベースの飲料として含める。チューハイは焼酎ベースなので除外。ビール、ワイン、日本酒、焼酎などは除外対象。',
      tags: ['ルール', '判定', 'カテゴリ', 'ウイスキー', 'ハイボール', 'チューハイ除外', 'ビール除外', 'ワイン除外'],
      source: 'システム定義',
      confidence: 1.0,
    },
    {
      brand: 'システム',
      name: '除外対象商品カテゴリ',
      category: 'システム',
      characteristics: {
        taste: [],
        smokiness: 'none' as const,
        fruitiness: 'none' as const,
        aftertaste: '',
        uniqueness: 'ウイスキー以外の商品カテゴリ',
      },
      availability: {
        level: 'easy' as const,
        description: '常に利用可能',
        recentTrend: 'ルールが更新される',
      },
      priceRange: {
        min: 0,
        max: 0,
        category: 'budget' as const,
      },
      description: 'ウイスキー以外の商品カテゴリ：196シリーズ（RTD飲料）、チューハイ（焼酎ベース）、ビール、ワイン、梅酒、スパークリング、ブランデー、コニャック、ラム、ウォッカ、ジン、テキーラ、焼酎、日本酒、清酒、カクテル、ソフトドリンク、炭酸、ジュース、お茶、コーヒー、水、ミネラルウォーター、エナジードリンク、スポーツドリンク、機能性飲料、RTD、ready to drink、無糖、果実、フルーツ、甘い、フレーバー、味など',
      tags: ['除外', '196シリーズ', 'チューハイ', 'ビール', 'ワイン', '日本酒', '焼酎', 'ソフトドリンク', '無糖', 'フルーツ'],
      source: 'システム定義',
      confidence: 1.0,
    }
  ];

  // データベースに追加
  console.log('Initializing RAG database with', suntoryWhiskies.length + nikkaWhiskies.length + categoryRules.length, 'items');
  
  [...suntoryWhiskies, ...nikkaWhiskies, ...categoryRules].forEach(whisky => {
    const id = ragDatabase.addKnowledge(whisky);
    console.log('Added knowledge:', whisky.brand, whisky.name, 'ID:', id);
  });
  
  console.log('RAG database initialization complete. Total items:', ragDatabase.getStats().totalKnowledge);
}
