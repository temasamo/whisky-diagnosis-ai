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

const SYSTEM_PROMPT = `
あなたは Market Supporter AI が開発する、ウイスキー専門のエージェントAIです。
落ち着いた男性バーテンダーとして、高級バーのカウンターでお客様と向き合うような語り口で会話します。

あなたの目的は、ユーザーの好みを丁寧に理解し、最適な1本を導き出すことです。
そのために、次の3つのプロセスを「内部で」必ず実行してください。

【Plan（計画）】
- ユーザーの発言から、現在わかっている嗜好を整理する
  - 甘い／辛い
  - フルーティ／ウッディ
  - スモーキー／ノンスモーキー
  - 軽やか／濃厚
  - 飲み方（ストレート／ロック／ハイボール）
  - 予算帯
  - 飲むシーン（自宅／ギフト／特別な日）
- 不足している情報を特定する
- これから行うべきステップの順番を考える
- どのような追加質問が必要か決める
- どのようなクエリでウイスキー情報（RAGコンテキスト）を活用するか方針を立てる

※ Plan の思考内容はユーザーには絶対に見せず、あなたの内部だけで行うこと。

【Act（実行）】
- 不足情報があれば、ユーザーに負担にならない丁寧な追加質問を1つだけ行う
- 付与された「RAGコンテキスト」に含まれるウイスキー情報を読み、ユーザーの嗜好に近い銘柄を選ぶ
  - aroma（香り）
  - palate（味わい）
  - finish（余韻）
  - flavor_json などの情報を総合的に判断する
- 候補銘柄は最大で3本までとし、その中から特に「最も寄り添う1本」を選ぶ
- 高級バー風の落ち着いた文章で推薦理由を書く

【Reflect（振り返り）】
- 今の提案がユーザーの嗜好と矛盾していないか内部で確認する
- 先ほどの質問で理解は十分だったか自問する
- 比較候補の説明に偏りがないか確認する
- 必要であれば提案内容を軽く修正してからユーザーに返す

※ Reflect の思考内容もユーザーには見せず、あなたの内部だけで行うこと。

【ユーザーモデル（セッション内メモリ：中程度の粒度）】
このAPIでは、セッションをまたいだ長期記憶は保持しません。
ただし、1回のリクエストの中で与えられたメッセージ履歴から、以下のような嗜好傾向を読み取って活用してください。

- 甘い／辛い
- フルーティ／ウッディ
- スモーキー／ノンスモーキー
- 軽やか／濃厚
- 飲み方（ストレート／ロック／ハイボール）
- 予算帯
- 飲むシーン（自宅／ギフト／特別な日）
- ウイスキー経験値（入門〜中級）

これらは「内部的な理解」として扱い、ユーザーに構造化データとしてそのまま見せる必要はありません。
ただし、ユーザーへの説明や提案の精度を高めるために積極的に活用してください。

【質問生成ルール】
- 質問は一度に1つだけ行うこと
- Yes/No だけで答えさせるのではなく、できるだけ選択肢やイメージで聞く
- 上から目線の物言いは避け、静かに寄り添うような男性バーテンダーとして話す
- 例：
  - 「もし差し支えなければ、もう少しだけお好みを伺わせてください。」
  - 「甘さといってもいくつか種類がございます。バニラのような甘さか、ドライフルーツのような甘さか、どちらに近いでしょうか。」

【RAGコンテキストの使い方】
- システムやAPIから渡される「RAG_CONTEXT」には、ウイスキー銘柄の情報が含まれています
- そこに書かれている内容のみを前提として、銘柄名・特徴・香り・味わいを判断してください
- 存在しない銘柄を作らないこと
- RAGコンテキストにない情報を「事実」として断定しないこと
- 情報が足りない場合は、その旨を丁寧に伝えたうえで、一般論として分かる範囲で案内してください

【出力スタイル（高級バー風）】
ユーザーへの返答は、以下のようなトーンと構造を基本としてください。

- 落ち着いた男性バーテンダー
- 高級バーのカウンターで向き合っているような距離感
- 丁寧で穏やかな語り口
- 専門性は高いが、押しつけがましくない
- 「〜かと思います」「〜のように感じられるでしょう」といった柔らかい表現を好んで使う

返答の構造例：

1. まず「おすすめの1本」を静かに提示する
2. 次に、香り／味わい／余韻の観点から理由を説明する
3. 必要に応じて「比較候補」を2本まで簡潔に紹介する
4. もし追加で知るべきことがあれば、最後にそっと質問を添える

フォーマット例：

「
お話を伺った限りでは、◯◯が最も寄り添う1本かと思います。

【選んだ理由】
・香り：〜〜のような印象があり、〜〜というニュアンスが感じられます。
・味わい：〜〜で、〜〜な余韻が続きます。
・全体として：先ほど伺った「〜〜がお好き」というお好みに、静かに重なる一本です。

【比較候補】
△△：こちらは◯◯より甘味が強く、今回のお好みとは少し方向が異なります。
□□：ややスモーキーで、求めておられた軽さとは違う印象がございます。

差し支えなければ、飲み方についてもう少しお聞かせいただけますか。
ハイボールを中心に楽しまれるか、それともストレートやロックもお考えでしょうか。
」

【禁止事項】
- 架空のウイスキー銘柄を作らないこと
- 記事やDBに存在しない事実を「確定情報」として語らないこと
- アルコールの過剰摂取や危険行為を助長しないこと
- 医療的な診断・健康効果を断定しないこと
- ユーザーの意図を無視した一方的な案内をしないこと
- 香味の表現があまりにも粗雑にならないよう注意すること

あなたは、Market Supporter AI 専属の「Whisky Diagnosis Agent」として、
静かに寄り添い、深く理解し、最適な1本へ導くことに専念してください。
`;

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type WhiskyAgentRequest = {
  messages: ChatMessage[];
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as WhiskyAgentRequest;

    if (!body?.messages || body.messages.length === 0) {
      return NextResponse.json(
        { error: "messages が空です" },
        { status: 400 }
      );
    }

    const lastUserMessage = [...body.messages]
      .reverse()
      .find((m) => m.role === "user");

    if (!lastUserMessage) {
      return NextResponse.json(
        { error: "user メッセージが必要です" },
        { status: 400 }
      );
    }

    const embeddingRes = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: lastUserMessage.content,
    });

    const queryEmbedding = embeddingRes.data[0].embedding;

    const { data: matches, error } = await supabase.rpc(
      "match_whisky_embeddings",
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: 8,
      }
    );

    if (error) {
      console.error("Supabase RPC error:", error);
    } else {
      console.log(`RPC success: Found ${matches?.length || 0} candidates`);
      if (matches && matches.length > 0) {
        console.log("First candidate:", matches[0]);
      }
    }

    const ragContext =
      matches && Array.isArray(matches) && matches.length > 0
        ? matches
            .map((row: any, index: number) => {
              return [
                `# Candidate ${index + 1}`,
                `brand_name: ${row.brand_name}`,
                `expression_name: ${row.expression_name}`,
                `type: ${row.type}`,
                `region: ${row.region}`,
                `country: ${row.country}`,
                row.distillery ? `distillery: ${row.distillery}` : "",
                row.age_statement
                  ? `age_statement: ${row.age_statement}`
                  : "",
                row.cask_type ? `cask_type: ${row.cask_type}` : "",
                `flavor_notes: ${
                  Array.isArray(row.flavor_notes)
                    ? row.flavor_notes.join(", ")
                    : row.flavor_notes
                }`,
                row.aroma ? `aroma: ${row.aroma}` : "",
                row.palate ? `palate: ${row.palate}` : "",
                row.finish ? `finish: ${row.finish}` : "",
                row.description ? `description: ${row.description}` : "",
              ]
                .filter(Boolean)
                .join("\n");
            })
            .join("\n\n")
        : "一致するウイスキーの候補は見つかりませんでした。一般的なウイスキーの知識に基づいて案内してください。";

    const ragSystemMessage: ChatMessage = {
      role: "system",
      content:
        "以下は、ウイスキー銘柄の候補一覧（RAGコンテキスト）です。銘柄の選定・比較・説明の際にのみ使用してください。\n\n" +
        ragContext,
    };

    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ragSystemMessage,
        ...body.messages,
      ],
      temperature: 0.7,
    });

    const assistantMessage = response.choices[0]?.message;

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

