"use client";

import { useEffect, useState } from "react";
import { PURGE_ALL_USERS_CONFIRM_PHRASE } from "@/lib/admin-purge-constants";

type Settings = {
  maintenanceOn: boolean;
  touchedAt: number;
  maintenanceMessage: string;
  entryGateAblyUrl: string;
  entryGateEnabled: boolean;
  welcomeAlertMessage: string;
};
type Metrics = {
  totalUsers: number;
  newUsersToday: number;
  totalLinks: number;
  queuedLinks: number;
  consumedLinks: number;
};

type Announcement = { id: string; title: string; body: string; createdAt: number };

function formatAnnPostedAt(ts: number): string {
  try {
    return new Date(ts).toLocaleString("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

type AlertState = { message: string; type: "error" | "success" | "info" } | null;

async function readResponseJson<T>(res: Response): Promise<{ data: T | null; status: number }> {
  const raw = await res.text();
  if (!raw.trim()) return { data: null, status: res.status };
  try {
    return { data: JSON.parse(raw) as T, status: res.status };
  } catch {
    return { data: null, status: res.status };
  }
}

function Alert({ state }: { state: AlertState }) {
  if (!state) return null;
  const styles = {
    error: "bg-red-50 text-red-700 border-red-200",
    success: "bg-green-50 text-green-700 border-green-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
  };
  return (
    <p className={`mt-3 text-sm rounded-xl border px-3 py-2 ${styles[state.type]}`}>
      {state.message}
    </p>
  );
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [password, setPassword] = useState("");
  const [maintenanceMsg, setMaintenanceMsg] = useState("");
  const [alert, setAlert] = useState<AlertState>(null);

  const [annList, setAnnList] = useState<Announcement[]>([]);
  const [annBusy, setAnnBusy] = useState(false);
  const [newAnnTitle, setNewAnnTitle] = useState("");
  const [newAnnBody, setNewAnnBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [entryGateInput, setEntryGateInput] = useState("");
  const [entryGateEnabled, setEntryGateEnabled] = useState(true);
  const [welcomeAlertInput, setWelcomeAlertInput] = useState("");
  const [purgeConfirm, setPurgeConfirm] = useState("");
  const [purgeBusy, setPurgeBusy] = useState(false);

  // Load current settings
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings");
        const { data: d } = await readResponseJson<
          Partial<Settings> & { error?: string; welcomeAlertMessage?: string }
        >(res);
        if (!res.ok) {
          setAlert({
            message: d?.error ?? `설정을 불러오지 못했습니다. (HTTP ${res.status})`,
            type: "error",
          });
          return;
        }
        if (!d) {
          setAlert({
            message: `설정 응답을 읽을 수 없습니다. (HTTP ${res.status})`,
            type: "error",
          });
          return;
        }
        setSettings({
          maintenanceOn: Boolean(d.maintenanceOn),
          touchedAt: d.touchedAt ?? 0,
          maintenanceMessage: typeof d.maintenanceMessage === "string" ? d.maintenanceMessage : "",
          entryGateAblyUrl:
            typeof d.entryGateAblyUrl === "string" && d.entryGateAblyUrl.trim()
              ? d.entryGateAblyUrl
              : "https://applink.a-bly.com/p25459",
          entryGateEnabled: d.entryGateEnabled !== false,
          welcomeAlertMessage: typeof d.welcomeAlertMessage === "string" ? d.welcomeAlertMessage : "",
        });
        if (typeof d.maintenanceMessage === "string") setMaintenanceMsg(d.maintenanceMessage);
        if (typeof d.entryGateAblyUrl === "string" && d.entryGateAblyUrl.trim()) {
          setEntryGateInput(d.entryGateAblyUrl);
        } else {
          setEntryGateInput("https://applink.a-bly.com/p25459");
        }
        if (typeof d.entryGateEnabled === "boolean") {
          setEntryGateEnabled(d.entryGateEnabled);
        } else {
          setEntryGateEnabled(true);
        }
        if (typeof d.welcomeAlertMessage === "string") {
          setWelcomeAlertInput(d.welcomeAlertMessage);
        } else {
          setWelcomeAlertInput("");
        }
      } catch {
        setAlert({ message: "네트워크 오류가 발생했습니다.", type: "error" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function toggleMaintenance(next: boolean) {
    if (busy) return;
    setAlert(null);

    if (!password) {
      setAlert({ message: "관리자 비밀번호를 입력해주세요.", type: "error" });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          on: next,
          ...(next ? { maintenanceMessage: maintenanceMsg } : {}),
        }),
      });
      const { data } = await readResponseJson<{
        ok?: boolean;
        error?: string;
        maintenanceOn?: boolean;
        touchedAt?: number;
        maintenanceMessage?: string;
      }>(res);

      if (!data || !res.ok || !data.ok) {
        setAlert({
          message: data?.error ?? `업데이트 실패 (HTTP ${res.status})`,
          type: "error",
        });
        return;
      }

      setSettings((prev) =>
        prev
          ? {
              ...prev,
              maintenanceOn: Boolean(data.maintenanceOn),
              touchedAt: data.touchedAt ?? prev.touchedAt,
              maintenanceMessage:
                typeof data.maintenanceMessage === "string" ? data.maintenanceMessage : maintenanceMsg,
            }
          : null
      );
      if (typeof data.maintenanceMessage === "string") setMaintenanceMsg(data.maintenanceMessage);
      setAlert({
        message: next ? "점검 모드가 활성화됐습니다." : "점검 모드가 해제됐습니다.",
        type: "success",
      });
    } catch {
      setAlert({ message: "네트워크 오류가 발생했습니다.", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function saveMaintenanceMessageOnly() {
    if (busy) return;
    setAlert(null);
    if (!password) {
      setAlert({ message: "관리자 비밀번호를 입력해주세요.", type: "error" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, maintenanceMessage: maintenanceMsg }),
      });
      const { data } = await readResponseJson<{
        ok?: boolean;
        error?: string;
        maintenanceOn?: boolean;
        touchedAt?: number;
        maintenanceMessage?: string;
      }>(res);
      if (!data || !res.ok || !data.ok) {
        setAlert({
          message: data?.error ?? `저장 실패 (HTTP ${res.status})`,
          type: "error",
        });
        return;
      }
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              maintenanceOn: Boolean(data.maintenanceOn),
              touchedAt: data.touchedAt ?? prev.touchedAt,
              maintenanceMessage:
                typeof data.maintenanceMessage === "string" ? data.maintenanceMessage : maintenanceMsg,
            }
          : prev
      );
      if (typeof data.maintenanceMessage === "string") setMaintenanceMsg(data.maintenanceMessage);
      setAlert({ message: "점검 안내 문구를 저장했습니다.", type: "success" });
    } catch {
      setAlert({ message: "네트워크 오류가 발생했습니다.", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function saveEntryGateUrl() {
    if (busy) return;
    setAlert(null);
    if (!password) {
      setAlert({ message: "관리자 비밀번호를 입력해주세요.", type: "error" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/entry-gate-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          url: entryGateInput,
          enabled: entryGateEnabled,
        }),
      });
      const { data } = await readResponseJson<{
        ok?: boolean;
        error?: string;
        entryGateAblyUrl?: string;
        entryGateEnabled?: boolean;
      }>(res);
      if (!data || !res.ok || !data.ok) {
        setAlert({
          message: data?.error ?? `저장 실패 (HTTP ${res.status})`,
          type: "error",
        });
        return;
      }
      if (typeof data.entryGateAblyUrl === "string") {
        setEntryGateInput(data.entryGateAblyUrl);
      }
      if (typeof data.entryGateEnabled === "boolean") {
        setEntryGateEnabled(data.entryGateEnabled);
      }
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              ...(typeof data.entryGateAblyUrl === "string"
                ? { entryGateAblyUrl: data.entryGateAblyUrl }
                : {}),
              ...(typeof data.entryGateEnabled === "boolean"
                ? { entryGateEnabled: data.entryGateEnabled }
                : {}),
            }
          : null
      );
      setAlert({ message: "메인 진입 게이트 설정을 저장했습니다.", type: "success" });
    } catch {
      setAlert({ message: "네트워크 오류가 발생했습니다.", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function saveWelcomeAlert() {
    if (busy) return;
    setAlert(null);
    if (!password) {
      setAlert({ message: "관리자 비밀번호를 입력해주세요.", type: "error" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/welcome-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, message: welcomeAlertInput }),
      });
      const { data } = await readResponseJson<{
        ok?: boolean;
        error?: string;
        welcomeAlertMessage?: string;
        touchedAt?: number;
      }>(res);
      if (!data || !res.ok || !data.ok) {
        setAlert({
          message: data?.error ?? `저장 실패 (HTTP ${res.status})`,
          type: "error",
        });
        return;
      }
      if (typeof data.welcomeAlertMessage === "string") {
        setWelcomeAlertInput(data.welcomeAlertMessage);
      }
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              welcomeAlertMessage:
                typeof data.welcomeAlertMessage === "string" ? data.welcomeAlertMessage : prev.welcomeAlertMessage,
              touchedAt: typeof data.touchedAt === "number" ? data.touchedAt : prev.touchedAt,
            }
          : null
      );
      setAlert({ message: "환영 페이지 긴급 안내를 저장했습니다.", type: "success" });
    } catch {
      setAlert({ message: "네트워크 오류가 발생했습니다.", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function forceEntryGateReshow() {
    if (busy) return;
    setAlert(null);
    if (!password) {
      setAlert({ message: "관리자 비밀번호를 입력해주세요.", type: "error" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/entry-gate-force", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const { data } = await readResponseJson<{ ok?: boolean; error?: string }>(res);
      if (!data || !res.ok || !data.ok) {
        setAlert({
          message: data?.error ?? `실패 (HTTP ${res.status})`,
          type: "error",
        });
        return;
      }
      setAlert({
        message:
          "진입 게이트를 다시 띄우도록 설정했습니다. 메인에 있는 사용자는 최대 약 20초 안에(설정 새로고침 주기) 또는 탭을 다시 보면 팝업이 나타납니다. 매 정각 자동 안내는 그대로 동작합니다.",
        type: "success",
      });
    } catch {
      setAlert({ message: "네트워크 오류가 발생했습니다.", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function loadStats() {
    setAlert(null);
    if (!password) {
      setAlert({ message: "관리자 비밀번호를 입력해주세요.", type: "error" });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const { data } = await readResponseJson<{ ok?: boolean; error?: string; metrics?: Metrics }>(
        res
      );

      if (!data || !res.ok || !data.ok) {
        setAlert({
          message: data?.error ?? `통계 조회 실패 (HTTP ${res.status})`,
          type: "error",
        });
        return;
      }

      setMetrics(data.metrics ?? null);
    } catch {
      setAlert({ message: "네트워크 오류가 발생했습니다.", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function purgeAllUsersAndLinks() {
    setAlert(null);
    if (!password) {
      setAlert({ message: "관리자 비밀번호를 입력해주세요.", type: "error" });
      return;
    }
    if (purgeConfirm !== PURGE_ALL_USERS_CONFIRM_PHRASE) {
      setAlert({
        message: "확인 문구가 일치하지 않습니다. 아래 입력란에 표시된 문구를 정확히 복사해 주세요.",
        type: "error",
      });
      return;
    }
    if (
      !globalThis.confirm(
        "정말로 모든 유저와 링크·맞교·세션·신고 데이터를 삭제할까요? 공지와 설정은 유지됩니다. 되돌릴 수 없습니다."
      )
    ) {
      return;
    }

    setPurgeBusy(true);
    try {
      const res = await fetch("/api/admin/purge-all-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirm: purgeConfirm }),
      });
      const { data } = await readResponseJson<{ ok?: boolean; error?: string }>(res);
      if (!data || !res.ok || !data.ok) {
        setAlert({
          message: data?.error ?? `삭제 실패 (HTTP ${res.status})`,
          type: "error",
        });
        return;
      }
      setPurgeConfirm("");
      setMetrics(null);
      setAlert({
        message:
          "유저·링크·맞교 관련 데이터를 모두 삭제했습니다. 통계의 「조회」로 반영 여부를 확인하세요.",
        type: "success",
      });
    } catch {
      setAlert({ message: "네트워크 오류가 발생했습니다.", type: "error" });
    } finally {
      setPurgeBusy(false);
    }
  }

  async function loadAnnouncementList() {
    setAlert(null);
    if (!password) {
      setAlert({ message: "관리자 비밀번호를 입력해주세요.", type: "error" });
      return;
    }
    setAnnBusy(true);
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, op: "list" }),
      });
      const { data } = await readResponseJson<{
        ok?: boolean;
        error?: string;
        items?: Announcement[];
      }>(res);
      if (!data || !res.ok || !data.ok) {
        setAlert({
          message: data?.error ?? `공지 목록 실패 (HTTP ${res.status})`,
          type: "error",
        });
        return;
      }
      setAnnList(data.items ?? []);
      setEditingId(null);
    } catch {
      setAlert({ message: "네트워크 오류가 발생했습니다.", type: "error" });
    } finally {
      setAnnBusy(false);
    }
  }

  async function createAnnouncement() {
    setAlert(null);
    if (!password) {
      setAlert({ message: "관리자 비밀번호를 입력해주세요.", type: "error" });
      return;
    }
    if (!newAnnTitle.trim() || !newAnnBody.trim()) {
      setAlert({ message: "제목과 상세 내용을 모두 입력해주세요.", type: "error" });
      return;
    }
    setAnnBusy(true);
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          op: "create",
          title: newAnnTitle,
          body: newAnnBody,
        }),
      });
      const { data } = await readResponseJson<{ ok?: boolean; error?: string }>(res);
      if (!data || !res.ok || !data.ok) {
        setAlert({ message: data?.error ?? "등록에 실패했습니다.", type: "error" });
        return;
      }
      setNewAnnTitle("");
      setNewAnnBody("");
      setAlert({ message: "공지를 등록했습니다.", type: "success" });
      await loadAnnouncementList();
    } catch {
      setAlert({ message: "네트워크 오류가 발생했습니다.", type: "error" });
    } finally {
      setAnnBusy(false);
    }
  }

  async function saveAnnouncementEdit(id: string) {
    setAlert(null);
    if (!password) {
      setAlert({ message: "관리자 비밀번호를 입력해주세요.", type: "error" });
      return;
    }
    if (!editTitle.trim() || !editBody.trim()) {
      setAlert({ message: "제목과 상세 내용을 모두 입력해주세요.", type: "error" });
      return;
    }
    setAnnBusy(true);
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          op: "update",
          id,
          title: editTitle,
          body: editBody,
        }),
      });
      const { data } = await readResponseJson<{ ok?: boolean; error?: string }>(res);
      if (!data || !res.ok || !data.ok) {
        setAlert({ message: data?.error ?? "수정에 실패했습니다.", type: "error" });
        return;
      }
      setEditingId(null);
      setAlert({ message: "공지를 수정했습니다.", type: "success" });
      await loadAnnouncementList();
    } catch {
      setAlert({ message: "네트워크 오류가 발생했습니다.", type: "error" });
    } finally {
      setAnnBusy(false);
    }
  }

  async function removeAnnouncement(id: string) {
    if (!confirm("이 공지를 삭제할까요?")) return;
    setAlert(null);
    if (!password) {
      setAlert({ message: "관리자 비밀번호를 입력해주세요.", type: "error" });
      return;
    }
    setAnnBusy(true);
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, op: "delete", id }),
      });
      const { data } = await readResponseJson<{ ok?: boolean; error?: string }>(res);
      if (!data || !res.ok || !data.ok) {
        setAlert({ message: data?.error ?? "삭제에 실패했습니다.", type: "error" });
        return;
      }
      if (editingId === id) setEditingId(null);
      setAlert({ message: "공지를 삭제했습니다.", type: "success" });
      await loadAnnouncementList();
    } catch {
      setAlert({ message: "네트워크 오류가 발생했습니다.", type: "error" });
    } finally {
      setAnnBusy(false);
    }
  }

  function startEditAnn(a: Announcement) {
    setEditingId(a.id);
    setEditTitle(a.title);
    setEditBody(a.body);
  }

  const isMaintenance = settings?.maintenanceOn ?? false;

  return (
    <main className="min-h-screen bg-white px-5 py-10">
      <div className="mx-auto w-full max-w-[560px] rounded-2xl border border-[#e7e9ee] bg-white p-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#1f2430]">관리자</h1>
        <p className="mt-2 text-sm text-[#7c8394]">서버 점검 모드와 통계를 관리해요.</p>
        <p className="mt-1 text-xs text-[#9aa3b2]">
          이 페이지를 열 때 브라우저가 요청하는 아이디·비밀번호는{" "}
          <code className="text-[#1f2430]">ADMIN_BASIC_USER</code> /{" "}
          <code className="text-[#1f2430]">ADMIN_BASIC_PASS</code> 입니다. 아래 칸은 점검·통계 API용으로{" "}
          <code className="text-[#1f2430]">ADMIN_TOGGLE_PASS</code>(없으면{" "}
          <code className="text-[#1f2430]">ADMIN_BASIC_PASS</code>)와 같게 입력하세요.
        </p>

        {/* Password input */}
        <div className="mt-6 rounded-xl border border-[#e7e9ee] bg-[#fbfbfd] p-4">
          <label className="mb-4 block">
            <p className="mb-2 text-xs font-semibold text-[#1f2430]">관리자 비밀번호</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              className="h-11 w-full rounded-xl border border-[#d9dde6] bg-white px-3 text-sm text-[#1f2430] outline-none placeholder:text-[#9aa3b2] focus:border-[#111] transition-colors"
            />
          </label>

          {/* Status badge */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1f2430]">현재 상태</p>
              <p className="mt-1 text-xs text-[#7c8394]">
                {loading ? "불러오는 중..." : isMaintenance ? "점검 중 (전체 차단)" : "정상 운영"}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                isMaintenance
                  ? "bg-[#ffe8ea] text-[#ff5a67]"
                  : "bg-[#e9fbf0] text-[#14a44d]"
              }`}
            >
              {isMaintenance ? "MAINTENANCE" : "LIVE"}
            </span>
          </div>

          <Alert state={alert} />

          {/* Toggle buttons */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              disabled={loading || busy || isMaintenance}
              onClick={() => void toggleMaintenance(true)}
              className="h-12 rounded-xl bg-[#111] text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              서버 전체 중단
            </button>
            <button
              disabled={loading || busy || !isMaintenance}
              onClick={() => void toggleMaintenance(false)}
              className="h-12 rounded-xl border border-[#e7e9ee] bg-white text-base font-bold text-[#1f2430] disabled:cursor-not-allowed disabled:opacity-40"
            >
              점검 해제
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-[#e7e9ee] bg-[#fbfbfd] p-4">
          <p className="text-sm font-semibold text-[#1f2430]">점검 화면 추가 안내</p>
          <p className="mt-1 text-xs text-[#7c8394]">
            점검 페이지에서 「다음에 다시…」 아래, 카카오 버튼 위에 박스로 보입니다. 비워 두면 표시하지 않아요. (최대
            2000자)
          </p>
          <textarea
            value={maintenanceMsg}
            onChange={(e) => setMaintenanceMsg(e.target.value)}
            maxLength={2000}
            rows={5}
            placeholder="예: 오늘 18시까지 점검 예정입니다. 긴급 문의는 카카오톡으로 주세요."
            className="mt-3 w-full resize-y rounded-xl border border-[#d9dde6] bg-white px-3 py-2.5 text-sm text-[#1f2430] outline-none placeholder:text-[#9aa3b2] focus:border-[#111]"
          />
          <button
            type="button"
            disabled={loading || busy}
            onClick={() => void saveMaintenanceMessageOnly()}
            className="mt-3 h-10 w-full rounded-xl border border-[#e7e9ee] bg-white text-sm font-bold text-[#1f2430] disabled:opacity-50"
          >
            안내 문구만 저장
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-[#e7e9ee] bg-[#fbfbfd] p-4">
          <p className="text-sm font-semibold text-[#1f2430]">환영 페이지 긴급 안내</p>
          <p className="mt-1 text-xs text-[#7c8394]">
            <code className="text-[#5c6570]">/welcome</code> 상단에 노란색 강조 박스로 표시됩니다. 비우고 저장하면
            숨깁니다. (최대 800자)
          </p>
          <textarea
            value={welcomeAlertInput}
            onChange={(e) => setWelcomeAlertInput(e.target.value)}
            maxLength={800}
            rows={4}
            placeholder="예: 일시적으로 가입이 지연되고 있습니다. 잠시 후 다시 시도해 주세요."
            className="mt-3 w-full resize-y rounded-xl border border-[#d9dde6] bg-white px-3 py-2.5 text-sm text-[#1f2430] outline-none placeholder:text-[#9aa3b2] focus:border-[#111]"
          />
          <button
            type="button"
            disabled={loading || busy}
            onClick={() => void saveWelcomeAlert()}
            className="mt-3 h-10 w-full rounded-xl bg-[#111] text-sm font-bold text-white disabled:opacity-50"
          >
            긴급 안내 저장
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-[#e7e9ee] bg-[#fbfbfd] p-4">
          <p className="text-sm font-semibold text-[#1f2430]">메인 진입 게이트</p>
          <p className="mt-1 text-xs text-[#7c8394]">
            로그인 후 메인에서 사용자가 눌러야 하는 「에이블리 수익성 링크」입니다. HTTPS이며 a-bly.com
            도메인만 허용됩니다. 아래 사용 안 함으로 두면 팝업이 뜨지 않습니다.
          </p>
          <label className="mt-3 flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={entryGateEnabled}
              onChange={(e) => setEntryGateEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-[#d9dde6] accent-[#111]"
            />
            <span className="text-sm font-medium text-[#1f2430]">메인 진입 게이트 사용</span>
          </label>
          <input
            type="url"
            value={entryGateInput}
            onChange={(e) => setEntryGateInput(e.target.value)}
            placeholder="https://applink.a-bly.com/..."
            className="mt-3 h-11 w-full rounded-xl border border-[#d9dde6] bg-white px-3 text-sm text-[#1f2430] outline-none placeholder:text-[#9aa3b2] focus:border-[#111]"
            autoComplete="off"
          />
          <button
            type="button"
            disabled={loading || busy}
            onClick={() => void saveEntryGateUrl()}
            className="mt-3 h-10 w-full rounded-xl bg-[#111] text-sm font-bold text-white disabled:opacity-50"
          >
            저장
          </button>
          <button
            type="button"
            disabled={loading || busy || !entryGateEnabled}
            onClick={() => void forceEntryGateReshow()}
            className="mt-2 h-10 w-full rounded-xl border border-[#d9dde6] bg-white text-sm font-bold text-[#1f2430] disabled:opacity-50"
          >
            진입 게이트 지금 다시 띄우기
          </button>
          <p className="mt-2 text-[11px] leading-relaxed text-[#9aa3b2]">
            게이트 사용이 켜져 있을 때만 동작합니다. 이미 이번 시간대에 확인한 사용자에게도 팝업이 다시 뜨며, 버튼을
            눌러 확인하면 사라집니다. 한국 시간 매 정각 자동 안내는 기존과 같습니다.
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-[#e7e9ee] bg-[#fbfbfd] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <p className="text-sm font-semibold text-[#1f2430]">공지 관리</p>
            <button
              type="button"
              disabled={annBusy}
              onClick={() => void loadAnnouncementList()}
              className="text-xs text-[#7c8394] border border-[#d9dde6] rounded-lg px-3 py-1 hover:bg-gray-50 disabled:opacity-50"
            >
              목록 불러오기
            </button>
          </div>
          <p className="text-xs text-[#7c8394] mb-3">
            메인 화면 상단에 탭으로 표시됩니다. 등록 시 올린 날짜가 자동으로 저장돼요. (제목 최대 200자, 내용 최대
            10000자)
          </p>

          <div className="rounded-xl border border-[#e7e9ee] bg-white p-3 mb-3">
            <p className="text-xs font-semibold text-[#1f2430] mb-2">새 공지</p>
            <input
              type="text"
              value={newAnnTitle}
              onChange={(e) => setNewAnnTitle(e.target.value)}
              maxLength={200}
              placeholder="제목"
              className="mb-2 h-10 w-full rounded-lg border border-[#d9dde6] px-3 text-sm outline-none focus:border-[#111]"
            />
            <textarea
              value={newAnnBody}
              onChange={(e) => setNewAnnBody(e.target.value)}
              rows={4}
              maxLength={10000}
              placeholder="상세 내용"
              className="w-full resize-y rounded-lg border border-[#d9dde6] px-3 py-2 text-sm outline-none focus:border-[#111]"
            />
            <button
              type="button"
              disabled={annBusy}
              onClick={() => void createAnnouncement()}
              className="mt-2 h-9 w-full rounded-lg bg-[#111] text-xs font-bold text-white disabled:opacity-50"
            >
              등록
            </button>
          </div>

          {annList.length === 0 ? (
            <p className="text-xs text-[#9aa3b2]">목록 불러오기를 누르면 현재 등록된 공지가 표시돼요.</p>
          ) : (
            <ul className="space-y-2">
              {annList.map((a) => (
                <li
                  key={a.id}
                  className="rounded-xl border border-[#e7e9ee] bg-white p-3"
                >
                  {editingId === a.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        maxLength={200}
                        className="h-9 w-full rounded-lg border border-[#d9dde6] px-2 text-sm"
                      />
                      <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={4}
                        maxLength={10000}
                        className="w-full resize-y rounded-lg border border-[#d9dde6] px-2 py-1.5 text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={annBusy}
                          onClick={() => void saveAnnouncementEdit(a.id)}
                          className="h-8 flex-1 rounded-lg bg-[#111] text-xs font-bold text-white disabled:opacity-50"
                        >
                          저장
                        </button>
                        <button
                          type="button"
                          disabled={annBusy}
                          onClick={() => setEditingId(null)}
                          className="h-8 flex-1 rounded-lg border border-[#d9dde6] text-xs font-bold text-[#1f2430] disabled:opacity-50"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-[#1f2430]">{a.title}</p>
                      <p className="mt-1 text-[11px] text-[#9aa3b2]">
                        올린 날짜: {formatAnnPostedAt(a.createdAt)}
                      </p>
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs text-[#5c6570]">
                        {a.body}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          disabled={annBusy}
                          onClick={() => startEditAnn(a)}
                          className="h-8 flex-1 rounded-lg border border-[#d9dde6] text-xs font-bold text-[#1f2430] disabled:opacity-50"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          disabled={annBusy}
                          onClick={() => void removeAnnouncement(a.id)}
                          className="h-8 flex-1 rounded-lg border border-[#ffd4d6] text-xs font-bold text-[#c53030] disabled:opacity-50"
                        >
                          삭제
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Stats section */}
        <div className="mt-4 rounded-xl border border-[#e7e9ee] bg-[#fbfbfd] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-[#1f2430]">통계</p>
            <button
              onClick={() => void loadStats()}
              disabled={busy}
              className="text-xs text-[#7c8394] border border-[#d9dde6] rounded-lg px-3 py-1 hover:bg-gray-50 disabled:opacity-50"
            >
              조회
            </button>
          </div>

          {metrics ? (
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "전체 유저", value: metrics.totalUsers },
                { label: "오늘 가입 (KST)", value: metrics.newUsersToday },
                { label: "전체 링크", value: metrics.totalLinks },
                { label: "대기 중", value: metrics.queuedLinks },
                { label: "소비됨", value: metrics.consumedLinks },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-white rounded-xl border border-[#e7e9ee] px-3 py-3"
                >
                  <p className="text-xs text-[#7c8394]">{item.label}</p>
                  <p className="text-xl font-bold text-[#1f2430] mt-1">{item.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#9aa3b2]">비밀번호를 입력하고 조회를 눌러주세요.</p>
          )}
          <p className="mt-2 text-[11px] text-[#9aa3b2] leading-snug">
            전체 유저 수·링크 수는 DB의 <code className="text-[#5c6570]">COUNT(*)</code> 결과입니다. 오늘 가입은
            한국 자정(KST) 이후 <code className="text-[#5c6570]">joined_at</code> 기준입니다.
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-[#f5c6cb] bg-[#fff5f5] p-4">
          <p className="text-sm font-semibold text-[#9b2c2c]">데이터 전체 삭제 (복구 불가)</p>
          <p className="mt-2 text-xs text-[#7a3b3b] leading-relaxed">
            <code className="text-[#5c1f1f]">users</code> 전원과 세션·링크·맞교·신고·대기열 등 연관 행을 삭제합니다.
            테스트용 대량 가짜 유저를 비울 때 사용하세요. 실서비스 계정이 있으면 함께 사라집니다.{" "}
            <code className="text-[#5c1f1f]">settings</code>, <code className="text-[#5c1f1f]">announcements</code>,{" "}
            <code className="text-[#5c1f1f]">blocked_client_ids</code> 는 그대로 둡니다.
          </p>
          <p className="mt-2 text-xs font-mono text-[#5c1f1f] break-all">
            확인 문구: {PURGE_ALL_USERS_CONFIRM_PHRASE}
          </p>
          <input
            type="text"
            value={purgeConfirm}
            onChange={(e) => setPurgeConfirm(e.target.value)}
            placeholder="위 확인 문구를 그대로 입력"
            disabled={purgeBusy}
            className="mt-2 w-full rounded-lg border border-[#e8b4b8] bg-white px-3 py-2 text-sm text-[#1f2430] placeholder:text-[#b8a0a0] disabled:opacity-50"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            disabled={purgeBusy || busy}
            onClick={() => void purgeAllUsersAndLinks()}
            className="mt-3 w-full rounded-xl bg-[#c53030] px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#9b2c2c] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {purgeBusy ? "삭제 중…" : "모든 유저·연관 데이터 삭제 실행"}
          </button>
        </div>

        <p className="mt-6 text-xs text-[#7c8394]">
          점검 중에도 <code className="text-[#1f2430]">/admin</code> 화면과{" "}
          <code className="text-[#1f2430]">/api/admin</code> 은 막지 않습니다. 화면은 Basic Auth + 아래 비밀번호
          이중으로 보호됩니다.
        </p>
      </div>
    </main>
  );
}
