"use client";

/**
 * R1-M9 Admin console — application shell: login gate, sidebar navigation,
 * top bar (language switch / admin chip / logout), multi-tab strip and the
 * module switchboard. Phase A preserved; Phase B–F modules added additively.
 */

import React, { useState } from "react";
import { AdminProvider, useAdmin } from "./admin-ui.tsx";
import type { AdminI18nKey } from "../../lib/admin/i18n.ts";
import { ADMIN_LOCALES } from "../../lib/admin/i18n.ts";
import DashboardModule from "./modules/dashboard.tsx";
import PlayersModule from "./modules/players.tsx";
import SessionsModule from "./modules/sessions.tsx";
import RoundsModule from "./modules/rounds.tsx";
import SpinsModule from "./modules/spins.tsx";
import WalletModule from "./modules/wallet.tsx";
import LedgerModule from "./modules/ledger.tsx";
import MathModule from "./modules/math.tsx";
import RiskModule from "./modules/risk.tsx";
import ReportsModule from "./modules/reports.tsx";
import SystemModule from "./modules/system.tsx";
import AdminsModule from "./modules/admins.tsx";
import VipModule from "./modules/vip.tsx";
import DepositsModule from "./modules/deposits.tsx";
import WithdrawalsModule from "./modules/withdrawals.tsx";
import ActivitiesModule from "./modules/activities.tsx";
import GamesModule from "./modules/games.tsx";
import GameOpsModule from "./modules/game-ops.tsx";
import AnnouncementsModule from "./modules/announcements.tsx";
import ContentModule from "./modules/content.tsx";
import RankingsModule from "./modules/rankings.tsx";
import SupportModule from "./modules/support.tsx";
import TicketsModule from "./modules/tickets.tsx";
import SecurityModule from "./modules/security.tsx";
import AuditModule from "./modules/audit.tsx";

type NavItem = {
  key: string;
  titleKey: AdminI18nKey;
  icon: string;
  permission?: string;
};

const NAV: { group: AdminI18nKey; items: NavItem[] }[] = [
  {
    group: "nav.group.operations",
    items: [
      { key: "dashboard", titleKey: "nav.dashboard", icon: "◆", permission: "dashboard:view" },
      { key: "players", titleKey: "nav.players", icon: "👤", permission: "players:view" },
      { key: "vip", titleKey: "nav.vip", icon: "♛", permission: "vip:view" },
      { key: "activities", titleKey: "nav.activities", icon: "🎁", permission: "activity:view" },
      { key: "sessions", titleKey: "nav.sessions", icon: "◎", permission: "rounds:view" },
      { key: "rounds", titleKey: "nav.rounds", icon: "🎰", permission: "rounds:view" },
      { key: "spins", titleKey: "nav.spins", icon: "↻", permission: "rounds:view" },
      { key: "games", titleKey: "nav.games", icon: "🎮", permission: "rounds:view" },
      { key: "gameOps", titleKey: "nav.gameOps", icon: "🐃", permission: "rounds:view" },
      { key: "risk", titleKey: "nav.risk", icon: "🛡", permission: "risk:view" },
      { key: "reports", titleKey: "nav.reports", icon: "▤", permission: "dashboard:view" },
      { key: "rankings", titleKey: "nav.rankings", icon: "🏆", permission: "dashboard:view" },
    ],
  },
  {
    group: "nav.group.finance",
    items: [
      { key: "wallet", titleKey: "nav.wallet", icon: "💼", permission: "wallet:view" },
      { key: "deposits", titleKey: "nav.deposits", icon: "↓", permission: "deposit:view" },
      { key: "withdrawals", titleKey: "nav.withdrawals", icon: "↑", permission: "withdraw:view" },
      { key: "ledger", titleKey: "nav.ledger", icon: "📒", permission: "ledger:view" },
    ],
  },
  {
    group: "nav.group.platform",
    items: [
      { key: "math", titleKey: "nav.math", icon: "∑", permission: "math:view" },
      { key: "content", titleKey: "nav.content", icon: "📰", permission: "content:view" },
      { key: "announcements", titleKey: "nav.announcements", icon: "📢", permission: "content:view" },
      { key: "tickets", titleKey: "nav.tickets", icon: "🎫", permission: "support:view" },
      { key: "support", titleKey: "nav.support", icon: "☎", permission: "system:view" },
      { key: "system", titleKey: "nav.system", icon: "⚙", permission: "system:view" },
      { key: "security", titleKey: "nav.security", icon: "🔐", permission: "security:view" },
      { key: "audit", titleKey: "nav.audit", icon: "📋", permission: "logs:view" },
      { key: "admins", titleKey: "nav.admins", icon: "🗝", permission: "admins:view" },
    ],
  },
];

function LoginScreen() {
  const { t, login } = useAdmin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await login(username.trim(), password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error === "ACCOUNT_DISABLED" ? t("login.accountDisabled") : t("login.failed"));
    }
  };

  return (
    <div className="ab-login-wrap">
      <div className="ab-login-card">
        <div className="ab-login-logo">🐃</div>
        <div className="ab-login-title">{t("login.title")}</div>
        <div className="ab-login-sub">{t("login.subtitle")}</div>
        {error ? <div className="ab-login-error">{error}</div> : null}
        <div className="ab-field">
          <label>{t("login.username")}</label>
          <input
            className="ab-input"
            value={username}
            autoComplete="username"
            onChange={(event) => setUsername(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && submit()}
          />
        </div>
        <div className="ab-field">
          <label>{t("login.password")}</label>
          <input
            className="ab-input"
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && submit()}
          />
        </div>
        <button
          className="ab-btn primary"
          style={{ width: "100%", justifyContent: "center", marginTop: 6 }}
          disabled={busy || !username || !password}
          onClick={submit}
        >
          {t("login.submit")}
        </button>
      </div>
    </div>
  );
}

