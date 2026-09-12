import crypto from "crypto";
import { ethers } from "ethers";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import abi from "./abi.json";

export type ChainOp =
  | { op: "mint"; creditId: string; qtyWh: string; owner: string }
  | { op: "transfer"; creditId: string; to: string; qtyWh: string }
  | { op: "retire"; creditId: string; qtyWh: string; ref: string };

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

/** Executes one chain op. Throws on failure so the queue can retry. */
export async function executeChainOp(chainOp: ChainOp): Promise<string> {
  const c = getContract();

  if (!c) {
    // simulated mode — plausible-looking hash, no real chain call
    await new Promise((r) => setTimeout(r, 300));
    return `0xsim${crypto.randomBytes(29).toString("hex")}`;
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
