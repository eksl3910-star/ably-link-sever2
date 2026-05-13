"use client";

import { useState } from "react";

type Props = {
  onComplete: () => void;
};

export function DailyLinkModal({ onComplete }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/user/link", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setError(j.error ?? "등록에 실패했습니다.");
        return;
      }
      onComplete();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-4">
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-link-title"
      >
        <h2 id="daily-link-title" className="text-lg font-bold text-[#1a1a1a]">
          오늘의 에이블리 링크 등록
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          매일 자정(KST) 이후 첫 접속 시 프로필 링크를 등록해야 맞교를 시작할 수 있어요.{" "}
          <span className="font-semibold text-[#ff5a5f]">https://applink.a-bly.com/</span> 로 시작하는 주소만
          가능합니다.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="https://applink.a-bly.com/..."
          className="mt-4 w-full resize-none rounded-xl border border-[#e5e7eb] px-3 py-2.5 text-sm outline-none focus:border-[#ff5a5f]"
        />
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() => void handleSubmit()}
          className="mt-4 h-12 w-full rounded-xl bg-[#ff5a5f] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "저장 중…" : "등록하고 시작하기"}
        </button>
      </div>
    </div>
  );
}
