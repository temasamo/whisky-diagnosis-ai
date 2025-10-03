import { NextApiRequest, NextApiResponse } from 'next';
import { ragDatabase } from '../../lib/rag-database';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { taste, smokiness, budget, availability } = req.body;

    const preferences = {
      taste: taste || [],
      smokiness: smokiness || undefined,
      budget: budget || undefined,
      availability: availability || undefined,
    };

    const recommendations = ragDatabase.getRecommendations(preferences);

    res.status(200).json({
      preferences,
      recommendations,
      count: recommendations.length,
    });
  } catch (error) {
    console.error('RAG recommend error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
