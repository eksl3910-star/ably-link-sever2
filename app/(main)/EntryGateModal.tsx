"use client";

import { useCallback, useEffect, useState } from "react";
import { getKstHourBucketId } from "@/lib/kst";

type Props = {
  targetUrl: string;
  /** 계정별로 인정 여부를 분리 */
  userId: string;
};

export function EntryGateModal({ targetUrl, userId }: Props) {
  const storageKey = `als_kst_entry_gate_hour_${userId}`;

  const syncBlocked = useCallback((): boolean => {
    const bucket = getKstHourBucketId(Date.now());
    let ack = "";
    try {
      ack = localStorage.getItem(storageKey) ?? "";
    } catch {
      /* ignore */
    }
    return ack !== bucket;
  }, [storageKey]);

  /** null = 아직 클라이언트에서 저장값 확인 전 */
  const [blocked, setBlocked] = useState<boolean | null>(null);

  useEffect(() => {
    setBlocked(syncBlocked());
  }, [syncBlocked]);

  useEffect(() => {
    const run = () => setBlocked(syncBlocked());
    const id = window.setInterval(run, 15_000);
    window.addEventListener("focus", run);
    const onVis = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [syncBlocked]);

  useEffect(() => {
    if (blocked !== true) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [blocked]);

  if (blocked !== true) return null;

  function onConfirm() {
    window.open(targetUrl, "_blank", "noopener,noreferrer");
    try {
      localStorage.setItem(storageKey, getKstHourBucketId(Date.now()));
    } catch {
      /* ignore */
    }
    setBlocked(false);
  }

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/55 px-5 als-backdrop-enter"
      role="dialog"
      aria-modal="true"
      aria-labelledby="entry-gate-title"
    >
      <div className="als-modal-enter w-full max-w-[420px] rounded-3xl bg-white p-7 shadow-2xl">
        <h2 id="entry-gate-title" className="text-lg font-bold text-[#1a1a1a]">
          이용 안내
        </h2>
        <p className="mt-4 text-center text-sm leading-relaxed text-[#444]">
          서버 유지를 위해 버튼을 눌러야 서비스를 이용할 수 있습니다.
        </p>
        <p className="mt-3 text-center text-sm font-semibold leading-relaxed text-[#1a1a1a]">
          에이블리 수익성 링크 입니다.
        </p>
        <button
          type="button"
          onClick={onConfirm}
          className="mt-8 h-14 w-full rounded-2xl bg-[#ff5a5f] text-base font-bold text-white shadow-[0_4px_16px_rgba(255,90,95,0.3)] transition hover:bg-[#e04448] active:scale-[0.98]"
        >
          링크 열고 서비스 이용하기
        </button>
        <p className="mt-4 text-center text-[11px] leading-relaxed text-gray-400">
          한국 시간 기준 매 정각마다 다시 눌러 주세요. 같은 시간 안에서는 한 번만 확인하면 됩니다.
        </p>
      </div>
    </div>
  );
}
