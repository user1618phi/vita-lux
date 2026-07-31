/* HTTP client for X2pos.

   Three things this client is careful about, each learned from the live API:

   1. The token from POST /api/auth carries no expiry. It is kept in memory for
      the life of the process and re-fetched on the first 401, which is the
      only signal we get. It is never persisted — a leaked token is a leaked
      till.

   2. Order payloads contain a customer name and phone. Nothing in this file
      ever logs a request or response body for the order endpoints; errors
      carry a status code and the endpoint, never the payload. That is the
      project's standing rule about order PII and it has to hold here too,
      where the temptation to `console.log(body)` while debugging is highest.

   3. `/api/stock` silently returns `[]` for `branch_id=all` or a missing
      `branch_id`, rather than erroring. An empty stock response is therefore
      ambiguous, and `getStock` treats "no rows at all" as a failure instead of
      quietly zeroing the entire warehouse. */

import { readConfig, type X2posConfig } from "./config.ts";
import {
  authResponse,
  createOrderResult,
  customerList,
  financeAccountList,
  mutationResult,
  procurementResponse,
  orderListResponse,
  productList,
  sessionList,
  stockResponse,
  whatIsNew,
  type CreateOrderPayload,
  type CreateOrderResult,
  type CreateReturnPayload,
  type Customer,
  type FinanceAccount,
  type OrderRow,
  type Procurement,
  type Product,
  type SessionRow,
  type WhatIsNew,
} from "./types.ts";

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_ATTEMPTS = 3;

export class X2posError extends Error {
  readonly status: number;
  readonly endpoint: string;
  constructor(endpoint: string, status: number, message: string) {
    super(`X2pos ${endpoint} failed (${status}): ${message}`);
    this.name = "X2posError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

export interface ClientOptions {
  config?: X2posConfig;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export function createClient(options: ClientOptions = {}) {
  const config = options.config ?? readConfig();
  const doFetch = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let token: string | null = null;

  async function authenticate(): Promise<string> {
    const body = new FormData();
    body.set("user", config.user);
    body.set("password", config.password);

    const res = await withTimeout((signal) =>
      doFetch(`${config.host}/api/auth`, { method: "POST", body, signal }),
    );
    if (!res.ok) throw new X2posError("/api/auth", res.status, "authentication rejected");

    const parsed = authResponse.safeParse(await res.json());
    if (!parsed.success) throw new X2posError("/api/auth", res.status, "unexpected auth response");
    token = parsed.data.token;
    return token;
  }

  async function withTimeout(run: (signal: AbortSignal) => Promise<Response>): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await run(controller.signal);
    } finally {
      clearTimeout(timer);
    }
  }

  /** One authenticated call, retrying transient failures and re-auth on 401. */
  async function request(
    endpoint: string,
    init: { method?: string; json?: unknown } = {},
  ): Promise<unknown> {
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (attempt > 0) await sleep(250 * 2 ** (attempt - 1));

      const key = token ?? (await authenticate());
      const headers: Record<string, string> = { "API-KEY": key, Accept: "application/json" };
      if (init.json !== undefined) headers["Content-Type"] = "application/json";

      let res: Response;
      try {
        res = await withTimeout((signal) =>
          doFetch(`${config.host}${endpoint}`, {
            method: init.method ?? "GET",
            headers,
            body: init.json === undefined ? undefined : JSON.stringify(init.json),
            signal,
          }),
        );
      } catch (cause) {
        // Network error or timeout — worth another go.
        lastError = cause;
        continue;
      }

      if (res.status === 401) {
        // Token went stale. Drop it and let the next iteration re-authenticate.
        token = null;
        lastError = new X2posError(endpoint, 401, "unauthorized");
        continue;
      }
      if (res.status >= 500) {
        lastError = new X2posError(endpoint, res.status, "server error");
        continue;
      }
      if (!res.ok) {
        // 4xx other than 401 is our fault; retrying will not fix it.
        throw new X2posError(endpoint, res.status, "request rejected");
      }

      try {
        return await res.json();
      } catch {
        throw new X2posError(endpoint, res.status, "response was not valid JSON");
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new X2posError(endpoint, 0, "exhausted retries");
  }

  function parse<T>(
    endpoint: string,
    schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } },
    value: unknown,
  ): T {
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw new X2posError(endpoint, 200, "response did not match the expected shape");
    return parsed.data;
  }

