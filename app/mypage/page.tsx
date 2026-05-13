"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = { id: string; nickname: string };

export default function MyPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/user/link");
    const j = (await r.json()) as {
      ok?: boolean;
      link?: string | null;
      error?: string;
      needsDailyRegistration?: boolean;
    };
    if (!r.ok) {
      setMessage(j.error ?? "불러오지 못했습니다.");
      return;
    }
    if (j.link) setText(j.link);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await fetch("/api/auth/me");
        const d = (await me.json()) as { ok?: boolean; user?: User };
        if (!me.ok || !d.ok || !d.user) {
          router.replace("/welcome");
          return;
        }
        if (!cancelled) setUser(d.user);
        await load();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, load]);

  async function handleSave() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/user/link", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setMessage(j.error ?? "저장에 실패했습니다.");
        return;
      }
      setMessage("저장했습니다.");
      await load();
    } catch {
      setMessage("네트워크 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
        <p className="text-sm text-gray-400">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] px-4 py-8">
      <div className="mx-auto max-w-md rounded-2xl border border-[#ececec] bg-white p-6 shadow-sm">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mb-4 text-sm text-gray-500 hover:text-[#1a1a1a]"
        >
          ← 돌아가기
        </button>
        <h1 className="text-xl font-bold text-[#1a1a1a]">마이페이지</h1>
        <p className="mt-1 text-sm text-gray-500">{user?.nickname}</p>

        <p className="mt-6 text-xs font-semibold text-gray-400">오늘의 에이블리 링크</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          className="mt-2 w-full resize-none rounded-xl border border-[#e5e7eb] px-3 py-2.5 text-sm outline-none focus:border-[#ff5a5f]"
          placeholder="https://applink.a-bly.com/..."
        />
        {message ? <p className="mt-2 text-sm text-[#1a7a45]">{message}</p> : null}

        <button
          type="button"
          disabled={busy}
          onClick={() => void handleSave()}
          className="mt-4 h-11 w-full rounded-xl bg-[#ff5a5f] text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? "저장 중…" : "링크 저장"}
        </button>
      </div>
    </div>
  );
}
