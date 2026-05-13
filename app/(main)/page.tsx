"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DEFAULT_ENTRY_GATE_ABLY_URL, TEMP_DAILY_TRADE_COMPLETED_LIMIT } from "@/lib/constants";
import { getOrCreateClientId } from "@/lib/client-id";
import { DailyLinkModal } from "./DailyLinkModal";
import { EntryGateModal } from "./EntryGateModal";
import { TradeModal } from "./TradeModal";

// ── Types ─────────────────────────────────────────────────────────────────────

type AlertType = "success" | "error" | "warning" | "info";
type AlertState = { message: string; type: AlertType } | null;

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

const CONTACT_KAKAO_URL = "https://open.kakao.com/o/sKsl7Tsi";
const CONTACT_IG_CURRENT = "https://www.instagram.com/riikuuu0/";
const MOALINK_PAGES_URL = "https://moalink.pages.dev/";

const LAYOUT_STORAGE_KEY = "als_layout_mode";
/** 탭/창을 떠난 채로 이 시간이 지나면 대기 명단 자동 해제 */
const WAITLIST_AUTO_LEAVE_MS = 30_000;

const REPORT_ACK_STORAGE_PREFIX = "als_report_ack_";
function reportAckStorageKey(userId: string) {
  return `${REPORT_ACK_STORAGE_PREFIX}${userId}`;
}
function readReportAckCount(userId: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const v = localStorage.getItem(reportAckStorageKey(userId));
    if (v == null) return 0;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}
function writeReportAckCount(userId: string, count: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(reportAckStorageKey(userId), String(count));
  } catch {
    /* ignore */
  }
}

type LayoutPref = "auto" | "mobile" | "desktop";

function readStoredLayoutPref(): LayoutPref {
  if (typeof window === "undefined") return "auto";
  const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
  if (raw === "mobile" || raw === "desktop" || raw === "auto") return raw;
  return "auto";
}

