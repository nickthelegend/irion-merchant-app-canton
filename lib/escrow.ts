// Merchant escrow transaction builders + readers, wired to the published
// `merchant_escrow` Move module (xorr_contracts package v2). Mirrors the
// dapp-kit idioms in xorr-core/lib/market.ts and bnpl.ts.
//
// Settlement coin is USDT (6 decimals): T = `${PKG}::usdt::USDT`.
import { Transaction } from "@mysten/sui/transactions";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { MERCHANT_ESCROW_PACKAGE_ID, USDT_DECIMALS } from "./sui";

const PKG = MERCHANT_ESCROW_PACKAGE_ID;
const T = `${PKG}::usdc::USDC`;
const SCALE = 10 ** USDT_DECIMALS;

/** Convert a human USDT amount to on-chain u64 base units. */
const u64 = (usdt: number) => BigInt(Math.floor(usdt * SCALE));

/** USDT coin type, for client.getCoins({ owner, coinType }). */
export const USDT_COIN_TYPE = T;

/** Fully-qualified `PaymentSettled` event type, for client.queryEvents. */
export const PAYMENT_SETTLED_EVENT = `${PKG}::merchant_escrow::PaymentSettled`;

/**
 * Create + share a `MerchantEscrow<USDT>` and transfer a `MerchantCap` to the
 * caller. The created shared escrow id and the cap id are read off
 * objectChanges by the caller (via findCreated).
 */
export function createEscrowTx(): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PKG}::merchant_escrow::create_escrow_entry`,
    typeArguments: [T],
    arguments: [],
  });
  return tx;
}

/**
 * Shopper settlement: split `amountUsdt` out of the buyer's primary USDT coin
 * and pay it into the merchant escrow, tagged with `orderId`.
 */
export function settlePaymentTx(
  escrowId: string,
  primaryCoinId: string,
  amountUsdt: number,
  orderId: string,
  sender: string,
): Transaction {
  const tx = new Transaction();
  tx.setSenderIfNotSet(sender);
  const [payment] = tx.splitCoins(tx.object(primaryCoinId), [tx.pure.u64(u64(amountUsdt))]);
  tx.moveCall({
    target: `${PKG}::merchant_escrow::settle_payment`,
    typeArguments: [T],
    arguments: [
      tx.object(escrowId),
      payment,
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(orderId))),
    ],
  });
  return tx;
}

/**
 * Merchant withdraws the full escrow balance using their `MerchantCap`. The
 * returned Coin<USDT> is transferred back to the merchant.
 */
export function withdrawTx(escrowId: string, capId: string, sender: string): Transaction {
  const tx = new Transaction();
  tx.setSenderIfNotSet(sender);
  const out = tx.moveCall({
    target: `${PKG}::merchant_escrow::withdraw`,
    typeArguments: [T],
    arguments: [tx.object(escrowId), tx.object(capId)],
  });
  tx.transferObjects([out], sender);
  return tx;
}

export type EscrowView = {
  /** Current withdrawable balance, in USDT. */
  balance: number;
  /** Lifetime settled total, in USDT. */
  totalSettled: number;
  /** Merchant address that owns the escrow. */
  merchant: string;
};

/**
 * Read a `MerchantEscrow<USDT>` object and return its fields in USDT units.
 * Returns null if the object is missing or not a Move object.
 */
export async function readEscrow(client: SuiJsonRpcClient, escrowId: string): Promise<EscrowView | null> {
  const obj = await client.getObject({ id: escrowId, options: { showContent: true } });
  const content = obj.data?.content;
  if (!content || content.dataType !== "moveObject") return null;
  const f = content.fields as Record<string, unknown>;
  // `balance` is a Balance<T>, which the JSON-RPC surfaces as a numeric string.
  const rawBalance = typeof f.balance === "string" ? f.balance : String(f.balance ?? "0");
  return {
    balance: Number(rawBalance) / SCALE,
    totalSettled: Number(f.total_settled ?? 0) / SCALE,
    merchant: String(f.merchant ?? ""),
  };
}
