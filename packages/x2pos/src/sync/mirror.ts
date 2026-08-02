/* Зеркалирование справочников X2pos в нашу базу.

   Продажи, клиенты, счета и складские документы. Всё, что админке нужно
   показывать, но что незачем спрашивать у X2pos в момент отрисовки страницы.

   Работает в воркере на Railway: он рядом с X2pos, не ограничен временем
   выполнения и уже ходит по расписанию. Панель после этого читает только
   собственный Postgres — миллисекунды вместо секунд и полная независимость
   от того, отвечает ли сейчас склад.

   Зеркало полное, а не дельта. Причин две. Продажи меняются задним числом:
   заказ был `issued` и стал `completed`, когда клиент довёз деньги, — по
   `changed_after` такое изменение не приедет, потому что у продаж этого
   параметра нет вовсе. И объём смешной: 112 продаж, 33 клиента, 13 документов.
   Дельту тут строить дороже, чем перезаливать.

   Удалённое наверху удаляется и здесь: строки, которых не было в этом
   прогоне, вычищаются. Иначе отменённая продажа осталась бы в выручке
   навсегда. */

import { inArray, notInArray, sql } from "drizzle-orm";
import { schema, type Database } from "@vita/db/client";
import type { X2posClient } from "../client.ts";
import { emptyReport, type SyncReport } from "./report.ts";

export interface MirrorOptions {
  db: Database;
  client: X2posClient;
}

export async function mirrorReference(opts: MirrorOptions): Promise<SyncReport> {
  const { db, client } = opts;
  const report = emptyReport(false);
  const now = new Date();

  /* Четыре независимых источника — тянем разом. Если один упадёт, остальные
     всё равно обновятся: панель лучше покажет свежие счета и вчерашние
     продажи, чем ничего. */
  const [sales, customers, accounts, docs] = await Promise.allSettled([
    fetchSales(client),
    client.listCustomers(),
    client.listAccounts(),
    client.listProcurements(),
  ]);

  /* ── продажи ─────────────────────────────────────────────────────────── */
  if (sales.status === "fulfilled") {
    const rows = sales.value;
    if (rows.length > 0) {
      await db
        .insert(schema.x2posSale)
        .values(
          rows.map((s) => ({
            id: s.id,
            soldAt: s.soldAt,
            totalKzt: s.totalKzt,
            paidKzt: s.paidKzt,
            status: s.status,
            isReturn: s.isReturn,
            fromSite: s.fromSite,
            customerName: s.customerName,
            syncedAt: now,
          })),
        )
        .onConflictDoUpdate({
          target: schema.x2posSale.id,
          set: {
            soldAt: sql`excluded.sold_at`,
            totalKzt: sql`excluded.total_kzt`,
            paidKzt: sql`excluded.paid_kzt`,
            status: sql`excluded.status`,
            isReturn: sql`excluded.is_return`,
            fromSite: sql`excluded.from_site`,
            customerName: sql`excluded.customer_name`,
            syncedAt: sql`excluded.synced_at`,
          },
        });

      /* Позиции переписываем целиком: их состав меняется вместе с продажей,
         и разбираться, что именно поменялось, дороже, чем перезаписать. */
      const ids = rows.map((s) => s.id);
      await db.delete(schema.x2posSaleItem).where(inArray(schema.x2posSaleItem.saleId, ids));
      const items = rows.flatMap((s) =>
        s.items.map((i) => ({
          saleId: s.id,
          name: i.name,
          vendorCode: i.vendorCode,
          qty: String(i.qty),
          totalKzt: i.totalKzt,
        })),
      );
      if (items.length > 0) await db.insert(schema.x2posSaleItem).values(items);

      /* Пропавшие наверху — вон. Позиции уйдут каскадом. */
      await db.delete(schema.x2posSale).where(notInArray(schema.x2posSale.id, ids));
      report.productsSeen = rows.length;
    }
  } else {
    report.errors.push(`продажи: ${errText(sales.reason)}`);
  }

  /* ── клиенты ─────────────────────────────────────────────────────────── */
  if (customers.status === "fulfilled") {
    const rows = customers.value;
    if (rows.length > 0) {
      await db
        .insert(schema.x2posCustomer)
        .values(
          rows.map((c) => ({
            id: c.id,
            name: (c.customer_name || c.company_name || "Без имени").trim(),
            phone: c.tel ?? null,
            city: c.kato_text ?? null,
            /* В X2pos долг отрицательный. Храним «сколько должен». */
            debtKzt: Math.max(0, Math.round(-Number(c.debt ?? 0))),
            syncedAt: now,
          })),
        )
        .onConflictDoUpdate({
          target: schema.x2posCustomer.id,
          set: {
            name: sql`excluded.name`,
            phone: sql`excluded.phone`,
            city: sql`excluded.city`,
            debtKzt: sql`excluded.debt_kzt`,
            syncedAt: sql`excluded.synced_at`,
          },
        });
      await db
        .delete(schema.x2posCustomer)
        .where(notInArray(schema.x2posCustomer.id, rows.map((c) => c.id)));
    }
  } else {
    report.errors.push(`клиенты: ${errText(customers.reason)}`);
  }

  /* ── денежные счета ──────────────────────────────────────────────────── */
  if (accounts.status === "fulfilled") {
    const rows = accounts.value;
    if (rows.length > 0) {
      await db
        .insert(schema.x2posAccount)
        .values(
          rows.map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            amountKzt: Math.round(Number(a.amount ?? 0)),
            currency: a.currency ?? "KZT",
            syncedAt: now,
          })),
        )
        .onConflictDoUpdate({
          target: schema.x2posAccount.id,
          set: {
            name: sql`excluded.name`,
            type: sql`excluded.type`,
            amountKzt: sql`excluded.amount_kzt`,
            currency: sql`excluded.currency`,
            syncedAt: sql`excluded.synced_at`,
          },
        });
      await db
        .delete(schema.x2posAccount)
        .where(notInArray(schema.x2posAccount.id, rows.map((a) => a.id)));
    }
  } else {
    report.errors.push(`счета: ${errText(accounts.reason)}`);
  }

  /* ── документы склада ────────────────────────────────────────────────── */
  if (docs.status === "fulfilled") {
    const rows = docs.value;
    if (rows.length > 0) {
      await db
        .insert(schema.x2posDoc)
        .values(
          rows.map((d) => ({
            id: d.id,
            action: d.action,
            status: d.status,
            docDate: (d.procurement_date ?? "").slice(0, 10) || null,
            quantity: String(Number(d.total_quantity ?? 0)),
            amountKzt: Math.round(Number(d.total_amount ?? 0)),
            supplier: d.supplier_name || null,
            items: Object.keys(d.procurement_items ?? {}).length,
            syncedAt: now,
          })),
        )
        .onConflictDoUpdate({
          target: schema.x2posDoc.id,
          set: {
            action: sql`excluded.action`,
            status: sql`excluded.status`,
            docDate: sql`excluded.doc_date`,
            quantity: sql`excluded.quantity`,
            amountKzt: sql`excluded.amount_kzt`,
            supplier: sql`excluded.supplier`,
            items: sql`excluded.items`,
            syncedAt: sql`excluded.synced_at`,
          },
        });
      await db.delete(schema.x2posDoc).where(notInArray(schema.x2posDoc.id, rows.map((d) => d.id)));
    }
  } else {
    report.errors.push(`документы: ${errText(docs.reason)}`);
  }

  report.finishedAt = new Date().toISOString();
  return report;
}

