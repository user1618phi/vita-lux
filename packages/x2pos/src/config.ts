/* X2pos connection settings, read from the environment once.

   The numeric ids are per-company and there is exactly one of each on this
   account (one branch, one till, one owner), so they are configuration rather
   than something to discover at runtime. They are still env vars, not
   constants, because a second branch would otherwise mean a code change. */

export interface X2posConfig {
  host: string;
  user: string;
  password: string;
  branchId: number;
  kassaId: number;
  userId: number;
  employeeId: number;
  cashAccountId: number;
  /** Marks web sales apart from counter sales in X2pos reporting. */
  channel: string;
}

export class X2posDisabledError extends Error {
  constructor() {
    super("X2pos integration is disabled (X2POS_ENABLED is not \"1\")");
    this.name = "X2posDisabledError";
  }
}

/** Fail-closed, like ADMIN_ENABLED: only the exact string "1" turns it on. */
export function isX2posEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.X2POS_ENABLED === "1";
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): X2posConfig {
  if (!isX2posEnabled(env)) throw new X2posDisabledError();
  return {
    host: env.X2POS_HOST ?? "https://x2pos.com",
    user: required(env, "X2POS_USER"),
    password: required(env, "X2POS_PASSWORD"),
    branchId: requiredInt(env, "X2POS_BRANCH_ID"),
    kassaId: requiredInt(env, "X2POS_KASSA_ID"),
    userId: requiredInt(env, "X2POS_USER_ID"),
    employeeId: requiredInt(env, "X2POS_EMPLOYEE_ID"),
    cashAccountId: requiredInt(env, "X2POS_CASH_ACCOUNT_ID"),
    channel: env.X2POS_CHANNEL ?? "VITASHOP",
  };
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const v = env[key]?.trim();
  if (!v) throw new Error(`${key} is required when X2POS_ENABLED=1`);
  return v;
}

function requiredInt(env: NodeJS.ProcessEnv, key: string): number {
  const n = Number(required(env, key));
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${key} must be a positive integer`);
  return n;
}
