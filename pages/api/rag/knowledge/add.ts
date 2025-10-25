import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface AddKnowledgeRequest {
  brand: string;
  name: string;
  category: string;
  description: string;
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
  tags: string[];
  source: string;
  confidence: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      brand,
      name,
      category,
      description,
      characteristics,
      availability,
      priceRange,
      tags,
      source,
      confidence
    }: AddKnowledgeRequest = req.body;

    // バリデーション
    if (!brand || !name || !category || !description) {
      return res.status(400).json({ error: '必須フィールドが不足しています' });
    }

    // 重複チェック
    const { data: existing } = await supabase
      .from('whisky_knowledge')
      .select('id')
      .eq('brand', brand)
      .eq('name', name)
      .single();

    if (existing) {
      return res.status(409).json({ error: '同じブランド・商品名の知識が既に存在します' });
    }

    // 知識を追加
    const { data, error } = await supabase
      .from('whisky_knowledge')
      .insert({
        brand,
        name,
        category,
        description,
        characteristics,
        availability,
        price_range: priceRange,
        tags,
        source,
        confidence,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('知識追加エラー:', error);
      return res.status(500).json({ error: '知識の追加に失敗しました' });
    }

    // 学習履歴を追加
    await supabase
      .from('rag_history')
      .insert({
        action: 'add',
        target_id: data.id,
        description: `新しいウイスキー知識を追加: ${brand} ${name}`,
        timestamp: new Date().toISOString(),
        metadata: {
          brand,
          name,
          category
        }
      });

    res.status(201).json({
      success: true,
      data,
      message: '知識が正常に追加されました'
    });

  } catch (error) {
    console.error('知識追加エラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
}
