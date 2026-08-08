"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  authForgotReset,
  authForgotStart,
  authForgotVerify,
  authLogin,
  authRegisterComplete,
  authRegisterStart,
  authRegisterVerify,
  type AuthChannel,
  type AuthProfileSnap,
  type AuthWalletSnap,
} from "./auth-api.ts";
import { applyAuthSnapshot, clearLobbyCaches } from "./api.ts";
import {
  getLobbyLangServerSnapshot,
  loadLobbyLang,
  subscribeLobbyLang,
  tLobby,
  type LobbyLang,
} from "./i18n.ts";
import { navigateXi, XI_ROUTES } from "./nav.ts";
import "./lobby.css";
import "./theme-red-gold.css";

export type AuthMode = "login" | "register" | "forgot";

type Props = { mode: AuthMode };

function mapError(lang: LobbyLang, code: string): string {
  const key = `auth.error.${code}`;
  const translated = tLobby(lang, key);
  if (translated !== key) return translated;
  return tLobby(lang, "auth.error.generic");
}

function finishAuth(
  profile: AuthProfileSnap,
  wallet: AuthWalletSnap,
): void {
  applyAuthSnapshot(profile, wallet);
  navigateXi({ href: XI_ROUTES.lobby, from: "lobby", to: "lobby", replace: true });
}

