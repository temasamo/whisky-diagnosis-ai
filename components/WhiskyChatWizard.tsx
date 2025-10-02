import { useState, useRef, useEffect } from "react";
import { buildQueryFromAnswers, WhiskyAnswers } from "@/lib/diagnosis";
import ChatBubble, { TypingBubble } from "./ChatBubble";

type Step = 0|1|2|3|4;

interface ChatMessage {
  id: string;
  type: 'ai' | 'user';
  content: string;
  timestamp: Date;
  step?: Step;
  options?: { label: string; value: any; action: (answers: WhiskyAnswers) => Partial<WhiskyAnswers> }[];
  allowCustom?: boolean;
  customPlaceholder?: string;
}

const initial: WhiskyAnswers = {
  use:"self", region:"islay", type:"single_malt", peat:"medium",
  cask:["any"], age:"any", drinking:"highball", budget:8000, volume:700
};

const questionConfigs = [
  {
    step: 0,
    question: "こんにちは！ウイスキー診断を始めましょう。まずは、どのようなシーンでウイスキーを楽しみたいですか？",
    options: [
      { label: "自分で飲む", value: "self", action: (a) => ({ use: "self" }) },
      { label: "ギフト用", value: "gift", action: (a) => ({ use: "gift" }) }
    ],
    allowCustom: true,
    customPlaceholder: "その他のシーンがあれば教えてください"
  },
  {
    step: 1,
    question: "地域の好みはありますか？アイラのスモーキーな味わいや、スペイサイドのフルーティな味わいなど、お好みの地域を教えてください。",
    options: [
      { label: "アイラ（スモーキー）", value: "islay", action: (a) => ({ region: "islay" }) },
      { label: "スペイサイド（フルーティ）", value: "speyside", action: (a) => ({ region: "speyside" }) },
      { label: "ハイランド（バランス）", value: "highland", action: (a) => ({ region: "highland" }) },
      { label: "ジャパニーズ", value: "japan", action: (a) => ({ region: "japan" }) },
      { label: "こだわらない", value: "any", action: (a) => ({ region: "any" }) }
    ],
    allowCustom: true,
    customPlaceholder: "その他の地域や特定の蒸留所があれば教えてください"
  },
  {
    step: 2,
    question: "味わいの方向性はいかがですか？ピート（スモーキー）の強さについて教えてください。",
    options: [
      { label: "ノンピート（スモーキーなし）", value: "none", action: (a) => ({ peat: "none" }) },
      { label: "ピート控えめ", value: "light", action: (a) => ({ peat: "light" }) },
      { label: "ほどよくピート", value: "medium", action: (a) => ({ peat: "medium" }) },
      { label: "しっかりスモーキー", value: "heavy", action: (a) => ({ peat: "heavy" }) }
    ],
    allowCustom: true,
    customPlaceholder: "その他の味わいの好みがあれば教えてください"
  },
  {
    step: 3,
    question: "予算帯はいかがですか？お手頃なものから高級なものまで、ご希望の価格帯を教えてください。",
    options: [
      { label: "〜3,000円", value: 3000, action: (a) => ({ budget: 3000 }) },
      { label: "〜5,000円", value: 5000, action: (a) => ({ budget: 5000 }) },
      { label: "〜8,000円", value: 8000, action: (a) => ({ budget: 8000 }) },
      { label: "〜15,000円", value: 15000, action: (a) => ({ budget: 15000 }) },
      { label: "〜30,000円", value: 30000, action: (a) => ({ budget: 30000 }) }
    ],
    allowCustom: true,
    customPlaceholder: "その他の予算があれば教えてください"
  },
  {
    step: 4,
    question: "最後に、内容量はいかがですか？",
    options: [
      { label: "500ml", value: 500, action: (a) => ({ volume: 500 }) },
      { label: "700ml（標準）", value: 700, action: (a) => ({ volume: 700 }) },
      { label: "750ml", value: 750, action: (a) => ({ volume: 750 }) },
      { label: "1000ml", value: 1000, action: (a) => ({ volume: 1000 }) }
    ],
    allowCustom: true,
    customPlaceholder: "その他の内容量があれば教えてください"
  }
];

