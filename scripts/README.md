# データ移行スクリプト

このディレクトリには、旧Supabaseから新しいSupabaseへのデータ移行用スクリプトが含まれています。

## セットアップ

### 1. 環境変数の設定

`.env.local` または `.env` ファイルに以下の環境変数を設定してください：

```bash
# 旧Supabase (whisky_diagnosis_ai)
OLD_SUPABASE_URL=https://your-old-project.supabase.co
OLD_SUPABASE_SERVICE_ROLE_KEY=your-old-service-role-key

# 新しいSupabase (market-ai-suite)
NEW_SUPABASE_URL=https://your-new-project.supabase.co
NEW_SUPABASE_SERVICE_ROLE_KEY=your-new-service-role-key

# OpenAI API Key (ベクトル化用)
OPENAI_API_KEY=your-openai-api-key
```

## 使用方法

### ステップ1: 依存関係のインストール

```bash
npm install
```

### ステップ2: データのエクスポート

旧Supabaseからデータをエクスポートします。

```bash
npm run export:whisky
```

エクスポートされたデータは `data/whisky-data-export.json` に保存されます。

### ステップ3: データのインポート

新しいSupabaseへデータをインポートします。

```bash
npm run import:whisky
```

### ステップ4: ベクトル化（オプション）

ウイスキーデータをベクトル化してSupabaseに登録します。

```bash
npm run embed:whisky
```

**注意**: ベクトル化には `whisky_embeddings` テーブルが必要です。テーブル構造は以下のようになります：

```sql
CREATE TABLE whisky_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expression_id UUID REFERENCES expressions(id),
  brand_name TEXT,
  expression_name TEXT,
  text TEXT,
  embedding vector(1536), -- OpenAI text-embedding-3-small の次元数
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(expression_id)
);
```

## 移行されるデータ

- **brands**: ブランド情報
- **expressions**: ウイスキー表現情報
- **releases**: リリース情報
- **whisky_news**: ウイスキーニュース（オプション）

## トラブルシューティング

### エラー: "Could not find the table"

テーブルが存在しない場合は、新しいSupabaseプロジェクトでテーブルを作成してください。

### エラー: "OpenAI API Key が設定されていません"

ベクトル化をスキップする場合は、このエラーは無視できます。

### 重複エラー

既にインポート済みのデータは自動的にスキップされます。
