/* Outbound queue: web orders → X2pos sales.

   Why a queue at all, rather than posting the sale during checkout.

   The two systems fail independently. If X2pos is unreachable, or its till has
   no open shift, a customer must still be able to place an order — the shop
   does not stop selling because the warehouse app is having a bad afternoon.
   Equally, a sale must not be lost because the reply timed out. So checkout
   writes the order and the intent to deliver it in one transaction, and
   delivery is retried afterwards until it lands.

   `formGuid` is the idempotency key. X2pos treats a repeated POST with the
   same guid as an update of the same sale rather than a new one, which is what
   makes retrying safe after an ambiguous timeout — and `GET /api/orders`
   (undocumented, but present) lets us look the guid up and find out whether an
   earlier attempt actually landed before we try again.

   The chosen policy is `issued`: stock leaves the warehouse the moment the
   order is placed. That trades a small risk (an abandoned order holds stock
   until someone cancels it) for the larger protection against selling the same
   unit twice, which is the failure the owner actually feels. */

import { and, asc, eq, isNull, lte } from "drizzle-orm";
import { schema, type Database } from "@vita/db/client";
import type { X2posClient } from "../client.ts";
import {
  RETURN_REASON_CHANGED_MIND,
  type CreateOrderPayload,
  type CreateReturnPayload,
} from "../types.ts";

/** Backoff between attempts. Roughly: 1 min, 5 min, 20 min, 1 h, then hourly. */
const BACKOFF_MINUTES = [1, 5, 20, 60, 180];
const MAX_ATTEMPTS = 12;

export interface OutboxResult {
  processed: number;
  delivered: number;
  failed: number;
  /** Deliveries that could not proceed because the till has no open shift. */
  blockedByShift: number;
  errors: string[];
}

/* ── enqueue (called from checkout, inside its transaction) ────────────── */

export interface SaleLine {
  /** X2pos variation id, from `variant.externalId`. */
  variationId: string;
  qty: number;
  unitPriceKzt: number;
}

/**
 * Build the payload for a sale. Pure — no I/O — so that checkout can write it
 * into the outbox inside the same transaction that creates the order.
 *
 * `session_no` is filled in at delivery time, not here: shifts open and close
 * while an order sits in the queue, and stamping a stale shift number would
 * file the sale against a closed till.
 */
export function buildSalePayload(input: {
  formGuid: string;
  refCode: string;
  lines: SaleLine[];
  branchId: number;
  kassaId: number;
  userId: number;
  channel: string;
  /** Free-text note for the seller. Must not carry name, phone or address. */
  note: string;
  orderDate: Date;
}): CreateOrderPayload {
  return {
    form_guid: input.formGuid,
    status: "issued",
    branch_id: input.branchId,
    kassa_id: input.kassaId,
    session_id: null,
    session_no: null, // resolved at delivery
    customer_id: null, // resolved at delivery
    user_id: input.userId,
    order_id: null,
    order_date: formatX2posDate(input.orderDate),
    price_type: "retail_price",
    notes: input.note,
    discount_type: null,
    discount_value: null,
    channel: input.channel,
    order_items: input.lines.map((l) => ({
      variation_id: Number(l.variationId),
      quantity: l.qty,
      minimal_piece: 1,
      sell_price: l.unitPriceKzt,
      discount_percent: 0,
      discount_fact: 0,
    })),
    /* Empty on purpose: the site takes no money yet (payment is agreed over
       WhatsApp), so in X2pos this is an issued-but-unpaid sale — a debt. That
       is the same shape as 38 of the 50 sales already in the system. */
    payments: [],
  };
}

/* X2pos wants local time as "YYYY-MM-DD HH:MM:SS". */
export function formatX2posDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}

/* ── deliver ───────────────────────────────────────────────────────────── */

export interface ProcessOutboxOptions {
  db: Database;
  client: X2posClient;
  /** How many queue entries to attempt in one run. */
  limit?: number;
}

