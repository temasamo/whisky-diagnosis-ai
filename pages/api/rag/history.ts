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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { limit = '50' } = req.query;
    const history = ragDatabase.getLearningHistory(Number(limit));
    const stats = ragDatabase.getStats();

    res.status(200).json({
      history,
      stats,
      count: history.length,
    });
  } catch (error) {
    console.error('RAG history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
