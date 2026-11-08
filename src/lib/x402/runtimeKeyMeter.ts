import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { query } from "../../db/index";

export type RuntimeKeyErrorCode =
  | "ERR_INVALID_RUNTIME_KEY"
  | "ERR_RUNTIME_SESSION_INACTIVE"
  | "ERR_SPEND_CAP_EXCEEDED"
  | "ERR_DAILY_CAP_EXCEEDED"
  | "ERR_INSUFFICIENT_NOTE_BALANCE"
  | "ERR_OPTIMISTIC_SESSION_REVOKED";

export class SpendPolicyError extends Error {
  readonly code: RuntimeKeyErrorCode;
  readonly status: number;

  constructor(code: RuntimeKeyErrorCode, message: string, status: number) {
    super(message);
    this.name = "SpendPolicyError";
    this.code = code;
    this.status = status;
  }
}

export interface RuntimeKeyAuthorization {
  sessionId: string;
  chargedMicroUsdc: number;
  remainingMicroUsdc: number;
  spentTodayMicroUsdc: number;
  source: "redis" | "postgres";
}

export interface AuthorizeOptions {
  forcePostgres?: boolean;
}

interface SessionRow {
  id: string;
  remaining_micro_usdc: string;
  max_per_request_micro_usdc: string;
  daily_cap_micro_usdc: string;
  spent_today_micro_usdc: string;
  status: string;
  expired: boolean;
  expires_at_epoch: string;
}

const REDIS_KEY_PREFIX = "refract:rk:";

export function hashRuntimeKey(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function assertAmount(amount: number, label: string): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new SpendPolicyError(
      "ERR_INSUFFICIENT_NOTE_BALANCE",
      `${label} must be a positive integer of micro-USDC`,
      400,
    );
  }
}

function policyErrorFor(code: string): SpendPolicyError {
  switch (code) {
    case "ERR_INVALID_RUNTIME_KEY":
      return new SpendPolicyError(code, "Unknown Runtime Key.", 401);
    case "ERR_RUNTIME_SESSION_INACTIVE":
      return new SpendPolicyError(
        code,
        "This Runtime Key is closed, expired, or revoked.",
        403,
      );
    case "ERR_OPTIMISTIC_SESSION_REVOKED":
      return new SpendPolicyError(
        code,
        "Optimistic credit session was revoked because the origin swap failed or was refunded.",
        403,
      );
    case "ERR_SPEND_CAP_EXCEEDED":
      return new SpendPolicyError(
        code,
        "Endpoint price exceeds the per-request cap for this Runtime Key.",
        403,
      );
    case "ERR_DAILY_CAP_EXCEEDED":
      return new SpendPolicyError(
        code,
        "This request would exceed the daily spend cap for the Runtime Key.",
        403,
      );
    default:
      return new SpendPolicyError(
        "ERR_INSUFFICIENT_NOTE_BALANCE",
        "Insufficient note balance.",
        402,
      );
  }
}

// ---------------------------------------------------------------------------
// Postgres (durable ledger, also the fallback path)
// ---------------------------------------------------------------------------

async function loadSession(runtimeKeyHash: string): Promise<SessionRow | null> {
  const res = await query<SessionRow>(
    `SELECT id,
            remaining_micro_usdc::text,
            max_per_request_micro_usdc::text,
            daily_cap_micro_usdc::text,
            spent_today_micro_usdc::text,
            status,
            (expires_at <= now()) AS expired,
            EXTRACT(EPOCH FROM expires_at)::bigint::text AS expires_at_epoch
       FROM zk_runtime_sessions
      WHERE runtime_key_hash = $1`,
    [runtimeKeyHash],
  );
  return res.rows[0] ?? null;
}

function assertPolicyAllows(session: SessionRow, requested: number): void {
  if (session.status === "REVOKED") {
    throw policyErrorFor("ERR_OPTIMISTIC_SESSION_REVOKED");
  }
  if (session.status !== "ACTIVE" || session.expired) {
    throw policyErrorFor("ERR_RUNTIME_SESSION_INACTIVE");
  }
  if (requested > Number(session.max_per_request_micro_usdc)) {
    throw policyErrorFor("ERR_SPEND_CAP_EXCEEDED");
  }
  if (
    Number(session.spent_today_micro_usdc) + requested >
    Number(session.daily_cap_micro_usdc)
  ) {
    throw policyErrorFor("ERR_DAILY_CAP_EXCEEDED");
  }
  if (requested > Number(session.remaining_micro_usdc)) {
    throw policyErrorFor("ERR_INSUFFICIENT_NOTE_BALANCE");
  }
}

