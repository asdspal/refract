import { create } from "zustand";

export type TxState = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface NoteMeta {
  commitmentHex: string;
  nullifierHashHex: string;
  sessionPubkeyHashHex: string;
  amountMicroUsdc: string;
  backedUp: boolean;
}

export interface ReceiptInfo {
  header: string;
  correlationId: string;
  chargedMicroUsdc: number;
  remainingMicroUsdc: number;
  timestamp: number;
}

export interface InspectorData {
  originQuoteId: string | null;
  nullifierHashHex: string | null;
  receiptHeader: string | null;
  paymentRequiredHeader: string | null;
  walletBytesReceived: 0;
}

export interface RefractState {
  note: NoteMeta | null;
  runtimeKey: string | null;
  spendCapMicroUsdc: number;
  txState: TxState;
  lastReply: string | null;
  lastModel: string | null;
  lastReceipt: ReceiptInfo | null;
  inspector: InspectorData | null;
  setNote: (note: NoteMeta) => void;
  setRuntimeKey: (key: string) => void;
  setSpendCapMicroUsdc: (value: number) => void;
  setTxState: (state: TxState) => void;
  setLastReply: (reply: string, model: string) => void;
  setReceipt: (receipt: ReceiptInfo) => void;
  setInspector: (data: InspectorData) => void;
  hydrateFromStorage: () => void;
}

const RUNTIME_KEY_STORAGE = "refract_runtime_key";
const NOTE_META_STORAGE = "refract_note_meta";
const QUOTE_STORAGE = "refract_origin_quote_id";

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage failures (private mode)
  }
}

export const useRefractStore = create<RefractState>((set) => ({
  note: null,
  runtimeKey: null,
  spendCapMicroUsdc: 100_000,
  txState: 1,
  lastReply: null,
  lastModel: null,
  lastReceipt: null,
  inspector: null,
  setNote: (note) => {
    safeSet(NOTE_META_STORAGE, JSON.stringify(note));
    set({ note });
  },
  setRuntimeKey: (runtimeKey) => {
    safeSet(RUNTIME_KEY_STORAGE, runtimeKey);
    set({ runtimeKey });
  },
  setSpendCapMicroUsdc: (spendCapMicroUsdc) => set({ spendCapMicroUsdc }),
  setTxState: (txState) => set({ txState }),
  setLastReply: (lastReply, lastModel) => set({ lastReply, lastModel }),
  setReceipt: (lastReceipt) => set({ lastReceipt }),
  setInspector: (inspector) => set({ inspector }),
  hydrateFromStorage: () => {
    const key = safeGet(RUNTIME_KEY_STORAGE);
    const noteJson = safeGet(NOTE_META_STORAGE);
    let note: NoteMeta | null = null;
    if (noteJson) {
      try {
        note = JSON.parse(noteJson) as NoteMeta;
      } catch {
        note = null;
      }
    }
    set({ runtimeKey: key, note });
  },
}));

export function readOriginQuoteId(): string | null {
  return safeGet(QUOTE_STORAGE);
}

export function writeOriginQuoteId(id: string): void {
  safeSet(QUOTE_STORAGE, id);
}

export function readRuntimeKey(): string | null {
  return safeGet(RUNTIME_KEY_STORAGE);
}
