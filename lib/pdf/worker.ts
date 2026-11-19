/// <reference lib="webworker" />
import * as core from "./engine-core";

/** Runs engine-core operations off the main thread; see engine.ts. */
type Msg = { id: number; op: keyof typeof core; args: unknown[] };

function buffers(value: unknown, out: ArrayBuffer[] = []): ArrayBuffer[] {
  if (value instanceof Uint8Array) {
    if (value.buffer instanceof ArrayBuffer && !out.includes(value.buffer)) out.push(value.buffer);
  } else if (Array.isArray(value)) value.forEach((v) => buffers(v, out));
  return out;
}

self.onmessage = async (e: MessageEvent<Msg>) => {
  const { id, op, args } = e.data;
  try {
    const fn = core[op] as (...a: unknown[]) => Promise<unknown>;
    // Only merge reports progress; other operations have optional trailing parameters.
    const extra = op === "merge" ? [(n: number) => self.postMessage({ id, progress: n })] : [];
    const result = await fn(...args, ...extra);
    self.postMessage({ id, result }, buffers(result));
  } catch (err) {
    const error = err as Error;
    self.postMessage({ id, error: { name: error?.name ?? "Error", message: String(error?.message ?? err) } });
  }
};