export default function WhiskyChatWizard(
  { onSearch, initialAnswers }: { 
    onSearch: (q: string, a: WhiskyAnswers) => void; 
    initialAnswers?: WhiskyAnswers;
  }
) {
  const [answers, setAnswers] = useState<WhiskyAnswers>(initialAnswers ?? initial);
  const [currentStep, setCurrentStep] = useState<Step>(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    // 初期メッセージを追加（一度だけ）
    if (messages.length === 0) {
      const initialMessage: ChatMessage = {
        id: 'initial',
        type: 'ai',
        content: questionConfigs[0].question,
        timestamp: new Date(),
        step: 0,
        options: questionConfigs[0].options,
        allowCustom: questionConfigs[0].allowCustom,
        customPlaceholder: questionConfigs[0].customPlaceholder
      };
      setMessages([initialMessage]);
    }
  }, []);

  const handleOptionSelect = (option: any) => {
    if (isComplete) return;

    const newAnswers = { ...answers, ...option.action(answers) };
    setAnswers(newAnswers);

    // ユーザーメッセージを追加
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: option.label,
      timestamp: new Date(),
      step: currentStep
    };

    setMessages(prev => [...prev, userMessage]);

    // AIの次の質問を追加
    setTimeout(() => {
      setIsTyping(true);
      setTimeout(() => {
        const nextStep = (currentStep + 1) as Step;
        if (nextStep < 5) {
          const nextQuestion: ChatMessage = {
            id: `ai-${Date.now()}`,
            type: 'ai',
            content: questionConfigs[nextStep].question,
            timestamp: new Date(),
            step: nextStep,
            options: questionConfigs[nextStep].options,
            allowCustom: questionConfigs[nextStep].allowCustom,
            customPlaceholder: questionConfigs[nextStep].customPlaceholder
          };
          setMessages(prev => [...prev, nextQuestion]);
          setCurrentStep(nextStep);
        } else {
          if (!isComplete) {
            const finalMessage: ChatMessage = {
              id: `ai-final-${Date.now()}`,
              type: 'ai',
              content: `診断が完了しました！\n\n検索語: ${buildQueryFromAnswers(newAnswers)}\n\n診断結果に基づいてウイスキーを探してみましょう。`,
              timestamp: new Date()
            };
            setMessages(prev => [...prev, finalMessage]);
            setIsComplete(true);
          }
        }
        setIsTyping(false);
      }, 1500); // 少し長めに設定して「考えている」感を演出
    }, 500);
  };

  const handleCustomSubmit = (input: string) => {
    if (!input.trim() || isComplete) return;

    const userMessage: ChatMessage = {
      id: `user-custom-${Date.now()}`,
      type: 'user',
      content: input,
      timestamp: new Date(),
      step: currentStep
    };

    setMessages(prev => [...prev, userMessage]);
    setCustomInput("");

    setTimeout(() => {
      setIsTyping(true);
      setTimeout(() => {
        const nextStep = (currentStep + 1) as Step;
        if (nextStep < 5) {
          const nextQuestion: ChatMessage = {
            id: `ai-${Date.now()}`,
            type: 'ai',
            content: questionConfigs[nextStep].question,
            timestamp: new Date(),
            step: nextStep,
            options: questionConfigs[nextStep].options,
            allowCustom: questionConfigs[nextStep].allowCustom,
            customPlaceholder: questionConfigs[nextStep].customPlaceholder
          };
          setMessages(prev => [...prev, nextQuestion]);
          setCurrentStep(nextStep);
        } else {
          if (!isComplete) {
            const finalMessage: ChatMessage = {
              id: `ai-final-${Date.now()}`,
              type: 'ai',
              content: `診断が完了しました！\n\n検索語: ${buildQueryFromAnswers(answers)}\n\n診断結果に基づいてウイスキーを探してみましょう。`,
              timestamp: new Date()
            };
            setMessages(prev => [...prev, finalMessage]);
            setIsComplete(true);
          }
        }
        setIsTyping(false);
      }, 1500);
    }, 500);
  };

  const handleStartSearch = () => {
    onSearch(buildQueryFromAnswers(answers), answers);
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-green-50 to-gray-100">
      {/* チャット履歴エリア */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((message) => (
          <ChatBubble
            key={message.id}
            message={message}
            onOptionSelect={handleOptionSelect}
            onCustomSubmit={handleCustomSubmit}
            customInput={customInput}
            onCustomInputChange={setCustomInput}
            isComplete={isComplete}
          />
        ))}

        {/* タイピングインジケーター */}
        {isTyping && <TypingBubble />}

        <div ref={messagesEndRef} />
      </div>

      {/* 診断完了時のアクション */}
      {isComplete && (
        <div className="p-4 bg-gradient-to-r from-green-50 to-green-100 border-t border-green-200">
          <div className="text-center">
            <button
              onClick={handleStartSearch}
              className="px-8 py-4 bg-gradient-to-r from-green-400 to-green-500 text-white rounded-full hover:from-green-500 hover:to-green-600 transition-all duration-200 font-semibold shadow-lg"
            >
              診断結果でウイスキーを探す
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
