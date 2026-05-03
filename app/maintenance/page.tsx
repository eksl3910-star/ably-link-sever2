import { getSettings } from "@/lib/database";

export const runtime = "edge";

const KAKAO_OPEN_URL = "https://open.kakao.com/o/sKsl7Tsi";

export default async function MaintenancePage() {
  let extra = "";
  try {
    const s = await getSettings();
    extra = s.maintenanceMessage.trim();
  } catch {
    extra = "";
  }

  return (
    <main className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#f5f6f8] px-6 text-center pointer-events-none">
      <div className="pointer-events-auto flex max-w-md flex-col items-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-[#1f2430] sm:text-5xl">
          점검중입니다
        </h1>
        <p className="mt-4 text-sm font-medium text-[#7c8394] sm:text-base">
          다음에 다시 서비스를 이용해 주세요
        </p>

        {extra ? (
          <div
            className="mt-6 w-full rounded-2xl border-2 border-[#ff5a5f] bg-[#fff0f0] px-5 py-4 text-left shadow-md shadow-[#ff5a5f]/10"
            role="region"
            aria-label="운영자 안내"
          >
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#ff5a5f]">안내</p>
            <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-[#1f2430]">
              {extra}
            </p>
          </div>
        ) : null}

        <a
          href={KAKAO_OPEN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-10 inline-flex h-12 min-w-[240px] items-center justify-center rounded-2xl bg-[#111] px-8 text-base font-bold text-white transition-opacity hover:opacity-90 active:opacity-80"
        >
          제작자에게 문의하기
        </a>
      </div>
    </main>
  );
}
