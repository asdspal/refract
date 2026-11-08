import { createHash } from "node:crypto";

export const DEPOSIT_EVENT_DISCRIMINATOR = createHash("sha256")
  .update("event:DepositCommitted")
  .digest()
  .subarray(0, 8);

export interface DepositEvent {
  leafIndex: number;
  commitment: string;
  newRoot: string;
  amountMicroUsdc: bigint;
}

/**
 * Decode an Anchor `DepositCommitted` event from a "Program data: <base64>"
 * log line. Returns null for other logs.
 */
export function decodeDepositEventLog(log: string): DepositEvent | null {
  const prefix = "Program data: ";
  if (!log.startsWith(prefix)) return null;
  const raw = Buffer.from(log.slice(prefix.length), "base64");
  if (raw.length < 8) return null;
  if (!raw.subarray(0, 8).equals(DEPOSIT_EVENT_DISCRIMINATOR)) return null;

  let offset = 8;
  const leafIndex = raw.readUInt32LE(offset);
  offset += 4;
  const commitment = "0x" + raw.subarray(offset, offset + 32).toString("hex");
  offset += 32;
  const newRoot = "0x" + raw.subarray(offset, offset + 32).toString("hex");
  offset += 32;
  const amountMicroUsdc = raw.readBigUInt64LE(offset);
  return { leafIndex, commitment, newRoot, amountMicroUsdc };
}

export function decodeDepositEvents(logs: string[]): DepositEvent[] {
  const events: DepositEvent[] = [];
  for (const log of logs) {
    const event = decodeDepositEventLog(log);
    if (event) events.push(event);
  }
  return events;
}
