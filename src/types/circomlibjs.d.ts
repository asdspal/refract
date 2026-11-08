declare module "circomlibjs" {
  export function buildPoseidon(): Promise<{
    (inputs: bigint[]): Uint8Array;
    F: {
      toString(value: unknown, radix?: number): string;
      toObject(value: unknown): bigint;
    };
  }>;
}
