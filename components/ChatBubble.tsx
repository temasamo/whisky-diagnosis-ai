import React from 'react';
import TypingIndicator from './TypingIndicator';

interface ChatBubbleProps {
  message: {
    id: string;
    type: 'ai' | 'user';
    content: string;
    timestamp: Date;
    options?: { label: string; value: any; action: (answers: any) => Partial<any> }[];
    allowCustom?: boolean;
    customPlaceholder?: string;
  };
  onOptionSelect?: (option: any) => void;
  onCustomSubmit?: (input: string) => void;
  customInput?: string;
  onCustomInputChange?: (input: string) => void;
  isTyping?: boolean;
  isComplete?: boolean;
}

export default function ChatBubble({ 
  message, 
  onOptionSelect, 
  onCustomSubmit, 
  customInput = "", 
  onCustomInputChange,
  isTyping = false,
  isComplete = false 
}: ChatBubbleProps) {
  const isUser = message.type === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-xs lg:max-w-md ${isUser ? 'order-2' : 'order-1'}`}>
        {/* 吹き出し */}
        <div className={`relative px-4 py-3 shadow-sm ${
          isUser 
            ? 'bg-gradient-to-r from-green-400 to-green-500 text-white rounded-2xl rounded-br-md' 
            : 'bg-white text-gray-800 rounded-2xl rounded-bl-md border border-gray-200'
        }`}>
          {/* 吹き出しの矢印 */}
          <div className={`absolute top-0 ${
            isUser 
              ? 'right-0 transform translate-x-1 -translate-y-1' 
              : 'left-0 transform -translate-x-1 -translate-y-1'
          }`}>
            <div className={`w-0 h-0 ${
              isUser 
                ? 'border-l-[8px] border-l-green-500 border-t-[8px] border-t-transparent' 
                : 'border-r-[8px] border-r-white border-t-[8px] border-t-transparent'
            }`}></div>
          </div>
          
          {/* メッセージ内容 */}
          <div className="whitespace-pre-wrap font-medium text-sm leading-relaxed">
            {message.content}
          </div>
          
          {/* タイムスタンプ */}
          <div className={`text-xs mt-1 ${
            isUser ? 'text-green-100' : 'text-gray-500'
          }`}>
          </div>
        </div>

        {/* 選択肢ボタン（AIメッセージの後） */}
        {message.options && message.type === 'ai' && !isComplete && (
          <div className="flex flex-wrap gap-2 mt-2 ml-2">
            {message.options.map((option, index) => (
              <button
                key={index}
                onClick={() => onOptionSelect?.(option)}
                className="px-3 py-1.5 text-xs bg-white border-2 border-green-200 rounded-full hover:bg-green-50 hover:border-green-300 transition-all duration-200 font-medium text-gray-700 shadow-sm"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        {/* カスタム入力（AIメッセージの後） */}
        {message.allowCustom && message.type === 'ai' && !isComplete && (
          <div className="mt-3 ml-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={customInput}
                onChange={(e) => onCustomInputChange?.(e.target.value)}
                placeholder={message.customPlaceholder}
                className="flex-1 px-3 py-2 text-xs border-2 border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all duration-200 font-medium"
                onKeyPress={(e) => e.key === 'Enter' && onCustomSubmit?.(customInput)}
              />
              <button
                onClick={() => onCustomSubmit?.(customInput)}
                disabled={!customInput.trim()}
                className="px-4 py-2 bg-gradient-to-r from-green-400 to-green-500 text-white rounded-full hover:from-green-500 hover:to-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-md text-xs"
              >
                送信
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// タイピングインジケーター用のコンポーネント
export function TypingBubble() {
  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-xs lg:max-w-md">
        <div className="relative bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-gray-200">
          {/* 吹き出しの矢印 */}
          <div className="absolute left-0 top-0 transform -translate-x-1 -translate-y-1">
            <div className="w-0 h-0 border-r-[8px] border-r-white border-t-[8px] border-t-transparent"></div>
          </div>
          
          <TypingIndicator />
        </div>
      </div>
    </div>
  );
}
