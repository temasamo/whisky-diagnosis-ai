-- Supabaseで実行するSQL: whisky_articles テーブル用の類似度検索関数
-- 
-- 使用方法:
-- 1. Supabase Dashboard の SQL Editor を開く
-- 2. 以下のSQLを実行

-- pgvector拡張を有効にする（まだの場合）
CREATE EXTENSION IF NOT EXISTS vector;

-- 類似度検索用のRPC関数を作成
-- 注意: whisky_articles テーブルの構造に合わせて調整してください
-- 想定される構造:
--   id, title, content, category, tags, embedding (vector(1536))

CREATE OR REPLACE FUNCTION match_whisky_articles(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.75,
  match_count int DEFAULT 3
)
RETURNS TABLE (
  id bigint,
  title text,
  content text,
  category text,
  tags text[],
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    wa.id,
    wa.title,
    wa.content,
    wa.category,
    wa.tags,
    1 - (wa.embedding <=> query_embedding) AS similarity
  FROM whisky_articles wa
  WHERE wa.embedding IS NOT NULL
    AND 1 - (wa.embedding <=> query_embedding) > match_threshold
  ORDER BY wa.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- インデックスを作成（検索パフォーマンス向上のため）
-- 注意: 既にインデックスが存在する場合はスキップされます
CREATE INDEX IF NOT EXISTS whisky_articles_embedding_idx 
ON whisky_articles 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

