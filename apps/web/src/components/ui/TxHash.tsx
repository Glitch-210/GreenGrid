import { explorerTxUrl, isOnChainHash, shortHash } from "../../lib/chain";

/**
 * Renders a blockchain tx hash — as a link to the Amoy explorer when it is a
 * real on-chain hash, as plain text when it is a simulated `0xsim…` placeholder.
 */
export function TxHash({ hash, className = "" }: { hash: string | null | undefined; className?: string }) {
  if (!hash) return null;

  const base = `font-mono text-xs ${className}`;

  if (!isOnChainHash(hash)) {
    return <span className={`${base} text-on-surface-variant`}>{shortHash(hash)} (simulated)</span>;
  }

  return (
    <a
      href={explorerTxUrl(hash)}
      target="_blank"
      rel="noreferrer"
      className={`${base} font-bold underline decoration-2 underline-offset-2 hover:bg-solar`}
      title={hash}
    >
      {shortHash(hash)} ↗
    </a>
  );
}
