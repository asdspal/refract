import {
  OneClickService,
  OpenAPI,
  QuoteRequest,
  type QuoteResponse,
  type TokenResponse,
} from "@defuse-protocol/one-click-sdk-typescript";
import { query } from "../../db/index";

export const DEFAULT_SOLANA_USDC_ASSET_ID =
  "nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near";
export const DEFAULT_ONE_CLICK_BASE_URL = "https://1click.chaindefuser.com";
export const MIN_DEPOSIT_MICRO_USDC = 1_000_000; // $1.00 (BR-01)
export const DEFAULT_INTEGRATOR_FEE_BPS = 30; // 0.30% (R-014)

export type QuoteErrorCode =
  | "ERR_MIN_DEPOSIT_NOT_MET"
  | "ERR_CONFIDENTIAL_AUTH_REQUIRED"
  | "ERR_AURORA_QUOTE_UNAVAILABLE";

export class AuroraQuoteError extends Error {
  readonly code: QuoteErrorCode;
  readonly status: number;

  constructor(code: QuoteErrorCode, message: string, status: number) {
    super(message);
    this.name = "AuroraQuoteError";
    this.code = code;
    this.status = status;
  }
}

export interface QuoteParams {
  originChain: string;
  originAsset: string;
  amountRaw: string;
  refundAddress: string;
  poseidonCommitmentHex: string;
  confidentialMode?: boolean;
  recipient?: string;
  destinationAsset?: string;
}

export interface DepositQuote {
  auroraQuoteId: string;
  depositAddress: string;
  expectedSolanaMicroUsdc: number;
  integratorFeeBps: number;
  confidentialMode: boolean;
  deadline?: string;
  correlationId: string;
}

export interface QuoteDeps {
  quoteFn?: (request: QuoteRequest) => Promise<QuoteResponse>;
}

export function configureOneClickClient(): void {
  OpenAPI.BASE =
    process.env.AURORA_ONE_CLICK_BASE_URL ?? DEFAULT_ONE_CLICK_BASE_URL;
  const jwt = process.env.AURORA_STUDIO_JWT_TOKEN;
  OpenAPI.TOKEN = jwt && jwt.length > 0 ? jwt : undefined;
}

function integratorFeeBps(): number {
  const parsed = Number(
    process.env.AURORA_INTEGRATOR_FEE_BPS ?? DEFAULT_INTEGRATOR_FEE_BPS,
  );
  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : DEFAULT_INTEGRATOR_FEE_BPS;
}

function solanaReceiver(params: QuoteParams): string {
  return (
    params.recipient ??
    process.env.SOLANA_RECEIVER_PUBKEY ??
    process.env.SOLANA_DEPLOYER_PUBKEY ??
    ""
  );
}

/** Build the exact 1Click request, including Confidential Intents + 30 bps fee. */
export function buildQuoteRequest(params: QuoteParams): QuoteRequest {
  if (!/^\d+$/.test(params.amountRaw) || Number(params.amountRaw) < MIN_DEPOSIT_MICRO_USDC) {
    throw new AuroraQuoteError(
      "ERR_MIN_DEPOSIT_NOT_MET",
      "Minimum deposit is $1.00 USDC equivalent to cover cross-chain solver settlement.",
      400,
    );
  }

  const jwt = process.env.AURORA_STUDIO_JWT_TOKEN;
  const confidentialMode = params.confidentialMode ?? true;
  if (confidentialMode && !jwt) {
    throw new AuroraQuoteError(
      "ERR_CONFIDENTIAL_AUTH_REQUIRED",
      "Aurora Confidential Intents requires AURORA_STUDIO_JWT_TOKEN. Set it or pass confidentialMode=false for a public quote.",
      503,
    );
  }

  const recipient = solanaReceiver(params);
  if (!recipient) {
    throw new AuroraQuoteError(
      "ERR_AURORA_QUOTE_UNAVAILABLE",
      "No Solana settlement recipient is configured (SOLANA_RECEIVER_PUBKEY).",
      502,
    );
  }

  return {
    dry: false,
    swapType: QuoteRequest.swapType.EXACT_INPUT,
    slippageTolerance: 100,
    originAsset: params.originAsset,
    depositType: QuoteRequest.depositType.ORIGIN_CHAIN,
    destinationAsset: params.destinationAsset ?? DEFAULT_SOLANA_USDC_ASSET_ID,
    amount: params.amountRaw,
    refundTo: params.refundAddress,
    refundType: QuoteRequest.refundType.ORIGIN_CHAIN,
    recipient,
    recipientType: QuoteRequest.recipientType.DESTINATION_CHAIN,
    deadline: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    ...(confidentialMode
      ? { confidentiality: QuoteRequest.confidentiality.BASIC }
      : {}),
    appFees: [
      {
        recipient:
          process.env.AURORA_INTEGRATOR_FEE_RECIPIENT ?? "refract-treasury.near",
        fee: integratorFeeBps(),
      },
    ],
  };
}

