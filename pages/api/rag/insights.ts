import { NextApiRequest, NextApiResponse } from 'next';
import { integrateRAGWithDiagnosis } from '../../../lib/rag-integration';
import { initializeRAGDatabase } from '../../../lib/rag-database';

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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { diagnosisResult } = req.body;

    if (!diagnosisResult) {
      return res.status(400).json({ error: 'Diagnosis result is required' });
    }

    // RAG知識を統合
    const ragInsights = await integrateRAGWithDiagnosis(diagnosisResult);

    res.status(200).json({
      success: true,
      data: ragInsights,
    });
  } catch (error) {
    console.error('RAG insights error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