export default function AuthApp({ mode }: Props) {
  const lang = useSyncExternalStore(
    subscribeLobbyLang,
    loadLobbyLang,
    getLobbyLangServerSnapshot,
  );
  const t = (key: string) => tLobby(lang, key);

  const [channel, setChannel] = useState<AuthChannel>("sms");
  const [destination, setDestination] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [nickname, setNickname] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    const titleKey =
      mode === "login"
        ? "auth.title.login"
        : mode === "register"
          ? "auth.title.register"
          : "auth.title.forgot";
    document.title = `${t(titleKey)} · ${t("auth.brand")}`;
  }, [lang, mode]);

  const resetFlow = () => {
    setChallengeId(null);
    setOtp("");
    setPassword("");
    setPassword2("");
    setStep(1);
    setError(null);
    setInfo(null);
  };

  const onChannel = (c: AuthChannel) => {
    setChannel(c);
    resetFlow();
  };

  const sendOtp = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    const start =
      mode === "register"
        ? await authRegisterStart(channel, destination)
        : await authForgotStart(channel, destination);
    setBusy(false);
    if (!start.ok) {
      setError(mapError(lang, start.error.code));
      return;
    }
    setChallengeId(start.data.challengeId);
    setTestMode(!!start.data.testMode);
    setStep(2);
    if (start.data.testMode) setInfo(t("auth.hint.otpTest"));
  };

  const verifyOtp = async () => {
    if (!challengeId) return;
    setBusy(true);
    setError(null);
    const verified =
      mode === "register"
        ? await authRegisterVerify(challengeId, otp)
        : await authForgotVerify(challengeId, otp);
    setBusy(false);
    if (!verified.ok) {
      setError(mapError(lang, verified.error.code));
      return;
    }
    setStep(3);
  };

  const submitRegister = async () => {
    if (!challengeId) return;
    if (password !== password2) {
      setError(t("auth.error.PASSWORD_MISMATCH"));
      return;
    }
    setBusy(true);
    setError(null);
    const result = await authRegisterComplete({
      challengeId,
      code: otp,
      password,
      nickname: nickname.trim() || undefined,
      lang,
    });
    setBusy(false);
    if (!result.ok) {
      setError(mapError(lang, result.error.code));
      return;
    }
    setInfo(t("auth.success.register"));
    finishAuth(result.data.profile, result.data.wallet);
  };

  const submitReset = async () => {
    if (!challengeId) return;
    if (password !== password2) {
      setError(t("auth.error.PASSWORD_MISMATCH"));
      return;
    }
    setBusy(true);
    setError(null);
    const result = await authForgotReset(challengeId, otp, password);
    setBusy(false);
    if (!result.ok) {
      setError(mapError(lang, result.error.code));
      return;
    }
    clearLobbyCaches();
    setInfo(t("auth.success.reset"));
    window.setTimeout(() => {
      navigateXi({ href: "/xi/login", from: "lobby", to: "lobby", replace: true });
    }, 600);
  };

  const submitLogin = async () => {
    setBusy(true);
    setError(null);
    const result = await authLogin(channel, destination, password);
    setBusy(false);
    if (!result.ok) {
      setError(mapError(lang, result.error.code));
      return;
    }
    setInfo(t("auth.success.login"));
    finishAuth(result.data.profile, result.data.wallet);
  };

  const title =
    mode === "login"
      ? t("auth.title.login")
      : mode === "register"
        ? t("auth.title.register")
        : t("auth.title.forgot");

  return (
    <div className="xi-lobby-root xi-auth-root" data-lang={lang} data-testid="xi-auth-root">
      <div className="xi-auth-shell">
        <header className="xi-auth-header">
          <button
            type="button"
            className="xi-auth-back"
            onClick={() =>
              navigateXi({ href: XI_ROUTES.lobby, from: "lobby", to: "lobby", replace: true })
            }
          >
            ←
          </button>
          <div className="xi-auth-brand">{t("auth.brand")}</div>
        </header>

        <h1 className="xi-auth-title">{title}</h1>

        <div className="xi-auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            className={channel === "sms" ? "is-active" : ""}
            aria-selected={channel === "sms"}
            onClick={() => onChannel("sms")}
          >
            {t("auth.tab.phone")}
          </button>
          <button
            type="button"
            role="tab"
            className={channel === "email" ? "is-active" : ""}
            aria-selected={channel === "email"}
            onClick={() => onChannel("email")}
          >
            {t("auth.tab.email")}
          </button>
        </div>

        {mode !== "login" && (
          <ol className="xi-auth-steps" aria-hidden="true">
            <li className={step >= 1 ? "is-on" : ""}>{t("auth.step.destination")}</li>
            <li className={step >= 2 ? "is-on" : ""}>{t("auth.step.otp")}</li>
            <li className={step >= 3 ? "is-on" : ""}>{t("auth.step.password")}</li>
          </ol>
        )}

        <form
          className="xi-auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "login") void submitLogin();
            else if (step === 1) void sendOtp();
            else if (step === 2) void verifyOtp();
            else if (mode === "register") void submitRegister();
            else void submitReset();
          }}
        >
          {(mode === "login" || step === 1) && (
            <>
              <label className="xi-auth-label">
                {channel === "sms" ? t("auth.phone") : t("auth.email")}
                <input
                  className="xi-auth-input"
                  type={channel === "sms" ? "tel" : "email"}
                  autoComplete={channel === "sms" ? "tel" : "email"}
                  placeholder={channel === "sms" ? "+959…" : "name@example.com"}
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  required
                />
              </label>
              {channel === "sms" && <p className="xi-auth-hint">{t("auth.hint.phone")}</p>}
            </>
          )}

          {mode === "login" && (
            <label className="xi-auth-label">
              {t("auth.password")}
              <input
                className="xi-auth-input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </label>
          )}

          {mode !== "login" && step >= 2 && (
            <label className="xi-auth-label">
              {t("auth.otp")}
              <input
                className="xi-auth-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                maxLength={8}
              />
            </label>
          )}

          {mode !== "login" && step >= 3 && (
            <>
              {mode === "register" && (
                <label className="xi-auth-label">
                  {t("auth.nickname")}
                  <input
                    className="xi-auth-input"
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    maxLength={24}
                  />
                </label>
              )}
              <label className="xi-auth-label">
                {mode === "forgot" ? t("auth.passwordNew") : t("auth.password")}
                <input
                  className="xi-auth-input"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </label>
              <label className="xi-auth-label">
                {t("auth.passwordConfirm")}
                <input
                  className="xi-auth-input"
                  type="password"
                  autoComplete="new-password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  required
                  minLength={8}
                />
              </label>
              <p className="xi-auth-hint">{t("auth.hint.password")}</p>
            </>
          )}

          {error && (
            <p className="xi-auth-error" role="alert" data-testid="xi-auth-error">
              {error}
            </p>
          )}
          {info && <p className="xi-auth-info">{info}</p>}
          {testMode && step === 2 && (
            <p className="xi-auth-hint" data-testid="xi-auth-test-otp">
              {t("auth.hint.otpTest")}
            </p>
          )}

          <button type="submit" className="xi-auth-cta" disabled={busy}>
            {busy
              ? "…"
              : mode === "login"
                ? t("auth.submitLogin")
                : step === 1
                  ? t("auth.sendOtp")
                  : step === 2
                    ? t("auth.verify")
                    : mode === "register"
                      ? t("auth.submitRegister")
                      : t("auth.submitReset")}
          </button>
        </form>

        <nav className="xi-auth-links">
          {mode !== "login" && (
            <button type="button" onClick={() => navigateXi({ href: "/xi/login" })}>
              {t("auth.goLogin")}
            </button>
          )}
          {mode !== "register" && (
            <button type="button" onClick={() => navigateXi({ href: "/xi/register" })}>
              {t("auth.goRegister")}
            </button>
          )}
          {mode === "login" && (
            <button type="button" onClick={() => navigateXi({ href: "/xi/forgot" })}>
              {t("auth.goForgot")}
            </button>
          )}
        </nav>
      </div>
    </div>
  );
}
