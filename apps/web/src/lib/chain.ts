const EXPLORER_TX_BASE = "https://amoy.polygonscan.com/tx/";

/**
 * Simulated mode (CHAIN_MODE=simulated) hands back `0xsim…` placeholders that no
 * explorer can resolve. Only a real Amoy hash — 0x plus 64 hex — gets a link.
 */
export function isOnChainHash(hash: string | null | undefined): hash is string {
  return typeof hash === "string" && /^0x[0-9a-fA-F]{64}$/.test(hash);
}

export function explorerTxUrl(hash: string): string {
  return `${EXPLORER_TX_BASE}${hash}`;
}

export function shortHash(hash: string): string {
  return hash.length <= 18 ? hash : `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}
