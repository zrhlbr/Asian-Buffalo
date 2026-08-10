"use client";

/**
 * R1-M7 Admin console — shared client infrastructure:
 * AdminProvider (auth + i18n + tabs + api client), SVG charts, data table,
 * stat cards, badges, danger-confirm modal with reason, pagination, toast.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getAdminDict,
  isAdminLocale,
  type AdminI18nKey,
  type AdminLocale,
} from "../../lib/admin/i18n.ts";

// ---------------------------------------------------------------------------
// Types & context
// ---------------------------------------------------------------------------

export type AdminMe = {
  id: string;
  username: string;
  role: string;
  permissions?: string[];
};

export type TabDef = { key: string; titleKey: AdminI18nKey; props?: Record<string, string> };

type AdminContextValue = {
  t: (key: AdminI18nKey) => string;
  locale: AdminLocale;
  setLocale: (locale: AdminLocale) => void;
  token: string | null;
  me: AdminMe | null;
  can: (permission: string) => boolean;
  api: <T = unknown>(path: string, options?: { method?: string; body?: unknown }) => Promise<T>;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  tabs: TabDef[];
  activeTab: string;
  openTab: (tab: TabDef) => void;
  closeTab: (key: string) => void;
  toast: (message: string, isError?: boolean) => void;
  authReady: boolean;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside AdminProvider");
  return ctx;
}

const TOKEN_KEY = "ab_admin_token";
const LOCALE_KEY = "ab_admin_locale";

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<AdminLocale>("zh");
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<AdminMe | null>(null);
  const [tabs, setTabs] = useState<TabDef[]>([{ key: "dashboard", titleKey: "nav.dashboard" }]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [toastState, setToastState] = useState<{ message: string; isError: boolean } | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const savedLocale = window.localStorage.getItem(LOCALE_KEY);
    if (isAdminLocale(savedLocale)) setLocaleState(savedLocale);
    const savedToken = window.localStorage.getItem(TOKEN_KEY);
    if (savedToken) {
      setToken(savedToken);
      fetch("/api/admin/me", { headers: { authorization: `Bearer ${savedToken}` } })
        .then(async (response) => {
          if (response.ok) {
            const data = (await response.json()) as { admin: AdminMe };
            setMe(data.admin);
          } else {
            window.localStorage.removeItem(TOKEN_KEY);
            setToken(null);
          }
        })
        .catch(() => {
          setToken(null);
        })
        .finally(() => setAuthReady(true));
    } else {
      setAuthReady(true);
    }
  }, []);

  const dict = useMemo(() => getAdminDict(locale), [locale]);
  const t = useCallback((key: AdminI18nKey) => dict[key] ?? key, [dict]);

  const setLocale = useCallback((next: AdminLocale) => {
    setLocaleState(next);
    window.localStorage.setItem(LOCALE_KEY, next);
  }, []);

  const toast = useCallback((message: string, isError = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastState({ message, isError });
    toastTimer.current = setTimeout(() => setToastState(null), 3200);
  }, []);

  const api = useCallback(
    async <T,>(path: string, options?: { method?: string; body?: unknown }): Promise<T> => {
      const response = await fetch(`/api/admin/${path}`, {
        method: options?.method ?? "GET",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: options?.body === undefined ? undefined : JSON.stringify(options.body),
      });
      if (response.status === 401) {
        window.localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setMe(null);
        throw new Error("UNAUTHORIZED");
      }
      const data = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        const code = (data as { error?: { code?: string } } | null)?.error?.code;
        const key = code ? (`error.${code}` as AdminI18nKey) : null;
        const localized = key && dict[key] ? dict[key] : null;
        const message =
          localized ??
          (data as { error?: { message?: string } } | null)?.error?.message ??
          `HTTP ${response.status}`;
        const err = new Error(message);
        (err as Error & { code?: string }).code = code;
        throw err;
      }
      return data as T;
    },
    [token, dict],
  );

  const login = useCallback(async (username: string, password: string) => {
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await response.json().catch(() => null)) as {
        token?: string;
        admin?: AdminMe;
        error?: { code?: string; message?: string };
      } | null;
      if (!response.ok || !data?.token || !data.admin) {
        return { ok: false, error: data?.error?.code ?? "LOGIN_FAILED" };
      }
      window.localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setMe(data.admin);
      return { ok: true };
    } catch {
      return { ok: false, error: "NETWORK" };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("logout", { method: "POST" });
    } catch {
      /* best effort */
    }
    window.localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setMe(null);
    setTabs([{ key: "dashboard", titleKey: "nav.dashboard" }]);
    setActiveTab("dashboard");
  }, [api]);

  const openTab = useCallback((tab: TabDef) => {
    setTabs((current) => (current.some((item) => item.key === tab.key) ? current : [...current, tab]));
    setActiveTab(tab.key);
  }, []);

  const closeTab = useCallback(
    (key: string) => {
      setTabs((current) => {
        if (current.length <= 1) return current;
        const next = current.filter((item) => item.key !== key);
        if (activeTab === key) setActiveTab(next[next.length - 1].key);
        return next;
      });
    },
    [activeTab],
  );

  const can = useCallback(
    (permission: string) => {
      if (!me) return false;
      if (me.role === "SUPER_ADMIN") return true;
      const perms = me.permissions;
      if (!perms) return me.role === "SUPER_ADMIN";
      return perms.includes(permission);
    },
    [me],
  );

  const value: AdminContextValue = {
    t,
    locale,
    setLocale,
    token,
    me,
    can,
    api,
    login,
    logout,
    tabs,
    activeTab,
    openTab,
    closeTab,
    toast,
    authReady,
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
      {toastState ? (
        <div className={`ab-toast${toastState.isError ? " error" : ""}`}>{toastState.message}</div>
      ) : null}
    </AdminContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function fmtMinor(minor: number | null | undefined): string {
  if (minor == null || Number.isNaN(Number(minor))) return "-";
  const major = Number(minor) / 100;
  return major.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtTime(value: string | null | undefined): string {
  if (!value) return "-";
  const iso = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

// ---------------------------------------------------------------------------
// Badges / stat cards
// ---------------------------------------------------------------------------

export function Badge({ tone, children }: { tone: "blue" | "green" | "red" | "amber" | "gray" | "purple"; children: React.ReactNode }) {
  return <span className={`ab-badge ${tone}`}>{children}</span>;
}

export function StatCard({
  label,
  value,
  sub,
  warn,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  warn?: boolean;
  tone?: "ok" | "bad" | "warn";
}) {
  return (
    <div className={`ab-stat${warn || tone === "warn" ? " warn" : ""}`}>
      <div className="ab-stat-label">{label}</div>
      <div className={`ab-stat-value${tone ? ` ${tone}` : ""}`}>{value}</div>
      {sub ? <div className="ab-stat-sub ab-stat-source">{sub}</div> : null}
    </div>
  );
}

export function ReadonlyBanner({ text }: { text: string }) {
  return <div className="ab-readonly-banner">🔒 {text}</div>;
}

// ---------------------------------------------------------------------------
// Data table
// ---------------------------------------------------------------------------

export type ColumnDef<T> = {
  key: string;
  title: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
};

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  sort,
  order,
  onSort,
  onRowClick,
  empty,
}: {
  columns: ColumnDef<T>[];
  rows: T[];
  sort?: string;
  order?: "asc" | "desc";
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
  empty: string;
}) {
  if (rows.length === 0) return <div className="ab-empty">{empty}</div>;
  return (
    <div className="ab-table-wrap">
      <table className="ab-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={column.sortable ? "sortable" : undefined}
                onClick={column.sortable && onSort ? () => onSort(column.key) : undefined}
              >
                {column.title}
                {column.sortable && sort === column.key ? (order === "asc" ? " ▲" : " ▼") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String((row.id as string | undefined) ?? index)} onClick={onRowClick ? () => onRowClick(row) : undefined} style={onRowClick ? { cursor: "pointer" } : undefined}>
              {columns.map((column) => (
                <td key={column.key}>{column.render ? column.render(row) : String(row[column.key] ?? "-")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="ab-pagination">
      <button className="ab-btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ‹
      </button>
      <span>
        {page} / {pages} · {total}
      </span>
      <button className="ab-btn" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        ›
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Danger confirm modal (second confirmation + mandatory reason)
// ---------------------------------------------------------------------------

export function DangerConfirm({
  title,
  description,
  reasonLabel,
  reasonRequired,
  hint,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy,
}: {
  title: string;
  description: string;
  reasonLabel: string;
  reasonRequired: string;
  hint: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);
  return (
    <div className="ab-modal-mask" onClick={onCancel}>
      <div className="ab-modal" onClick={(event) => event.stopPropagation()}>
        <div className="ab-modal-title">⚠ {title}</div>
        <div className="ab-modal-desc">{description}</div>
        <div className="ab-modal-warn">{hint}</div>
        <div className="ab-field">
          <label>{reasonLabel} *</label>
          <textarea
            className="ab-textarea"
            rows={2}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setError(false);
            }}
          />
          {error ? <div style={{ color: "#fca5a5", fontSize: 12, marginTop: 4 }}>{reasonRequired}</div> : null}
        </div>
        <div className="ab-modal-actions">
          <button className="ab-btn" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            className="ab-btn danger"
            disabled={busy}
            onClick={() => {
              if (reason.trim().length < 2) {
                setError(true);
                return;
              }
              onConfirm(reason.trim());
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG charts (dependency-free)
// ---------------------------------------------------------------------------

const CHART_COLORS = ["#3b82f6", "#06b6d4", "#34d399", "#f59e0b", "#a78bfa", "#f87171", "#93c5fd"];

export function LineChart({
  series,
  height = 220,
}: {
  series: { name: string; color?: string; points: { x: string; y: number }[] }[];
  height?: number;
}) {
  const width = 640;
  const pad = { left: 44, right: 12, top: 12, bottom: 28 };
  const all = series.flatMap((s) => s.points.map((p) => p.y));
  const maxY = Math.max(1, ...all);
  const xs = series[0]?.points.map((p) => p.x) ?? [];
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const xAt = (index: number) => pad.left + (xs.length <= 1 ? innerW / 2 : (index / (xs.length - 1)) * innerW);
  const yAt = (value: number) => pad.top + innerH - (value / maxY) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(maxY * ratio));
  const labelEvery = Math.max(1, Math.ceil(xs.length / 8));

  return (
    <div className="ab-chart-box">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={yAt(tick)} y2={yAt(tick)} stroke="#132a4d" strokeWidth={1} />
            <text x={pad.left - 6} y={yAt(tick) + 4} fill="#4c6aa0" fontSize={10} textAnchor="end">
              {tick.toLocaleString()}
            </text>
          </g>
        ))}
        {series.map((s, seriesIndex) => {
          const color = s.color ?? CHART_COLORS[seriesIndex % CHART_COLORS.length];
          const path = s.points.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(p.y)}`).join(" ");
          return (
            <g key={s.name}>
              <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
              {s.points.map((p, i) => (
                <circle key={i} cx={xAt(i)} cy={yAt(p.y)} r={2.2} fill={color} />
              ))}
            </g>
          );
        })}
        {xs.map((x, i) =>
          i % labelEvery === 0 ? (
            <text key={x} x={xAt(i)} y={height - 8} fill="#4c6aa0" fontSize={10} textAnchor="middle">
              {x.slice(11, 16) || x}
            </text>
          ) : null,
        )}
      </svg>
      <div className="ab-chart-legend">
        {series.map((s, i) => (
          <span key={s.name}>
            <i style={{ background: s.color ?? CHART_COLORS[i % CHART_COLORS.length] }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BarChart({
  groups,
  height = 220,
}: {
  groups: { label: string; values: { name: string; value: number; color?: string }[] }[];
  height?: number;
}) {
  const width = 640;
  const pad = { left: 48, right: 12, top: 12, bottom: 28 };
  const maxY = Math.max(1, ...groups.flatMap((g) => g.values.map((v) => v.value)));
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const groupW = groups.length > 0 ? innerW / groups.length : innerW;
  const seriesNames = groups[0]?.values.map((v) => v.name) ?? [];
  const labelEvery = Math.max(1, Math.ceil(groups.length / 10));

  return (
    <div className="ab-chart-box">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img">
        {[0, 0.5, 1].map((ratio) => (
          <g key={ratio}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={pad.top + innerH - ratio * innerH}
              y2={pad.top + innerH - ratio * innerH}
              stroke="#132a4d"
            />
            <text x={pad.left - 6} y={pad.top + innerH - ratio * innerH + 4} fill="#4c6aa0" fontSize={10} textAnchor="end">
              {Math.round(maxY * ratio).toLocaleString()}
            </text>
          </g>
        ))}
        {groups.map((group, gi) => {
          const barW = Math.min(18, (groupW * 0.7) / Math.max(1, group.values.length));
          const startX = pad.left + gi * groupW + (groupW - barW * group.values.length) / 2;
          return (
            <g key={group.label}>
              {group.values.map((v, vi) => {
                const h = (v.value / maxY) * innerH;
                return (
                  <rect
                    key={v.name}
                    x={startX + vi * barW}
                    y={pad.top + innerH - h}
                    width={barW - 2}
                    height={h}
                    rx={2}
                    fill={v.color ?? CHART_COLORS[vi % CHART_COLORS.length]}
                  />
                );
              })}
              {gi % labelEvery === 0 ? (
                <text x={pad.left + gi * groupW + groupW / 2} y={height - 8} fill="#4c6aa0" fontSize={10} textAnchor="middle">
                  {group.label.slice(11, 16) || group.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="ab-chart-legend">
        {seriesNames.map((name, i) => (
          <span key={name}>
            <i style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function PieChart({
  data,
  size = 180,
}: {
  data: { name: string; value: number; color?: string }[];
  size?: number;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = size / 2;
  let angle = -Math.PI / 2;
  const arcs = data.map((item, index) => {
    const fraction = total > 0 ? item.value / total : 0;
    const start = angle;
    angle += fraction * Math.PI * 2;
    const end = angle;
    const large = fraction > 0.5 ? 1 : 0;
    const x1 = radius + radius * Math.cos(start);
    const y1 = radius + radius * Math.sin(start);
    const x2 = radius + radius * Math.cos(end);
    const y2 = radius + radius * Math.sin(end);
    const path =
      fraction >= 0.9999
        ? `M ${radius} 0 A ${radius} ${radius} 0 1 1 ${radius - 0.01} 0 L ${radius} ${radius} Z`
        : `M ${radius} ${radius} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`;
    return { path, color: item.color ?? CHART_COLORS[index % CHART_COLORS.length], name: item.name, value: item.value };
  });
  if (total === 0) {
    return (
      <div className="ab-chart-box" style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <svg width={size} height={size}>
          <circle cx={radius} cy={radius} r={radius - 2} fill="none" stroke="#132a4d" strokeWidth={2} />
        </svg>
      </div>
    );
  }
  return (
    <div className="ab-chart-box" style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
      <svg width={size} height={size}>
        {arcs.map((arc) => (
          <path key={arc.name} d={arc.path} fill={arc.color} opacity={0.9} />
        ))}
      </svg>
      <div className="ab-chart-legend" style={{ flexDirection: "column", gap: 6 }}>
        {arcs.map((arc) => (
          <span key={arc.name}>
            <i style={{ background: arc.color }} />
            {arc.name} · {arc.value}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Loading({ text }: { text: string }) {
  return <div className="ab-loading">{text}</div>;
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="ab-error-box">{message}</div>;
}
