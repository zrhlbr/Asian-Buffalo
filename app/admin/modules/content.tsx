"use client";

/** ADMIN-1F Content Center — Banner / Recommended / Preview hub. */

import React, { useCallback, useEffect, useState } from "react";
import {
  Badge,
  DangerConfirm,
  DataTable,
  ErrorBox,
  Loading,
  Pagination,
  useAdmin,
  type ColumnDef,
} from "../admin-ui.tsx";

type LocaleBundle = { zh: string; en: string; my: string };

type Banner = {
  id: string;
  title: string;
  locales: LocaleBundle;
  imageUrl: string;
  targetUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: string;
  sortOrder: number;
  textStrategy: string;
  version: number;
  createdBy: string;
  publishedBy: string | null;
  publishedAt: string | null;
  localeCompleteness: { complete: boolean; missing: string[] };
};

type RecGame = {
  id: string;
  gameId: string;
  sortOrder: number;
  enabled: boolean;
  tag: string | null;
  coverUrl: string | null;
  locales: LocaleBundle;
};

type Meta = {
  mediaUpload: string;
  mediaPolicy: string;
  scheduling: string;
  rewardPayout: string;
  brandLogoEditable: boolean;
  officialGames: string[];
};

export default function ContentModule() {
  const { t, api, toast, can, openTab } = useAdmin();
  const [tab, setTab] = useState<"banners" | "recommended" | "preview">("banners");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [banners, setBanners] = useState<Banner[] | null>(null);
  const [recs, setRecs] = useState<RecGame[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [confirm, setConfirm] = useState<
    { kind: "publish" | "unpublish"; id: string } | { kind: "saveBanner" } | { kind: "saveRec" } | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [previewLocale, setPreviewLocale] = useState<"zh" | "en" | "my">("zh");
  const [previewWidth, setPreviewWidth] = useState<390 | 1280>(390);

  const [title, setTitle] = useState("");
  const [zh, setZh] = useState("");
  const [en, setEn] = useState("");
  const [my, setMy] = useState("");
  const [imageUrl, setImageUrl] = useState("https://cdn.example.com/banner.webp");
  const [targetUrl, setTargetUrl] = useState("");
  const [textStrategy, setTextStrategy] = useState<"TRI_LOCALE" | "IMAGE_ONLY">("TRI_LOCALE");
  const [editId, setEditId] = useState<string | null>(null);

  const canEdit = can("content:edit");
  const canPublish = can("content:publish");

  const loadMeta = useCallback(async () => {
    try {
      setMeta(await api<Meta>("content/meta"));
    } catch {
      setMeta(null);
    }
  }, [api]);

  const loadBanners = useCallback(async () => {
    try {
      const result = await api<{ items: Banner[]; total: number }>(
        `content/banners?page=${page}&pageSize=20`,
      );
      setBanners(result.items);
      setTotal(result.total);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api, page]);

  const loadRecs = useCallback(async () => {
    try {
      const result = await api<{ items: RecGame[] }>("content/recommended-games");
      setRecs(result.items);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (tab === "banners" || tab === "preview") void loadBanners();
    if (tab === "recommended") void loadRecs();
  }, [tab, loadBanners, loadRecs]);

  const runConfirm = async (reason: string) => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === "saveBanner") {
        if (textStrategy === "TRI_LOCALE" && !(zh.trim() && en.trim() && my.trim())) {
          // Draft allowed incomplete; warn only
        }
        await api("content/banners", {
          method: "POST",
          body: {
            reason,
            id: editId ?? undefined,
            title,
            locales: { zh, en, my },
            imageUrl,
            targetUrl: targetUrl || null,
            textStrategy,
            status: "DRAFT",
          },
        });
        setTitle("");
        setZh("");
        setEn("");
        setMy("");
        setEditId(null);
        await loadBanners();
      } else if (confirm.kind === "saveRec") {
        await api("content/recommended-games", {
          method: "POST",
          body: {
            reason,
            gameId: "bull-demon-king",
            sortOrder: 0,
            enabled: true,
            tag: "OFFICIAL",
            locales: { zh: "牛魔王", en: "Bull Demon King", my: "နွားနတ်ဆိုးဘုရင်" },
          },
        });
        await loadRecs();
      } else {
        await api(
          `content/banners/${encodeURIComponent(confirm.id)}/${confirm.kind === "publish" ? "publish" : "unpublish"}`,
          { method: "POST", body: { reason } },
        );
        await loadBanners();
      }
      toast(t("common.success"));
      setConfirm(null);
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), true);
    } finally {
      setBusy(false);
    }
  };

  const bannerCols: ColumnDef<Banner>[] = [
    { key: "title", title: t("content.title"), render: (r) => r.title },
    {
      key: "status",
      title: t("common.status"),
      render: (r) => (
        <Badge tone={r.status === "ACTIVE" ? "green" : r.status === "DRAFT" ? "gray" : "amber"}>
          {r.status}
        </Badge>
      ),
    },
    {
      key: "locales",
      title: t("content.locales"),
      render: (r) =>
        r.textStrategy === "IMAGE_ONLY"
          ? "IMAGE_ONLY"
          : r.localeCompleteness.complete
            ? "zh/en/my"
            : `missing:${r.localeCompleteness.missing.join(",")}`,
    },
    { key: "version", title: t("content.version"), render: (r) => String(r.version) },
    {
      key: "actions",
      title: t("common.actions"),
      render: (r) => (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {canEdit ? (
            <button
              className="ab-btn"
              onClick={() => {
                setEditId(r.id);
                setTitle(r.title);
                setZh(r.locales.zh);
                setEn(r.locales.en);
                setMy(r.locales.my);
                setImageUrl(r.imageUrl);
                setTargetUrl(r.targetUrl ?? "");
                setTextStrategy(r.textStrategy === "IMAGE_ONLY" ? "IMAGE_ONLY" : "TRI_LOCALE");
                setTab("banners");
              }}
            >
              {t("content.edit")}
            </button>
          ) : null}
          {canPublish ? (
            <button
              className="ab-btn"
              onClick={() =>
                setConfirm({
                  kind: r.status === "ACTIVE" || r.status === "SCHEDULED" ? "unpublish" : "publish",
                  id: r.id,
                })
              }
            >
              {r.status === "ACTIVE" || r.status === "SCHEDULED"
                ? t("content.unpublish")
                : t("content.publish")}
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  const recCols: ColumnDef<RecGame>[] = [
    { key: "gameId", title: "Game ID", render: (r) => r.gameId },
    { key: "tag", title: t("content.tag"), render: (r) => r.tag ?? "—" },
    {
      key: "enabled",
      title: t("common.status"),
      render: (r) =>
        r.enabled ? <Badge tone="green">ON</Badge> : <Badge tone="gray">OFF</Badge>,
    },
    { key: "sortOrder", title: t("content.sort"), render: (r) => String(r.sortOrder) },
  ];

  const previewBanner = banners?.[0] ?? null;

  return (
    <div>
      <div className="ab-toolbar" style={{ flexWrap: "wrap", gap: 8 }}>
        <button className={`ab-btn ${tab === "banners" ? "primary" : ""}`} onClick={() => setTab("banners")}>
          {t("content.banners")}
        </button>
        <button
          className={`ab-btn ${tab === "recommended" ? "primary" : ""}`}
          onClick={() => setTab("recommended")}
        >
          {t("content.recommended")}
        </button>
        <button className={`ab-btn ${tab === "preview" ? "primary" : ""}`} onClick={() => setTab("preview")}>
          {t("content.preview")}
        </button>
        <button className="ab-btn" onClick={() => openTab({ key: "announcements", titleKey: "nav.announcements" })}>
          {t("nav.announcements")}
        </button>
        <button className="ab-btn" onClick={() => openTab({ key: "activities", titleKey: "nav.activities" })}>
          {t("nav.activities")}
        </button>
        <button className="ab-btn" onClick={() => openTab({ key: "vip", titleKey: "nav.vip" })}>
          {t("nav.vip")}
        </button>
      </div>

      {meta ? (
        <div className="ab-chip-row" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          <span className="ab-chip">mediaUpload={meta.mediaUpload}</span>
          <span className="ab-chip">scheduling={meta.scheduling}</span>
          <span className="ab-chip">rewardPayout={meta.rewardPayout}</span>
          <span className="ab-chip">brandLogoEditable={String(meta.brandLogoEditable)}</span>
        </div>
      ) : null}

      {error ? <ErrorBox message={error} /> : null}

      {tab === "banners" ? (
        <>
          {canEdit ? (
            <div className="ab-card" style={{ marginBottom: 12, display: "grid", gap: 8 }}>
              <b>{editId ? t("content.editBanner") : t("content.createBanner")}</b>
              <input className="ab-input" placeholder={t("content.title")} value={title} onChange={(e) => setTitle(e.target.value)} />
              <input className="ab-input" placeholder="imageUrl (https)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
              <input className="ab-input" placeholder="targetUrl" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} />
              <select
                className="ab-input"
                value={textStrategy}
                onChange={(e) => setTextStrategy(e.target.value as "TRI_LOCALE" | "IMAGE_ONLY")}
              >
                <option value="TRI_LOCALE">TRI_LOCALE</option>
                <option value="IMAGE_ONLY">IMAGE_ONLY</option>
              </select>
              {textStrategy === "TRI_LOCALE" ? (
                <>
                  <textarea className="ab-input" rows={2} placeholder="ZH" value={zh} onChange={(e) => setZh(e.target.value)} />
                  <textarea className="ab-input" rows={2} placeholder="EN" value={en} onChange={(e) => setEn(e.target.value)} />
                  <textarea className="ab-input" rows={2} placeholder="MY" value={my} onChange={(e) => setMy(e.target.value)} />
                </>
              ) : (
                <span className="ab-chip">{t("content.imageOnlyHint")}</span>
              )}
              <button className="ab-btn primary" disabled={busy} onClick={() => setConfirm({ kind: "saveBanner" })}>
                {t("common.save")}
              </button>
            </div>
          ) : null}
          {!banners ? (
            <Loading text={t("common.loading")} />
          ) : (
            <>
              <DataTable columns={bannerCols} rows={banners} empty={t("common.empty")} />
              <Pagination page={page} pageSize={20} total={total} onPage={setPage} />
            </>
          )}
        </>
      ) : null}

      {tab === "recommended" ? (
        <>
          <div className="ab-readonly-banner">{t("content.recommendedHint")}</div>
          {canEdit ? (
            <button className="ab-btn primary" style={{ marginBottom: 10 }} onClick={() => setConfirm({ kind: "saveRec" })}>
              {t("content.addOfficialGame")}
            </button>
          ) : null}
          {!recs ? (
            <Loading text={t("common.loading")} />
          ) : (
            <DataTable columns={recCols} rows={recs} empty={t("common.empty")} />
          )}
        </>
      ) : null}

      {tab === "preview" ? (
        <div>
          <div className="ab-toolbar">
            {(["zh", "en", "my"] as const).map((loc) => (
              <button
                key={loc}
                className={`ab-btn ${previewLocale === loc ? "primary" : ""}`}
                onClick={() => setPreviewLocale(loc)}
              >
                {loc.toUpperCase()}
              </button>
            ))}
            <button className={`ab-btn ${previewWidth === 390 ? "primary" : ""}`} onClick={() => setPreviewWidth(390)}>
              390
            </button>
            <button className={`ab-btn ${previewWidth === 1280 ? "primary" : ""}`} onClick={() => setPreviewWidth(1280)}>
              Desktop
            </button>
            <span className="ab-chip">{t("content.previewNotPublish")}</span>
          </div>
          <div
            style={{
              width: previewWidth,
              maxWidth: "100%",
              border: "1px solid var(--ab-border, #333)",
              borderRadius: 8,
              padding: 12,
              background: "#111",
              color: "#eee",
            }}
          >
            {!previewBanner ? (
              <div>{t("common.empty")}</div>
            ) : (
              <>
                <div style={{ fontSize: 12, opacity: 0.7 }}>PREVIEW · not published by this view</div>
                <div style={{ fontWeight: 700, marginTop: 8 }}>{previewBanner.title}</div>
                <div style={{ marginTop: 6 }}>
                  {previewBanner.textStrategy === "IMAGE_ONLY"
                    ? "[IMAGE_ONLY]"
                    : previewBanner.locales[previewLocale] || "—"}
                </div>
                <div style={{ marginTop: 8, fontSize: 11, wordBreak: "break-all" }}>{previewBanner.imageUrl}</div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {confirm ? (
        <DangerConfirm
          title={
            confirm.kind === "publish"
              ? t("content.publishConfirm")
              : confirm.kind === "unpublish"
                ? t("content.unpublishConfirm")
                : t("common.confirm")
          }
          description={t("common.dangerConfirm")}
          reasonLabel={t("common.reason")}
          reasonRequired={t("common.reasonRequired")}
          hint={
            confirm.kind === "publish" || confirm.kind === "unpublish"
              ? t("content.playerImpactHint")
              : t("common.dangerConfirmHint")
          }
          confirmLabel={t("common.confirm")}
          cancelLabel={t("common.cancel")}
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={(reason) => void runConfirm(reason)}
        />
      ) : null}
    </div>
  );
}
