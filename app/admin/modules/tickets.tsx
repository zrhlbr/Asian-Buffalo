"use client";

/** ADMIN-1G Customer Service — tickets (plain text, no money ops). */

import React, { useCallback, useEffect, useState } from "react";
import {
  Badge,
  DangerConfirm,
  DataTable,
  ErrorBox,
  Loading,
  Pagination,
  fmtTime,
  useAdmin,
  type ColumnDef,
} from "../admin-ui.tsx";

type Ticket = {
  id: string;
  playerId: string | null;
  category: string;
  subject: string;
  status: string;
  priority: string;
  assignedAdminUsername: string | null;
  related: Record<string, string | null>;
  createdAt: string;
  updatedAt: string;
  lastReplyAt: string | null;
};

type Message = {
  id: string;
  authorUsername: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
};

const CATEGORIES = [
  "ACCOUNT", "LOGIN", "GAME", "WALLET", "DEPOSIT", "WITHDRAWAL",
  "ACTIVITY", "VIP", "TECHNICAL", "OTHER",
];

export default function TicketsModule() {
  const { t, api, toast, can, openTab } = useAdmin();
  const [items, setItems] = useState<Ticket[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ ticket: Ticket; messages: Message[] } | null>(null);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [confirm, setConfirm] = useState<
    | { kind: "create" }
    | { kind: "status"; id: string; status: string }
    | { kind: "reply" }
    | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [subject, setSubject] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [body, setBody] = useState("");

  const canReply = can("support:reply");
  const canAssign = can("support:assign");
  const canManage = can("support:manage");

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (status) qs.set("status", status);
      if (search.trim()) qs.set("search", search.trim());
      const result = await api<{ items: Ticket[]; total: number; meta?: { attachment: string } }>(
        `support/tickets?${qs}`,
      );
      setItems(result.items);
      setTotal(result.total);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api, page, status, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (id: string) => {
    try {
      const result = await api<{ ticket: Ticket; messages: Message[] }>(
        `support/tickets/${encodeURIComponent(id)}`,
      );
      setDetail(result);
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), true);
    }
  };

  const runConfirm = async (reason: string) => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === "create") {
        await api("support/tickets", {
          method: "POST",
          body: {
            reason,
            subject,
            playerId: playerId.trim() || null,
            category,
            body,
            priority: "NORMAL",
          },
        });
        setSubject("");
        setPlayerId("");
        setBody("");
        await load();
      } else if (confirm.kind === "status") {
        await api(`support/tickets/${encodeURIComponent(confirm.id)}/update`, {
          method: "POST",
          body: { reason, status: confirm.status },
        });
        await openDetail(confirm.id);
        await load();
      } else if (confirm.kind === "reply" && detail) {
        await api(`support/tickets/${encodeURIComponent(detail.ticket.id)}/reply`, {
          method: "POST",
          body: { reason, body: reply, internal },
        });
        setReply("");
        await openDetail(detail.ticket.id);
      }
      toast(t("common.success"));
      setConfirm(null);
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), true);
    } finally {
      setBusy(false);
    }
  };

  const columns: ColumnDef<Ticket>[] = [
    { key: "id", title: t("tickets.id"), render: (r) => r.id.slice(0, 8) },
    { key: "subject", title: t("tickets.subject"), render: (r) => r.subject },
    { key: "category", title: t("tickets.category"), render: (r) => r.category },
    {
      key: "priority",
      title: t("tickets.priority"),
      render: (r) => (
        <Badge tone={r.priority === "URGENT" || r.priority === "HIGH" ? "red" : "gray"}>
          {r.priority}
        </Badge>
      ),
    },
    {
      key: "status",
      title: t("common.status"),
      render: (r) => <Badge tone={r.status === "OPEN" ? "amber" : "green"}>{r.status}</Badge>,
    },
    {
      key: "assigned",
      title: t("tickets.assigned"),
      render: (r) => r.assignedAdminUsername ?? "—",
    },
    { key: "updated", title: t("common.time"), render: (r) => fmtTime(r.updatedAt) },
  ];

  return (
    <div>
      <div className="ab-chip-row" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        <span className="ab-chip">ATTACHMENT=BLOCKED</span>
        <span className="ab-chip">{t("tickets.noMoney")}</span>
        <span className="ab-chip">{t("tickets.plainText")}</span>
      </div>
      <div className="ab-toolbar" style={{ flexWrap: "wrap", gap: 8 }}>
        <select className="ab-input" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">{t("common.all")}</option>
          {["OPEN", "IN_PROGRESS", "WAITING_PLAYER", "RESOLVED", "CLOSED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          className="ab-input"
          placeholder={t("common.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="ab-btn" onClick={() => { setPage(1); void load(); }}>
          ⟳ {t("common.refresh")}
        </button>
        <button className="ab-btn" onClick={() => openTab({ key: "support", titleKey: "nav.support" })}>
          {t("support.title")}
        </button>
      </div>
      {error ? <ErrorBox message={error} /> : null}

      {canReply ? (
        <div className="ab-card" style={{ marginBottom: 12, display: "grid", gap: 8, maxWidth: 560 }}>
          <b>{t("tickets.create")}</b>
          <input className="ab-input" placeholder={t("tickets.subject")} value={subject} onChange={(e) => setSubject(e.target.value)} />
          <input className="ab-input" placeholder="Player ID" value={playerId} onChange={(e) => setPlayerId(e.target.value)} />
          <select className="ab-input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <textarea className="ab-input" rows={3} placeholder={t("tickets.message")} value={body} onChange={(e) => setBody(e.target.value)} />
          <button className="ab-btn primary" onClick={() => setConfirm({ kind: "create" })}>{t("common.submit")}</button>
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(280px,420px)", gap: 12 }}>
        <div>
          {!items ? (
            <Loading text={t("common.loading")} />
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={items}
                empty={t("common.empty")}
                onRowClick={(r) => void openDetail(r.id)}
              />
              <Pagination page={page} pageSize={20} total={total} onPage={setPage} />
            </>
          )}
        </div>
        <div className="ab-card" style={{ minHeight: 200 }}>
          {!detail ? (
            <div className="ab-chip">{t("tickets.selectHint")}</div>
          ) : (
            <>
              <b>{detail.ticket.subject}</b>
              <div className="ab-chip-row" style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0" }}>
                <span className="ab-chip">{detail.ticket.status}</span>
                <span className="ab-chip">{detail.ticket.priority}</span>
                <span className="ab-chip">{detail.ticket.category}</span>
              </div>
              {detail.ticket.playerId ? (
                <button
                  className="ab-btn"
                  style={{ marginBottom: 8 }}
                  onClick={() =>
                    openTab({
                      key: `players:${detail.ticket.playerId}`,
                      titleKey: "nav.players",
                      props: { playerId: String(detail.ticket.playerId) },
                    })
                  }
                >
                  Player
                </button>
              ) : null}
              {canAssign ? (
                <button
                  className="ab-btn"
                  style={{ marginBottom: 8, marginLeft: 6 }}
                  onClick={() =>
                    void api(`support/tickets/${detail.ticket.id}/update`, {
                      method: "POST",
                      body: { reason: "assign self", assignToSelf: true },
                    }).then(() => openDetail(detail.ticket.id))
                  }
                >
                  {t("tickets.assignSelf")}
                </button>
              ) : null}
              <div style={{ maxHeight: 240, overflow: "auto", marginBottom: 8 }}>
                {detail.messages.map((m) => (
                  <div key={m.id} style={{ marginBottom: 8, fontSize: 13 }}>
                    <b>{m.authorUsername}</b>
                    {m.isInternal ? <Badge tone="amber">NOTE</Badge> : null}
                    <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
                    <div style={{ opacity: 0.6, fontSize: 11 }}>{fmtTime(m.createdAt)}</div>
                  </div>
                ))}
              </div>
              {canReply ? (
                <>
                  <textarea className="ab-input" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} />
                  <label className="ab-chip" style={{ cursor: "pointer", marginTop: 6 }}>
                    <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />{" "}
                    {t("tickets.internalNote")}
                  </label>
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    <button className="ab-btn primary" onClick={() => setConfirm({ kind: "reply" })}>
                      {t("tickets.reply")}
                    </button>
                    <button className="ab-btn" onClick={() => setConfirm({ kind: "status", id: detail.ticket.id, status: "IN_PROGRESS" })}>
                      IN_PROGRESS
                    </button>
                    <button className="ab-btn" onClick={() => setConfirm({ kind: "status", id: detail.ticket.id, status: "RESOLVED" })}>
                      RESOLVED
                    </button>
                    {canManage ? (
                      <button className="ab-btn" onClick={() => setConfirm({ kind: "status", id: detail.ticket.id, status: "CLOSED" })}>
                        CLOSED
                      </button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      {confirm ? (
        <DangerConfirm
          title={t("tickets.confirm")}
          description={t("common.dangerConfirm")}
          reasonLabel={t("common.reason")}
          reasonRequired={t("common.reasonRequired")}
          hint={t("common.dangerConfirmHint")}
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
