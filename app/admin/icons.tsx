"use client";

/**
 * R1-M7 — Unified SVG icon set.
 *
 * Single-stroke, 24×24 viewBox, consistent 1.6 stroke width, round caps.
 * Emoji are forbidden as formal icons in the M7 standard; every navigation,
 * stat card, status and action icon comes from this set.
 */

import React from "react";

export type IconName =
  | "dashboard"
  | "players"
  | "rounds"
  | "wallet"
  | "ledger"
  | "math"
  | "risk"
  | "system"
  | "admins"
  | "online"
  | "active"
  | "userPlus"
  | "spin"
  | "bet"
  | "payout"
  | "profit"
  | "rtp"
  | "freeSpin"
  | "anomaly"
  | "health"
  | "api"
  | "refresh"
  | "search"
  | "filter"
  | "logout"
  | "lock"
  | "unlock"
  | "eye"
  | "close"
  | "chevronLeft"
  | "chevronRight"
  | "warning"
  | "check"
  | "info"
  | "coin"
  | "arrowUp"
  | "arrowDown"
  | "menu"
  | "language"
  | "shield"
  | "clock"
  | "document"
  | "freeze"
  | "key"
  | "announcement"
  | "config"
  | "log"
  | "empty";

const PATHS: Record<IconName, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="9" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="5.5" rx="1.5" />
      <rect x="13.5" y="12" width="7.5" height="9" rx="1.5" />
      <rect x="3" y="15.5" width="7.5" height="5.5" rx="1.5" />
    </>
  ),
  players: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.8 20c.8-3.6 3.6-5.4 7.2-5.4s6.4 1.8 7.2 5.4" />
    </>
  ),
  rounds: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M3 9h18" />
      <circle cx="8" cy="14" r="1.4" />
      <circle cx="12" cy="14" r="1.4" />
      <circle cx="16" cy="14" r="1.4" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" />
      <path d="M15 12.5h5v3h-5a1.5 1.5 0 0 1 0-3z" />
      <path d="M4 7.5V6a2 2 0 0 1 2-2h9" />
    </>
  ),
  ledger: (
    <>
      <path d="M6 3.5h9.5A2.5 2.5 0 0 1 18 6v14.5H8.5A2.5 2.5 0 0 1 6 18z" />
      <path d="M6 18V6a2.5 2.5 0 0 1 2.5-2.5H18" />
      <path d="M9.5 8.5h5M9.5 12h5M9.5 15.5h3" />
    </>
  ),
  math: (
    <>
      <path d="M18 5H7l6 7-6 7h11" />
      <path d="M6 5h2M6 19h2" />
    </>
  ),
  risk: (
    <>
      <path d="M12 3l7.5 3v5.5c0 4.5-3 8-7.5 9.5-4.5-1.5-7.5-5-7.5-9.5V6z" />
      <path d="M12 8v4.5" />
      <circle cx="12" cy="15.8" r="0.4" fill="currentColor" />
    </>
  ),
  system: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.4M12 18.8v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" />
    </>
  ),
  admins: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c.7-3.1 3-4.7 5.5-4.7 1.5 0 2.9.5 3.9 1.4" />
      <path d="M15.5 12.5l4.5 4.5M20 12.5l-4.5 4.5" transform="translate(-1.5 -1)" />
      <circle cx="16.5" cy="15" r="4" />
    </>
  ),
  online: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </>
  ),
  active: (
    <>
      <path d="M3 12h4l2.5-6 4 12 2.5-6h5" />
    </>
  ),
  userPlus: (
    <>
      <circle cx="10" cy="8" r="3.4" />
      <path d="M4 20c.7-3.3 3.1-5 6-5 1.6 0 3 .5 4.1 1.4" />
      <path d="M17.5 8v5M15 10.5h5" />
    </>
  ),
  spin: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 3.5V8h-4.5" />
    </>
  ),
  bet: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v9M9.2 9.8c0-1.2 1.2-2 2.8-2s2.8.8 2.8 2c0 2.8-5.6 1.6-5.6 4.4 0 1.2 1.2 2 2.8 2s2.8-.8 2.8-2" />
    </>
  ),
  payout: (
    <>
      <path d="M12 3.5v13M12 16.5l-4.5-4.5M12 16.5l4.5-4.5" />
      <path d="M4.5 20.5h15" />
    </>
  ),
  profit: (
    <>
      <path d="M3.5 17l5-5 3.5 3.5 8.5-8.5" />
      <path d="M15.5 7h5v5" />
    </>
  ),
  rtp: (
    <>
      <path d="M19 5L5 19" />
      <circle cx="7.5" cy="7.5" r="2.5" />
      <circle cx="16.5" cy="16.5" r="2.5" />
    </>
  ),
  freeSpin: (
    <>
      <path d="M12 3.5l2.2 5 5.3.5-4 3.6 1.2 5.2-4.7-2.8-4.7 2.8 1.2-5.2-4-3.6 5.3-.5z" />
    </>
  ),
  anomaly: (
    <>
      <path d="M12 3.5L22 20H2z" />
      <path d="M12 9.5v4.5" />
      <circle cx="12" cy="16.8" r="0.5" fill="currentColor" stroke="none" />
    </>
  ),
  health: (
    <>
      <path d="M12 20.5S4 15.5 4 9.8C4 6.7 6.3 4.5 9 4.5c1.3 0 2.4.6 3 1.5.6-.9 1.7-1.5 3-1.5 2.7 0 5 2.2 5 5.3 0 5.7-8 10.7-8 10.7z" />
    </>
  ),
  api: (
    <>
      <path d="M8 9l-3.5 3L8 15M16 9l3.5 3L16 15" />
      <path d="M13.5 6l-3 12" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 3.5V8h-4.5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L21 21" />
    </>
  ),
  filter: (
    <>
      <path d="M4 5h16l-6.2 7.2v5.6L10.2 20v-7.8z" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H14" />
      <path d="M10 12h10.5M17 8.5l3.5 3.5-3.5 3.5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
      <circle cx="12" cy="15.2" r="1.2" />
    </>
  ),
  unlock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8 10.5V7.8a4 4 0 0 1 7.8-1.2" />
      <circle cx="12" cy="15.2" r="1.2" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  chevronLeft: <path d="M14.5 5.5L8 12l6.5 6.5" />,
  chevronRight: <path d="M9.5 5.5L16 12l-6.5 6.5" />,
  warning: (
    <>
      <path d="M12 3.5L22 20H2z" />
      <path d="M12 9.5v4.5" />
      <circle cx="12" cy="16.8" r="0.5" fill="currentColor" stroke="none" />
    </>
  ),
  check: <path d="M4.5 12.5l5 5L19.5 7" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.8" r="0.5" fill="currentColor" stroke="none" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
    </>
  ),
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  menu: <path d="M4 6.5h16M4 12h16M4 17.5h16" />,
  language: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.2 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.2-3.6-8.5s1.2-6.2 3.6-8.5z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7.5 3v5.5c0 4.5-3 8-7.5 9.5-4.5-1.5-7.5-5-7.5-9.5V6z" />
      <path d="M8.8 12l2.2 2.2 4.2-4.4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.4 2" />
    </>
  ),
  document: (
    <>
      <path d="M6.5 3.5h7L18 8v12.5h-11.5z" />
      <path d="M13 3.5V8.5H18" />
      <path d="M9.5 12h5M9.5 15.5h5" />
    </>
  ),
  freeze: (
    <>
      <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" />
      <path d="M12 3l-2 2M12 3l2 2M12 21l-2-2M12 21l2-2" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="14.5" r="4.5" />
      <path d="M11.5 11L20 3.5M16.5 6.5l2.5 2.5M13.8 9.2l2 2" />
    </>
  ),
  announcement: (
    <>
      <path d="M4 10v4a1.5 1.5 0 0 0 1.5 1.5H8l7 4.5v-16L8 8.5H5.5A1.5 1.5 0 0 0 4 10z" />
      <path d="M18 9.5a3.5 3.5 0 0 1 0 5" />
    </>
  ),
  config: (
    <>
      <path d="M4 7.5h8.5M17.5 7.5H20M4 16.5h3.5M12.5 16.5H20" />
      <circle cx="15" cy="7.5" r="2.2" />
      <circle cx="10" cy="16.5" r="2.2" />
    </>
  ),
  log: (
    <>
      <path d="M6 3.5h9.5A2.5 2.5 0 0 1 18 6v14.5H8.5A2.5 2.5 0 0 1 6 18z" />
      <path d="M9.5 8h5M9.5 11.5h5M9.5 15h3.5" />
    </>
  ),
  empty: (
    <>
      <path d="M4 8.5l2.5-4h11l2.5 4v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M4 8.5h16M9.5 12.5h5" />
    </>
  ),
};

export function Icon({
  name,
  size = 16,
  strokeWidth = 1.6,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
