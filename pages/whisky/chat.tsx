import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// 質問フロー
const QUESTIONS = [
  {
    id: "scene",
    text: "こんにちは！ウイスキー診断を始めましょう。まずは、どのようなシーンでウイスキーを楽しみたいですか？",
    options: ["自分で飲む", "ギフト用"]
  },
  {
    id: "region", 
    text: "地域の好みはありますか？アイラのスモーキーな味わいや、スペイサイドのフルーティな味わいなど、お好みの地域を教えてください。",
    options: ["アイラ（スモーキー）", "スペイサイド（フルーティ）", "ハイランド（バランス）", "ジャパニーズ", "こだわらない"]
  },
  {
    id: "peat",
    text: "味わいの方向性はいかがですか？ピート（スモーキー）の強さについて教えてください。",
    options: ["ノンピート（スモーキーなし）", "ピート控えめ", "ほどよくピート", "しっかりスモーキー"]
  },
  {
    id: "budget",
    text: "予算帯はいかがですか？お手頃なものから高級なものまで、ご希望の価格帯を教えてください。",
    options: ["〜3,000円", "〜5,000円", "〜8,000円", "〜15,000円", "〜30,000円"]
  },
  {
    id: "volume",
    text: "最後に、内容量はいかがですか？",
    options: ["180ml", "500ml", "700ml（標準）", "1000ml以上"]
  }
];

type Message = {
  id: string;
  role: "ai" | "user";
  text: string;
  options?: string[];
  timestamp: Date;
};

type SearchResult = {
  key: string;
  cheapest: {
    mall: string;
    title: string;
    price: number;
    url: string;
    image: string;
    shop: string;
  };
};

