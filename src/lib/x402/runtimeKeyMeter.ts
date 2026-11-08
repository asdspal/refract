import { createHash } from "node:crypto";
import { query } from "../../db/index";

export type RuntimeKeyErrorCode =
  | "ERR_INVALID_RUNTIME_KEY"
  | "ERR_RUNTIME_SESSION_INACTIVE"
  | "ERR_SPEND_CAP_EXCEEDED"
  | "ERR_DAILY_CAP_EXCEEDED"
  | "ERR_INSUFFICIENT_NOTE_BALANCE";

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
}

interface SessionRow {
  id: string;
  remaining_micro_usdc: string;
  max_per_request_micro_usdc: string;
  daily_cap_micro_usdc: string;
  spent_today_micro_usdc: string;
  status: string;
  expired: boolean;
}

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

async function loadSession(runtimeKeyHash: string): Promise<SessionRow | null> {
  const res = await query<SessionRow>(
    `SELECT id,
            remaining_micro_usdc::text,
            max_per_request_micro_usdc::text,
            daily_cap_micro_usdc::text,
            spent_today_micro_usdc::text,
            status,
            (expires_at <= now()) AS expired
       FROM zk_runtime_sessions
      WHERE runtime_key_hash = $1`,
    [runtimeKeyHash],
  );
  return res.rows[0] ?? null;
}

function assertPolicyAllows(session: SessionRow, requested: number): void {
  if (session.status !== "ACTIVE" || session.expired) {
    throw new SpendPolicyError(
      "ERR_RUNTIME_SESSION_INACTIVE",
      "This Runtime Key is closed, expired, or revoked.",
      403,
    );
  }
  if (requested > Number(session.max_per_request_micro_usdc)) {
    throw new SpendPolicyError(
      "ERR_SPEND_CAP_EXCEEDED",
      `Endpoint requested ${requested} micro-USDC, exceeding the per-request cap of ${session.max_per_request_micro_usdc}.`,
      403,
    );
  }
  if (
    Number(session.spent_today_micro_usdc) + requested >
    Number(session.daily_cap_micro_usdc)
  ) {
    throw new SpendPolicyError(
      "ERR_DAILY_CAP_EXCEEDED",
      "This request would exceed the daily spend cap for the Runtime Key.",
      403,
    );
  }
  if (requested > Number(session.remaining_micro_usdc)) {
    throw new SpendPolicyError(
      "ERR_INSUFFICIENT_NOTE_BALANCE",
      `Insufficient note balance (${session.remaining_micro_usdc} remaining, ${requested} required).`,
      402,
    );
  }
}

/**
 * Atomically authorize an x402 request against a Runtime Key.
 *
 * ponytail: single Postgres atomic UPDATE path. Add the Upstash Redis Lua fast
 * path when measured p95 exceeds the 15ms NFR; correctness lives here.
 */
export async function authorizeAndDeductRuntimeKey(
  rawToken: string,
  requestedMicroUsdc: number,
): Promise<RuntimeKeyAuthorization> {
  assertAmount(requestedMicroUsdc, "requestedMicroUsdc");
  const runtimeKeyHash = hashRuntimeKey(rawToken);

  const session = await loadSession(runtimeKeyHash);
  if (!session) {
    throw new SpendPolicyError(
      "ERR_INVALID_RUNTIME_KEY",
      "Unknown Runtime Key.",
      401,
    );
  }
  assertPolicyAllows(session, requestedMicroUsdc);

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
    [requestedMicroUsdc, runtimeKeyHash],
  );

  if (res.rowCount === 0) {
    // Lost a race: re-read to report the precise reason.
    const latest = await loadSession(runtimeKeyHash);
    if (!latest) {
      throw new SpendPolicyError(
        "ERR_INVALID_RUNTIME_KEY",
        "Unknown Runtime Key.",
        401,
      );
    }
    assertPolicyAllows(latest, requestedMicroUsdc);
    throw new SpendPolicyError(
      "ERR_INSUFFICIENT_NOTE_BALANCE",
      "Concurrent spend consumed the note balance before this request settled.",
      402,
    );
  }

  const row = res.rows[0];
  return {
    sessionId: row.id,
    chargedMicroUsdc: requestedMicroUsdc,
    remainingMicroUsdc: Number(row.remaining_micro_usdc),
    spentTodayMicroUsdc: Number(row.spent_today_micro_usdc),
  };
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
}
