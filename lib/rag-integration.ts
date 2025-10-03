// RAG知識と診断結果の統合機能

import { ragDatabase } from './rag-database';

export interface ExpertSource {
  id: string;
  name: string; // M氏、O氏など
  title?: string; // 専門家、ソムリエなど
  expertise?: string[]; // 専門分野
  credibility: number; // 信頼度 (0-1)
}

export interface RAGInsight {
  id: string;
  whiskyName: string;
  insight: string;
  source: ExpertSource;
  confidence: number;
  context: string; // 診断結果の文脈
  createdAt: Date;
}

export interface DiagnosisWithRAG {
  originalDiagnosis: any;
  ragInsights: RAGInsight[];
  expertRecommendations: {
    primary: RAGInsight[];
    alternative: RAGInsight[];
  };
  summary: string;
}

// 専門家ソースの管理
class ExpertSourceManager {
  private sources: Map<string, ExpertSource> = new Map();

  constructor() {
    this.initializeDefaultSources();
  }

  private initializeDefaultSources(): void {
    // M氏の情報を追加
    this.addSource({
      id: 'expert_m',
      name: 'M氏',
      title: 'ウイスキー専門家',
      expertise: ['日本ウイスキー', 'サントリー', 'ニッカ'],
      credibility: 0.95,
    });

    // 将来の拡張用：O氏など
    // this.addSource({
    //   id: 'expert_o',
    //   name: 'O氏',
    //   title: 'ソムリエ',
    //   expertise: ['スコッチウイスキー', 'ブレンデッド'],
    //   credibility: 0.90,
    // });
  }

  addSource(source: ExpertSource): void {
    this.sources.set(source.id, source);
  }

  getSource(id: string): ExpertSource | undefined {
    return this.sources.get(id);
  }

  getAllSources(): ExpertSource[] {
    return Array.from(this.sources.values());
  }
}

// RAG知識と診断結果の統合
class RAGIntegrationService {
  private expertManager = new ExpertSourceManager();

  // 診断結果に基づいてRAG知識を取得し、専門家の見解を生成
  async generateRAGInsights(diagnosisResult: any): Promise<DiagnosisWithRAG> {
    const ragInsights: RAGInsight[] = [];
    
    // 診断結果から検索クエリを生成
    const searchQuery = this.buildSearchQuery(diagnosisResult);
    
    // RAG知識ベースから関連情報を検索
    const ragResults = ragDatabase.searchKnowledge(searchQuery);
    
    // 各結果に対して専門家の見解を生成
    for (const knowledge of ragResults) {
      const expertSource = this.expertManager.getSource('expert_m'); // M氏
      if (expertSource) {
        const insight = this.generateExpertInsight(knowledge, diagnosisResult, expertSource);
        ragInsights.push(insight);
      }
    }

    // 推奨を分類
    const expertRecommendations = this.categorizeRecommendations(ragInsights);
    
    // サマリーを生成
    const summary = this.generateSummary(diagnosisResult, ragInsights);

    return {
      originalDiagnosis: diagnosisResult,
      ragInsights,
      expertRecommendations,
      summary,
    };
  }

  // 診断結果から検索クエリを構築
  private buildSearchQuery(diagnosisResult: any): string {
    const queryParts: string[] = [];
    
    // 地域情報
    if (diagnosisResult.region) {
      queryParts.push(diagnosisResult.region);
    }
    
    // 味わい情報
    if (diagnosisResult.taste) {
      queryParts.push(diagnosisResult.taste);
    }
    
    // ピート情報
    if (diagnosisResult.peat) {
      queryParts.push(diagnosisResult.peat);
    }

    return queryParts.join(' ');
  }

  // 専門家の見解を生成
  private generateExpertInsight(
    knowledge: any, 
    diagnosisResult: any, 
    expertSource: ExpertSource
  ): RAGInsight {
    const insight = this.formatExpertOpinion(knowledge, expertSource);
    
    return {
      id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      whiskyName: `${knowledge.brand} ${knowledge.name}`,
      insight,
      source: expertSource,
      confidence: knowledge.confidence,
      context: this.buildContext(diagnosisResult),
      createdAt: new Date(),
    };
  }

