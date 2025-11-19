"use client";

import { useState } from "react";

export default function WhiskyChat() {
  const [messages, setMessages] = useState([
    {
      role: "bartender",
      content:
        "こんばんは。🥃 ようこそバーへ。今日はどんな気分ですか？落ち着いた夜、それとも少し冒険したい気分でしょうか？",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!input.trim()) return;
    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/whisky/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });

      // 405エラー（Method Not Allowed）の処理
      if (res.status === 405) {
        throw new Error("APIエンドポイントが正しく設定されていません。管理者にお問い合わせください。");
      }

      // レスポンスボディを安全に読み取る
      const text = await res.text();
      
      if (!text || text.trim() === "") {
        throw new Error("サーバーからの応答が空です");
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError: any) {
        console.error("JSON parse error:", parseError, "Response text:", text.substring(0, 200));
        throw new Error("サーバーからの応答の解析に失敗しました");
      }
      
      if (!res.ok) {
        throw new Error(data?.error || `エラーが発生しました (ステータス: ${res.status})`);
      }

      if (data.bartender) {
        setMessages((prev) => [
          ...prev,
          { role: "bartender", content: data.bartender },
        ]);
      }
    } catch (error: any) {
      console.error("Error:", error);
      
      let errorMessage = "申し訳ございません。エラーが発生しました。もう一度お試しください。";
      
      if (error.message?.includes("405") || error.message?.includes("Method Not Allowed")) {
        errorMessage = "⚠️ APIエンドポイントの設定に問題があります。管理者にお問い合わせください。";
      } else if (error.message?.includes("JSON") || error.message?.includes("解析")) {
        errorMessage = "⚠️ サーバーからの応答を処理できませんでした。時間をおいて再度お試しください。";
      } else if (error.message && error.message !== "エラーが発生しました") {
        errorMessage = `⚠️ ${error.message}`;
      }
      
      setMessages((prev) => [
        ...prev,
        { role: "bartender", content: errorMessage },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen bg-[#2B1D12] text-[#E8D9C4] flex flex-col items-center p-6"
      style={{
        backgroundImage:
          "radial-gradient(circle at 20% 20%, rgba(80,50,20,0.4), #1a1208)",
      }}
    >
      <h1 className="text-2xl font-bold mb-2">🥃 ウイスキーソムリエ診断</h1>
      <p className="text-sm mb-6 text-[#c7b8a0]">
        あなたにぴったりの一杯を見つけましょう
      </p>

      <div className="w-full max-w-lg bg-[#3B2818] rounded-2xl p-4 shadow-lg space-y-4 overflow-y-auto h-[60vh]">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`${
              msg.role === "bartender"
                ? "bg-[#5C3A21] text-[#F5EBDD]"
                : "bg-[#C58940] text-[#2B1D12]"
            } p-3 rounded-xl max-w-[80%] break-words whitespace-pre-wrap ${
              msg.role === "bartender" ? "self-start" : "self-end ml-auto"
            }`}
          >
            {msg.role === "bartender" ? "🧑‍🍸 " : "👤 "}
            <span className="block">{msg.content}</span>
          </div>
        ))}
        {loading && (
          <div className="text-[#C58940] text-sm italic">考え中です…</div>
        )}
      </div>

      <div className="flex mt-4 w-full max-w-lg">
        <input
          type="text"
          className="flex-1 p-3 rounded-l-2xl bg-[#E8D9C4] text-[#2B1D12]"
          placeholder="例：疲れた夜に飲みたい / フルーティな香りが好き"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="bg-[#C58940] text-[#2B1D12] px-5 rounded-r-2xl font-semibold hover:bg-[#d59a50] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          送信
        </button>
      </div>
    </div>
  );
}
