import nacl from "tweetnacl";

export interface ReceiptPayload {
  sessionId: string;
  correlationId: string;
  chargedMicroUsdc: number;
  remainingMicroUsdc: number;
  timestamp: number;
}

export interface SignedUsageReceipt extends ReceiptPayload {
  version: "refract-receipt-v1";
  publicKey: string;
  signature: string;
}

export const RECEIPT_VERSION = "refract-receipt-v1";

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(value, "base64"));
  }
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

let cachedKeyPair: nacl.SignKeyPair | undefined;

function signingKeyPair(): nacl.SignKeyPair {
  if (cachedKeyPair) return cachedKeyPair;
  const configured = process.env.ZKAPI_SCHNORR_SIGNING_PRIVATE_KEY_HEX;
  if (configured && /^(0x)?[0-9a-fA-F]{64}$/.test(configured)) {
    cachedKeyPair = nacl.sign.keyPair.fromSeed(hexToBytes(configured));
    return cachedKeyPair;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "ZKAPI_SCHNORR_SIGNING_PRIVATE_KEY_HEX is required in production",
    );
  }
  // Deterministic dev/test key so receipts are verifiable locally.
  const seed = nacl
    .hash(new TextEncoder().encode("refract-dev-receipt-key"))
    .slice(0, 32);
  cachedKeyPair = nacl.sign.keyPair.fromSeed(seed);
  return cachedKeyPair;
}

export function receiptPublicKeyHex(): string {
  return bytesToHex(signingKeyPair().publicKey);
}

function canonicalMessage(payload: ReceiptPayload): Uint8Array {
  const message = [
    RECEIPT_VERSION,
    payload.sessionId,
    payload.correlationId,
    payload.chargedMicroUsdc.toString(),
    payload.remainingMicroUsdc.toString(),
    payload.timestamp.toString(),
  ].join("|");
  return new TextEncoder().encode(message);
}

export function signUsageReceipt(payload: ReceiptPayload): SignedUsageReceipt {
  const keyPair = signingKeyPair();
  const signature = nacl.sign.detached(
    canonicalMessage(payload),
    keyPair.secretKey,
  );
  return {
    version: RECEIPT_VERSION,
    ...payload,
    publicKey: bytesToHex(keyPair.publicKey),
    signature: bytesToHex(signature),
  };
}

export function encodeReceiptHeader(receipt: SignedUsageReceipt): string {
  return toBase64(new TextEncoder().encode(JSON.stringify(receipt)));
}

export function decodeReceiptHeader(header: string): SignedUsageReceipt {
  const parsed = JSON.parse(
    new TextDecoder().decode(fromBase64(header)),
  ) as SignedUsageReceipt;
  if (parsed.version !== RECEIPT_VERSION) {
    throw new Error(`Unsupported receipt version: ${parsed.version}`);
  }
  return parsed;
}

/** Verify a receipt header cryptographically (Double-Blind Inspector). */
export function verifySchnorrUsageReceipt(
  receiptHeader: string,
  publicKeyHex?: string,
): boolean {
  try {
    const receipt = decodeReceiptHeader(receiptHeader);
    if (!receipt.signature || !receipt.publicKey) return false;
    return nacl.sign.detached.verify(
      canonicalMessage(receipt),
      hexToBytes(receipt.signature),
      hexToBytes(publicKeyHex ?? receipt.publicKey),
    );
  } catch {
    return false;
  }
}
