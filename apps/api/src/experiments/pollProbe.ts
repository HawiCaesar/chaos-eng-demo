import { probeDatabase } from "../db/probe.js";
import { getPool } from "../db/pool.js";

export const POLL_INTERVAL_MS = 2_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const pollUntil = async (
  predicate: (probe: Awaited<ReturnType<typeof probeDatabase>>) => boolean,
  timeoutMs: number,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const probe = await probeDatabase(getPool());
    if (predicate(probe)) {
      return;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`Timed out after ${timeoutMs}ms waiting for primary database probe`);
};
