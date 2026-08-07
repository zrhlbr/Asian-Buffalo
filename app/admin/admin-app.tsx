"use client";

/**
<<<<<<< Updated upstream
 * R1-M7 Admin console — application shell: login gate, sidebar navigation,
 * top bar (language switch / admin chip / logout), multi-tab strip and the
 * module switchboard.
=======
 * R1-M9 Admin console — application shell: login gate, sidebar navigation,
 * top bar (language switch / admin chip / logout), multi-tab strip and the
 * module switchboard. Phase A preserved; Phase B–F modules added additively.
>>>>>>> Stashed changes
 */

import React, { useState } from "react";
import { AdminProvider, useAdmin } from "./admin-ui.tsx";
import type { AdminI18nKey } from "../../lib/admin/i18n.ts";
import { ADMIN_LOCALES } from "../../lib/admin/i18n.ts";
import DashboardModule from "./modules/dashboard.tsx";
import PlayersModule from "./modules/players.tsx";
<<<<<<< Updated upstream
import RoundsModule from "./modules/rounds.tsx";
=======
import SessionsModule from "./modules/sessions.tsx";
import RoundsModule from "./modules/rounds.tsx";
import SpinsModule from "./modules/spins.tsx";
>>>>>>> Stashed changes
import WalletModule from "./modules/wallet.tsx";
import LedgerModule from "./modules/ledger.tsx";
import MathModule from "./modules/math.tsx";
import RiskModule from "./modules/risk.tsx";
<<<<<<< Updated upstream
=======
import ReportsModule from "./modules/reports.tsx";
>>>>>>> Stashed changes
import SystemModule from "./modules/system.tsx";
import AdminsModule from "./modules/admins.tsx";

const NAV: { group: AdminI18nKey; items: { key: string; titleKey: AdminI18nKey; icon: string }[] }[] = [
  {
    group: "nav.group.operations",
    items: [
      { key: "dashboard", titleKey: "nav.dashboard", icon: "◆" },
      { key: "players", titleKey: "nav.players", icon: "👤" },
<<<<<<< Updated upstream
      { key: "rounds", titleKey: "nav.rounds", icon: "🎰" },
      { key: "risk", titleKey: "nav.risk", icon: "🛡" },
=======
      { key: "sessions", titleKey: "nav.sessions", icon: "◎" },
      { key: "rounds", titleKey: "nav.rounds", icon: "🎰" },
      { key: "spins", titleKey: "nav.spins", icon: "↻" },
      { key: "risk", titleKey: "nav.risk", icon: "🛡" },
      { key: "reports", titleKey: "nav.reports", icon: "▤" },
>>>>>>> Stashed changes
    ],
  },
  {
    group: "nav.group.finance",
    items: [
      { key: "wallet", titleKey: "nav.wallet", icon: "💼" },
      { key: "ledger", titleKey: "nav.ledger", icon: "📒" },
    ],
  },
  {
    group: "nav.group.platform",
    items: [
      { key: "math", titleKey: "nav.math", icon: "∑" },
      { key: "system", titleKey: "nav.system", icon: "⚙" },
      { key: "admins", titleKey: "nav.admins", icon: "🗝" },
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
<<<<<<< Updated upstream
  rounds: "nav.rounds",
=======
  sessions: "nav.sessions",
  rounds: "nav.rounds",
  spins: "nav.spins",
>>>>>>> Stashed changes
  wallet: "nav.wallet",
  ledger: "nav.ledger",
  math: "nav.math",
  risk: "nav.risk",
<<<<<<< Updated upstream
=======
  reports: "nav.reports",
>>>>>>> Stashed changes
  system: "nav.system",
  admins: "nav.admins",
};

function ModuleView({ tabKey }: { tabKey: string }) {
  const module = tabKey.split(":")[0];
  switch (module) {
    case "dashboard":
      return <DashboardModule />;
    case "players":
      return <PlayersModule />;
<<<<<<< Updated upstream
    case "rounds":
      return <RoundsModule />;
=======
    case "sessions":
      return <SessionsModule />;
    case "rounds":
      return <RoundsModule />;
    case "spins":
      return <SpinsModule />;
>>>>>>> Stashed changes
    case "wallet":
      return <WalletModule />;
    case "ledger":
      return <LedgerModule />;
    case "math":
      return <MathModule />;
    case "risk":
      return <RiskModule />;
<<<<<<< Updated upstream
=======
    case "reports":
      return <ReportsModule />;
>>>>>>> Stashed changes
    case "system":
      return <SystemModule />;
    case "admins":
      return <AdminsModule />;
    default:
      return <DashboardModule />;
  }
}

function Shell() {
  const { t, me, token, authReady, locale, setLocale, logout, tabs, activeTab, openTab, closeTab } = useAdmin();

  if (!authReady) return <div className="ab-loading">{t("common.loading")}</div>;
  if (!token || !me) return <LoginScreen />;

  return (
    <div className="ab-shell">
      <aside className="ab-sidebar">
        <div className="ab-brand">
          <div className="ab-brand-title">🐃 Asian Buffalo</div>
<<<<<<< Updated upstream
          <div className="ab-brand-sub">R1-M7 ADMIN CONSOLE</div>
=======
          <div className="ab-brand-sub">R1-M9 ADMIN CONSOLE</div>
>>>>>>> Stashed changes
        </div>
        <nav className="ab-nav">
          {NAV.map((group) => (
            <div key={group.group}>
              <div className="ab-nav-group">{t(group.group)}</div>
              {group.items.map((item) => (
                <button
                  key={item.key}
                  className={`ab-nav-item${activeTab === item.key ? " active" : ""}`}
                  onClick={() => openTab({ key: item.key, titleKey: item.titleKey })}
                >
                  <span className="ab-nav-icon" aria-hidden>{item.icon}</span>
                  <span>{t(item.titleKey)}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="ab-main">
        <header className="ab-topbar">
          <div className="ab-topbar-title">{t(MODULE_TITLES[activeTab.split(":")[0]] ?? "nav.dashboard")}</div>
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
            <div key={tab.key} className={`ab-tab${activeTab === tab.key ? " active" : ""}`} onClick={() => openTab(tab)}>
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
                <ModuleView tabKey={tab.key} />
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
