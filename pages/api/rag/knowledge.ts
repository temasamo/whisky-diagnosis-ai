import { NextApiRequest, NextApiResponse } from 'next';
import { ragDatabase, initializeRAGDatabase } from '../../../lib/rag-database';

// サーバーサイドで初期化を確実に実行
let isInitialized = false;
if (!isInitialized) {
  initializeRAGDatabase();
  isInitialized = true;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    // 新しい知識の追加
    try {
      const knowledgeData = req.body;
      const id = ragDatabase.addKnowledge(knowledgeData);
      
      res.status(201).json({
        id,
        message: 'Knowledge added successfully',
      });
    } catch (error) {
      console.error('Add knowledge error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'PUT') {
    // 知識の更新
    try {
      const { id, ...updates } = req.body;
      const success = ragDatabase.updateKnowledge(id, updates);
      
      if (success) {
        res.status(200).json({ message: 'Knowledge updated successfully' });
      } else {
        res.status(404).json({ error: 'Knowledge not found' });
      }
    } catch (error) {
      console.error('Update knowledge error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'GET') {
    // 全知識の取得
    try {
      const { q, category } = req.query;
      
      let results;
      if (q) {
        results = ragDatabase.searchKnowledge(q as string, category ? { category: category as string } : undefined);
      } else {
        // 全知識を取得（簡易実装）
        results = ragDatabase.searchKnowledge('', category ? { category: category as string } : undefined);
      }
      
      res.status(200).json({
        knowledge: results,
        count: results.length,
      });
    } catch (error) {
      console.error('Get knowledge error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
