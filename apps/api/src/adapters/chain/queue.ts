import { logger } from "../../lib/logger";
import { CHAIN_RETRY_DELAYS_MS } from "../../config/constants";
import { executeChainOp, type ChainOp } from "./chain.service";

interface QueueItem {
  op: ChainOp;
  attempts: number;
  nextAttemptAt: number;
  onSuccess: (txHash: string) => Promise<void> | void;
  onFailure: (error: unknown) => Promise<void> | void;
}

const queue: QueueItem[] = [];
let draining = false;

export function enqueueChainOp(
  op: ChainOp,
  onSuccess: (txHash: string) => Promise<void> | void,
  onFailure: (error: unknown) => Promise<void> | void = () => {},
) {
  queue.push({ op, attempts: 0, nextAttemptAt: Date.now(), onSuccess, onFailure });
}

export async function processChainQueue() {
  if (draining) return;
  draining = true;
  try {
    const now = Date.now();
    const ready = queue.filter((item) => item.nextAttemptAt <= now);
    for (const item of ready) {
      const idx = queue.indexOf(item);
      if (idx >= 0) queue.splice(idx, 1);

      try {
        const txHash = await executeChainOp(item.op);
        await item.onSuccess(txHash);
      } catch (error) {
        item.attempts += 1;
        if (item.attempts <= CHAIN_RETRY_DELAYS_MS.length) {
          item.nextAttemptAt = Date.now() + CHAIN_RETRY_DELAYS_MS[item.attempts - 1];
          queue.push(item);
          logger.warn("Chain op failed, will retry", { op: item.op.op, attempt: item.attempts });
        } else {
          logger.error("Chain op exhausted retries", { op: item.op.op, error: String(error) });
          await item.onFailure(error);
        }
      }
    }
  } finally {
    draining = false;
  }
}

export function chainQueueDepth() {
  return queue.length;
}
