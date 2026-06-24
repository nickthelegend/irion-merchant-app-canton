"use client";

import { useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { toast } from "sonner";
import type { Transaction } from "@mysten/sui/transactions";
import { suiscanTxUrl } from "./sui";

// Structural subset of the tx response we read (the 2.19 SDK doesn't export a
// stable response type name).
export type TxResult = {
  digest: string;
  objectChanges?: Array<{ type: string; objectType?: string; objectId?: string }>;
};

/**
 * useTx — one hook for every on-chain interaction. Signs + executes a
 * Transaction via the connected Sui wallet, shows a loading → success/error
 * sonner toast, and on success renders a CLICKABLE toast that opens the tx on
 * Suiscan. Returns the full response (with objectChanges) so callers can read
 * created object ids.
 */
export function useTx() {
  const { mutateAsync } = useSignAndExecuteTransaction();
  const client = useSuiClient();

  return async function runTx(label: string, tx: Transaction): Promise<TxResult> {
    const toastId = toast.loading(`${label}…`, { description: "Confirm in your wallet" });
    try {
      const res = await mutateAsync({ transaction: tx });
      const full = await client.waitForTransaction({
        digest: res.digest,
        options: { showObjectChanges: true, showEffects: true },
      });
      const url = suiscanTxUrl(res.digest);
      const short = `${res.digest.slice(0, 10)}…${res.digest.slice(-6)}`;

      // Dismiss the loader, then render a fully-clickable success card → Suiscan.
      toast.dismiss(toastId);
      toast.custom(
        (t) => (
          <div
            onClick={() => { window.open(url, "_blank", "noopener,noreferrer"); toast.dismiss(t); }}
            className="cursor-pointer select-none w-[340px] rounded-xl border border-primary/30 bg-[#0d0f14] px-4 py-3 shadow-2xl hover:border-primary/60 transition-colors font-mono"
            role="button"
            title="Open on Suiscan"
          >
            <div className="flex items-center gap-2 text-primary text-[12px] font-black uppercase tracking-widest">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" /> {label} confirmed
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-foreground/50">
              <span className="truncate">tx {short}</span>
              <span className="text-primary/70 font-bold">View on Suiscan ↗</span>
            </div>
          </div>
        ),
        { duration: 9000 },
      );
      return full;
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      toast.error(`${label} failed`, { id: toastId, description: text.slice(0, 140) });
      throw e;
    }
  };
}

/** Find the first created object whose type contains `frag` (e.g. "::merchant_escrow::MerchantCap"). */
export function findCreated(res: TxResult, frag: string): string | null {
  const c = (res.objectChanges || []).find(
    (ch) => ch.type === "created" && (ch.objectType || "").includes(frag),
  );
  return c && "objectId" in c ? c.objectId : null;
}