interface IntentDepositRow {
  aurora_quote_id: string;
  deposit_address: string;
  expected_solana_micro_usdc: string;
  integrator_fee_bps: number;
  confidential_mode: boolean;
}

function toDepositQuote(row: IntentDepositRow): DepositQuote {
  return {
    auroraQuoteId: row.aurora_quote_id,
    depositAddress: row.deposit_address,
    expectedSolanaMicroUsdc: Number(row.expected_solana_micro_usdc),
    integratorFeeBps: row.integrator_fee_bps,
    confidentialMode: row.confidential_mode,
    correlationId: row.aurora_quote_id,
  };
}

async function findExistingQuote(
  poseidonCommitmentHex: string,
): Promise<IntentDepositRow | null> {
  const res = await query<IntentDepositRow>(
    `SELECT aurora_quote_id, deposit_address, expected_solana_micro_usdc::text,
            integrator_fee_bps, confidential_mode
       FROM intent_deposits
      WHERE poseidon_commitment_hex = $1
        AND deleted_at IS NULL
        AND status NOT IN ('EXPIRED','FAILED','REFUNDED')
      ORDER BY created_at DESC
      LIMIT 1`,
    [poseidonCommitmentHex],
  );
  return res.rows[0] ?? null;
}

async function persistQuote(
  params: QuoteParams,
  request: QuoteRequest,
  response: QuoteResponse,
): Promise<DepositQuote> {
  const existing = await findExistingQuote(params.poseidonCommitmentHex);
  if (existing) return toDepositQuote(existing);

  const depositAddress = response.quote.depositAddress;
  if (!depositAddress) {
    throw new AuroraQuoteError(
      "ERR_AURORA_QUOTE_UNAVAILABLE",
      "Aurora quote did not return a deposit address.",
      502,
    );
  }

  const res = await query<IntentDepositRow>(
    `INSERT INTO intent_deposits
       (aurora_quote_id, origin_chain, origin_asset, origin_amount_raw,
        expected_solana_micro_usdc, deposit_address, refund_address,
        confidential_mode, integrator_fee_bps, poseidon_commitment_hex, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'QUOTE_CREATED')
     ON CONFLICT (aurora_quote_id) DO NOTHING
     RETURNING aurora_quote_id, deposit_address, expected_solana_micro_usdc::text,
               integrator_fee_bps, confidential_mode`,
    [
      response.correlationId,
      params.originChain,
      request.originAsset,
      request.amount,
      Number(response.quote.amountOut),
      depositAddress,
      params.refundAddress,
      params.confidentialMode ?? true,
      integratorFeeBps(),
      params.poseidonCommitmentHex,
    ],
  );

  if (res.rows[0]) return toDepositQuote(res.rows[0]);

  const fallback = await findExistingQuote(params.poseidonCommitmentHex);
  if (fallback) return toDepositQuote(fallback);
  throw new AuroraQuoteError(
    "ERR_AURORA_QUOTE_UNAVAILABLE",
    "Quote was created upstream but could not be persisted.",
    502,
  );
}

/** Create an Aurora Intents quote and persist it as a DRAFT deposit intent. */
export async function createConfidentialDepositQuote(
  params: QuoteParams,
  deps: QuoteDeps = {},
): Promise<DepositQuote> {
  const request = buildQuoteRequest(params);
  configureOneClickClient();
  const quoteFn =
    deps.quoteFn ?? ((req: QuoteRequest) => OneClickService.getQuote(req));

  let response: QuoteResponse;
  try {
    response = await quoteFn(request);
  } catch (err) {
    throw new AuroraQuoteError(
      "ERR_AURORA_QUOTE_UNAVAILABLE",
      `Aurora cross-chain solver quote failed: ${err instanceof Error ? err.message : String(err)}`,
      502,
    );
  }

  return persistQuote(params, request, response);
}

let tokenCache: { fetchedAt: number; tokens: TokenResponse[] } | null = null;
const TOKEN_CACHE_MS = 300_000;

export async function getSupportedCrossChainTokens(): Promise<TokenResponse[]> {
  if (tokenCache && Date.now() - tokenCache.fetchedAt < TOKEN_CACHE_MS) {
    return tokenCache.tokens;
  }
  configureOneClickClient();
  const tokens = await OneClickService.getTokens();
  tokenCache = { fetchedAt: Date.now(), tokens };
  return tokens;
}
