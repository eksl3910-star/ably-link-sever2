"use client";

import { useEffect, useState } from "react";

/**
 * 단축키·우클릭·도킹된 개발자 도구(크기 차이 휴리스틱)에 대응합니다.
 * 브라우저 상단 메뉴로만 열 경우에는 막을 수 없습니다.
 */
export function DevToolsGuard() {
  const [devtoolsLikelyOpen, setDevtoolsLikelyOpen] = useState(false);

  useEffect(() => {
    const blockKeys = (e: KeyboardEvent) => {
      if (e.key === "F12") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const k = e.key;
      if (e.ctrlKey && e.shiftKey && ["I", "i", "J", "j", "C", "c"].includes(k)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.metaKey && e.altKey && (k === "I" || k === "i" || k === "J" || k === "j")) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.ctrlKey && (k === "U" || k === "u" || k === "S" || k === "s")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const blockContext = (e: MouseEvent) => {
      e.preventDefault();
    };

    document.addEventListener("keydown", blockKeys, true);
    document.addEventListener("contextmenu", blockContext, true);

    const threshold = 140;
    const checkSize = () => {
      const desktop =
        window.matchMedia("(min-width: 992px)").matches &&
        !window.matchMedia("(pointer: coarse)").matches;
      if (!desktop) {
        setDevtoolsLikelyOpen(false);
        return;
      }
      const wDiff = window.outerWidth - window.innerWidth;
      const hDiff = window.outerHeight - window.innerHeight;
      setDevtoolsLikelyOpen(wDiff > threshold || hDiff > threshold);
    };

    checkSize();
    const id = window.setInterval(checkSize, 400);
    window.addEventListener("resize", checkSize);

    return () => {
      document.removeEventListener("keydown", blockKeys, true);
      document.removeEventListener("contextmenu", blockContext, true);
      window.clearInterval(id);
      window.removeEventListener("resize", checkSize);
    };
  }, []);

  return (
    <>
      {devtoolsLikelyOpen ? (
        <div
          className="fixed inset-0 z-[2147483646] flex items-center justify-center bg-[#1a1a1a] px-6 text-center text-sm leading-relaxed text-white/90"
          aria-hidden="true"
        >
          <p>개발자 도구를 닫은 뒤 새로고침해 주세요.</p>
        </div>
      ) : null}
    </>
  );
}