  // 専門家の見解をフォーマット
  private formatExpertOpinion(knowledge: any, expertSource: ExpertSource): string {
    const { name } = expertSource;
    
    // M氏の見解としてフォーマット（「M氏によれば」は削除）
    let opinion = `「${knowledge.brand} ${knowledge.name}」は`;
    
    // 味わいの特徴（重複を避けて簡潔に）
    if (knowledge.characteristics.taste.length > 0) {
      const tasteText = knowledge.characteristics.taste.join('、');
      opinion += `${tasteText}な味わい`;
      
      // スモーキー度（味わいと重複しない場合のみ追加）
      if (knowledge.characteristics.smokiness !== 'none') {
        const smokinessLabels = {
          light: 'で軽いスモーキーさがあります',
          medium: 'で中程度のスモーキーさがあります',
          strong: 'で強いスモーキーさがあります',
        };
        opinion += smokinessLabels[knowledge.characteristics.smokiness] || '';
      }
      opinion += '。';
    }
    
    // 後味（味わいと重複しない場合のみ追加）
    if (knowledge.characteristics.aftertaste && 
        !knowledge.characteristics.taste.includes(knowledge.characteristics.aftertaste)) {
      opinion += `後味は${knowledge.characteristics.aftertaste}。`;
    }
    
    // 入手しやすさと価格帯を簡潔に
    const availabilityLabels = {
      easy: '入手しやすく',
      moderate: '入手可能で',
      difficult: '入手困難だが',
    };
    opinion += `${availabilityLabels[knowledge.availability.level]}価格帯は¥${knowledge.priceRange.min.toLocaleString()}〜¥${knowledge.priceRange.max.toLocaleString()}程度です。`;
    
    return opinion;
  }

  // 文脈を構築
  private buildContext(diagnosisResult: any): string {
    const contextParts: string[] = [];
    
    if (diagnosisResult.scene) {
      contextParts.push(`用途: ${diagnosisResult.scene}`);
    }
    if (diagnosisResult.region) {
      contextParts.push(`地域: ${diagnosisResult.region}`);
    }
    if (diagnosisResult.budget) {
      contextParts.push(`予算: ¥${diagnosisResult.budget.toLocaleString()}`);
    }
    
    return contextParts.join(', ');
  }

  // 推奨を分類
  private categorizeRecommendations(insights: RAGInsight[]): {
    primary: RAGInsight[];
    alternative: RAGInsight[];
  } {
    // 信頼度と適合度でソート
    const sorted = insights.sort((a, b) => {
      const scoreA = a.confidence * (a.source.credibility || 0.5);
      const scoreB = b.confidence * (b.source.credibility || 0.5);
      return scoreB - scoreA;
    });

    return {
      primary: sorted.slice(0, 3), // 上位3つを主要推奨
      alternative: sorted.slice(3, 6), // 次の3つを代替推奨
    };
  }

  // サマリーを生成
  private generateSummary(diagnosisResult: any, insights: RAGInsight[]): string {
    if (insights.length === 0) {
      return '診断結果に基づく専門家の推奨は見つかりませんでした。';
    }

    const primaryCount = Math.min(3, insights.length);
    const expertNames = [...new Set(insights.map(i => i.source.name))].join('、');
    
    return `${expertNames}の専門知識に基づき、${primaryCount}件のウイスキーを推奨いたします。診断結果に最も適合するウイスキーをご提案しています。`;
  }

  // 新しい専門家ソースを追加
  addExpertSource(source: ExpertSource): void {
    this.expertManager.addSource(source);
  }

  // 全専門家ソースを取得
  getAllExpertSources(): ExpertSource[] {
    return this.expertManager.getAllSources();
  }
}

// シングルトンインスタンス
export const ragIntegrationService = new RAGIntegrationService();

// 診断結果にRAG知識を統合する関数
export async function integrateRAGWithDiagnosis(diagnosisResult: any): Promise<DiagnosisWithRAG> {
  return await ragIntegrationService.generateRAGInsights(diagnosisResult);
}

// 専門家ソースを追加する関数
export function addExpertSource(source: ExpertSource): void {
  ragIntegrationService.addExpertSource(source);
}