export default function WhiskyChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [input, setInput] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showSearchButton, setShowSearchButton] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  // 初期化（クライアントサイドのみ）
  useEffect(() => {
    if (!isInitialized) {
      const initialMessage: Message = {
        id: "initial",
        role: "ai",
        text: QUESTIONS[0].text,
        options: QUESTIONS[0].options,
        timestamp: new Date()
      };
      setMessages([initialMessage]);
      setIsInitialized(true);
    }
  }, [isInitialized]);

  const addMessage = (message: Omit<Message, "id" | "timestamp">) => {
    const newMessage: Message = {
      ...message,
      id: `msg-${Date.now()}-${Math.random()}`,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleOptionClick = async (option: string) => {
    // ユーザーの選択を追加
    addMessage({
      role: "user",
      text: option
    });

    setIsTyping(true);

    // 次の質問を表示
    setTimeout(() => {
      const nextIndex = currentQuestionIndex + 1;
      if (nextIndex < QUESTIONS.length) {
        const nextQuestion = QUESTIONS[nextIndex];
        addMessage({
          role: "ai",
          text: nextQuestion.text,
          options: nextQuestion.options
        });
        setCurrentQuestionIndex(nextIndex);
      } else {
        // 最後の質問が終わったら検索ボタンを表示
        addMessage({
          role: "ai",
          text: "診断が完了しました！あなたにぴったりのウイスキーを検索しますか？"
        });
        setShowSearchButton(true);
      }
      setIsTyping(false);
    }, 1000);
  };

  const handleSearch = async () => {
    try {
      const query = messages
        .filter(m => m.role === "user")
        .map(m => m.text)
        .join(" ");
      
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&budget=5000`);
      const data = await response.json();
      setResults(data.items || []);
      setShowSearchButton(false);
      
      // 検索結果のメッセージを追加
      if (data.items && data.items.length > 0) {
        addMessage({
          role: "ai",
          text: `検索結果：${data.items.length}件のウイスキーが見つかりました！`
        });
      } else {
        addMessage({
          role: "ai",
          text: "申し訳ございません。条件に合うウイスキーが見つかりませんでした。別の条件で検索してみてください。"
        });
      }
    } catch (error) {
      console.error("検索エラー:", error);
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    
    addMessage({
      role: "user",
      text: input
    });
    setInput("");
  };

  // スクロールを最下部に
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, isTyping, results]);

  // シンプルで柔らかい吹き出し
  const ChatBubble = ({ message }: { message: Message }) => {
    const isUser = message.role === "user";

    return (
      <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
        <div className="max-w-[78%] sm:max-w-[70%]">
          <div
            className={[
              "relative px-4 py-3 rounded-2xl shadow-sm ring-1",
              isUser
                ? "bg-amber-200 text-amber-900 ring-amber-400 rounded-br-md"
                : "bg-amber-100 text-amber-900 ring-amber-300 rounded-bl-md",
            ].join(" ")}
          >
            {/* 矢印（控えめ） */}
            <div
              className={[
                "absolute top-3 w-3 h-3 rotate-45",
                isUser
                  ? "-right-1 bg-amber-200 ring-1 ring-amber-400"
                  : "-left-1 bg-amber-100 ring-1 ring-amber-300",
              ].join(" ")}
            />
            <div className="whitespace-pre-wrap text-[15px] leading-relaxed">{message.text}</div>
          </div>
        </div>
      </div>
    );
  };

  // タイピングドットも同じトーンに
  const TypingBubble = () => (
    <div className="flex justify-start">
      <div className="max-w-[60%]">
        <div className="relative rounded-2xl rounded-bl-md bg-amber-100 ring-1 ring-amber-300 px-4 py-3 shadow-sm">
          <div className="absolute -left-1 top-3 h-3 w-3 rotate-45 bg-amber-100 ring-1 ring-amber-300" />
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-2 w-2 rounded-full bg-amber-500 animate-bounce"
                style={{ animationDelay: `${i * 120}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // 現在の質問の選択肢を取得
  const getCurrentOptions = () => {
    const lastAiMessage = [...messages].reverse().find(m => m.role === "ai" && m.options);
    return lastAiMessage?.options || [];
  };

  return (
    <div className="flex h-screen flex-col bg-gradient-to-br from-amber-100 to-amber-200">
      {/* ヘッダー */}
      <header className="bg-amber-50/90 backdrop-blur-sm border-b border-amber-300 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-amber-900 flex items-center gap-2">
            <span className="text-2xl">🥃</span>
            ウイスキー診断チャット
          </h1>
          <Link href="/whisky" className="text-sm text-amber-700 hover:underline">
            戻る
          </Link>
        </div>
        <p className="text-sm text-amber-700 mt-1">
          AIがあなたにぴったりの1本を提案します
        </p>
      </header>

      {/* チャットエリア */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-3 py-6">
          {/* チャット枠（ウイスキー色） */}
          <div className="rounded-3xl border border-amber-300/60 bg-amber-100/95 shadow-sm">
            {/* スクロール領域 */}
            <div ref={chatRef} className="h-[calc(100vh-260px)] overflow-y-auto px-4 py-6 sm:px-8">
              <div className="space-y-4">
                {messages.map((message) => (
                  <ChatBubble key={message.id} message={message} />
                ))}
                {isTyping && <TypingBubble />}
              </div>
            </div>

            {/* 入力エリア（カードの下部にくっつける） */}
            <div className="border-t bg-amber-100/90 backdrop-blur px-3 py-3 sm:px-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="例：フルーティ / シェリー / 〜8000円 など"
                  className="flex-1 rounded-full border border-amber-400 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  disabled={isTyping}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  className="rounded-full bg-amber-600 px-5 py-2 text-sm font-medium text-white shadow hover:bg-amber-700 disabled:opacity-50"
                >
                  送信
                </button>
              </div>
            </div>
          </div>

          {/* 回答候補（チャット枠の外の下部） */}
          {getCurrentOptions().length > 0 && (
            <div className="mt-4 px-3">
              <div className="flex flex-wrap gap-2 justify-center">
                {getCurrentOptions().map((option, i) => (
                  <button
                    key={i}
                    onClick={() => handleOptionClick(option)}
                    className="px-4 py-2 text-sm rounded-full bg-amber-100 text-amber-900 ring-1 ring-amber-300 hover:bg-amber-200 transition-colors"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 検索ボタン（最後の質問が終わった時） */}
          {showSearchButton && (
            <div className="mt-4 px-3">
              <div className="flex justify-center">
                <button
                  onClick={handleSearch}
                  className="px-6 py-3 text-lg font-medium rounded-full bg-amber-600 text-white shadow-lg hover:bg-amber-700 transition-colors"
                >
                  🥃 ウイスキーを検索する
                </button>
              </div>
            </div>
          )}

          {/* 検索結果（チャット枠の外の下部） */}
          {results.length > 0 && (
            <div className="mt-4 px-3">
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 shadow-sm">
                <h3 className="text-lg font-medium text-amber-900 mb-4 text-center">🥃 検索結果</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.map((item) => (
                    <div key={item.key} className="border border-amber-200 rounded-lg p-3 hover:shadow-md transition-shadow bg-white">
                      <div className="aspect-square bg-gray-100 rounded-lg mb-2 overflow-hidden">
                        <img 
                          src={item.cheapest.image} 
                          alt={item.cheapest.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <h4 className="text-sm font-medium mb-1">{item.cheapest.title}</h4>
                      <p className="text-xs text-gray-600 mb-2">{item.cheapest.shop}</p>
                      <p className="text-lg font-bold text-amber-600 mb-2">
                        ¥{item.cheapest.price.toLocaleString()}
                      </p>
                      <a
                        href={`/api/out?mall=${item.cheapest.mall}&url=${encodeURIComponent(item.cheapest.url)}`}
                        className="inline-block w-full text-center px-3 py-1.5 text-xs bg-amber-600 text-white rounded-full hover:bg-amber-700 transition-colors"
                      >
                        {item.cheapest.mall === "rakuten" ? "楽天で見る" : "Yahooで見る"}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