async function writeThroughDeduct(
  runtimeKeyHash: string,
  requested: number,
): Promise<{ id: string; remaining: string; spent: string }> {
  const res = await query<{
    id: string;
    remaining_micro_usdc: string;
    spent_today_micro_usdc: string;
  }>(
    `UPDATE zk_runtime_sessions
        SET remaining_micro_usdc = remaining_micro_usdc - $1,
            spent_today_micro_usdc = spent_today_micro_usdc + $1,
            updated_at = now()
      WHERE runtime_key_hash = $2
        AND status = 'ACTIVE'
        AND expires_at > now()
        AND remaining_micro_usdc >= $1
        AND $1 <= max_per_request_micro_usdc
        AND spent_today_micro_usdc + $1 <= daily_cap_micro_usdc
      RETURNING id, remaining_micro_usdc::text, spent_today_micro_usdc::text`,
    [requested, runtimeKeyHash],
  );
  if (res.rowCount === 0) {
    throw policyErrorFor("ERR_INSUFFICIENT_NOTE_BALANCE");
  }
  return {
    id: res.rows[0].id,
    remaining: res.rows[0].remaining_micro_usdc,
    spent: res.rows[0].spent_today_micro_usdc,
  };
}

async function authorizePostgres(
  runtimeKeyHash: string,
  requested: number,
): Promise<RuntimeKeyAuthorization> {
  const session = await loadSession(runtimeKeyHash);
  if (!session) throw policyErrorFor("ERR_INVALID_RUNTIME_KEY");
  assertPolicyAllows(session, requested);
  const row = await writeThroughDeduct(runtimeKeyHash, requested);
  return {
    sessionId: row.id,
    chargedMicroUsdc: requested,
    remainingMicroUsdc: Number(row.remaining),
    spentTodayMicroUsdc: Number(row.spent),
    source: "postgres",
  };
}

// ---------------------------------------------------------------------------
// Upstash Redis (serverless REST fast path — Vercel-friendly, atomic Lua)
// ---------------------------------------------------------------------------

let redisClient: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  redisClient = url && token ? new Redis({ url, token }) : null;
  return redisClient;
}

const AUTHORIZE_LUA = `
local key = KEYS[1]
local amount = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
if redis.call('EXISTS', key) == 0 then return {'MISS'} end
local status = redis.call('HGET', key, 'status')
local expires = tonumber(redis.call('HGET', key, 'expires_at') or '0')
if status == 'REVOKED' then return {'ERR_OPTIMISTIC_SESSION_REVOKED'} end
if status ~= 'ACTIVE' or expires <= now then return {'ERR_RUNTIME_SESSION_INACTIVE'} end
if amount > tonumber(redis.call('HGET', key, 'max_per_request')) then return {'ERR_SPEND_CAP_EXCEEDED'} end
local spent = tonumber(redis.call('HGET', key, 'spent_today'))
local daily = tonumber(redis.call('HGET', key, 'daily_cap'))
if spent + amount > daily then return {'ERR_DAILY_CAP_EXCEEDED'} end
local remaining = tonumber(redis.call('HGET', key, 'remaining'))
if amount > remaining then return {'ERR_INSUFFICIENT_NOTE_BALANCE'} end
local newRemaining = redis.call('HINCRBY', key, 'remaining', -amount)
local newSpent = redis.call('HINCRBY', key, 'spent_today', amount)
return {'OK', tostring(newRemaining), tostring(newSpent), redis.call('HGET', key, 'session_id')}
`;

const SEED_LUA = `
local key = KEYS[1]
if redis.call('EXISTS', key) == 1 then return 0 end
redis.call('HSET', key,
  'session_id', ARGV[1],
  'remaining', ARGV[2],
  'spent_today', ARGV[3],
  'max_per_request', ARGV[4],
  'daily_cap', ARGV[5],
  'status', ARGV[6],
  'expires_at', ARGV[7])
redis.call('EXPIREAT', key, tonumber(ARGV[7]) + 60)
return 1
`;

const ROLLBACK_LUA = `
local key = KEYS[1]
local amount = tonumber(ARGV[1])
redis.call('HINCRBY', key, 'remaining', amount)
redis.call('HINCRBY', key, 'spent_today', -amount)
return 1
`;

async function seedRedis(redis: Redis, key: string, session: SessionRow) {
  await redis.eval(
    SEED_LUA,
    [key],
    [
      session.id,
      session.remaining_micro_usdc,
      session.spent_today_micro_usdc,
      session.max_per_request_micro_usdc,
      session.daily_cap_micro_usdc,
      session.status,
      session.expires_at_epoch,
    ],
  );
}

