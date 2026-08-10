"use client";

/** Announcements — trilingual draft/create; publish requires zh/en/my. */

import React, { useCallback, useEffect, useState } from "react";
import {
  Badge,
  DangerConfirm,
  DataTable,
  ErrorBox,
  Loading,
  fmtTime,
  useAdmin,
  type ColumnDef,
} from "../admin-ui.tsx";

type Announcement = {
  id: string;
  title: string;
  content: string;
  level: string;
  status: string;
  created_by: string;
  created_at: string;
  [key: string]: unknown;
};

function parseLocales(content: string): { zh: string; en: string; my: string; publishAt: string | null } {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (parsed && typeof parsed === "object" && ("zh" in parsed || "en" in parsed || "my" in parsed)) {
      return {
        zh: typeof parsed.zh === "string" ? parsed.zh : "",
        en: typeof parsed.en === "string" ? parsed.en : "",
        my: typeof parsed.my === "string" ? parsed.my : "",
        publishAt: typeof parsed.publishAt === "string" ? parsed.publishAt : null,
      };
    }
  } catch {
    /* plain */
  }
  return { zh: content, en: content, my: content, publishAt: null };
}

function hasAllLocales(content: string): boolean {
  const locales = parseLocales(content);
  return Boolean(locales.zh.trim() && locales.en.trim() && locales.my.trim());
}

export default function AnnouncementsModule() {
  const { t, api, toast, locale, can } = useAdmin();
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<
    { kind: "create" } | { kind: "toggle"; id: string; publish: boolean } | null
  >(null);
  const [newTitle, setNewTitle] = useState("");
  const [newZh, setNewZh] = useState("");
  const [newEn, setNewEn] = useState("");
  const [newMy, setNewMy] = useState("");
  const [asDraft, setAsDraft] = useState(true);
  const canManage = can("content:publish") || can("content:edit");
  const canPublish = can("content:publish");

  const load = useCallback(async () => {
    try {
      const result = await api<{ items: Announcement[] }>("system/announcements");
      setItems(result.items);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const runConfirm = async (reason: string) => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === "create") {
        const publishNow = !asDraft;
        if (publishNow && !(newZh.trim() && newEn.trim() && newMy.trim())) {
          toast(t("announcements.publishNeedLocales"), true);
          setBusy(false);
          return;
        }
        await api("system/announcements", {
          method: "POST",
          body: {
            title: newTitle,
            locales: { zh: newZh, en: newEn, my: newMy },
            content: newZh || newEn || newMy,
            status: publishNow ? "PUBLISHED" : "UNPUBLISHED",
            level: "INFO",
            reason,
          },
        });
        setNewTitle("");
        setNewZh("");
        setNewEn("");
        setNewMy("");
        setAsDraft(true);
      } else {
        if (confirm.publish) {
          const row = items?.find((item) => item.id === confirm.id);
          if (!row || !hasAllLocales(row.content)) {
            toast(t("announcements.publishNeedLocales"), true);
            setBusy(false);
            return;
          }
        }
        await api(
          `system/announcements/${encodeURIComponent(confirm.id)}/${confirm.publish ? "publish" : "unpublish"}`,
          { method: "POST", body: { reason } },
        );
      }
      toast(t("common.success"));
      setConfirm(null);
      await load();
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), true);
    } finally {
      setBusy(false);
    }
  };

  const columns: ColumnDef<Announcement>[] = [
    { key: "title", title: t("system.announcementTitle"), render: (row) => row.title },
    {
      key: "content",
      title: t("system.announcementContent"),
      render: (row) => {
        const parsed = parseLocales(row.content);
        const text = parsed[locale] || parsed.zh || parsed.en || parsed.my;
        return text.slice(0, 48) + (text.length > 48 ? "…" : "");
      },
    },
    {
      key: "locales",
      title: t("announcements.locales"),
      render: (row) => {
        const parsed = parseLocales(row.content);
        const bits = [
          parsed.zh.trim() ? "zh" : null,
          parsed.en.trim() ? "en" : null,
          parsed.my.trim() ? "my" : null,
        ].filter(Boolean);
        return bits.length ? bits.join("/") : t("common.notConfigured");
      },
    },
    {
      key: "status",
      title: t("common.status"),
      render: (row) => (
        <Badge tone={row.status === "PUBLISHED" ? "green" : "gray"}>
          {row.status === "PUBLISHED" ? t("system.published") : t("system.annDraft")}
        </Badge>
      ),
    },
    { key: "created_by", title: t("system.admin"), render: (row) => row.created_by },
    { key: "created_at", title: t("common.time"), render: (row) => fmtTime(row.created_at) },
    {
      key: "actions",
      title: t("common.actions"),
      render: (row) =>
        canPublish ? (
          <button
            className="ab-btn"
            onClick={() =>
              setConfirm({ kind: "toggle", id: row.id, publish: row.status !== "PUBLISHED" })
            }
          >
            {row.status === "PUBLISHED" ? t("system.unpublish") : t("system.publish")}
          </button>
        ) : (
          <span className="ab-chip">{t("common.viewOnly")}</span>
        ),
    },
  ];

  return (
    <div>
      <div className="ab-toolbar">
        <button className="ab-btn" onClick={() => void load()}>
          ⟳ {t("common.refresh")}
        </button>
        <span className="ab-chip">{t("announcements.requireLocales")}</span>
      </div>
      {error ? <ErrorBox message={error} /> : null}

      {canManage ? (
        <div className="ab-card" style={{ marginBottom: 12, display: "grid", gap: 8 }}>
          <b>{t("system.addAnnouncement")}</b>
          <input
            className="ab-input"
            placeholder={t("system.announcementTitle")}
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
          />
          <textarea
            className="ab-input"
            placeholder={`${t("system.announcementContent")} (zh)`}
            value={newZh}
            onChange={(event) => setNewZh(event.target.value)}
            rows={2}
          />
          <textarea
            className="ab-input"
            placeholder={`${t("system.announcementContent")} (en)`}
            value={newEn}
            onChange={(event) => setNewEn(event.target.value)}
            rows={2}
          />
          <textarea
            className="ab-input"
            placeholder={`${t("system.announcementContent")} (my)`}
            value={newMy}
            onChange={(event) => setNewMy(event.target.value)}
            rows={2}
          />
          <label className="ab-chip" style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={asDraft}
              onChange={(event) => setAsDraft(event.target.checked)}
            />
            {t("system.annDraft")}
          </label>
          <button
            className="ab-btn primary"
            disabled={!newTitle || !(newZh || newEn || newMy)}
            onClick={() => setConfirm({ kind: "create" })}
          >
            {t("common.submit")}
          </button>
        </div>
      ) : null}

      {!items ? (
        <Loading text={t("common.loading")} />
      ) : (
        <DataTable columns={columns} rows={items} empty={t("common.empty")} />
      )}

      {confirm ? (
        <DangerConfirm
          title={
            confirm.kind === "create"
              ? t("system.addAnnouncement")
              : confirm.publish
                ? t("system.publish")
                : t("system.unpublish")
          }
          description={t("common.dangerConfirm")}
          reasonLabel={t("common.reason")}
          reasonRequired={t("common.reasonRequired")}
          hint={
            confirm.kind === "toggle"
              ? t("content.playerImpactHint")
              : t("common.dangerConfirmHint")
          }
          confirmLabel={t("common.confirm")}
          cancelLabel={t("common.cancel")}
          busy={busy}
          onConfirm={(reason) => void runConfirm(reason)}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </div>
  );
}
