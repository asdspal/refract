import {
  computeCommitment,
  computeNullifierHash,
  poseidonHash,
  toHex32,
  type Field,
} from "./merkleTree";

export const NOTE_VERSION = "refract-zkapi-note-v1";
const DB_NAME = "refract_notes_v1";
const STORE_NAME = "notes";

// Domain separator for the deterministic session key derivation.
const SESSION_KEY_DOMAIN = BigInt("0x73657373696f6e5f6b6579"); // "session_key"

export interface LocalZkNote {
  version: typeof NOTE_VERSION;
  commitmentHex: string;
  nullifierHex: string;
  trapdoorHex: string;
  amountMicroUsdc: string;
  nullifierHashHex: string;
  sessionPubkeyHashHex: string;
  createdAt: string;
  backedUp: boolean;
}

export interface EncryptedNote {
  version: typeof NOTE_VERSION;
  commitmentHex: string;
  iv: string;
  ciphertext: string;
}

function randomField(): Field {
  const bytes = new Uint8Array(31);
  globalThis.crypto.getRandomValues(bytes);
  return BigInt("0x" + Buffer.from(bytes).toString("hex"));
}

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error("WebCrypto subtle is unavailable");
  return c.subtle;
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

/** Generate a local bearer note; secrets never leave this function's caller. */
export async function generateLocalZkNote(
  amountMicroUsdc: bigint,
): Promise<LocalZkNote> {
  if (amountMicroUsdc <= 0n) throw new Error("amountMicroUsdc must be positive");
  const nullifier = randomField();
  const trapdoor = randomField();
  const commitment = await computeCommitment(nullifier, trapdoor, amountMicroUsdc);
  const nullifierHash = await computeNullifierHash(nullifier);
  const sessionPubkeyHash = await poseidonHash([nullifier, SESSION_KEY_DOMAIN]);

  return {
    version: NOTE_VERSION,
    commitmentHex: toHex32(commitment),
    nullifierHex: toHex32(nullifier),
    trapdoorHex: toHex32(trapdoor),
    amountMicroUsdc: amountMicroUsdc.toString(),
    nullifierHashHex: toHex32(nullifierHash),
    sessionPubkeyHashHex: toHex32(sessionPubkeyHash),
    createdAt: new Date().toISOString(),
    backedUp: false,
  };
}

async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const material = await subtle().digest(
    "SHA-256",
    new TextEncoder().encode(passphrase),
  );
  return subtle().importKey("raw", material, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptNote(
  note: LocalZkNote,
  passphrase: string,
): Promise<EncryptedNote> {
  const key = await deriveKey(passphrase);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await subtle().encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(note)),
  );
  return {
    version: NOTE_VERSION,
    commitmentHex: note.commitmentHex,
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptNote(
  encrypted: EncryptedNote,
  passphrase: string,
): Promise<LocalZkNote> {
  const key = await deriveKey(passphrase);
  const plaintext = await subtle().decrypt(
    { name: "AES-GCM", iv: fromBase64(encrypted.iv) },
    key,
    fromBase64(encrypted.ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as LocalZkNote;
}

const memoryStore = new Map<string, EncryptedNote>();

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveNoteEncrypted(
  note: LocalZkNote,
  passphrase: string,
): Promise<EncryptedNote> {
  const encrypted = await encryptNote(note, passphrase);
  if (typeof indexedDB === "undefined") {
    memoryStore.set(note.commitmentHex, encrypted);
    return encrypted;
  }
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(encrypted, note.commitmentHex);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return encrypted;
}

export async function loadEncryptedNote(
  commitmentHex: string,
): Promise<EncryptedNote | null> {
  if (typeof indexedDB === "undefined") {
    return memoryStore.get(commitmentHex) ?? null;
  }
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(commitmentHex);
    req.onsuccess = () => resolve((req.result as EncryptedNote) ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** Serialize the bearer note for a .json backup (contains the secrets!). */
export function exportNoteBackupJson(note: LocalZkNote): string {
  const backup: LocalZkNote = { ...note, backedUp: true };
  return JSON.stringify(backup, null, 2);
}

export function importNoteBackupJson(jsonString: string): LocalZkNote {
  const parsed = JSON.parse(jsonString) as LocalZkNote;
  if (parsed.version !== NOTE_VERSION) {
    throw new Error(`Unsupported note version: ${parsed.version}`);
  }
  for (const key of [
    "commitmentHex",
    "nullifierHex",
    "trapdoorHex",
    "nullifierHashHex",
    "sessionPubkeyHashHex",
    "amountMicroUsdc",
  ] as const) {
    if (typeof parsed[key] !== "string" || parsed[key].length === 0) {
      throw new Error(`Note backup is missing ${key}`);
    }
  }
  return { ...parsed, backedUp: true };
}

/** Trigger a browser download of the note backup; no-op outside the browser. */
export function downloadNoteBackup(note: LocalZkNote): void {
  const json = exportNoteBackupJson(note);
  if (
    typeof document === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    return;
  }
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `refract-note-${note.commitmentHex.slice(2, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
