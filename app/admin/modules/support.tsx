"use client";

/** Support channels from system config support_info — Not Configured when empty. */

import React, { useCallback, useEffect, useState } from "react";
import {
  DangerConfirm,
  ErrorBox,
  Loading,
  useAdmin,
} from "../admin-ui.tsx";

type ConfigItem = {
  key: string;
  value?: unknown;
  value_json?: string;
};

type SupportInfo = {
  telegram?: string;
  whatsapp?: string;
  line?: string;
  email?: string;
  online?: string;
  hours?: string;
};

function parseSupport(row: ConfigItem | undefined): SupportInfo {
  if (!row) return {};
  if (row.value && typeof row.value === "object") return row.value as SupportInfo;
  try {
    return JSON.parse(String(row.value_json ?? "{}")) as SupportInfo;
  } catch {
    return {};
  }
}

function displayOrNc(value: string | undefined | null, nc: string): string {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : nc;
}

export default function SupportModule() {
  const { t, api, toast, can } = useAdmin();
  const [info, setInfo] = useState<SupportInfo | null>(null);
  const [draft, setDraft] = useState<SupportInfo>({});
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const canManage = can("system:manage");
  const nc = t("common.notConfigured");

  const load = useCallback(async () => {
    try {
      const result = await api<{ items: ConfigItem[] }>("system/config");
      const row = result.items.find((item) => item.key === "support_info");
      const parsed = parseSupport(row);
      setInfo(parsed);
      setDraft(parsed);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (reason: string) => {
    setBusy(true);
    try {
      await api("system/config", {
        method: "POST",
        body: {
          key: "support_info",
          value: {
            telegram: (draft.telegram ?? "").trim(),
            whatsapp: (draft.whatsapp ?? "").trim(),
            line: (draft.line ?? "").trim(),
            email: (draft.email ?? "").trim(),
            online: (draft.online ?? "").trim(),
            hours: (draft.hours ?? "").trim(),
          },
          reason,
        },
      });
      toast(t("common.success"));
      setConfirm(false);
      setEditing(false);
      await load();
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), true);
    } finally {
      setBusy(false);
    }
  };

  if (error && !info) return <ErrorBox message={error} />;
  if (!info) return <Loading text={t("common.loading")} />;

  const fields: { key: keyof SupportInfo; label: string }[] = [
    { key: "telegram", label: t("support.telegram") },
    { key: "whatsapp", label: t("support.whatsapp") },
    { key: "line", label: t("support.line") },
    { key: "email", label: t("support.email") },
    { key: "online", label: t("support.online") },
    { key: "hours", label: t("support.hours") },
  ];

  return (
    <div>
      {!canManage ? (
        <div className="ab-chip" style={{ marginBottom: 12 }}>
          {t("support.readonlyHint")}
        </div>
      ) : null}
      <div className="ab-toolbar">
        <button className="ab-btn" onClick={() => void load()}>
          ⟳ {t("common.refresh")}
        </button>
        {canManage ? (
          editing ? (
            <>
              <button className="ab-btn primary" onClick={() => setConfirm(true)}>
                {t("common.save")}
              </button>
              <button
                className="ab-btn"
                onClick={() => {
                  setEditing(false);
                  setDraft(info);
                }}
              >
                {t("common.cancel")}
              </button>
            </>
          ) : (
            <button className="ab-btn" onClick={() => setEditing(true)}>
              {t("support.edit")}
            </button>
          )
        ) : null}
      </div>
      {error ? <ErrorBox message={error} /> : null}
      <div className="ab-panel">
        <div className="ab-panel-title">{t("support.title")}</div>
        <div className="ab-kv" style={{ marginTop: 12 }}>
          {fields.map((field) => (
            <div className="ab-kv-item" key={field.key}>
              <span className="k">{field.label}</span>
              <span className="v" style={{ flex: 1 }}>
                {editing ? (
                  <input
                    className="ab-input"
                    value={draft[field.key] ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, [field.key]: event.target.value }))
                    }
                    placeholder={nc}
                  />
                ) : (
                  displayOrNc(info[field.key], nc)
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
      {confirm ? (
        <DangerConfirm
          title={t("support.saveConfirm")}
          description={t("common.dangerConfirm")}
          reasonLabel={t("common.reason")}
          reasonRequired={t("common.reasonRequired")}
          hint={t("common.dangerConfirmHint")}
          confirmLabel={t("common.confirm")}
          cancelLabel={t("common.cancel")}
          busy={busy}
          onConfirm={(reason) => void save(reason)}
          onCancel={() => setConfirm(false)}
        />
      ) : null}
    </div>
  );
}
