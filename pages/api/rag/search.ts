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
    const { q, category, taste, smokiness, availability, minPrice, maxPrice } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const filters: any = {};
    if (category) filters.category = category;
    if (taste) filters.taste = Array.isArray(taste) ? taste : [taste];
    if (smokiness) filters.smokiness = smokiness;
    if (availability) filters.availability = availability;
    if (minPrice || maxPrice) {
      filters.priceRange = {
        min: minPrice ? Number(minPrice) : 0,
        max: maxPrice ? Number(maxPrice) : Number.MAX_SAFE_INTEGER,
      };
    }

    const results = ragDatabase.searchKnowledge(q as string, filters);
    
    console.log('RAG Search - Query:', q);
    console.log('RAG Search - Results count:', results.length);
    console.log('RAG Search - First result:', results[0]);

    res.status(200).json({
      query: q,
      results,
      count: results.length,
      filters: filters,
    });
  } catch (error) {
    console.error('RAG search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
