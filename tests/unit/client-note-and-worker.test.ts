import { beforeAll, describe, expect, it } from "vitest";
import { resolve } from "node:path";
import {
  decryptNote,
  exportNoteBackupJson,
  generateLocalZkNote,
  importNoteBackupJson,
  loadEncryptedNote,
  saveNoteEncrypted,
  type LocalZkNote,
} from "../../src/lib/zkapi/clientNoteVault";
import { proveNoteSpend } from "../../src/lib/zkapi/proverClient";
import {
  buildMerkleTree,
  toHex32,
} from "../../src/lib/zkapi/merkleTree";

const root = resolve(__dirname, "../..");
const wasmPath = resolve(root, "public/circuits/refract_note_spend.wasm");
const zkeyPath = resolve(root, "public/circuits/refract_note_spend_final.zkey");
const NOTE_AMOUNT = 10_000_000n;

describe("client zkAPI note vault", () => {
  let note: LocalZkNote;

  beforeAll(async () => {
    note = await generateLocalZkNote(NOTE_AMOUNT);
  });

  it("generates a local Poseidon note with deterministic session key hash", () => {
    expect(note.commitmentHex).toMatch(/^0x[0-9a-f]{64}$/);
    expect(note.nullifierHex).toMatch(/^0x[0-9a-f]{64}$/);
    expect(note.trapdoorHex).toMatch(/^0x[0-9a-f]{64}$/);
    expect(note.nullifierHashHex).toMatch(/^0x[0-9a-f]{64}$/);
    expect(note.sessionPubkeyHashHex).toMatch(/^0x[0-9a-f]{64}$/);
    expect(note.amountMicroUsdc).toBe(NOTE_AMOUNT.toString());
    expect(note.nullifierHex).not.toBe(note.trapdoorHex);
    expect(note.backedUp).toBe(false);
  });

  it("encrypts, stores, and decrypts the note with AES-GCM-256", async () => {
    const passphrase = "correct horse battery staple";
    const encrypted = await saveNoteEncrypted(note, passphrase);
    expect(encrypted.ciphertext.length).toBeGreaterThan(0);
    expect(encrypted.ciphertext).not.toContain(note.nullifierHex.slice(2));

    const loaded = await loadEncryptedNote(note.commitmentHex);
    expect(loaded).not.toBeNull();
    const decrypted = await decryptNote(loaded!, passphrase);
    expect(decrypted.commitmentHex).toBe(note.commitmentHex);
    expect(decrypted.nullifierHex).toBe(note.nullifierHex);
    expect(decrypted.trapdoorHex).toBe(note.trapdoorHex);

    await expect(decryptNote(loaded!, "wrong passphrase")).rejects.toBeTruthy();
  });

  it("exports and imports a .json bearer backup", () => {
    const json = exportNoteBackupJson(note);
    expect(json).toContain("refract-zkapi-note-v1");
    const restored = importNoteBackupJson(json);
    expect(restored.commitmentHex).toBe(note.commitmentHex);
    expect(restored.nullifierHex).toBe(note.nullifierHex);
    expect(restored.trapdoorHex).toBe(note.trapdoorHex);
    expect(restored.backedUp).toBe(true);
    expect(() => importNoteBackupJson('{"version":"nope"}')).toThrow();
  });

  it(
    "proves note ownership in <= 2200ms with zero secret bytes in the API payload",
    async () => {
      const leavesHex = [note.commitmentHex];

      // Warm up the WASM/zkey so the measured run reflects steady state.
      await proveNoteSpend({
        note,
        leavesHex,
        leafIndex: 0,
        spendCapMicroUsdc: NOTE_AMOUNT,
        wasmPath,
        zkeyPath,
      });

      const result = await proveNoteSpend({
        note,
        leavesHex,
        leafIndex: 0,
        spendCapMicroUsdc: NOTE_AMOUNT,
        wasmPath,
        zkeyPath,
      });

      console.log(`client proof duration (node): ${result.durationMs.toFixed(0)}ms`);
      expect(result.durationMs).toBeLessThanOrEqual(2200);
      expect(result.proofHex).toMatch(/^0x[0-9a-f]{512}$/);
      expect(result.proofHex.length).toBe(514);
      expect(result.publicInputs).toHaveLength(4);
      expect(result.nullifierHashHex).toBe(note.nullifierHashHex);
      expect(result.sessionPubkeyHashHex).toBe(note.sessionPubkeyHashHex);

      const tree = await buildMerkleTree([BigInt(note.commitmentHex)]);
      expect(result.merkleRootHex).toBe(toHex32(tree.root));

      const apiPayload = JSON.stringify({
        proofHex: result.proofHex,
        merkleRootHex: result.merkleRootHex,
        nullifierHashHex: result.nullifierHashHex,
        spendCapMicroUsdc: result.spendCapMicroUsdc,
        sessionPubkeyHashHex: result.sessionPubkeyHashHex,
        publicInputs: result.publicInputs,
      }).toLowerCase();
      expect(apiPayload).not.toContain(note.nullifierHex.slice(2).toLowerCase());
      expect(apiPayload).not.toContain(note.trapdoorHex.slice(2).toLowerCase());
    },
    120_000,
  );
});