/* Продажи со всеми позициями. Страницы тянутся пачками параллельно: воркер не
   ограничен временем, но и тратить его впустую незачем. */
async function fetchSales(client: X2posClient) {
  const channel = client.config.channel.toLowerCase();
  const out: {
    id: string;
    soldAt: Date | null;
    totalKzt: number;
    paidKzt: number;
    status: string | null;
    isReturn: boolean;
    fromSite: boolean;
    customerName: string | null;
    items: { name: string; vendorCode: string | null; qty: number; totalKzt: number }[];
  }[] = [];

  const BATCH = 5;
  for (let first = 1; first <= 200; first += BATCH) {
    const batch = await Promise.all(
      Array.from({ length: BATCH }, (_, k) => client.listOrders(first + k)),
    );
    for (const r of batch.flat()) {
      if (r.is_deleted === "1") continue;
      const raw = r.order_date ? new Date(r.order_date.replace(" ", "T")) : null;
      out.push({
        id: r.id,
        soldAt: raw && !Number.isNaN(raw.getTime()) ? raw : null,
        totalKzt: Math.round(Number(r.total ?? 0)),
        paidKzt: Math.round(Number(r.total_paid ?? 0)),
        status: r.status ?? null,
        isReturn: r.is_return === "1",
        fromSite: (r.channel ?? "").toLowerCase() === channel,
        customerName: r.customer_name || null,
        items: Object.values(r.order_items ?? {}).map((it) => ({
          name: (it.product_name ?? "—").trim() || "—",
          vendorCode: it.product_vendor_code || null,
          qty: Number(it.quantity ?? 0),
          totalKzt: Math.round(Number(it.total ?? 0)),
        })),
      });
    }
    if (batch[batch.length - 1].length === 0) break;
  }
  return out;
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
