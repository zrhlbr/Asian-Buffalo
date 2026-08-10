/**
 * ADMIN-1G Customer Service tickets.
 * Plain-text messages; internal notes never for player APIs.
 * ATTACHMENT = BLOCKED. No wallet/ledger mutation from tickets.
 */

import { sql } from "drizzle-orm";
import type { AdminDb } from "./admin-queries.ts";

export const TICKET_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_PLAYER",
  "RESOLVED",
  "CLOSED",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_CATEGORIES = [
  "ACCOUNT",
  "LOGIN",
  "GAME",
  "WALLET",
  "DEPOSIT",
  "WITHDRAWAL",
  "ACTIVITY",
  "VIP",
  "TECHNICAL",
  "OTHER",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export type TicketRelated = {
  playerId?: string | null;
  roundId?: string | null;
  spinId?: string | null;
  ledgerId?: string | null;
  depositId?: string | null;
  withdrawalId?: string | null;
  riskEventId?: string | null;
};

export type TicketRow = {
  id: string;
  playerId: string | null;
  category: TicketCategory;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignedAdminId: string | null;
  assignedAdminUsername: string | null;
  related: TicketRelated;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastReplyAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
};

export type TicketMessage = {
  id: string;
  ticketId: string;
  authorType: string;
  authorId: string | null;
  authorUsername: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
};

function nowSql(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function parseRelated(raw: unknown): TicketRelated {
  if (typeof raw !== "string") return {};
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    return {
      playerId: typeof v.playerId === "string" ? v.playerId : null,
      roundId: typeof v.roundId === "string" ? v.roundId : null,
      spinId: typeof v.spinId === "string" ? v.spinId : null,
      ledgerId: typeof v.ledgerId === "string" ? v.ledgerId : null,
      depositId: typeof v.depositId === "string" ? v.depositId : null,
      withdrawalId: typeof v.withdrawalId === "string" ? v.withdrawalId : null,
      riskEventId: typeof v.riskEventId === "string" ? v.riskEventId : null,
    };
  } catch {
    return {};
  }
}

/** Strip scripts / HTML — tickets are plain text only. */
export function sanitizeTicketText(input: string, max = 4000): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .trim()
    .slice(0, max);
}

