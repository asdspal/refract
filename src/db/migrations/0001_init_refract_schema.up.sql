-- Refract PostgreSQL 16 schema
-- 6 tables, 8 named indexes, seed data.
-- Unlinkability (SEC-04): NO foreign keys or join path between intent_deposits
-- and zk_runtime_sessions.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Merchants ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS x402_merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    solana_pubkey VARCHAR(64) NOT NULL UNIQUE,
    endpoint_pattern VARCHAR(255) NOT NULL UNIQUE,
    price_per_call_micro_usdc BIGINT NOT NULL CHECK (price_per_call_micro_usdc > 0),
    auto_compound_defi BOOLEAN NOT NULL DEFAULT TRUE,
    liquid_balance_micro_usdc BIGINT NOT NULL DEFAULT 0 CHECK (liquid_balance_micro_usdc >= 0),
    defi_staked_micro_usdc BIGINT NOT NULL DEFAULT 0 CHECK (defi_staked_micro_usdc >= 0),
    yield_earned_micro_usdc BIGINT NOT NULL DEFAULT 0 CHECK (yield_earned_micro_usdc >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Intent deposits ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS intent_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aurora_quote_id VARCHAR(128) NOT NULL UNIQUE,
    origin_chain VARCHAR(32) NOT NULL,
    origin_asset VARCHAR(128) NOT NULL,
    origin_amount_raw VARCHAR(64) NOT NULL,
    expected_solana_micro_usdc BIGINT NOT NULL CHECK (expected_solana_micro_usdc > 0),
    deposit_address VARCHAR(128) NOT NULL,
    refund_address VARCHAR(128),
    confidential_mode BOOLEAN NOT NULL DEFAULT TRUE,
    integrator_fee_bps SMALLINT NOT NULL DEFAULT 30 CHECK (integrator_fee_bps BETWEEN 0 AND 500),
    poseidon_commitment_hex CHAR(66) NOT NULL,
    origin_tx_hash VARCHAR(128),
    solana_settlement_sig VARCHAR(128),
    optimistic_credit_issued BOOLEAN NOT NULL DEFAULT FALSE,
    optimistic_credit_micro_usdc BIGINT NOT NULL DEFAULT 0 CHECK (optimistic_credit_micro_usdc >= 0),
    status VARCHAR(32) NOT NULL DEFAULT 'QUOTE_CREATED'
        CHECK (status IN ('QUOTE_CREATED','PENDING_DEPOSIT','OPTIMISTIC_CREDITED','SETTLED','FAILED','REFUNDED','EXPIRED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 3. Merkle leaves (public mirror of on-chain tree) --------------------------
CREATE TABLE IF NOT EXISTS merkle_leaves (
    leaf_index INTEGER PRIMARY KEY CHECK (leaf_index BETWEEN 0 AND 1048575),
    commitment_hex CHAR(66) NOT NULL UNIQUE,
    merkle_root_after_hex CHAR(66) NOT NULL,
    solana_tx_sig VARCHAR(128),
    inserted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Runtime sessions --------------------------------------------------------
CREATE TABLE IF NOT EXISTS zk_runtime_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nullifier_hash_hex CHAR(66) NOT NULL UNIQUE,
    merkle_root_used_hex CHAR(66) NOT NULL,
    solana_verify_tx_sig VARCHAR(128),
    runtime_key_hash CHAR(64) NOT NULL UNIQUE,
    principal_micro_usdc BIGINT NOT NULL CHECK (principal_micro_usdc > 0),
    yield_subsidy_micro_usdc BIGINT NOT NULL DEFAULT 0 CHECK (yield_subsidy_micro_usdc >= 0),
    remaining_micro_usdc BIGINT NOT NULL CHECK (remaining_micro_usdc >= 0),
    max_per_request_micro_usdc BIGINT NOT NULL DEFAULT 100000 CHECK (max_per_request_micro_usdc > 0),
    daily_cap_micro_usdc BIGINT NOT NULL DEFAULT 2000000 CHECK (daily_cap_micro_usdc > 0),
    spent_today_micro_usdc BIGINT NOT NULL DEFAULT 0 CHECK (spent_today_micro_usdc >= 0),
    is_optimistic BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE','EXHAUSTED','CLOSED_REFUNDED','REVOKED')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Usage receipts ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS x402_usage_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES zk_runtime_sessions(id) ON DELETE RESTRICT,
    merchant_id UUID NOT NULL REFERENCES x402_merchants(id) ON DELETE RESTRICT,
    request_correlation_id VARCHAR(128) NOT NULL UNIQUE,
    payment_scheme VARCHAR(32) NOT NULL,
    charged_micro_usdc BIGINT NOT NULL CHECK (charged_micro_usdc >= 0),
    cumulative_session_spend_micro_usdc BIGINT NOT NULL CHECK (cumulative_session_spend_micro_usdc >= 0),
    schnorr_signature_hex VARCHAR(140),
    upstream_http_status SMALLINT,
    refund_triggered BOOLEAN NOT NULL DEFAULT FALSE,
    aurora_refund_quote_id VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. DeFi vault snapshots ----------------------------------------------------
CREATE TABLE IF NOT EXISTS defi_vault_snapshots (
    id BIGSERIAL PRIMARY KEY,
    total_pool_micro_usdc BIGINT NOT NULL CHECK (total_pool_micro_usdc >= 0),
    kamino_staked_micro_usdc BIGINT NOT NULL CHECK (kamino_staked_micro_usdc >= 0),
    liquid_reserve_micro_usdc BIGINT NOT NULL CHECK (liquid_reserve_micro_usdc >= 0),
    optimistic_utilized_micro_usdc BIGINT NOT NULL DEFAULT 0 CHECK (optimistic_utilized_micro_usdc >= 0),
    current_apy_bps INTEGER NOT NULL DEFAULT 0,
    subsidy_bonus_bps INTEGER NOT NULL DEFAULT 0,
    solana_slot BIGINT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8 named indexes ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_intent_deposits_status_created
    ON intent_deposits (status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_intent_deposits_commitment
    ON intent_deposits (poseidon_commitment_hex);
CREATE INDEX IF NOT EXISTS idx_merkle_leaves_root
    ON merkle_leaves (merkle_root_after_hex);
CREATE INDEX IF NOT EXISTS idx_merkle_leaves_commitment
    ON merkle_leaves (commitment_hex);
CREATE INDEX IF NOT EXISTS idx_zk_runtime_sessions_key_active
    ON zk_runtime_sessions (runtime_key_hash, status) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_x402_receipts_session_created
    ON x402_usage_receipts (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_x402_receipts_merchant_created
    ON x402_usage_receipts (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_defi_snapshots_recorded
    ON defi_vault_snapshots (recorded_at DESC);

-- Seed data ------------------------------------------------------------------
INSERT INTO x402_merchants (name, solana_pubkey, endpoint_pattern, price_per_call_micro_usdc)
VALUES
    ('Refract AI Chat', 'RefractAiMerchant1111111111111111111111111', '/api/v1/ai/chat', 15000),
    ('Refract AI Auditor', 'RefractAiMerchant2222222222222222222222222', '/api/v1/ai/audit', 50000)
ON CONFLICT (endpoint_pattern) DO NOTHING;

INSERT INTO defi_vault_snapshots
    (total_pool_micro_usdc, kamino_staked_micro_usdc, liquid_reserve_micro_usdc,
     optimistic_utilized_micro_usdc, current_apy_bps, subsidy_bonus_bps, solana_slot)
SELECT 25000000, 22500000, 2500000, 0, 940, 840, 0
WHERE NOT EXISTS (SELECT 1 FROM defi_vault_snapshots);
