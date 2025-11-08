# 🥃 Whisky Knowledge × AI Integration
**Project:** Whisky Diagnosis AI + Knowledge RAG Structure  
**Version:** 0.9 (構想段階)  
**Author:** Market Supporter AI Team  
**Date:** 2025-11-07

---

## 🎯 目的（Purpose）
「**ウイスキー診断AI**」のRAG（Retrieval Augmented Generation）を構築し、Market Supporter AI の記事資産（ウイスキー知識シリーズ）を AI の回答精度とUXに活用する。

---

## 🧩 全体構成（Overview）
/whisky-knowledge/
├── basics/ # 基礎・入門編（RAG基礎知識層）
├── science/ # 製法・科学編（理論説明層）
├── brands/ # 銘柄別特集（辞書層 / 検索層）
├── culture/ # 文化・楽しみ方編（体験・感性層）
├── images/ # 各記事のAI生成画像（.jpg）
└── embeddings/ # RAG用チャンク化データ（自動生成）

---

## 🧠 RAG設計方針（Design Policy）

| 層 | フォルダ | 内容 | 主な用途 |
|---|---|---|---|
| **1. 基礎層** | `/basics/` | 用語・定義・分類 | 「ウイスキーとは？」等の一般質問 |
| **2. 理論層** | `/science/` | 製法・熟成・香りの科学 | 「なぜ？」系の根拠説明 |
| **3. 辞書層** | `/brands/` | ブランド/銘柄情報 | 診断結果の銘柄補足 |
| **4. 文化層** | `/culture/` | 飲み方・保存・旅・AI | 体験・文化系の提案 |

---

## 🧱 Supabase 構成（Schema）
```sql
-- whisky_embeddings テーブル（仮）
CREATE TABLE whisky_embeddings (
  id bigint primary key generated always as identity,
  title text,
  category text,
  content text,
  embedding vector(1536),
  slug text,
  created_at timestamptz default now()
);
-- pgvector 必須: CREATE EXTENSION IF NOT EXISTS vector;
OpenAI embeddings: text-embedding-3-small
記事更新時はチャンク分割（500–700 tokens）→ 再埋め込み
自動更新は GitHub Actions または Supabase Edge Functions で運用
🔄 自動連携フロー（Integration Flow）
flowchart TD
A[Whisky Blog MDX] -->|parse + chunk| B[Embedding Script]
B -->|generate| C[OpenAI API (text-embedding-3-small)]
C -->|vector insert| D[Supabase: whisky_embeddings]
D -->|semantic search| E[Whisky Diagnosis AI]
E -->|RAG answer| F[User]
/content/whisky/ を自動スキャン
保存メタ：title / category / slug / date
RAGクエリは Top-k=3 を初期値にABテスト
📚 記事フェーズ設計（Production Phases）
フェーズ	主題	本数	状況	優先度
Phase 1	基礎・科学	10	第1〜7章済、残3本	🔥
Phase 2	製法・職人技	10	準備中（樽・ピート・蒸留）	🔜
Phase 3	ブランド・地域	10	白州・山崎から開始	🔜
Phase 4	文化・AI連動	10	2026春想定	🕓
現状（抜粋）
完了：第1章（基礎）、第2章（五大）、第6章（樽/熟成 修正版）、第7章（ブレンド 修正版）
近日：原料比較、蒸留の科学、ピート、度数と風味、年数表示の意味
🧰 Tech Stack
Next.js (App Router) / MDX
Supabase (PostgreSQL + pgvector) / Storage
OpenAI GPT-5（RAG）
Embeddings: text-embedding-3-small
CI: GitHub Actions（自動埋め込み更新）
Images: .jpg 統一（/images/whisky/）
🧩 将来拡張（Roadmap）
AIブレンドPoC：香味データから仮想ブレンド提案
旅AI連携：蒸溜所ツーリズム（白州・余市等）と接続
モード切替：初心者/上級者応答スタイル
外部API補強：Whiskybase等との統合検討
📈 実行ステップ（Action Plan）
Step	内容	担当	状況
1	Phase1 残3本執筆（11月内）	Content	進行中
2	埋め込み登録スクリプト実装（TS）	Dev	設計中
3	whisky_embeddings テーブル作成	Dev	✅
4	RAG 検索テスト（Top-k=3）	Dev	準備中
5	ブランド特集（山崎/白州）着手	Content	12月
6	AIブレンドPoC（Phase4）	AI Team	2026初
📝 執筆・運用ルール
.mdx 形式／lang: "ja" 必須
フロントマター直後に
import { AffButton } from "@/components/AffButton";
画像は /images/whisky/… .jpg（記事と同時生成）
表は使わない（スマホ最適化）
末尾に「出典」（URL不要）
「ウイスキー診断AI」は （工事中） を明記
📁 ファイル例
/content/whisky/
  basics/
    2025-10-28-whisky-intro.mdx
    2025-10-31-world-five-whiskies.mdx
  science/
    2025-11-02-whisky-cask-aging.mdx
    2025-11-03-whisky-blending-art.mdx
  brands/
    yamazaki.mdx
    hakushu.mdx
  culture/
    whisky-ai-blending.mdx
🔚 Summary
「記事資産 × RAG」を中核に、読む×答えるを両立。
Phase1→4で段階的にAI精度と体験価値を拡張。
SupabaseとCIで自動埋め込み更新を実現。

---

### すぐ反映するミニ手順（Cursor向け）
1) `docs/whisky-ai-rag-readme.md` を追加してコミット  
2) `/content/whisky/` ディレクトリをこのREADMEの構成で作成  
3) Embedding登録スクリプト（`scripts/embed-whisky.ts`）を次回私が用意します（Supabase URL/KeyとOpenAI Keyを `.env` 参照）

ほかに「CI（GitHub Actions）の雛形」も必要なら、一緒に出しますよ。