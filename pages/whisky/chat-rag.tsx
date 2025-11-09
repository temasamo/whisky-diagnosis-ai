/**
 * /pages/whisky/chat-rag.tsx
 * 🥃 RAG連携ウイスキー診断チャット
 */

"use client";

import { useState } from "react";
import Image from "next/image";

export default function WhiskyChatRag() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "🥃 バーテンダーAI：こんばんは。今夜はどんな気分ですか？香りや味わいの好みを教えていただければ、あなたにぴったりのウイスキーをご提案します。",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    // ユーザーメッセージを追加
    const newMessages = [
      ...messages,
      { role: "user", content: userMessage },
    ];
    setMessages(newMessages);

    // ローディングメッセージを追加
    const loadingMessages = [
      ...newMessages,
      { role: "assistant", content: "⏳ バーテンダーAI：少々お待ちください..." },
    ];
    setMessages(loadingMessages);

    try {
      const res = await fetch("/api/whisky/rag/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMessage }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "APIエラーが発生しました");
      }

      const answer =
        data.answer ||
        "すみません、うまく情報が見つかりませんでした。もう少し詳しく教えていただけますか？";

      setMessages([
        ...newMessages,
        { role: "assistant", content: "🥃 バーテンダーAI：" + answer },
      ]);
    } catch (err: any) {
      console.error("RAG Chat error:", err);
      setMessages([
        ...newMessages,
        { role: "assistant", content: "⚠️ エラーが発生しました。もう一度お試しください。" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: "#2c1e1a",
        color: "#f2e4c9",
        minHeight: "100vh",
        padding: "2rem 1rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontFamily: "serif",
      }}
    >
      <h1 style={{ fontSize: "1.8rem", color: "#d2a679", marginBottom: "1rem" }}>
        🥃 ウイスキー診断チャット（RAG版）
      </h1>

      <div
        style={{
          width: "100%",
          maxWidth: "700px",
          backgroundColor: "#3b2b24",
          borderRadius: "12px",
          padding: "1rem",
          overflowY: "auto",
          height: "65vh",
          boxShadow: "0 0 8px rgba(0,0,0,0.3)",
          position: "relative",
          backgroundImage: "url('/bartender/bartender-background.jpg')",
          backgroundSize: "60% auto",
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* 背景画像の上に半透明のオーバーレイ */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(59, 43, 36, 0.7)",
            borderRadius: "12px",
            zIndex: 0,
          }}
        />
        <div style={{ position: "relative", zIndex: 1 }}>
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                marginBottom: "1rem",
                display: "flex",
                alignItems: "flex-start",
                flexDirection: msg.role === "user" ? "row-reverse" : "row",
                gap: "0.75rem",
              }}
            >
              {/* アシスタントメッセージの場合のみアバターを表示 */}
              {msg.role === "assistant" && (
                <div
                  style={{
                    flexShrink: 0,
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    overflow: "hidden",
                    border: "2px solid #d2a679",
                    backgroundColor: "#3b2b24",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "24px",
                  }}
                >
                  <Image
                    src="/bartender/bartender-avatar.jpg"
                    alt="バーテンダーAI"
                    width={48}
                    height={48}
                    style={{
                      objectFit: "cover",
                      width: "100%",
                      height: "100%",
                    }}
                    onError={(e) => {
                      // 画像が存在しない場合のフォールバック（アイコンを表示）
                      e.currentTarget.style.display = "none";
                      const parent = e.currentTarget.parentElement;
                      if (parent && !parent.querySelector(".fallback-icon")) {
                        const fallback = document.createElement("span");
                        fallback.className = "fallback-icon";
                        fallback.textContent = "🥃";
                        fallback.style.fontSize = "24px";
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                </div>
              )}
              <div
                style={{
                  display: "inline-block",
                  backgroundColor:
                    msg.role === "user" ? "#a67b5b" : "rgba(242,228,201,0.15)",
                  padding: "0.8rem 1rem",
                  borderRadius: "10px",
                  maxWidth: "75%",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  textAlign: msg.role === "user" ? "right" : "left",
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          marginTop: "1rem",
          width: "100%",
          maxWidth: "700px",
          display: "flex",
        }}
      >
        <input
          type="text"
          placeholder="例：スモーキーで余韻の長いウイスキーを教えて"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{
            flex: 1,
            padding: "0.8rem",
            borderRadius: "8px 0 0 8px",
            border: "none",
            backgroundColor: "#4b352a",
            color: "#f2e4c9",
          }}
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={loading}
          style={{
            backgroundColor: loading ? "#8b6f47" : "#d2a679",
            color: "#2c1e1a",
            border: "none",
            padding: "0 1.2rem",
            borderRadius: "0 8px 8px 0",
            fontWeight: "bold",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          送信
        </button>
      </div>
    </div>
  );
}