function mapTicket(row: Record<string, unknown>): TicketRow {
  return {
    id: String(row.id),
    playerId: row.player_id ? String(row.player_id) : null,
    category: String(row.category) as TicketCategory,
    subject: String(row.subject ?? ""),
    status: String(row.status) as TicketStatus,
    priority: String(row.priority) as TicketPriority,
    assignedAdminId: row.assigned_admin_id ? String(row.assigned_admin_id) : null,
    assignedAdminUsername: row.assigned_admin_username
      ? String(row.assigned_admin_username)
      : null,
    related: parseRelated(row.related_json),
    createdBy: String(row.created_by ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    lastReplyAt: row.last_reply_at ? String(row.last_reply_at) : null,
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    closedAt: row.closed_at ? String(row.closed_at) : null,
  };
}

function mapMessage(row: Record<string, unknown>): TicketMessage {
  return {
    id: String(row.id),
    ticketId: String(row.ticket_id),
    authorType: String(row.author_type ?? "ADMIN"),
    authorId: row.author_id ? String(row.author_id) : null,
    authorUsername: String(row.author_username ?? ""),
    body: String(row.body ?? ""),
    isInternal: Number(row.is_internal) === 1,
    createdAt: String(row.created_at ?? ""),
  };
}

export async function listTickets(
  db: AdminDb,
  opts: {
    page?: number;
    pageSize?: number;
    status?: string;
    priority?: string;
    category?: string;
    playerId?: string;
    assignedAdminId?: string;
    search?: string;
  },
): Promise<{ items: TicketRow[]; page: number; pageSize: number; total: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
  const offset = (page - 1) * pageSize;
  const all = await db.all<Record<string, unknown>>(sql`
    SELECT * FROM admin_tickets ORDER BY updated_at DESC LIMIT 500
  `);
  let items = all.map(mapTicket);
  if (opts.status) items = items.filter((t) => t.status === opts.status!.toUpperCase());
  if (opts.priority) items = items.filter((t) => t.priority === opts.priority!.toUpperCase());
  if (opts.category) items = items.filter((t) => t.category === opts.category!.toUpperCase());
  if (opts.playerId) items = items.filter((t) => t.playerId === opts.playerId);
  if (opts.assignedAdminId) {
    items = items.filter((t) => t.assignedAdminId === opts.assignedAdminId);
  }
  if (opts.search?.trim()) {
    const q = opts.search.trim().toLowerCase();
    items = items.filter(
      (t) =>
        t.id.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        (t.playerId ?? "").toLowerCase().includes(q),
    );
  }
  const total = items.length;
  return { items: items.slice(offset, offset + pageSize), page, pageSize, total };
}

export async function getTicket(
  db: AdminDb,
  id: string,
): Promise<{ ticket: TicketRow; messages: TicketMessage[] } | null> {
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT * FROM admin_tickets WHERE id = ${id} LIMIT 1
  `);
  if (!rows[0]) return null;
  const msgs = await db.all<Record<string, unknown>>(sql`
    SELECT * FROM admin_ticket_messages WHERE ticket_id = ${id}
    ORDER BY created_at ASC LIMIT 500
  `);
  return { ticket: mapTicket(rows[0]), messages: msgs.map(mapMessage) };
}

export async function createTicket(
  db: AdminDb,
  input: {
    playerId?: string | null;
    category: string;
    subject: string;
    priority?: string;
    body?: string;
    related?: TicketRelated;
    createdById: string;
    createdByUsername: string;
  },
): Promise<{ ok: true; ticket: TicketRow } | { ok: false; code: string; message: string }> {
  const category = input.category.toUpperCase();
  if (!(TICKET_CATEGORIES as readonly string[]).includes(category)) {
    return { ok: false, code: "INVALID_REQUEST", message: "invalid category" };
  }
  const subject = sanitizeTicketText(input.subject, 200);
  if (subject.length < 2) return { ok: false, code: "INVALID_REQUEST", message: "subject required" };
  const priority = (input.priority ?? "NORMAL").toUpperCase();
  if (!(TICKET_PRIORITIES as readonly string[]).includes(priority)) {
    return { ok: false, code: "INVALID_REQUEST", message: "invalid priority" };
  }
  const id = crypto.randomUUID();
  const ts = nowSql();
  const related = {
    playerId: input.playerId ?? null,
    ...(input.related ?? {}),
  };
  await db.run(sql`
    INSERT INTO admin_tickets (
      id, player_id, category, subject, status, priority,
      related_json, created_by, created_at, updated_at
    ) VALUES (
      ${id}, ${input.playerId ?? null}, ${category}, ${subject}, 'OPEN', ${priority},
      ${JSON.stringify(related)}, ${input.createdByUsername}, ${ts}, ${ts}
    )
  `);
  if (input.body?.trim()) {
    await appendMessage(db, {
      ticketId: id,
      authorId: input.createdById,
      authorUsername: input.createdByUsername,
      body: input.body,
      isInternal: false,
    });
  }
  const detail = await getTicket(db, id);
  return { ok: true, ticket: detail!.ticket };
}

async function appendMessage(
  db: AdminDb,
  input: {
    ticketId: string;
    authorId: string;
    authorUsername: string;
    body: string;
    isInternal: boolean;
  },
): Promise<{ ok: true; id: string } | { ok: false; code: string; message: string }> {
  const body = sanitizeTicketText(input.body);
  if (body.length < 1) return { ok: false, code: "INVALID_REQUEST", message: "body required" };
  const id = crypto.randomUUID();
  const ts = nowSql();
  await db.run(sql`
    INSERT INTO admin_ticket_messages (
      id, ticket_id, author_type, author_id, author_username, body, is_internal, created_at
    ) VALUES (
      ${id}, ${input.ticketId}, 'ADMIN', ${input.authorId}, ${input.authorUsername},
      ${body}, ${input.isInternal ? 1 : 0}, ${ts}
    )
  `);
  await db.run(sql`
    UPDATE admin_tickets SET
      last_reply_at = ${ts},
      updated_at = ${ts}
    WHERE id = ${input.ticketId}
  `);
  return { ok: true, id };
}

export async function addTicketReply(
  db: AdminDb,
  input: {
    ticketId: string;
    authorId: string;
    authorUsername: string;
    body: string;
    isInternal: boolean;
  },
) {
  const existing = await getTicket(db, input.ticketId);
  if (!existing) return { ok: false as const, code: "NOT_FOUND", message: "ticket not found" };
  return appendMessage(db, input);
}

export async function updateTicket(
  db: AdminDb,
  input: {
    ticketId: string;
    status?: string;
    priority?: string;
    assignedAdminId?: string | null;
    assignedAdminUsername?: string | null;
    related?: TicketRelated;
  },
): Promise<
  | { ok: true; before: TicketRow; after: TicketRow }
  | { ok: false; code: string; message: string }
> {
  const existing = await getTicket(db, input.ticketId);
  if (!existing) return { ok: false, code: "NOT_FOUND", message: "ticket not found" };
  const before = existing.ticket;
  let status = before.status;
  let priority = before.priority;
  if (input.status) {
    const s = input.status.toUpperCase();
    if (!(TICKET_STATUSES as readonly string[]).includes(s)) {
      return { ok: false, code: "INVALID_REQUEST", message: "invalid status" };
    }
    status = s as TicketStatus;
  }
  if (input.priority) {
    const p = input.priority.toUpperCase();
    if (!(TICKET_PRIORITIES as readonly string[]).includes(p)) {
      return { ok: false, code: "INVALID_REQUEST", message: "invalid priority" };
    }
    priority = p as TicketPriority;
  }
  const ts = nowSql();
  const resolvedAt = status === "RESOLVED" ? ts : before.resolvedAt;
  const closedAt = status === "CLOSED" ? ts : before.closedAt;
  const assignedId =
    input.assignedAdminId === undefined ? before.assignedAdminId : input.assignedAdminId;
  const assignedName =
    input.assignedAdminUsername === undefined
      ? before.assignedAdminUsername
      : input.assignedAdminUsername;
  const related = input.related
    ? { ...before.related, ...input.related }
    : before.related;
  await db.run(sql`
    UPDATE admin_tickets SET
      status = ${status},
      priority = ${priority},
      assigned_admin_id = ${assignedId},
      assigned_admin_username = ${assignedName},
      related_json = ${JSON.stringify(related)},
      resolved_at = ${resolvedAt},
      closed_at = ${closedAt},
      updated_at = ${ts}
    WHERE id = ${input.ticketId}
  `);
  const after = (await getTicket(db, input.ticketId))!.ticket;
  return { ok: true, before, after };
}

export const TICKET_META = {
  attachment: "BLOCKED",
  richText: false,
  plainTextOnly: true,
  moneyOps: "FORBIDDEN",
};
