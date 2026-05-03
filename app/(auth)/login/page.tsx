"use client";

import { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Tab = "login" | "register";

type AlertState = { message: string; type: "error" | "success" } | null;

const NICKNAME_PATTERN = /^[a-zA-Z0-9\uAC00-\uD7A3\u3131-\u318E]+$/;

function normalizeNicknameInput(raw: string): string {
  return raw.trim().replace(/[A-Z]/g, (c) => c.toLowerCase());
}

function validateNicknameClient(normalized: string): string | null {
  if (normalized.length < 2) return "닉네임은 2자 이상이어야 합니다.";
  if (normalized.length > 20) return "닉네임은 20자 이하여야 합니다.";
  if (!NICKNAME_PATTERN.test(normalized)) {
    return "닉네임은 영어, 한글, 숫자만 사용할 수 있습니다.";
  }
  return null;
}

function Alert({ state }: { state: AlertState }) {
  if (!state) return null;
  const base = "rounded-xl px-4 py-3 text-sm mb-4 als-modal-enter";
  const styles =
    state.type === "error"
      ? `${base} bg-red-50 text-red-700 border border-red-200`
      : `${base} bg-green-50 text-green-700 border border-green-200`;
  return <div className={styles}>{state.message}</div>;
}

function IconUser({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconLock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M8 11V8a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconLink({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10.5 13.5a4.5 4.5 0 0 1 0-6.364l1.061-1.06a4.5 4.5 0 1 1 6.364 6.364l-1.5 1.5M13.5 10.5a4.5 4.5 0 0 1 0 6.364l-1.061 1.06a4.5 4.5 0 1 1-6.364-6.364l1.5-1.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("login");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json() as Promise<{ maintenanceOn?: boolean }>)
      .then((d) => {
        if (d.maintenanceOn) router.replace("/maintenance");
      })
      .catch(() => {});
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setAlert(null);
    setLoading(true);

    const normalized = normalizeNicknameInput(nickname);
    const nickErr = validateNicknameClient(normalized);
    if (nickErr) {
      setAlert({ message: nickErr, type: "error" });
      setLoading(false);
      return;
    }

    if (tab === "register") {
      if (password.length < 8) {
        setAlert({ message: "비밀번호는 8자 이상이어야 합니다.", type: "error" });
        setLoading(false);
        return;
      }
      if (password !== passwordConfirm) {
        setAlert({ message: "비밀번호 확인이 일치하지 않습니다.", type: "error" });
        setLoading(false);
        return;
      }
    }

    const endpoint = tab === "login" ? "/api/auth/login" : "/api/auth/register";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          tab === "register"
            ? { nickname: normalized, password, passwordConfirm }
            : { nickname: normalized, password, rememberMe: keepLoggedIn }
        ),
      });

      const text = await res.text();
      let data: { ok?: boolean; error?: string } = {};
      try {
        data = text ? (JSON.parse(text) as typeof data) : {};
      } catch {
        setAlert({
          message: `서버 응답을 처리할 수 없습니다. (HTTP ${res.status})`,
          type: "error",
        });
        return;
      }

      if (!res.ok || !data.ok) {
        setAlert({ message: data.error ?? "오류가 발생했습니다.", type: "error" });
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setAlert({
        message: "연결에 실패했습니다. 네트워크와 서버 상태를 확인해주세요.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-[#f5f5f7] px-6 py-10">
      <Link
        href="/welcome"
        className="absolute left-6 top-6 flex items-center gap-2 text-sm font-medium text-gray-500 transition-all duration-200 hover:text-[#1a1a1a] hover:-translate-x-0.5"
      >
        <span aria-hidden>←</span>
        돌아가기
      </Link>

      <div className="w-full max-w-sm als-enter">
        <div className="mb-8 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#fff0f0] shadow-md shadow-[#ff5a5f]/15 transition-transform duration-200 hover:scale-105 sm:h-20 sm:w-20 sm:rounded-[1.25rem]">
            <IconLink className="h-8 w-8 text-[#ff5a5f] sm:h-10 sm:w-10" />
          </div>
        </div>

        <div className="mb-8 flex rounded-2xl bg-[#ececec] p-1.5">
          {(["login", "register"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setAlert(null);
                setPasswordConfirm("");
              }}
              className={`flex-1 rounded-xl py-3.5 text-sm font-semibold transition-all duration-200 ${
                tab === t
                  ? "bg-white text-[#1a1a1a] shadow-sm"
                  : "text-gray-500 hover:text-[#1a1a1a]"
              }`}
            >
              {t === "login" ? "로그인" : "회원가입"}
            </button>
          ))}
        </div>

        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-[#1a1a1a] sm:text-3xl">
            {tab === "login" ? "로그인" : "회원가입"}
          </h1>
          <p className="mt-2 text-sm text-gray-500 sm:text-base">
            {tab === "login" ? "계정에 로그인하세요" : "새로운 계정을 만들어보세요"}
          </p>
        </div>

        <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-sm">
          <Alert state={alert} />

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#1a1a1a]">닉네임</label>
              <div className="group relative">
                <IconUser className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 transition-colors duration-200 group-focus-within:text-[#ff5a5f]" />
                <input
                  type="text"
                  autoComplete="username"
                  required
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="닉네임을 입력하세요"
                  maxLength={20}
                  className="h-14 w-full rounded-full border border-[#e5e7eb] bg-white pl-12 pr-4 text-sm outline-none transition-all duration-200 placeholder:text-gray-300 focus:border-[#ff5a5f]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#1a1a1a]">비밀번호</label>
              <div className="group relative">
                <IconLock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 transition-colors duration-200 group-focus-within:text-[#ff5a5f]" />
                <input
                  type="password"
                  autoComplete={tab === "login" ? "current-password" : "new-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  minLength={tab === "register" ? 8 : 1}
                  className="h-14 w-full rounded-full border border-[#e5e7eb] bg-white pl-12 pr-4 text-sm outline-none transition-all duration-200 placeholder:text-gray-300 focus:border-[#ff5a5f]"
                />
              </div>
            </div>

            <div
              className={`space-y-2 overflow-hidden transition-all duration-300 ease-out ${
                tab === "register" ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <label className="text-sm font-semibold text-[#1a1a1a]">비밀번호 확인</label>
              <div className="group relative">
                <IconLock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 transition-colors duration-200 group-focus-within:text-[#ff5a5f]" />
                <input
                  type="password"
                  autoComplete="new-password"
                  required={tab === "register"}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="비밀번호를 다시 입력하세요"
                  minLength={8}
                  className="h-14 w-full rounded-full border border-[#e5e7eb] bg-white pl-12 pr-4 text-sm outline-none transition-all duration-200 placeholder:text-gray-300 focus:border-[#ff5a5f]"
                />
              </div>
              {tab === "register" && passwordConfirm && password !== passwordConfirm ? (
                <p className="text-sm text-red-600">비밀번호가 일치하지 않습니다</p>
              ) : null}
            </div>

            <div
              className={`overflow-hidden transition-all duration-300 ease-out ${
                tab === "login" ? "max-h-14 opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={keepLoggedIn}
                  onChange={(e) => setKeepLoggedIn(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 accent-[#ff5a5f] transition-transform duration-200"
                />
                <span className="text-sm text-gray-500 transition-colors duration-200 hover:text-[#1a1a1a]">
                  로그인 유지하기
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-14 w-full rounded-2xl bg-[#ff5a5f] text-base font-bold text-white shadow-lg shadow-[#ff5a5f]/30 transition-all duration-200 hover:bg-[#e04448] hover:shadow-xl hover:shadow-[#ff5a5f]/35 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? "처리 중..." : tab === "login" ? "로그인" : "회원가입"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