export async function processOutbox(opts: ProcessOutboxOptions): Promise<OutboxResult> {
  const { db, client } = opts;
  const limit = opts.limit ?? 20;
  const result: OutboxResult = {
    processed: 0,
    delivered: 0,
    failed: 0,
    blockedByShift: 0,
    errors: [],
  };

  const pending = await db
    .select()
    .from(schema.x2posOutbox)
    .where(
      and(isNull(schema.x2posOutbox.doneAt), lte(schema.x2posOutbox.nextAttemptAt, new Date())),
    )
    .orderBy(asc(schema.x2posOutbox.nextAttemptAt))
    .limit(limit);

  if (pending.length === 0) return result;

  /* One shift lookup for the whole batch — it is the same till for all of
     them, and the answer does not change mid-run. */
  const session = await client.getLastSession().catch(() => null);
  const shiftOpen = Boolean(session && !session.date_closed);
  const sessionNo = session?.smena_no ? Number(session.smena_no) : null;

  for (const entry of pending) {
    result.processed++;
    try {
      if (entry.kind === "sale") {
        /* A closed till is not a failure to retry into oblivion — it is a
           situation a human resolves by opening the shift. Hold the entry,
           back off, and let the caller raise it. */
        if (!shiftOpen) {
          result.blockedByShift++;
          await backoff(db, entry.id, entry.attempts, "смена на кассе закрыта");
          continue;
        }
        await deliverSale({ db, client, entry, sessionNo });
      } else {
        await deliverReturn({ db, client, entry, sessionNo });
      }
      result.delivered++;
    } catch (e) {
      result.failed++;
      const message = errText(e);
      result.errors.push(`${entry.kind} ${entry.formGuid}: ${message}`);
      await backoff(db, entry.id, entry.attempts, message);
    }
  }

  return result;
}

interface DeliverArgs {
  db: Database;
  client: X2posClient;
  entry: typeof schema.x2posOutbox.$inferSelect;
  sessionNo: number | null;
}

async function deliverSale({ db, client, entry, sessionNo }: DeliverArgs): Promise<void> {
  /* Did an earlier attempt already land? Asking costs one request and is the
     difference between a retry and selling the same stock twice. */
  const existing = await client.findOrderByFormGuid(entry.formGuid).catch(() => null);
  if (existing) {
    await markDone(db, entry.id, entry.orderId, existing.id);
    return;
  }

  const payload = { ...(entry.payload as CreateOrderPayload), session_no: sessionNo };
  const result = await client.createOrder(payload);
  await markDone(db, entry.id, entry.orderId, String(result.order_id ?? ""));
}

async function deliverReturn({ db, client, entry, sessionNo }: DeliverArgs): Promise<void> {
  const payload = { ...(entry.payload as CreateReturnPayload), session_no: sessionNo };
  await client.createReturn(payload);
  await db
    .update(schema.x2posOutbox)
    .set({ doneAt: new Date(), lastError: null })
    .where(eq(schema.x2posOutbox.id, entry.id));
}

async function markDone(
  db: Database,
  entryId: string,
  orderId: string,
  x2posOrderId: string,
): Promise<void> {
  await db
    .update(schema.x2posOutbox)
    .set({ doneAt: new Date(), lastError: null })
    .where(eq(schema.x2posOutbox.id, entryId));
  if (x2posOrderId) {
    await db
      .update(schema.order)
      .set({ x2posOrderId })
      .where(eq(schema.order.id, orderId));
  }
}

async function backoff(
  db: Database,
  entryId: string,
  attempts: number,
  message: string,
): Promise<void> {
  const next = attempts + 1;
  const minutes = BACKOFF_MINUTES[Math.min(next, BACKOFF_MINUTES.length - 1)];
  await db
    .update(schema.x2posOutbox)
    .set({
      attempts: next,
      lastError: message.slice(0, 500),
      nextAttemptAt: new Date(Date.now() + minutes * 60_000),
      /* Give up eventually, but do not delete: a stuck entry is evidence, and
         the admin screen lists it so a human can act on it. */
      doneAt: next >= MAX_ATTEMPTS ? new Date() : null,
    })
    .where(eq(schema.x2posOutbox.id, entryId));
}

/* ── returns ───────────────────────────────────────────────────────────── */

/**
 * Payload that puts stock back after a cancelled order.
 *
 * Only possible once the sale exists in X2pos: a return has to reference the
 * original sale id. An order cancelled before its sale was ever delivered
 * needs no return at all — the caller drops the pending sale instead.
 */
export function buildReturnPayload(input: {
  formGuid: string;
  x2posOrderId: string;
  lines: SaleLine[];
  totalKzt: number;
  branchId: number;
  kassaId: number;
  employeeId: number;
  cashAccountId: number;
}): CreateReturnPayload {
  const quantity: Record<string, number> = {};
  for (const l of input.lines) quantity[l.variationId] = l.qty;

  return {
    form_guid: input.formGuid,
    session_no: null, // resolved at delivery
    drd_branch: input.branchId,
    drd_employee: input.employeeId,
    kassa_id: input.kassaId,
    customer_id: null,
    ref_return_reason: RETURN_REASON_CHANGED_MIND,
    order_id: input.x2posOrderId,
    drd_account_id: input.cashAccountId,
    total_to_return: input.totalKzt,
    quantity_to_return: quantity,
  };
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
