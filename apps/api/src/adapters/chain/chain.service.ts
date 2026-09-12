import crypto from "crypto";
import { ethers } from "ethers";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import abi from "./abi.json";

export type ChainOp =
  | { op: "mint"; creditId: string; qtyWh: string; owner: string }
  // `origin` carries what it would take to mint this credit — the seller's
  // pseudo-address and the credit's *full* quantity, not the traded slice. It is
  // used only for a credit the chain has never seen; see ensureMinted.
  | { op: "transfer"; creditId: string; to: string; qtyWh: string; origin?: CreditOrigin }
  | { op: "retire"; creditId: string; qtyWh: string; ref: string; origin?: CreditOrigin };

export interface CreditOrigin {
  owner: string;
  qtyWh: string;
}

function pseudoAddress(userId: string): string {
  const hash = crypto.createHash("sha256").update(userId).digest("hex");
  return `0x${hash.slice(0, 40)}`;
}

export { pseudoAddress };

let contract: ethers.Contract | null = null;

function getContract(): ethers.Contract | null {
  if (env.chainMode !== "live") return null;
  if (contract) return contract;
  if (!env.blockchainRpcUrl || !env.blockchainPrivateKey || !env.smartContractAddress) {
    logger.warn("CHAIN_MODE=live but missing RPC/key/address — falling back to simulated tx hashes");
    return null;
  }
  const provider = new ethers.JsonRpcProvider(env.blockchainRpcUrl);
  const wallet = new ethers.Wallet(env.blockchainPrivateKey, provider);
  contract = new ethers.Contract(env.smartContractAddress, abi, wallet);
  return contract;
}

/**
 * Credits seeded straight into Postgres (prisma/seed.ts) have never been minted
 * on-chain, so transferring or retiring one would revert with "unknown credit".
 * Mint it on first touch instead — cheaper than backfilling every seeded row
 * after each demo reset, and idempotent: a credit minted the normal way has a
 * non-zero `ts` and is left alone.
 */
async function ensureMinted(c: ethers.Contract, creditId: string, origin?: CreditOrigin) {
  const existing = await c.getCredit(creditId);
  if (existing.ts !== 0n) return;
  if (!origin) {
    logger.warn("Credit unknown on-chain and no origin to mint it from", { creditId });
    return;
  }
  logger.info("Lazily minting credit unknown to the chain", { creditId });
  const mintTx = await c.mintCredit(creditId, origin.qtyWh, origin.owner);
  await mintTx.wait();
}

/** Executes one chain op. Throws on failure so the queue can retry. */
export async function executeChainOp(chainOp: ChainOp): Promise<string> {
  const c = getContract();

  if (!c) {
    // simulated mode — plausible-looking hash, no real chain call
    await new Promise((r) => setTimeout(r, 300));
    return `0xsim${crypto.randomBytes(29).toString("hex")}`;
  }

  if (chainOp.op !== "mint") {
    await ensureMinted(c, chainOp.creditId, chainOp.origin);
  }

  let tx;
  if (chainOp.op === "mint") {
    tx = await c.mintCredit(chainOp.creditId, chainOp.qtyWh, chainOp.owner);
  } else if (chainOp.op === "transfer") {
    tx = await c.transferCredit(chainOp.creditId, chainOp.to, chainOp.qtyWh);
  } else {
    tx = await c.retireCredit(chainOp.creditId, chainOp.qtyWh, chainOp.ref);
  }
  const receipt = await tx.wait();
  return receipt.hash as string;
}
