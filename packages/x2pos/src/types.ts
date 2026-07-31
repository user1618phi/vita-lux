/* Wire schemas for the X2pos API.

   Written against the *live* API, not the v1.6 PDF, which is out of date in
   ways that would crash a naive client:

     - products carry `image_url` / `image_thumb_url`; the PDF shows those on
       categories only
     - `variations` is an object keyed by id, NOT the array the PDF draws
     - products carry `product_is_deleted` / `product_date_updated`
     - `GET /api/orders` exists and is undocumented

   Everything is `.passthrough()`-ish by default (zod strips unknown keys but
   does not fail on them) so that the next undocumented field X2pos adds does
   not take the sync down. */

import { z } from "zod";

/** X2pos quotes numbers as strings ("2550.00", "1"). Accept both. */
const numeric = z.union([z.string(), z.number()]).nullish();

export const authResponse = z.object({
  token: z.string().min(1),
  company_id: numeric,
});
export type AuthResponse = z.infer<typeof authResponse>;

export const whatIsNew = z.object({
  app_status: z.string(),
  subscription_expires: z.string().nullish(),
  category_last_updated: z.string().nullish(),
  product_last_updated: z.string().nullish(),
  customer_last_updated: z.string().nullish(),
  order_last_updated: z.string().nullish(),
  /* The server tells us how often it wants to be asked. Live value is 180 s. */
  what_is_new_timeout: z.number().nullish(),
});
export type WhatIsNew = z.infer<typeof whatIsNew>;

export const variation = z.object({
  id: z.string(),
  name: z.string().nullish(),
  measurement_unit: z.string().nullish(),
  quantity_minimal_piece: numeric,
  sku: z.string().nullish(),
  vendor_code: z.string().nullish(),
  is_generic: numeric,
  retail_price: numeric,
  wholesale_price: numeric,
  discount_type: z.string().nullish(),
  discount: numeric,
  image_url: z.string().nullish(),
  is_deleted: numeric,
});
export type Variation = z.infer<typeof variation>;

export const product = z.object({
  company_id: numeric,
  category_id: z.string().nullish(),
  category_name: z.string().nullish(),
  product_id: z.string(),
  product_name: z.string(),
  product_sku: z.string().nullish(),
  product_brand: z.string().nullish(),
  product_vendor_code: z.string().nullish(),
  product_description: z.string().nullish(),
  is_productset: numeric,
  is_service: numeric,
  is_serial: numeric,
  image_url: z.string().nullish(),
  image_thumb_url: z.string().nullish(),
  product_date_updated: z.string().nullish(),
  product_is_deleted: numeric,
  type: z.string().nullish(),
  /* Keyed by variation id — the PDF is wrong about this being an array. */
  variations: z.record(z.string(), variation).nullish(),
});
export type Product = z.infer<typeof product>;

export const productList = z.array(product);

export const stockRow = z.object({
  company_id: numeric,
  branch_id: numeric,
  variation_id: numeric,
  quantity: numeric,
});

/* Keyed by variation id. Absent key means zero — X2pos omits empty rows
   entirely (36 of 92 live products have no row at all). */
export const stockResponse = z.record(z.string(), stockRow);
export type StockResponse = z.infer<typeof stockResponse>;

export const sessionRow = z.object({
  id: z.string(),
  kassa_id: z.string().nullish(),
  smena_no: z.string().nullish(),
  date_opened: z.string().nullish(),
  date_closed: z.string().nullish(),
});
export const sessionList = z.array(sessionRow);
export type SessionRow = z.infer<typeof sessionRow>;

export const customer = z.object({
  id: z.string(),
  customer_name: z.string().nullish(),
  tel: z.string().nullish(),
  is_supplier: numeric,
});
export const customerList = z.array(customer);
export type Customer = z.infer<typeof customer>;

/** POST /api/customers answers only {"status":"success"} — no id. */
export const mutationResult = z.object({
  status: z.string(),
  message: z.union([z.string(), z.array(z.string())]).nullish(),
});

export const createOrderResult = z.object({
  status: z.string(),
  order_id: numeric,
  message: z.string().nullish(),
});
export type CreateOrderResult = z.infer<typeof createOrderResult>;

export const orderRow = z.object({
  id: z.string(),
  form_guid: z.string().nullish(),
  channel: z.string().nullish(),
  external_order_id: z.string().nullish(),
  status: z.string().nullish(),
  total: numeric,
  order_date: z.string().nullish(),
  is_deleted: numeric,
});
export const orderListResponse = z.object({
  status: z.string(),
  orders: z.array(orderRow).nullish(),
});
export type OrderRow = z.infer<typeof orderRow>;

/* ── outbound payloads ─────────────────────────────────────────────────── */

export interface OrderItemPayload {
  variation_id: number;
  quantity: number;
  minimal_piece: number;
  sell_price: number;
  discount_percent: number;
  discount_fact: number;
}

export interface CreateOrderPayload {
  form_guid: string;
  status: "draft" | "issued" | "completed" | "canceled";
  branch_id: number;
  kassa_id: number;
  session_id: null;
  session_no: number | null;
  customer_id: number | null;
  user_id: number;
  order_id: string | number | null;
  order_date: string;
  price_type: "retail_price" | "wholesale_price";
  notes: string;
  discount_type: null;
  discount_value: null;
  channel: string;
  order_items: OrderItemPayload[];
  payments: [];
}

export interface CreateReturnPayload {
  form_guid: string;
  session_no: number | null;
  drd_branch: number;
  drd_employee: number;
  kassa_id: number;
  customer_id: number | null;
  ref_return_reason: number;
  order_id: string | number;
  drd_account_id: number;
  total_to_return: number;
  quantity_to_return: Record<string, number>;
}

/** «Передумал покупатель» — the honest reason for a cancelled web order. */
export const RETURN_REASON_CHANGED_MIND = 3;
