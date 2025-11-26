import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

const CHAT_MODEL = process.env.WHISKY_AGENT_MODEL || "gpt-4o-mini";
const EMBEDDING_MODEL =
  process.env.WHISKY_AGENT_EMBED_MODEL || "text-embedding-3-small";

/* -------------------------------------------------------------------------- */
/*                            システムプロンプト本体                           */
/* -------------------------------------------------------------------------- */
const SYSTEM_PROMPT = `
あなたは Market Supporter AI が開発する、ウイスキー専門のエージェントAIです。
落ち着いた男性バーテンダーとして、高級バーのカウンターでお客様と向き合うような語り口で会話します。

あなたの目的は、ユーザーの好みを丁寧に理解し、最適な1本を導き出すことです。

※以下の Plan / Act / Reflect は「内部思考」であり、絶対にユーザーへ見せないでください。

【Plan】
- ユーザーの好み（甘さ、香り、スモーク、飲み方、予算、シーンなど）を整理
- 足りない情報を把握し、必要なら質問
- RAGコンテキストからどの銘柄を比較・評価すべきか方針を立てる

【Act】
- 追加質問は一度に1つだけ
- RAGで与えられた候補から最大3本までピックアップし、
  その中から最も寄り添う1本を選んで理由とともに説明する

【Reflect】
- 今の提案がユーザーの好みと矛盾していないか確認
- 表現がバーテンダーとして自然か確認

【禁止事項】
- 架空の銘柄を作らない
- RAGにない情報を事実のように断定しない
- 強い断言・押し付けをしない
- アルコール摂取を助長しない

【返答スタイル】
- トーンは温かく、落ち着いた男性バーテンダー
- 「〜かと思います」「〜のように感じられるでしょう」のような柔らかい表現
- 必ず最初に「おすすめの1本」を静かに提示する
- 次に香り・味わい・余韻を丁寧に説明
- 比較候補は最大2本まで軽く紹介
- 最後に、そっと追加の確認質問を添える
`;

/* -------------------------------------------------------------------------- */
/*                               型定義                                       */
/* -------------------------------------------------------------------------- */
type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type WhiskyAgentRequest = {
  messages: ChatMessage[];
};

/* -------------------------------------------------------------------------- */
/*                                   API本体                                   */
/* -------------------------------------------------------------------------- */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as WhiskyAgentRequest;

    if (!body?.messages || body.messages.length === 0) {
      return NextResponse.json(
        { error: "messages が空です" },
        { status: 400 }
      );
    }

    /* ------------------------------ 直近のユーザー発言 ------------------------------ */
    const lastUserMessage = [...body.messages]
      .reverse()
      .find((m) => m.role === "user");

    if (!lastUserMessage) {
      return NextResponse.json(
        { error: "user メッセージが必要です" },
        { status: 400 }
      );
    }

    /* ------------------------------ Embedding生成 ------------------------------ */
    const embeddingRes = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: lastUserMessage.content,
    });

    const queryEmbedding = embeddingRes.data[0].embedding;

    /* ------------------------------ Supabase RPC ------------------------------ */
    const { data: matches, error } = await supabase.rpc(
      "match_whisky_embeddings",
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.45, // ← 推奨：0.45〜0.55
        match_count: 8,
      }
    );

    if (error) {
      console.error("Supabase RPC error:", error);
    } else {
      console.log(`RPC success: Found ${matches?.length || 0} candidates`);
      if (matches && matches.length > 0) {
        console.log("Top candidate:", matches[0]);
      }
    }

    /* ------------------------------ RAGコンテキスト生成 ------------------------------ */
    const ragContext =
      matches && Array.isArray(matches) && matches.length > 0
        ? matches
            .map((row: any, index: number) => {
              return [
                `# Candidate ${index + 1}`,
                `brand_name: ${row.brand_name}`,
                `expression_name: ${row.expression_name}`,
                row.type ? `type: ${row.type}` : "",
                row.region ? `region: ${row.region}` : "",
                row.country ? `country: ${row.country}` : "",
                row.distillery ? `distillery: ${row.distillery}` : "",
                row.age_statement
                  ? `age_statement: ${row.age_statement}`
                  : "",
                row.cask_type ? `cask_type: ${row.cask_type}` : "",
                row.flavor_notes
                  ? `flavor_notes: ${
                      Array.isArray(row.flavor_notes)
                        ? row.flavor_notes.join(", ")
                        : row.flavor_notes
                    }`
                  : "",
                row.aroma ? `aroma: ${row.aroma}` : "",
                row.palate ? `palate: ${row.palate}` : "",
                row.finish ? `finish: ${row.finish}` : "",
                row.description ? `description: ${row.description}` : "",
              ]
                .filter(Boolean)
                .join("\n");
            })
            .join("\n\n")
        : "一致するウイスキー候補がありませんでした。一般的な知識に基づいて案内してください。";

    const ragSystemMessage: ChatMessage = {
      role: "system",
      content:
        "以下は、ウイスキー銘柄の候補一覧（RAGコンテキスト）です。銘柄の選定・比較・説明の際にのみ使用してください。\n\n" +
        ragContext,
    };

    /* ------------------------------ 最終応答の生成 ------------------------------ */
    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ragSystemMessage,
        ...body.messages,
        {
          role: "system",
          content: `
あなたは上記RAG候補をもとに「おすすめの1本」を必ず返してください。
候補が複数ある場合は最も相性の良い1本を選び、落ち着いたバーテンダー口調で理由を説明してください。
候補が0件の場合でも、一般的な知識から1本を提案してください。
比較候補は最大2本まで軽く触れてください。
          `,
        },
      ],
      temperature: 0.7,
    });

    const assistantMessage = response.choices[0]?.message;

    /* ------------------------------ レスポンス ------------------------------ */
    return NextResponse.json(
      {
        reply: assistantMessage?.content,
        ragCandidates: matches ?? [],
        ragCandidatesCount: matches?.length || 0,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("Whisky agent error:", e);
    return NextResponse.json(
      { error: "Whisky agent error", detail: e?.message },
      { status: 500 }
    );
  }
}