async function authorizeRedis(
  runtimeKeyHash: string,
  requested: number,
): Promise<RuntimeKeyAuthorization | null> {
  const redis = getRedis();
  if (!redis) return null;
  const key = REDIS_KEY_PREFIX + runtimeKeyHash;
  const now = Math.floor(Date.now() / 1000);

  try {
    let result = (await redis.eval(AUTHORIZE_LUA, [key], [requested, now])) as unknown[];

    if (String(result[0]) === "MISS") {
      const session = await loadSession(runtimeKeyHash);
      if (!session) throw policyErrorFor("ERR_INVALID_RUNTIME_KEY");
      if (session.status === "REVOKED") {
        throw policyErrorFor("ERR_OPTIMISTIC_SESSION_REVOKED");
      }
      if (session.status !== "ACTIVE" || session.expired) {
        throw policyErrorFor("ERR_RUNTIME_SESSION_INACTIVE");
      }
      await seedRedis(redis, key, session);
      result = (await redis.eval(AUTHORIZE_LUA, [key], [requested, now])) as unknown[];
    }

    const status = String(result[0]);
    if (status !== "OK") throw policyErrorFor(status);

    const remaining = Number(result[1]);
    const spentToday = Number(result[2]);
    const sessionId = String(result[3]);

    // Write-through to the durable ledger. If it fails, compensate Redis so the
    // next request re-syncs instead of silently over/under-charging.
    try {
      await writeThroughDeduct(runtimeKeyHash, requested);
    } catch (err) {
      await redis
        .eval(ROLLBACK_LUA, [key], [requested])
        .catch(() => redis.del(key).catch(() => undefined));
      throw err;
    }

    return {
      sessionId,
      chargedMicroUsdc: requested,
      remainingMicroUsdc: remaining,
      spentTodayMicroUsdc: spentToday,
      source: "redis",
    };
  } catch (err) {
    if (err instanceof SpendPolicyError) throw err;
    // Upstash outage / network error: fall back to the Postgres atomic path.
    return null;
  }
}

export async function invalidateRuntimeKeyCache(
  rawToken: string,
): Promise<void> {
  await invalidateRuntimeKeyCacheByHash(hashRuntimeKey(rawToken));
}

export async function invalidateRuntimeKeyCacheByHash(
  runtimeKeyHash: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.del(REDIS_KEY_PREFIX + runtimeKeyHash).catch(() => undefined);
}

/**
 * Atomically authorize an x402 request against a Runtime Key.
 *
 * Hot path uses Upstash Redis Lua (atomic, serverless REST) and writes through
 * to Postgres. If Redis is unavailable, the Postgres atomic UPDATE path is the
 * fallback. ponytail: write-through is synchronous for durability; move it to
 * Next.js `after()` if measured p95 needs the extra few ms.
 */
export async function authorizeAndDeductRuntimeKey(
  rawToken: string,
  requestedMicroUsdc: number,
  options: AuthorizeOptions = {},
): Promise<RuntimeKeyAuthorization> {
  assertAmount(requestedMicroUsdc, "requestedMicroUsdc");
  const runtimeKeyHash = hashRuntimeKey(rawToken);

  if (!options.forcePostgres) {
    const viaRedis = await authorizeRedis(runtimeKeyHash, requestedMicroUsdc);
    if (viaRedis) return viaRedis;
  } else {
    await invalidateRuntimeKeyCache(rawToken);
  }

  return authorizePostgres(runtimeKeyHash, requestedMicroUsdc);
}

/** Compensating credit for upstream 5xx failures (R-011 / R-008). */
export async function rollbackRuntimeKeyCharge(
  sessionId: string,
  amountMicroUsdc: number,
): Promise<void> {
  assertAmount(amountMicroUsdc, "amountMicroUsdc");
  await query(
    `UPDATE zk_runtime_sessions
        SET remaining_micro_usdc = remaining_micro_usdc + $1,
            spent_today_micro_usdc = GREATEST(spent_today_micro_usdc - $1, 0),
            updated_at = now()
      WHERE id = $2`,
    [amountMicroUsdc, sessionId],
  );

  const redis = getRedis();
  if (!redis) return;
  const res = await query<{ runtime_key_hash: string }>(
    "SELECT runtime_key_hash FROM zk_runtime_sessions WHERE id = $1",
    [sessionId],
  );
  if (!res.rows[0]) return;
  const key = REDIS_KEY_PREFIX + res.rows[0].runtime_key_hash;
  await redis
    .eval(ROLLBACK_LUA, [key], [amountMicroUsdc])
    .catch(() => redis.del(key).catch(() => undefined));
}