function IconRefresh({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 「다시 보지 않기」 시 계정별로 저장 */
function usageGuideNeverStorageKey(userId: string) {
  return `als_usage_guide_never_${userId}`;
}

function DailyTradeLimitModal({
  completed,
  limit,
  onDismiss,
}: {
  completed: number;
  limit: number;
  onDismiss: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[76] flex items-end justify-center bg-black/50 als-backdrop-enter md:items-center md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-trade-limit-title"
      onClick={(e) => e.target === e.currentTarget && onDismiss()}
    >
      <div
        className="als-modal-enter w-full max-w-[400px] rounded-t-3xl bg-white p-6 pb-8 shadow-2xl md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="daily-trade-limit-title" className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          안내
        </p>
        <p className="mt-3 text-center text-xl font-bold text-[#1a1a1a]">오늘 맞교 완료 한도</p>
        <p className="mt-3 text-center text-sm leading-relaxed text-[#555]">
          한국 시간 기준 오늘 완료한 맞교가{" "}
          <span className="font-semibold text-[#ff5a5f]">
            {completed}/{limit}회
          </span>
          로 도달했습니다. 내일 자정 이후에 다시 이용할 수 있어요.
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-6 h-12 w-full rounded-xl bg-[#111] text-base font-semibold text-white transition hover:opacity-95 active:scale-[0.98]"
        >
          확인
        </button>
      </div>
    </div>
  );
}

function ReportNoticeModal({
  count,
  onDismiss,
}: {
  count: number;
  onDismiss: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[75] flex items-end justify-center bg-black/50 als-backdrop-enter md:items-center md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-notice-title"
      onClick={(e) => e.target === e.currentTarget && onDismiss()}
    >
      <div
        className="als-modal-enter w-full max-w-[400px] rounded-t-3xl bg-white p-6 pb-8 shadow-2xl md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="report-notice-title" className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          안내
        </p>
        <p className="mt-3 text-center text-2xl font-bold text-[#c0392b]">신고 누적 {count}회</p>
        <p className="mt-3 text-center text-sm leading-relaxed text-[#555]">
          신고가 누적되면 맞교 제한 등 제재가 적용될 수 있어요. 원활한 맞교를 위해 규칙을 지켜 주세요.
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-6 h-12 w-full rounded-xl bg-[#111] text-base font-semibold text-white transition hover:opacity-95 active:scale-[0.98]"
        >
          확인
        </button>
      </div>
    </div>
  );
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
            <p className="text-xs font-semibold text-gray-500">아이디어 제공</p>
            <p className="mt-1 font-semibold text-[#1a1a1a]">크헤히</p>
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
  userId,
  onClose,
  onRequestWithdraw,
  hideWithdraw,
}: {
  userId: string;
  onClose: () => void;
  onRequestWithdraw: () => void;
  hideWithdraw?: boolean;
}) {
  const handleDontShow = () => {
    try {
      localStorage.setItem(usageGuideNeverStorageKey(userId), "1");
    } catch {
      /* ignore */
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[92] flex items-end justify-center bg-black/45 als-backdrop-enter md:items-center md:p-6"
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
            title: "마이페이지에서 에이블리 링크 등록",
            desc: "오늘 쓸 에이블리 링크(https://applink.a-bly.com/…)를 마이페이지에서 한 번 등록해요.",
          },
          {
            n: 2,
            title: "대기 명단 등록",
            desc: "맞교할 준비가 되면 ‘대기 명단 등록’을 켜요. 숫자는 지금 대기 중인 인원이에요.",
          },
          {
            n: 3,
            title: "맞교하기로 상대 찾기",
            desc: "대기 명단에 있어야 맞교하기가 켜져요. 누르면 상대를 찾고, 두 사람이 매칭되면 같은 맞교 창이 열려요.",
          },
          {
            n: 4,
            title: "상대 링크 열기 · 내 링크도 열어주기",
            desc: "맞교 창에서 안내에 따라 서로의 링크를 열면 완료!",
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
            "⚡ 대기 명단에 있어야 맞교하기를 쓸 수 있어요",
            "🤝 맞교하기를 누른 사람끼리 1:1로 매칭돼요",
            "⏱️ 맞교 창 타이머 안에 서로 링크를 열어 주세요",
            "🔗 에이블리 링크(https://applink.a-bly.com/)는 마이페이지에서 등록해 주세요",
          ].map((item) => (
            <p key={item} className="text-xs text-[#555] leading-relaxed">
              {item}
            </p>
          ))}
        </div>

        {!hideWithdraw ? (
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
        ) : (
          <p className="mt-6 rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-center text-xs leading-relaxed text-amber-900">
            신고 누적으로 계정 탈퇴를 진행할 수 없습니다.
          </p>
        )}

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
  const pathname = usePathname();

  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [waitlistCount, setWaitlistCount] = useState(0);
  const [waitlistEnrolled, setWaitlistEnrolled] = useState(false);
  const [waitlistToggleBusy, setWaitlistToggleBusy] = useState(false);
  const [waitlistCountRefreshing, setWaitlistCountRefreshing] = useState(false);
  const [tradeDailyCompleted, setTradeDailyCompleted] = useState(0);
  const [tradeDailyLimit, setTradeDailyLimit] = useState(TEMP_DAILY_TRADE_COMPLETED_LIMIT);
  const [tradeDailyRemaining, setTradeDailyRemaining] = useState<number | null>(null);
  const [showDailyTradeLimitModal, setShowDailyTradeLimitModal] = useState(false);
  const dailyLimitNoticeDismissedRef = useRef(false);
  const [tradeSearching, setTradeSearching] = useState(false);
  const seekAbortRef = useRef(false);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activeAnnIdx, setActiveAnnIdx] = useState(0);
  const [announcementOpen, setAnnouncementOpen] = useState(true);

  // Receive section
  const [receiveAlert, setReceiveAlert] = useState<AlertState>(null);
  const [receiving, setReceiving] = useState(false);

  const [needsDailyLink, setNeedsDailyLink] = useState(false);
  /** /api/user/link 확인 완료 전에는 사용 방법 타이밍을 잡지 않음 (오늘 링크 필요 여부 레이스 방지) */
  const [linkRequirementResolved, setLinkRequirementResolved] = useState(false);
  const [tradeSession, setTradeSession] = useState<{ transactionId: string; linkId: string } | null>(
    null
  );

  // Guide popup
  const [showGuide, setShowGuide] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [layoutPref, setLayoutPref] = useState<LayoutPref>("auto");
  const [mediaDesktop, setMediaDesktop] = useState(false);
  /** 신고 3회 이상·영구 정지: 서버가 로그아웃/탈퇴를 거부; UI에서도 막음(쿠키 삭제는 막을 수 없음) */
  const [accountControlsLocked, setAccountControlsLocked] = useState(false);
  /** 신고 누적 알림 — 숫자가 있으면 해당 횟수로 팝업 표시 */
  const [reportNoticeCount, setReportNoticeCount] = useState<number | null>(null);
  /** 메인 진입 게이트용 에이블리 링크 (관리자 설정) */
  const [entryGateAblyUrl, setEntryGateAblyUrl] = useState<string>(DEFAULT_ENTRY_GATE_ABLY_URL);
  /** 관리자가 끄면 진입 게이트 비표시 */
  const [entryGateEnabled, setEntryGateEnabled] = useState(true);
  /** 관리자 「다시 띄우기」 시각(ms); 정각 게이트와 별도로 클라이언트가 확인 전이면 모달 표시 */
  const [entryGateForceAt, setEntryGateForceAt] = useState(0);

  /** 진입 게이트를 통과했거나, 관리자 설정으로 게이트가 꺼진 경우 true */
  const [entryGateFlowDone, setEntryGateFlowDone] = useState(false);

  const handleEntryGatePassed = useCallback(() => {
    setEntryGateFlowDone(true);
  }, []);

  // ── Load current user ───────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const sRes = await fetch("/api/settings");
        const s = (await sRes.json()) as {
          maintenanceOn?: boolean;
          entryGateAblyUrl?: string;
          entryGateEnabled?: boolean;
          entryGateForceAt?: number;
        };
        if (cancelled) return;
        if (typeof s.entryGateEnabled === "boolean") {
          setEntryGateEnabled(s.entryGateEnabled);
        }
        if (typeof s.entryGateAblyUrl === "string" && s.entryGateAblyUrl.trim()) {
          setEntryGateAblyUrl(s.entryGateAblyUrl);
        }
        if (typeof s.entryGateForceAt === "number" && Number.isFinite(s.entryGateForceAt)) {
          setEntryGateForceAt(s.entryGateForceAt);
        }
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
        const d = (await r.json()) as {
          ok?: boolean;
          user?: User;
          accountControlsLocked?: boolean;
        };
        if (cancelled) return;
        if (r.status === 503) {
          router.replace("/maintenance");
          setAuthLoading(false);
          return;
        }
        if (d.ok && d.user) {
          setUser(d.user);
          setAccountControlsLocked(Boolean(d.accountControlsLocked));
          try {
            const lr = await fetch("/api/user/link");
            const lj = (await lr.json()) as { ok?: boolean; needsDailyRegistration?: boolean };
            if (!cancelled && lr.ok && lj.ok && lj.needsDailyRegistration) {
              setNeedsDailyLink(true);
            }
          } catch {
            /* ignore */
          } finally {
            if (!cancelled) setLinkRequirementResolved(true);
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

  useEffect(() => {
    if (authLoading || !user) return;
    const cid = getOrCreateClientId();
    if (!cid) return;
    void fetch("/api/auth/bind-client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: cid }),
    }).catch(() => null);
  }, [authLoading, user]);

  // ── Load stats ──────────────────────────────────────────────────────────────

  const loadWaitlistStats = useCallback(async () => {
    try {
      const r = await fetch("/api/trade/waitlist");
      const d = (await r.json()) as {
        ok?: boolean;
        count?: number;
        enrolled?: boolean;
        tradeDailyCompleted?: number;
        tradeDailyLimit?: number;
        tradeDailyRemaining?: number;
      };
      if (d.ok) {
        setWaitlistCount(d.count ?? 0);
        setWaitlistEnrolled(Boolean(d.enrolled));
        setTradeDailyCompleted(d.tradeDailyCompleted ?? 0);
        setTradeDailyLimit(d.tradeDailyLimit ?? TEMP_DAILY_TRADE_COMPLETED_LIMIT);
        const rem = d.tradeDailyRemaining ?? 0;
        setTradeDailyRemaining(rem);
        if (rem === 0 && !dailyLimitNoticeDismissedRef.current) {
          setShowDailyTradeLimitModal(true);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadAnnouncements = useCallback(() => {
    fetch("/api/announcements")
      .then((r) => r.json() as Promise<{ ok?: boolean; items?: Announcement[] }>)
      .then((d) => {
        if (d.ok && Array.isArray(d.items)) setAnnouncements(d.items);
      })
      .catch(() => null);
  }, []);

  const checkReportNotice = useCallback(async () => {
    const uid = user?.id;
    if (!uid) return;
    try {
      const r = await fetch("/api/user/reports-received");
      const d = (await r.json()) as { ok?: boolean; count?: number };
      if (!d.ok || typeof d.count !== "number") return;
      const total = d.count;
      const ack = readReportAckCount(uid);
      if (total > ack) {
        setReportNoticeCount((prev): number | null => {
          if (prev === total) return prev;
          return total;
        });
      }
    } catch {
      /* ignore */
    }
  }, [user?.id]);

  const refreshAccountFlags = useCallback(async () => {
    try {
      const r = await fetch("/api/auth/me");
      const d = (await r.json()) as { ok?: boolean; accountControlsLocked?: boolean };
      if (d.ok && typeof d.accountControlsLocked === "boolean") {
        setAccountControlsLocked(d.accountControlsLocked);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const refreshDashboard = useCallback(() => {
    void loadWaitlistStats();
    loadAnnouncements();
    void checkReportNotice();
    void refreshAccountFlags();
    void fetch("/api/settings")
      .then(
        (r) =>
          r.json() as Promise<{
            entryGateAblyUrl?: string;
            entryGateEnabled?: boolean;
            entryGateForceAt?: number;
          }>
      )
      .then((s) => {
        if (typeof s.entryGateEnabled === "boolean") {
          setEntryGateEnabled(s.entryGateEnabled);
        }
        if (typeof s.entryGateAblyUrl === "string" && s.entryGateAblyUrl.trim()) {
          setEntryGateAblyUrl(s.entryGateAblyUrl);
        }
        if (typeof s.entryGateForceAt === "number" && Number.isFinite(s.entryGateForceAt)) {
          setEntryGateForceAt(s.entryGateForceAt);
        }
      })
      .catch(() => null);
  }, [loadWaitlistStats, loadAnnouncements, checkReportNotice, refreshAccountFlags]);

  async function handleRefreshWaitlistCount() {
    if (waitlistCountRefreshing) return;
    setWaitlistCountRefreshing(true);
    try {
      await loadWaitlistStats();
    } finally {
      setWaitlistCountRefreshing(false);
    }
  }

  useEffect(() => {
    const gateShown = Boolean(entryGateEnabled && entryGateAblyUrl?.trim());
    if (!gateShown) {
      setEntryGateFlowDone(true);
    }
  }, [entryGateEnabled, entryGateAblyUrl]);

  useEffect(() => {
    if (tradeDailyRemaining != null && tradeDailyRemaining > 0) {
      dailyLimitNoticeDismissedRef.current = false;
    }
  }, [tradeDailyRemaining]);

  useEffect(() => {
    if (!authLoading && user) {
      refreshDashboard();
    }
  }, [authLoading, user, refreshDashboard]);

  useEffect(() => {
    if (!user?.id) return;
    try {
      const legacy = localStorage.getItem("als_guide_done");
      if (legacy === "1") {
        localStorage.setItem(usageGuideNeverStorageKey(user.id), "1");
        localStorage.removeItem("als_guide_done");
      }
    } catch {
      /* ignore */
    }
  }, [user?.id]);

  /** 홈(`/`) — 진입 게이트·오늘 링크 안내가 끝난 뒤 「다시 보지 않기」가 없으면 사용 방법 표시 */
  useEffect(() => {
    if (authLoading || !user || pathname !== "/") return;
    if (!entryGateFlowDone) return;
    if (!linkRequirementResolved) return;
    if (needsDailyLink) return;
    let cancelled = false;
    let t: ReturnType<typeof setTimeout> | null = null;
    try {
      if (!localStorage.getItem(usageGuideNeverStorageKey(user.id))) {
        t = setTimeout(() => {
          if (!cancelled) setShowGuide(true);
        }, 400);
      }
    } catch {
      t = setTimeout(() => {
        if (!cancelled) setShowGuide(true);
      }, 400);
    }
    return () => {
      cancelled = true;
      if (t != null) clearTimeout(t);
    };
  }, [
    pathname,
    authLoading,
    user?.id,
    entryGateFlowDone,
    linkRequirementResolved,
    needsDailyLink,
  ]);

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

  /** 대기 명단 켜 둔 채 30초 이상 탭/창을 벗어나 있으면 자동 해제 */
  useEffect(() => {
    if (authLoading || !user || !waitlistEnrolled) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function clearLeaveTimer() {
      if (timeoutId != null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    }

    function scheduleAutoLeave() {
      clearLeaveTimer();
      timeoutId = setTimeout(() => {
        timeoutId = null;
        if (document.visibilityState !== "visible") {
          void fetch("/api/trade/waitlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enrolled: false }),
          })
            .then((r) => r.json() as Promise<{
              ok?: boolean;
              count?: number;
              enrolled?: boolean;
              tradeDailyCompleted?: number;
              tradeDailyLimit?: number;
              tradeDailyRemaining?: number;
            }>)
            .then((d) => {
              if (d.ok) {
                setWaitlistCount(d.count ?? 0);
                setWaitlistEnrolled(Boolean(d.enrolled));
                setTradeDailyCompleted(d.tradeDailyCompleted ?? 0);
                setTradeDailyLimit(d.tradeDailyLimit ?? TEMP_DAILY_TRADE_COMPLETED_LIMIT);
                setTradeDailyRemaining(d.tradeDailyRemaining ?? 0);
              }
            })
            .catch(() => null);
        }
      }, WAITLIST_AUTO_LEAVE_MS);
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        scheduleAutoLeave();
      } else {
        clearLeaveTimer();
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearLeaveTimer();
    };
  }, [authLoading, user, waitlistEnrolled]);

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
    const res = await fetch("/api/auth/logout", { method: "POST" });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (res.status === 403 || j.ok === false) {
      setReceiveAlert({
        message: j.error ?? "지금은 로그아웃할 수 없습니다.",
        type: "warning",
      });
      return;
    }
    router.push("/welcome");
  }

  // ── Trade waitlist toggle ────────────────────────────────────────────────────

  async function handleToggleWaitlist() {
    if (waitlistToggleBusy) return;
    if (!waitlistEnrolled && tradeDailyRemaining === 0) {
      setReceiveAlert({
        message:
          "오늘(한국 시간 기준) 완료한 맞교가 상한에 도달하여 대기 명단에 등록할 수 없습니다. 내일 다시 이용해 주세요.",
        type: "warning",
      });
      return;
    }
    setWaitlistToggleBusy(true);
    try {
      const res = await fetch("/api/trade/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrolled: !waitlistEnrolled }),
      });
      const d = (await res.json()) as {
        ok?: boolean;
        count?: number;
        enrolled?: boolean;
        error?: string;
        tradeDailyCompleted?: number;
        tradeDailyLimit?: number;
        tradeDailyRemaining?: number;
      };
      if (!res.ok || !d.ok) {
        setReceiveAlert({ message: d.error ?? "대기 명단 설정에 실패했습니다.", type: "error" });
        return;
      }
      setWaitlistCount(d.count ?? 0);
      setWaitlistEnrolled(Boolean(d.enrolled));
      setTradeDailyCompleted(d.tradeDailyCompleted ?? 0);
      setTradeDailyLimit(d.tradeDailyLimit ?? TEMP_DAILY_TRADE_COMPLETED_LIMIT);
      setTradeDailyRemaining(d.tradeDailyRemaining ?? 0);
    } catch {
      setReceiveAlert({ message: "연결에 실패했습니다.", type: "error" });
    } finally {
      setWaitlistToggleBusy(false);
    }
  }

  // ── Seek trade partner (poll until matched) ─────────────────────────────────

  async function handleSeekTrade() {
    setReceiveAlert(null);
    if (!waitlistEnrolled) {
      setReceiveAlert({ message: "먼저 ‘대기 명단 등록’을 켜 주세요.", type: "warning" });
      return;
    }

    seekAbortRef.current = false;
    setReceiving(true);
    setTradeSearching(true);

    try {
      for (let i = 0; i < 300; i++) {
        if (seekAbortRef.current) break;

        const res = await fetch("/api/trade/seek", { method: "POST" });
        const data = (await res.json()) as {
          ok?: boolean;
          waiting?: boolean;
          error?: string;
          reason?: string;
          transactionId?: string;
          link?: { id: string; url: string; deadline: number };
        };

        if (!res.ok || data.ok === false) {
          const msg =
            data.reason === "NOT_ON_WAITLIST"
              ? "먼저 대기 명단에 등록해 주세요."
              : data.reason === "NO_USER_LINK"
                ? (data.error ?? "마이페이지에서 에이블리 링크(https://applink.a-bly.com/)를 등록해 주세요.")
                : data.reason === "TRADE_TEMP_BAN"
                  ? (data.error ?? "신고 누적으로 일정 시간 동안 맞교할 수 없습니다.")
                  : data.reason === "PERMANENT_TRADE_BAN"
                    ? (data.error ?? "계정 제재로 맞교할 수 없습니다.")
                    : data.reason === "DAILY_TRADE_LIMIT"
                      ? (data.error ??
                        "오늘(한국 시간 기준) 완료한 맞교가 상한에 도달했습니다. 내일 다시 이용해 주세요.")
                      : (data.error ?? "맞교를 시작할 수 없어요.");
          setReceiveAlert({ message: msg, type: "warning" });
          return;
        }

        if (data.transactionId && data.link) {
          setTradeSession({ transactionId: data.transactionId, linkId: data.link.id });
          return;
        }

        if (data.waiting) {
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }

        setReceiveAlert({ message: "매칭 응답을 이해하지 못했습니다. 다시 시도해 주세요.", type: "error" });
        return;
      }

      setReceiveAlert({
        message: "아직 상대를 찾지 못했어요. 잠시 후 다시 눌러 주세요.",
        type: "info",
      });
    } catch {
      setReceiveAlert({ message: "연결에 실패했습니다. 네트워크를 확인해 주세요.", type: "error" });
    } finally {
      setReceiving(false);
      setTradeSearching(false);
    }
  }

  function resetTradeUi() {
    seekAbortRef.current = true;
    setTradeSession(null);
    setReceiving(false);
    setTradeSearching(false);
    setReceiveAlert(null);
    refreshDashboard();
  }

  function dismissReportNotice() {
    if (user && reportNoticeCount != null) {
      writeReportAckCount(user.id, reportNoticeCount);
    }
    setReportNoticeCount(null);
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
              에이블리 옷장 맞교
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
              {!accountControlsLocked ? (
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
              ) : null}
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

              {/* Stats: 새로고침 버튼 + 주기·탭 복귀 시 자동 갱신 */}
              <div
                className={`flex w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-2xl border border-[#ececec] bg-white shadow-sm ${
                  isDesktopLayout ? "p-5 lg:p-6" : "p-4"
                }`}
              >
                <span
                  className={`font-bold text-[#ff5a5f] ${isDesktopLayout ? "text-3xl" : "text-2xl"}`}
                >
                  {waitlistCount}
                </span>
                <span className={`text-gray-500 ${isDesktopLayout ? "text-base" : "text-sm"}`}>
                  명의 맞교 상대 대기 중
                </span>
                <button
                  type="button"
                  onClick={() => void handleRefreshWaitlistCount()}
                  disabled={waitlistCountRefreshing}
                  aria-label="대기 인원 새로고침"
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#ececec] bg-[#fafafa] text-gray-500 transition hover:bg-gray-100 hover:text-[#1a1a1a] disabled:opacity-50 ${
                    waitlistCountRefreshing ? "[&_svg]:animate-spin" : ""
                  }`}
                >
                  <IconRefresh className="h-4 w-4" />
                </button>
              </div>

              {/* 대기 명단 */}
              <div
                className={`rounded-2xl border border-[#ececec] bg-white shadow-sm transition-shadow hover:shadow-md ${
                  isDesktopLayout ? "p-5 lg:p-6" : "p-4"
                }`}
              >
                <p className="mb-3 text-xs font-semibold text-gray-400">맞교 대기 명단</p>
                <button
                  type="button"
                  onClick={() => void handleToggleWaitlist()}
                  disabled={waitlistToggleBusy || (!waitlistEnrolled && tradeDailyRemaining === 0)}
                  aria-pressed={waitlistEnrolled}
                  className={`w-full rounded-2xl border-2 font-semibold transition-all active:scale-[0.98] disabled:opacity-50 ${
                    waitlistEnrolled
                      ? "border-[#ff5a5f] bg-[#fff5f5] py-4 text-[#ff5a5f] shadow-inner"
                      : "border-[#e5e7eb] bg-white py-4 text-gray-600 hover:bg-gray-50"
                  } ${isDesktopLayout ? "text-base" : "text-sm"}`}
                >
                  {waitlistToggleBusy
                    ? "처리 중…"
                    : waitlistEnrolled
                      ? "✓ 대기 명단에 등록됨 · 탭하여 해제"
                      : "대기 명단 등록하기"}
                </button>
                <p className="mt-2 text-center text-xs leading-relaxed text-gray-400">
                  등록해야 위 숫자에 포함되고, 맞교하기를 쓸 수 있어요. 다른 화면으로 30초 이상
                  머물면 대기는 자동으로 꺼져요.
                </p>
                {tradeDailyRemaining !== null ? (
                  <p className="mt-2 text-center text-[11px] leading-relaxed text-gray-500">
                    오늘 맞교 완료 {tradeDailyCompleted}/{tradeDailyLimit}회
                    {tradeDailyRemaining === 0 ? (
                      <span className="font-semibold text-[#c0392b]"> · 내일 자정 이후 다시 가능</span>
                    ) : null}
                  </p>
                ) : null}
              </div>

              {/* Receive / trade */}
              {!tradeSession && (
                <div>
                  {receiveAlert && <Alert state={receiveAlert} />}
                  <button
                    onClick={() => void handleSeekTrade()}
                    disabled={
                      receiving ||
                      needsDailyLink ||
                      !waitlistEnrolled ||
                      tradeDailyRemaining === 0
                    }
                    className={`w-full rounded-2xl bg-[#ff5a5f] text-white font-bold shadow-[0_4px_16px_rgba(255,90,95,0.25)] disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed active:scale-[0.97] transition-all ${
                      isDesktopLayout
                        ? "h-[4.5rem] text-xl"
                        : "h-16 text-lg"
                    }`}
                  >
                    {tradeSearching
                      ? "맞교 상대를 찾는 중…"
                      : receiving
                        ? "연결 중…"
                        : "맞교하기"}
                  </button>
                  {!waitlistEnrolled ? (
                    <p className="mt-2 text-center text-xs text-amber-700">
                      맞교하기를 쓰려면 위에서 대기 명단을 먼저 켜 주세요.
                    </p>
                  ) : null}
                  {needsDailyLink ? (
                    <p className="mt-2 text-center text-xs text-gray-500">
                      마이페이지에서 오늘의 에이블리 링크(https://applink.a-bly.com/)를 등록한 뒤 이용할 수 있어요.
                    </p>
                  ) : null}
                  {waitlistEnrolled && tradeDailyRemaining === 0 ? (
                    <p className="mt-2 text-center text-xs text-[#c0392b]">
                      오늘은 맞교 완료 한도에 도달했습니다. 내일 다시 이용해 주세요.
                    </p>
                  ) : null}
                  <a
                    href={MOALINK_PAGES_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#e8e8e8] bg-white px-4 text-center text-sm font-semibold text-[#1a1a1a] shadow-sm transition hover:border-[#ff5a5f]/50 hover:bg-[#fff8f8] hover:text-[#ff5a5f] active:scale-[0.99] sm:text-[15px]"
                  >
                    다른 서비스도 이용하러 가기
                    <svg className="h-4 w-4 shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M7 17L17 7M17 7H9M17 7v8"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </a>
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

      {showGuide && user ? (
        <GuidePopup
          userId={user.id}
          onClose={() => setShowGuide(false)}
          onRequestWithdraw={() => setShowWithdrawModal(true)}
          hideWithdraw={accountControlsLocked}
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

      {reportNoticeCount != null ? (
        <ReportNoticeModal count={reportNoticeCount} onDismiss={dismissReportNotice} />
      ) : null}

      {showDailyTradeLimitModal ? (
        <DailyTradeLimitModal
          completed={tradeDailyCompleted}
          limit={tradeDailyLimit}
          onDismiss={() => {
            dailyLimitNoticeDismissedRef.current = true;
            setShowDailyTradeLimitModal(false);
          }}
        />
      ) : null}

      {user && entryGateEnabled && entryGateAblyUrl ? (
        <EntryGateModal
          targetUrl={entryGateAblyUrl}
          userId={user.id}
          entryGateForceAt={entryGateForceAt}
          onGatePassed={handleEntryGatePassed}
        />
      ) : null}
    </>
  );
}