  return {
    config,

    async getWhatIsNew(): Promise<WhatIsNew> {
      return parse("/api/what_is_new", whatIsNew, await request("/api/what_is_new"));
    },

    /** One page of products (50 variations). `changedAfter` yields the delta. */
    async listProducts(opts: { page?: number; changedAfter?: string } = {}): Promise<Product[]> {
      const q = new URLSearchParams();
      if (opts.page) q.set("page", String(opts.page));
      if (opts.changedAfter) q.set("changed_after", opts.changedAfter);
      const endpoint = `/api/products${q.size ? `?${q}` : ""}`;
      return parse(endpoint, productList, await request(endpoint));
    },

    /** Every product, following pagination to exhaustion. */
    async listAllProducts(changedAfter?: string): Promise<Product[]> {
      const all: Product[] = [];
      for (let page = 1; page <= 200; page++) {
        const batch = await this.listProducts({ page, changedAfter });
        if (batch.length === 0) break;
        all.push(...batch);
      }
      return all;
    },

    /**
     * Stock for the configured branch, as variation id → quantity.
     *
     * Missing keys mean zero. An entirely empty response means the branch id
     * was not accepted, and is raised rather than interpreted as "everything
     * is out of stock" — that mistake would wipe the whole catalogue.
     */
    async getStock(): Promise<Map<string, number>> {
      const endpoint = `/api/stock?branch_id=${config.branchId}`;
      const raw = parse(endpoint, stockResponse, await request(endpoint));
      const entries = Object.entries(raw);
      if (entries.length === 0) {
        throw new X2posError(endpoint, 200, `no stock rows for branch ${config.branchId}`);
      }
      const out = new Map<string, number>();
      for (const [variationId, row] of entries) {
        out.set(variationId, Math.trunc(Number(row.quantity ?? 0)));
      }
      return out;
    },

    /** The most recent shift on the till, open or closed. */
    async getLastSession(): Promise<SessionRow | null> {
      const endpoint = `/api/session?kassa_id=${config.kassaId}&show_last=1`;
      const rows = parse(endpoint, sessionList, await request(endpoint));
      return rows[0] ?? null;
    },

    /**
     * Все клиенты компании.
     *
     * Без `page`, и это не упущение: на боевом аккаунте параметр
     * ИГНОРИРУЕТСЯ — вторая и третья страницы отдают тех же 33 клиентов, что
     * и первая. Пагинацию по клиентам строить нельзя.
     */
    async listCustomers(): Promise<Customer[]> {
      const endpoint = "/api/customers?is_supplier=0";
      const rows = parse(endpoint, customerList, await request(endpoint));
      return rows.filter((r) => r.is_deleted !== "1");
    },

    /** Денежные счета с текущими остатками. Архивные отфильтрованы. */
    async listAccounts(): Promise<FinanceAccount[]> {
      const endpoint = "/api/finance_accounts";
      const rows = parse(endpoint, financeAccountList, await request(endpoint));
      return rows.filter((r) => r.is_archived !== "1");
    },

    /** Приёмки, списания, перемещения и ревизии. */
    async listProcurements(perPage = 100): Promise<Procurement[]> {
      const endpoint = `/api/procurements?per_page=${perPage}`;
      const parsed = parse(endpoint, procurementResponse, await request(endpoint));
      return (parsed.procurements ?? []).filter((p) => p.is_deleted !== "1");
    },

    async findCustomerByPhone(phone: string): Promise<Customer | null> {
      const endpoint = `/api/customers?is_supplier=0&search=${encodeURIComponent(phone)}`;
      const rows = parse(endpoint, customerList, await request(endpoint));
      const digits = onlyDigits(phone);
      return rows.find((c) => onlyDigits(c.tel ?? "") === digits) ?? null;
    },

    /**
     * Create a customer, then look it up — the API answers this POST with
     * `{"status":"success"}` and no id, so a follow-up search is the only way
     * to learn what it created.
     */
    async createCustomer(input: { name: string; phone: string; address?: string }): Promise<Customer | null> {
      const body = new FormData();
      body.set("is_supplier", "0");
      body.set("customer_name", input.name);
      body.set("tel", input.phone);
      if (input.address) body.set("address", input.address);

      const res = await withTimeout(async (signal) => {
        const key = token ?? (await authenticate());
        return doFetch(`${config.host}/api/customers`, {
          method: "POST",
          headers: { "API-KEY": key },
          body,
          signal,
        });
      });
      if (!res.ok) throw new X2posError("/api/customers", res.status, "customer create rejected");
      parse("/api/customers", mutationResult, await res.json());
      return this.findCustomerByPhone(input.phone);
    },

    async createOrder(payload: CreateOrderPayload): Promise<CreateOrderResult> {
      const result = parse(
        "/api/orders",
        createOrderResult,
        await request("/api/orders", { method: "POST", json: payload }),
      );
      if (result.status !== "success") {
        // Note the absence of the payload in this message: it holds PII.
        throw new X2posError("/api/orders", 200, result.message ?? "sale was not accepted");
      }
      return result;
    },

    async createReturn(payload: CreateReturnPayload): Promise<CreateOrderResult> {
      const result = parse(
        "/api/return_order",
        createOrderResult,
        await request("/api/return_order", { method: "POST", json: payload }),
      );
      if (result.status !== "success") {
        throw new X2posError("/api/return_order", 200, result.message ?? "return was not accepted");
      }
      return result;
    },

    /**
     * Recent sales. Undocumented but present, and the only way to tell "the
     * sale never reached X2pos" from "it did and the reply was lost" — which
     * is the difference between retrying and double-selling.
     */
    async listOrders(page = 1): Promise<OrderRow[]> {
      const endpoint = `/api/orders?page=${page}`;
      const parsed = parse(endpoint, orderListResponse, await request(endpoint));
      return parsed.orders ?? [];
    },

    /** Has a sale with this form_guid already landed? */
    async findOrderByFormGuid(formGuid: string): Promise<OrderRow | null> {
      const needle = formGuid.toLowerCase();
      for (let page = 1; page <= 3; page++) {
        const rows = await this.listOrders(page);
        if (rows.length === 0) break;
        const hit = rows.find((r) => (r.form_guid ?? "").toLowerCase() === needle);
        if (hit) return hit;
      }
      return null;
    },
  };
}

export type X2posClient = ReturnType<typeof createClient>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}
