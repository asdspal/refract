/// <reference lib="webworker" />
import { groth16 } from "snarkjs";

interface ProveRequest {
  input: Record<string, unknown>;
  wasmPath: string;
  zkeyPath: string;
}

self.onmessage = async (event: MessageEvent<ProveRequest>) => {
  const { input, wasmPath, zkeyPath } = event.data;
  try {
    const { proof } = await groth16.fullProve(input, wasmPath, zkeyPath);
    self.postMessage({ proof });
  } catch (err) {
    self.postMessage({
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
