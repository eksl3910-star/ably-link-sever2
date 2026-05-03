"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DailyLinkModal } from "./DailyLinkModal";
import { TradeModal } from "./TradeModal";

// ── Types ─────────────────────────────────────────────────────────────────────

type AlertType = "success" | "error" | "warning" | "info";
type AlertState = { message: string; type: AlertType } | null;

type LinkStats = { total: number; mine: number };
type User = { id: string; nickname: string };
type Announcement = { id: string; title: string; body: string; createdAt: number };

function formatAnnouncementDate(ts: number): string {
  try {
    return new Date(ts).toLocaleString("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

async function readResponseJson<T>(res: Response): Promise<{ data: T | null; status: number }> {
  const raw = await res.text();
  if (!raw.trim()) return { data: null, status: res.status };
  try {
    return { data: JSON.parse(raw) as T, status: res.status };
  } catch {
    return { data: null, status: res.status };
  }
}

// ── Alert component ───────────────────────────────────────────────────────────

function Alert({ state }: { state: AlertState }) {
  if (!state) return null;
  const styles: Record<AlertType, string> = {
    success: "bg-[#e8faf0] text-[#1a7a45] border-[#c3f0d8]",
    error: "bg-[#fff0f0] text-[#c0392b] border-[#ffd6d6]",
    warning: "bg-[#fff8e8] text-[#b07800] border-[#ffe4a0]",
    info: "bg-[#eef4ff] text-[#2355b0] border-[#c7d9ff]",
  };
  return (
    <div
      className={`rounded-xl px-4 py-3 text-sm border leading-relaxed mb-3 ${styles[state.type]}`}
    >
      {state.message}
    </div>
  );
}

const WITHDRAW_CONFIRM_PHRASE = "위 내용을 모두 이해했습니다";

const REQUEUE_COOLDOWN_MS = 3000;
const CONTACT_KAKAO_URL = "https://open.kakao.com/o/sKsl7Tsi";
const CONTACT_IG_ORIGINAL = "https://www.instagram.com/solitunnn/";
const CONTACT_IG_CURRENT = "https://www.instagram.com/riikuuu0/";

const LAYOUT_STORAGE_KEY = "als_layout_mode";
type LayoutPref = "auto" | "mobile" | "desktop";

function readStoredLayoutPref(): LayoutPref {
  if (typeof window === "undefined") return "auto";
  const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
  if (raw === "mobile" || raw === "desktop" || raw === "auto") return raw;
  return "auto";
}

// ── Contact / credits popup ───────────────────────────────────────────────────

function ContactModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 als-backdrop-enter md:items-center md:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="als-modal-enter w-full max-w-[480px] max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-6 pb-9 shadow-2xl md:max-h-[min(90vh,720px)] md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1a1a1a]">문의하기 · 제작자</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f5f5f5] text-[#666] transition-all duration-200 hover:bg-[#ebebeb]"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 text-left text-sm text-[#444]">
          <div className="rounded-xl border border-[#ececec] bg-[#fafafa] px-4 py-3">
            <p className="text-xs font-semibold text-gray-500">원제작자</p>
            <a
              href={CONTACT_IG_ORIGINAL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block font-semibold text-[#ff5a5f] underline-offset-2 hover:underline"
            >
              solitunnn (Instagram)
            </a>
          </div>

          <div className="rounded-xl border border-[#ececec] bg-[#fafafa] px-4 py-3">
            <p className="text-xs font-semibold text-gray-500">제작자</p>
            <a
              href={CONTACT_IG_CURRENT}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block font-semibold text-[#ff5a5f] underline-offset-2 hover:underline"
            >
              riikuuu0 (Instagram)
            </a>
          </div>

          <div className="rounded-xl border-2 border-[#ff5a5f] bg-[#fff0f0] px-4 py-3 text-[#1a1a1a]">
            <p className="text-xs font-bold text-[#ff5a5f]">문의 안내</p>
            <p className="mt-2 leading-relaxed">
              모든 문의는 제작자(riikuuu0)에게만 부탁드립니다.
            </p>
            <p className="mt-2 text-xs text-gray-600 leading-relaxed">
              문의 방법: 인스타그램 DM 또는 아래 카카오 오픈채팅
            </p>
          </div>

          <a
            href={CONTACT_KAKAO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 w-full items-center justify-center rounded-xl bg-[#111] text-base font-bold text-white transition-opacity hover:opacity-90 active:opacity-80"
          >
            오픈채팅으로 문의하기
          </a>

          <a
            href={CONTACT_IG_CURRENT}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 w-full items-center justify-center rounded-xl border border-[#e5e7eb] bg-white text-sm font-semibold text-[#1a1a1a] transition-colors hover:bg-gray-50"
          >
            DM으로 문의하기
          </a>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 h-10 w-full rounded-xl bg-[#f5f5f5] text-sm text-gray-500 transition-all hover:bg-[#ebebeb]"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

// ── Guide popup ───────────────────────────────────────────────────────────────

function GuidePopup({
  onClose,
  onRequestWithdraw,
}: {
  onClose: () => void;
  onRequestWithdraw: () => void;
}) {
  const handleDontShow = () => {
    localStorage.setItem("als_guide_done", "1");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 als-backdrop-enter md:items-center md:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="als-modal-enter w-full max-w-[480px] max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-6 pb-9 shadow-2xl md:max-h-[min(90vh,720px)] md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-[#1a1a1a]">사용방법</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f5f5f5] text-base text-[#666] transition-all duration-200 hover:bg-[#ebebeb] hover:rotate-90"
          >
            ✕
          </button>
        </div>

        {[
          {
            n: 1,
            title: "에이블리에서 내 링크 복사하기",
            desc: "에이블리 앱에서 이벤트 링크를 새로 만들고 복사해요. 카카오톡으로 받은 메시지 전체를 복사해도 돼요!",
          },
          {
            n: 2,
            title: "텍스트 박스에 붙여넣고 올리기",
            desc: "링크를 텍스트 박스에 붙여넣거나 입력하고 '링크 올리기' 버튼을 눌러요.",
          },
          {
            n: 3,
            title: "빨간 버튼으로 거래 시작",
            desc: "버튼을 누르면 거래 창이 열려요. 상대 링크를 열고, 내 링크도 상대가 열면 완료!",
          },
          {
            n: 4,
            title: "반복하면 응모 티켓이 쌓여요",
            desc: "에이블리에서 새 링크 만들고 → 올리고 → 받기. 이걸 반복하면 돼요!",
          },
        ].map((step) => (
          <div key={step.n} className="flex gap-4 mb-5">
            <div className="w-7 h-7 min-w-[28px] rounded-full bg-[#ff5a5f] text-white text-xs font-bold flex items-center justify-center mt-0.5">
              {step.n}
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1a1a1a] mb-1">{step.title}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
            </div>
          </div>
        ))}

        <hr className="border-[#f0f0f0] my-5" />

        <div className="bg-[#f7f7f7] rounded-xl p-4 mb-5 space-y-2">
          {[
            "⚡ 동시에 눌러도 딱 1명만 받을 수 있어요",
            "🚫 한 사람 링크는 딱 1번만 받을 수 있어요",
            "⏱️ 클레임 시간 내 미완료 시 자동 반납될 수 있어요",
            "🔗 에이블리 링크(a-bly.com)만 올릴 수 있어요",
            "🔄 내 링크를 대기열 맨 앞으로 다시 올릴 수 있어요",
          ].map((item) => (
            <p key={item} className="text-xs text-[#555] leading-relaxed">
              {item}
            </p>
          ))}
        </div>

        <div className="mt-6 border-t border-[#f0f0f0] pt-5">
          <button
            type="button"
            onClick={() => {
              onClose();
              onRequestWithdraw();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-[#767676] transition-all duration-200 hover:bg-red-50 hover:text-red-600"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            계정 탈퇴하기
          </button>
        </div>

        <button
          type="button"
          onClick={handleDontShow}
          className="mb-2 mt-4 h-12 w-full rounded-xl bg-[#1a1a1a] text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.99]"
        >
          다시 보지 않기
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-10 w-full rounded-xl bg-[#f5f5f5] text-sm text-gray-500 transition-all duration-200 hover:bg-[#ebebeb] active:scale-[0.99]"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

// ── Withdraw confirm modal ────────────────────────────────────────────────────

function WithdrawConfirmModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = phrase === WITHDRAW_CONFIRM_PHRASE;

  async function handleWithdraw() {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/delete", { method: "DELETE" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? "탈퇴 처리에 실패했습니다.");
        return;
      }
      onSuccess();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 als-backdrop-enter"
        aria-label="닫기"
        onClick={() => {
          onClose();
          setPhrase("");
        }}
      />
      <div
        className="als-modal-enter relative w-full max-w-md rounded-[1.5rem] border border-[#f0f0f0] bg-white p-6 shadow-2xl sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="withdraw-title"
      >
        <button
          type="button"
          onClick={() => {
            onClose();
            setPhrase("");
          }}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl text-[#888] transition-all duration-200 hover:bg-[#f5f5f5] hover:text-[#1a1a1a] hover:rotate-90 sm:right-5 sm:top-5"
        >
          ✕
        </button>

        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ffe8ec]">
            <svg className="h-7 w-7 text-[#e04d5c]" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h2 id="withdraw-title" className="text-xl font-bold text-[#1a1a1a] sm:text-2xl">
            정말로 탈퇴하시겠습니까?
          </h2>
        </div>

        <div className="mb-6 rounded-xl bg-[#fff0f2] p-4">
          <p className="text-sm leading-relaxed text-[#c0392b]">
            탈퇴하시면 지금까지 저장된 모든 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
          </p>
        </div>

        <div className="mb-6 space-y-3">
          <p className="text-sm font-medium text-[#1a1a1a]">탈퇴를 진행하려면 아래 문구를 입력하세요:</p>
          <p className="rounded-xl bg-[#fff0f0] p-3 text-sm font-medium text-[#1a1a1a]">
            {WITHDRAW_CONFIRM_PHRASE}
          </p>
          <input
            type="text"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder="문구를 입력하세요"
            className="h-12 w-full rounded-xl border border-[#e8e2d4] bg-[#fffdf8] px-4 text-sm outline-none transition-all duration-200 placeholder:text-[#b0b0b0] focus:border-[#d4bc6a]"
            autoComplete="off"
          />
        </div>

        {error ? (
          <p className="mb-4 text-center text-sm text-red-600">{error}</p>
        ) : null}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              setPhrase("");
            }}
            className="h-12 flex-1 rounded-xl bg-[#f5f5f5] text-sm font-semibold text-[#1a1a1a] transition-all duration-200 hover:bg-[#ebebeb] active:scale-[0.98]"
          >
            취소
          </button>
          <button
            type="button"
            disabled={!canSubmit || busy}
            onClick={() => void handleWithdraw()}
            className="h-12 flex-1 rounded-xl bg-[#e85d6c] text-sm font-semibold text-white shadow-md shadow-red-200/50 transition-all duration-200 hover:bg-[#d64a5a] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none active:scale-[0.98]"
          >
            {busy ? "처리 중..." : "탈퇴하기"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();

  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Stats
  const [stats, setStats] = useState<LinkStats>({ total: 0, mine: 0 });
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activeAnnIdx, setActiveAnnIdx] = useState(0);
  const [announcementOpen, setAnnouncementOpen] = useState(true);

  // Upload section
  const [linkText, setLinkText] = useState("");
  const [uploadAlert, setUploadAlert] = useState<AlertState>(null);
  const [uploading, setUploading] = useState(false);
  const [showRequeue, setShowRequeue] = useState(false);

  // Receive section
  const [receiveAlert, setReceiveAlert] = useState<AlertState>(null);
  const [receiving, setReceiving] = useState(false);

  const [needsDailyLink, setNeedsDailyLink] = useState(false);
  const [tradeSession, setTradeSession] = useState<{ transactionId: string; linkId: string } | null>(
    null
  );

  // Guide popup
  const [showGuide, setShowGuide] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [requeueBusy, setRequeueBusy] = useState(false);
  const [layoutPref, setLayoutPref] = useState<LayoutPref>("auto");
  const [mediaDesktop, setMediaDesktop] = useState(false);

  const requeueLastAtRef = useRef(0);

  // ── Load current user ───────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const sRes = await fetch("/api/settings");
        const s = (await sRes.json()) as { maintenanceOn?: boolean };
        if (cancelled) return;
        if (s.maintenanceOn) {
          router.replace("/maintenance");
          setAuthLoading(false);
          return;
        }
      } catch {
        /* ignore */
      }
      if (cancelled) return;

      try {
        const r = await fetch("/api/auth/me");
        const d = (await r.json()) as { ok?: boolean; user?: User };
        if (cancelled) return;
        if (r.status === 503) {
          router.replace("/maintenance");
          setAuthLoading(false);
          return;
        }
        if (d.ok && d.user) {
          setUser(d.user);
          try {
            const lr = await fetch("/api/user/link");
            const lj = (await lr.json()) as { ok?: boolean; needsDailyRegistration?: boolean };
            if (!cancelled && lr.ok && lj.ok && lj.needsDailyRegistration) {
              setNeedsDailyLink(true);
            }
          } catch {
            /* ignore */
          }
        } else {
          router.replace("/welcome");
        }
      } catch {
        if (!cancelled) router.replace("/welcome");
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // ── Load stats ──────────────────────────────────────────────────────────────

  const loadStats = useCallback(() => {
    fetch("/api/links/stats")
      .then((r) => r.json() as Promise<{ ok?: boolean; total?: number; mine?: number }>)
      .then((d) => {
        if (d.ok) setStats({ total: d.total ?? 0, mine: d.mine ?? 0 });
      })
      .catch(() => null);
  }, []);

  const loadAnnouncements = useCallback(() => {
    fetch("/api/announcements")
      .then((r) => r.json() as Promise<{ ok?: boolean; items?: Announcement[] }>)
      .then((d) => {
        if (d.ok && Array.isArray(d.items)) setAnnouncements(d.items);
      })
      .catch(() => null);
  }, []);

  const refreshDashboard = useCallback(() => {
    loadStats();
    loadAnnouncements();
  }, [loadStats, loadAnnouncements]);

  useEffect(() => {
    if (!authLoading && user) {
      refreshDashboard();
      if (!localStorage.getItem("als_guide_done")) {
        setTimeout(() => setShowGuide(true), 400);
      }
    }
  }, [authLoading, user, refreshDashboard]);

  useEffect(() => {
    if (announcements.length === 0) {
      setActiveAnnIdx(0);
      return;
    }
    setActiveAnnIdx((i) => Math.min(i, announcements.length - 1));
  }, [announcements]);

  useEffect(() => {
    if (authLoading || !user) return;
    const id = window.setInterval(() => refreshDashboard(), 20_000);
    const onVis = () => {
      if (document.visibilityState === "visible") refreshDashboard();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [authLoading, user, refreshDashboard]);

  useEffect(() => {
    setLayoutPref(readStoredLayoutPref());
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => setMediaDesktop(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setLayoutPreference = useCallback((pref: LayoutPref) => {
    setLayoutPref(pref);
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, pref);
    } catch {
      /* ignore */
    }
  }, []);

  const isDesktopLayout =
    layoutPref === "desktop" || (layoutPref === "auto" && mediaDesktop);

  // ── Logout ──────────────────────────────────────────────────────────────────

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/welcome");
  }

  // ── Submit link ─────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setUploadAlert(null);
    const text = linkText.trim();
    if (!text) {
      setUploadAlert({ message: "에이블리 링크를 입력해주세요.", type: "warning" });
      return;
    }

    setUploading(true);
    try {
      const res = await fetch("/api/links/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const { data } = await readResponseJson<{ ok?: boolean; error?: string }>(res);

      if (!data) {
        setUploadAlert({
          message: `서버 응답을 읽을 수 없습니다. (HTTP ${res.status})`,
          type: "error",
        });
        return;
      }

      if (!res.ok || !data.ok) {
        setUploadAlert({ message: data.error ?? "업로드 오류가 발생했습니다.", type: "error" });
        return;
      }

      setLinkText("");
      setShowRequeue(true);
      setUploadAlert({ message: "링크가 올라갔어요! 🎉", type: "success" });
      refreshDashboard();
    } catch {
      setUploadAlert({ message: "연결에 실패했습니다. 네트워크를 확인해주세요.", type: "error" });
    } finally {
      setUploading(false);
    }
  }

  // ── Requeue ─────────────────────────────────────────────────────────────────

  async function handleRequeue() {
    if (requeueBusy) return;
    const now = Date.now();
    const elapsed = now - requeueLastAtRef.current;
    if (elapsed < REQUEUE_COOLDOWN_MS) {
      const sec = Math.ceil((REQUEUE_COOLDOWN_MS - elapsed) / 1000);
      setUploadAlert({
        message: `너무 자주 눌렀어요. ${sec}초 후에 다시 시도해주세요.`,
        type: "info",
      });
      return;
    }

    requeueLastAtRef.current = now;
    setRequeueBusy(true);
    try {
      const res = await fetch("/api/links/requeue", { method: "POST" });
      const { data } = await readResponseJson<{ ok?: boolean; reason?: string; error?: string }>(res);

      if (!data || !res.ok || !data.ok) {
        const msg =
          data?.reason === "NO_QUEUED_LINK"
            ? "대기 중인 내 링크가 없어요."
            : data?.error ?? "오류가 발생했습니다.";
        setUploadAlert({ message: msg, type: "info" });
        return;
      }
      setUploadAlert({ message: "내 링크가 대기열 맨 앞으로 이동됐어요! 🔄", type: "success" });
    } catch {
      setUploadAlert({ message: "연결에 실패했습니다. 잠시 후 다시 시도해주세요.", type: "error" });
    } finally {
      setRequeueBusy(false);
    }
  }

  // ── Receive link ─────────────────────────────────────────────────────────────

  async function handleReceive() {
    setReceiveAlert(null);
    setReceiving(true);

    try {
      const res = await fetch("/api/links/claim", { method: "POST" });
      const { data } = await readResponseJson<{
        ok?: boolean;
        reason?: string;
        error?: string;
        transactionId?: string;
        link?: { id: string; url: string; deadline: number };
      }>(res);

      if (!data) {
        setReceiveAlert({
          message: `서버 응답을 읽을 수 없습니다. (HTTP ${res.status})`,
          type: "error",
        });
        return;
      }

      if (!res.ok) {
        setReceiveAlert({
          message: data.error ?? "링크를 받지 못했어요.",
          type: res.status === 401 ? "warning" : "error",
        });
        return;
      }

      if (!data.ok) {
        const msg =
          data.reason === "NO_LINK"
            ? "지금 받을 수 있는 링크가 없어요."
            : data.reason === "RACE"
              ? "다른 사람이 먼저 받았어요. 다시 눌러주세요."
              : data.reason === "NO_USER_LINK"
                ? (data.error ?? "먼저 오늘의 에이블리 링크를 등록해 주세요.")
                : data.reason === "NO_TX_TABLE"
                  ? (data.error ?? "서버 설정 오류입니다.")
                  : "링크를 받지 못했어요.";
        setReceiveAlert({ message: msg, type: "info" });
        return;
      }

      if (data.link && data.transactionId) {
        setTradeSession({ transactionId: data.transactionId, linkId: data.link.id });
      }
    } catch {
      setReceiveAlert({
        message: "연결에 실패했습니다. 네트워크를 확인해주세요.",
        type: "error",
      });
    } finally {
      setReceiving(false);
    }
  }

  function resetTradeUi() {
    setTradeSession(null);
    setReceiving(false);
    setReceiveAlert(null);
    refreshDashboard();
  }

  // ── Paste from clipboard ─────────────────────────────────────────────────────

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      setLinkText(text);
    } catch {
      setUploadAlert({
        message: "붙여넣기 권한이 필요해요. 브라우저에서 클립보드 접근을 허용해주세요.",
        type: "warning",
      });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
        <p className="text-sm text-gray-400">불러오는 중...</p>
      </div>
    );
  }

  const layoutPill = (active: boolean) =>
    active
      ? "border-[#ff5a5f] bg-[#fff5f5] text-[#ff5a5f]"
      : "border-[#e5e7eb] bg-white text-gray-600 hover:bg-gray-50";

  return (
    <>
      <div className="flex min-h-screen flex-col bg-[#f5f5f7]">
        <div
          className={
            isDesktopLayout
              ? "flex w-full flex-1 flex-col"
              : "mx-auto flex w-full max-w-[480px] flex-1 flex-col"
          }
        >
          {/* Top bar */}
          <header
            className={`sticky top-0 z-10 flex items-center justify-between border-b border-[#e8e8e8] bg-white/95 py-4 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-md ${
              isDesktopLayout ? "px-6 lg:px-12 xl:px-20 2xl:px-24" : "px-5"
            }`}
          >
            <h1
              className={`font-semibold text-[#1a1a1a] ${
                isDesktopLayout ? "text-base sm:text-lg" : "text-base"
              }`}
            >
              에이블리 링크 교환
            </h1>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span
                className={`truncate text-gray-400 ${
                  isDesktopLayout
                    ? "max-w-[140px] text-xs"
                    : "max-w-[64px] text-[10px] sm:max-w-[88px] sm:text-xs"
                }`}
              >
                {user?.nickname}
              </span>
              <button
                type="button"
                onClick={() => setShowGuide(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-[#767676] transition-all duration-200 hover:bg-[#fff0f0] hover:text-[#1a1a1a] active:scale-95"
                title="사용방법"
                aria-label="사용방법"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                  <path
                    d="M12 16v-1M12 8v5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setShowContact(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-[#767676] transition-all duration-200 hover:bg-[#fff0f0] hover:text-[#1a1a1a] active:scale-95"
                title="문의하기"
                aria-label="문의하기"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M4 6h16v12H4V6z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M4 8l8 5 8-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => router.push("/mypage")}
                className="flex h-10 min-w-[40px] items-center justify-center rounded-xl px-2 text-[11px] font-semibold text-[#767676] transition-all duration-200 hover:bg-[#fff0f0] hover:text-[#1a1a1a] active:scale-95 sm:text-xs"
                title="마이페이지"
              >
                MY
              </button>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-[#767676] transition-all duration-200 hover:bg-[#fff0f0] hover:text-[#1a1a1a] active:scale-95"
                title="로그아웃"
                aria-label="로그아웃"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M15 3h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </header>

          <div
            className={
              isDesktopLayout
                ? "flex flex-1 flex-col px-6 pb-8 pt-5 lg:px-12 lg:pt-6 xl:px-20 2xl:px-24"
                : "flex flex-1 flex-col px-4 pt-4"
            }
          >
            <div
              className={
                isDesktopLayout
                  ? "flex flex-1 flex-col space-y-5"
                  : "flex flex-1 flex-col space-y-3"
              }
            >
              {/* 공지 */}
              <div className="overflow-hidden rounded-2xl border border-[#ececec] bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setAnnouncementOpen((o) => !o)}
                  aria-expanded={announcementOpen}
                  aria-label={announcementOpen ? "공지 접기" : "공지 펼치기"}
                  className={`flex w-full items-center justify-between bg-gradient-to-r from-[#fff8f8] to-[#fffbfb] px-4 py-2.5 text-left transition-colors hover:from-[#fff3f3] hover:to-[#fff8f8] ${
                    announcementOpen ? "border-b border-[#f5e6e8]" : ""
                  }`}
                >
                  <span className="text-xs font-bold tracking-wide text-[#ff5a5f]">공지</span>
                  <svg
                    className={`h-4 w-4 shrink-0 text-[#ff5a5f] transition-transform duration-200 ${
                      announcementOpen ? "rotate-180" : ""
                    }`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {announcementOpen ? (
                  announcements.length === 0 ? (
                    <p className="px-4 py-5 text-center text-sm text-gray-400">
                      등록된 공지가 없습니다
                    </p>
                  ) : (
                    <>
                      <div
                        role="tablist"
                        aria-label="공지 탭"
                        className="flex gap-1 overflow-x-auto border-b border-[#f0f0f0] bg-[#fafafa] px-2 py-2"
                      >
                        {announcements.map((a, i) => (
                          <button
                            key={a.id}
                            type="button"
                            role="tab"
                            aria-selected={i === activeAnnIdx}
                            onClick={() => setActiveAnnIdx(i)}
                            className={`shrink-0 rounded-lg px-3 py-2 text-left text-xs font-medium transition-all ${
                              i === activeAnnIdx
                                ? "bg-white text-[#1a1a1a] shadow-sm ring-1 ring-[#ffd4d6]"
                                : "text-gray-500 hover:bg-white/80 hover:text-[#1a1a1a]"
                            }`}
                          >
                            <span className="line-clamp-1 max-w-[200px] sm:max-w-[280px]">{a.title}</span>
                          </button>
                        ))}
                      </div>
                      <div className="px-4 py-4" role="tabpanel">
                        <p className="mb-2 text-[11px] text-gray-400">
                          {formatAnnouncementDate(announcements[activeAnnIdx]!.createdAt)}
                        </p>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#1a1a1a]">
                          {announcements[activeAnnIdx]!.body}
                        </p>
                      </div>
                    </>
                  )
                ) : null}
              </div>

              {/* Stats (자동 새로고침: 주기·탭 복귀 시) */}
              <div
                className={`flex w-full items-center justify-center gap-2 rounded-2xl border border-[#ececec] bg-white shadow-sm ${
                  isDesktopLayout ? "p-5 lg:p-6" : "p-4"
                }`}
              >
                <span
                  className={`font-bold text-[#ff5a5f] ${isDesktopLayout ? "text-3xl" : "text-2xl"}`}
                >
                  {stats.total}
                </span>
                <span className={`text-gray-500 ${isDesktopLayout ? "text-base" : "text-sm"}`}>
                  개의 링크 대기 중
                </span>
              </div>

              {/* Upload card */}
              <div
                className={`rounded-2xl border border-[#ececec] bg-white shadow-sm transition-shadow hover:shadow-md ${
                  isDesktopLayout ? "p-5 lg:p-6" : "p-4"
                }`}
              >
                <p className="text-xs font-semibold text-gray-400 mb-3">내 링크 올리기</p>

                <textarea
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="에이블리 링크를 붙여넣어주세요 (a-bly.com)"
                  rows={isDesktopLayout ? 4 : 3}
                  className={`w-full rounded-xl border border-[#e5e7eb] px-3 py-2.5 resize-none outline-none focus:border-[#ff5a5f] transition-colors placeholder:text-gray-300 mb-2 ${
                    isDesktopLayout ? "text-base min-h-[100px]" : "text-sm"
                  }`}
                />

                <div className="flex gap-2">
                  <button
                    onClick={() => void handlePaste()}
                    className={`flex-1 rounded-xl border border-[#e5e7eb] text-gray-500 hover:bg-gray-50 active:scale-[0.98] transition-all ${
                      isDesktopLayout ? "h-11 text-sm" : "h-10 text-sm"
                    }`}
                  >
                    📋 붙여넣기
                  </button>
                  <button
                    onClick={() => void handleSubmit()}
                    disabled={uploading}
                    className={`flex-1 rounded-xl bg-[#ff5a5f] text-white font-semibold disabled:opacity-50 hover:bg-[#e04448] active:scale-[0.98] transition-all ${
                      isDesktopLayout ? "h-11 text-sm" : "h-10 text-sm"
                    }`}
                  >
                    {uploading ? "업로드 중..." : "링크 올리기"}
                  </button>
                </div>

                {showRequeue && (
                  <button
                    type="button"
                    onClick={() => void handleRequeue()}
                    disabled={requeueBusy}
                    title="같은 동작은 3초에 한 번만 서버로 전송돼요."
                    className={`mt-2 w-full rounded-xl border border-[#e5e7eb] text-gray-500 transition-all hover:bg-gray-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
                      isDesktopLayout ? "h-11 text-sm" : "h-10 text-sm"
                    }`}
                  >
                    {requeueBusy ? "처리 중…" : "🔄 내 링크 대기열 맨 앞으로 다시 올리기"}
                  </button>
                )}

                {uploadAlert && (
                  <div className="mt-2">
                    <Alert state={uploadAlert} />
                  </div>
                )}
              </div>

              {/* Receive / trade */}
              {!tradeSession && (
                <div>
                  {receiveAlert && <Alert state={receiveAlert} />}
                  <button
                    onClick={() => void handleReceive()}
                    disabled={receiving || needsDailyLink}
                    className={`w-full rounded-2xl bg-[#ff5a5f] text-white font-bold shadow-[0_4px_16px_rgba(255,90,95,0.25)] disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed active:scale-[0.97] transition-all ${
                      isDesktopLayout
                        ? "h-[4.5rem] text-xl"
                        : "h-16 text-lg"
                    }`}
                  >
                    {receiving ? "연결 중..." : "거래하기"}
                  </button>
                  {needsDailyLink ? (
                    <p className="mt-2 text-center text-xs text-gray-500">
                      오늘의 링크 등록 후 이용할 수 있어요.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div
            className={`mt-auto border-t border-[#e5e5e5] bg-[#f0f0f3]/90 py-8 backdrop-blur-sm ${
              isDesktopLayout
                ? "px-6 pb-10 pt-14 lg:px-12 lg:pb-12 lg:pt-16 xl:px-20 2xl:px-24"
                : "px-4 pb-10 pt-14"
            }`}
          >
            <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              화면 레이아웃
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setLayoutPreference("auto")}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${layoutPill(layoutPref === "auto")}`}
              >
                자동 (기기 맞춤)
              </button>
              <button
                type="button"
                onClick={() => setLayoutPreference("mobile")}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${layoutPill(layoutPref === "mobile")}`}
              >
                모바일 화면
              </button>
              <button
                type="button"
                onClick={() => setLayoutPreference("desktop")}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${layoutPill(layoutPref === "desktop")}`}
              >
                PC 화면
              </button>
            </div>
          </div>
        </div>
      </div>

      {showContact ? <ContactModal onClose={() => setShowContact(false)} /> : null}

      {showGuide ? (
        <GuidePopup
          onClose={() => setShowGuide(false)}
          onRequestWithdraw={() => setShowWithdrawModal(true)}
        />
      ) : null}
      {showWithdrawModal ? (
        <WithdrawConfirmModal
          onClose={() => setShowWithdrawModal(false)}
          onSuccess={() => {
            setShowWithdrawModal(false);
            router.push("/welcome");
            router.refresh();
          }}
        />
      ) : null}

      {needsDailyLink ? (
        <DailyLinkModal
          onComplete={() => {
            setNeedsDailyLink(false);
            refreshDashboard();
          }}
        />
      ) : null}

      {tradeSession ? (
        <TradeModal
          transactionId={tradeSession.transactionId}
          linkId={tradeSession.linkId}
          onClose={() => resetTradeUi()}
          onSettled={() => resetTradeUi()}
        />
      ) : null}
    </>
  );
}