const MODULE_TITLES: Record<string, AdminI18nKey> = {
  dashboard: "nav.dashboard",
  players: "nav.players",
  vip: "nav.vip",
  activities: "nav.activities",
  sessions: "nav.sessions",
  rounds: "nav.rounds",
  spins: "nav.spins",
  games: "nav.games",
  gameOps: "nav.gameOps",
  wallet: "nav.wallet",
  deposits: "nav.deposits",
  withdrawals: "nav.withdrawals",
  ledger: "nav.ledger",
  math: "nav.math",
  risk: "nav.risk",
  reports: "nav.reports",
  rankings: "nav.rankings",
  content: "nav.content",
  announcements: "nav.announcements",
  tickets: "nav.tickets",
  support: "nav.support",
  system: "nav.system",
  security: "nav.security",
  audit: "nav.audit",
  admins: "nav.admins",
};

function ModuleView({
  tabKey,
  initialProps,
}: {
  tabKey: string;
  initialProps?: Record<string, string>;
}) {
  const module = tabKey.split(":")[0];
  switch (module) {
    case "dashboard":
      return <DashboardModule />;
    case "players":
      return <PlayersModule initialProps={initialProps} />;
    case "vip":
      return <VipModule />;
    case "activities":
      return <ActivitiesModule />;
    case "sessions":
      return <SessionsModule initialProps={initialProps} />;
    case "rounds":
      return <RoundsModule initialProps={initialProps} />;
    case "spins":
      return <SpinsModule initialProps={initialProps} />;
    case "games":
      return <GamesModule />;
    case "gameOps":
      return <GameOpsModule initialProps={initialProps} />;
    case "wallet":
      return <WalletModule initialProps={initialProps} />;
    case "deposits":
      return <DepositsModule />;
    case "withdrawals":
      return <WithdrawalsModule />;
    case "ledger":
      return <LedgerModule initialProps={initialProps} />;
    case "math":
      return <MathModule />;
    case "risk":
      return <RiskModule initialProps={initialProps} />;
    case "reports":
      return <ReportsModule />;
    case "rankings":
      return <RankingsModule />;
    case "content":
      return <ContentModule />;
    case "announcements":
      return <AnnouncementsModule />;
    case "tickets":
      return <TicketsModule />;
    case "support":
      return <SupportModule />;
    case "system":
      return <SystemModule />;
    case "security":
      return <SecurityModule />;
    case "audit":
      return <AuditModule />;
    case "admins":
      return <AdminsModule />;
    default:
      return <DashboardModule />;
  }
}

function Shell() {
  const { t, me, token, authReady, locale, setLocale, logout, tabs, activeTab, openTab, closeTab, can } =
    useAdmin();

  if (!authReady) return <div className="ab-loading">{t("common.loading")}</div>;
  if (!token || !me) return <LoginScreen />;

  const activeTabDef = tabs.find((tab) => tab.key === activeTab);

  return (
    <div className="ab-shell">
      <aside className="ab-sidebar">
        <div className="ab-brand">
          <div className="ab-brand-title">🐃 {t("common.appName")}</div>
          <div className="ab-brand-sub">XI GAME ADMIN</div>
        </div>
        <nav className="ab-nav">
          {NAV.map((group) => {
            const visible = group.items.filter((item) => !item.permission || can(item.permission));
            if (visible.length === 0) return null;
            return (
              <div key={group.group}>
                <div className="ab-nav-group">{t(group.group)}</div>
                {visible.map((item) => (
                  <button
                    key={item.key}
                    className={`ab-nav-item${activeTab === item.key ? " active" : ""}`}
                    onClick={() => openTab({ key: item.key, titleKey: item.titleKey })}
                  >
                    <span className="ab-nav-icon" aria-hidden>
                      {item.icon}
                    </span>
                    <span>{t(item.titleKey)}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="ab-main">
        <header className="ab-topbar">
          <div className="ab-topbar-title">
            {t(MODULE_TITLES[activeTab.split(":")[0]] ?? "nav.dashboard")}
          </div>
          <div className="ab-money-gate-chip" title="PRODUCTION MONEY GATE CLOSED">
            <span>{t("money.realProvider" as never)}: {t("money.notConfigured" as never)}</span>
            <span>{t("money.productionMoney" as never)}: {t("money.gateClosed" as never)}</span>
          </div>
          <div className="ab-chip">
            🗝 <b>{me.username}</b> · {me.role}
          </div>
          <div className="ab-lang">
            {ADMIN_LOCALES.map((item) => (
              <button
                key={item}
                className={locale === item ? "active" : undefined}
                onClick={() => setLocale(item)}
              >
                {item === "zh" ? "中文" : item === "en" ? "EN" : "မြန်မာ"}
              </button>
            ))}
          </div>
          <button className="ab-btn" onClick={logout}>
            {t("common.logout")}
          </button>
        </header>

        <div className="ab-tabs">
          {tabs.map((tab) => (
            <div
              key={tab.key}
              className={`ab-tab${activeTab === tab.key ? " active" : ""}`}
              onClick={() => openTab(tab)}
            >
              {t(tab.titleKey)}
              {tabs.length > 1 ? (
                <button
                  className="ab-tab-close"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeTab(tab.key);
                  }}
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
        </div>

        <main className="ab-content">
          {tabs.map((tab) =>
            tab.key === activeTab ? (
              <div key={tab.key}>
                <ModuleView tabKey={tab.key} initialProps={activeTabDef?.props ?? tab.props} />
              </div>
            ) : null,
          )}
        </main>
      </div>
    </div>
  );
}

export default function AdminApp() {
  return (
    <AdminProvider>
      <Shell />
    </AdminProvider>
  );
}
