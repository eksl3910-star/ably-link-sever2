"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type TxPoll = {
  ok?: boolean;
  role?: "a" | "b";
  peerUserId?: string;
  peerLink?: string;
  myLink?: string;
  status?: string;
  peerPresent?: boolean;
  phase?: "waiting" | "peer_connected" | "done";
  peerClickedMyLink?: boolean;
  iClickedPeerLink?: boolean;
  createdAt?: number;
  claimDeadline?: number | null;
  showReport?: boolean;
  error?: string;
};

type Props = {
  transactionId: string;
  linkId: string;
  onClose: () => void;
  onSettled: () => void;
};

const POLL_MS = 1200;

export function TradeModal({ transactionId, linkId, onClose, onSettled }: Props) {
  const closeWithReturn = useCallback(() => {
    void fetch("/api/links/return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkId }),
    })
      .catch(() => null)
      .finally(() => onClose());
  }, [linkId, onClose]);

  const [tx, setTx] = useState<TxPoll | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyOpen, setBusyOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const settledRef = useRef(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/transactions/${encodeURIComponent(transactionId)}`);
      const j = (await res.json()) as TxPoll;
      if (!res.ok || !j.ok) {
        setError(j.error ?? "거래 정보를 불러오지 못했습니다.");
        return;
      }
      setTx(j);
      setError(null);
      if (j.phase === "done" && !settledRef.current) {
        settledRef.current = true;
        onSettled();
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    }
  }, [transactionId, onSettled]);

  useEffect(() => {
    void poll();
    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => window.clearInterval(id);
  }, [poll]);

  useEffect(() => {
    const deadline = tx?.claimDeadline;
    if (deadline == null) return;
    const tick = () => {
      if (Date.now() >= deadline) {
        closeWithReturn();
      }
    };
    const id = window.setInterval(tick, 400);
    tick();
    return () => window.clearInterval(id);
  }, [tx?.claimDeadline, closeWithReturn]);

  async function handleOpenPeer() {
    if (!tx?.peerLink || busyOpen) return;
    setBusyOpen(true);
    try {
      const res = await fetch(`/api/transactions/${encodeURIComponent(transactionId)}/click`, {
        method: "POST",
      });
      if (!res.ok) {
        setError("클릭 기록에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      window.open(tx.peerLink, "_blank", "noopener,noreferrer");
      void poll();
    } finally {
      setBusyOpen(false);
    }
  }

  async function handleReport() {
    if (!tx?.peerUserId || reportBusy || reportDone) return;
    setReportBusy(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: tx.peerUserId,
          reason: reportReason.trim() || "거래 타이머 내 상대 링크 미클릭",
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? "신고 처리에 실패했습니다.");
        return;
      }
      setReportDone(true);
    } finally {
      setReportBusy(false);
    }
  }

  const phaseLabel =
    tx?.phase === "done"
      ? "양측 완료 · 종료"
      : tx?.phase === "peer_connected"
        ? "상대방 접속 완료"
        : "대기 중";

  const secondsLeft =
    tx?.createdAt != null ? Math.max(0, 15 - Math.floor((Date.now() - tx.createdAt) / 1000)) : null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 als-backdrop-enter md:items-center md:p-6"
      onClick={(e) => e.target === e.currentTarget && closeWithReturn()}
    >
      <div
        className="als-modal-enter w-full max-w-[480px] max-h-[90vh] overflow-y-auto rounded-t-3xl bg-white p-6 pb-9 shadow-2xl md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[#1a1a1a]">거래하기</h2>
          <button
            type="button"
            onClick={() => closeWithReturn()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f5f5f5] text-[#666] transition hover:bg-[#ebebeb]"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {error ? (
          <div className="mb-3 rounded-xl border border-[#ffd6d6] bg-[#fff5f5] px-3 py-2 text-sm text-[#c0392b]">
            {error}
          </div>
        ) : null}

        <div className="mb-4 rounded-2xl border border-[#ececec] bg-[#fafafa] px-4 py-3 text-sm text-[#444]">
          <p className="text-xs font-semibold text-gray-500">거래 상태</p>
          <p className="mt-1 font-semibold text-[#1a1a1a]">{phaseLabel}</p>
          <p className="mt-2 text-xs text-gray-500 leading-relaxed">
            나의 링크를 상대가 열고, 상대 링크를 내가 열면 완료됩니다. 창을 닫으면 반납 규칙이 그대로
            적용돼요.
          </p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl border border-[#ececec] bg-white px-3 py-3">
            <p className="text-[11px] text-gray-400">상대 링크 열기</p>
            <p className="mt-1 text-lg font-bold text-[#ff5a5f]">
              {tx?.iClickedPeerLink ? "완료" : "필요"}
            </p>
          </div>
          <div className="rounded-xl border border-[#ececec] bg-white px-3 py-3">
            <p className="text-[11px] text-gray-400">내 링크 수신</p>
            <p className="mt-1 text-lg font-bold text-[#2355b0]">
              {tx?.peerClickedMyLink ? "완료" : "대기"}
            </p>
          </div>
        </div>

        {secondsLeft !== null ? (
          <div className="mb-4 text-center">
            <p className="text-xs text-gray-400">신고 판정 타이머 (15초)</p>
            <p className="text-4xl font-bold leading-none text-[#1a1a1a]">{secondsLeft}</p>
          </div>
        ) : null}

        <div className="mb-3 rounded-xl bg-[#f7f7f7] px-3 py-2 text-xs text-gray-500 break-all">
          {tx?.myLink ? tx.myLink : "내 링크 불러오는 중…"}
        </div>

        <button
          type="button"
          disabled={busyOpen || !tx?.peerLink || tx.phase === "done"}
          onClick={() => void handleOpenPeer()}
          className="mb-3 h-12 w-full rounded-xl bg-[#ff5a5f] text-base font-bold text-white transition hover:bg-[#e04448] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busyOpen ? "처리 중…" : "상대 링크 열기 (에이블리)"}
        </button>

        <button
          type="button"
          onClick={() => closeWithReturn()}
          className="h-10 w-full rounded-xl bg-[#f5f5f5] text-sm text-gray-600 hover:bg-[#ebebeb]"
        >
          반납하고 닫기
        </button>

        {tx?.showReport ? (
          <div className="mt-5 rounded-2xl border border-[#ffe4a0] bg-[#fffaf0] p-4">
            <p className="text-sm font-semibold text-[#b07800]">15초 내 상대 링크 클릭이 감지되지 않았어요</p>
            <p className="mt-2 text-xs text-[#666] leading-relaxed">
              문제가 지속되면 신고할 수 있어요. 신고가 누적되면 이용이 제한될 수 있습니다.
            </p>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="신고 사유 (선택)"
              rows={2}
              className="mt-3 w-full resize-none rounded-xl border border-[#ececec] px-3 py-2 text-sm outline-none focus:border-[#ff5a5f]"
            />
            <button
              type="button"
              disabled={reportBusy || reportDone}
              onClick={() => void handleReport()}
              className="mt-3 h-11 w-full rounded-xl bg-[#111] text-sm font-semibold text-white disabled:opacity-40"
            >
              {reportDone ? "신고 접수됨" : reportBusy ? "전송 중…" : "신고하기"}
            </button>
          </div>
        ) : null}

        {tx?.phase === "done" ? (
          <button
            type="button"
            onClick={() => closeWithReturn()}
            className="mt-4 h-11 w-full rounded-xl bg-[#1a1a1a] text-sm font-semibold text-white"
          >
            닫기
          </button>
        ) : null}
      </div>
    </div>
  );
}
