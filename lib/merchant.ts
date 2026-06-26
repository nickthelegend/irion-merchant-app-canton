// Irion merchant client (replaces the old lib/escrow.ts Sui builders).
//
// On Irion there is no per-merchant escrow object to deploy: settlement and
// escrow live inside the IrionCore contract, keyed by the merchant's own
// Stellar address. A shopper settling a bill calls `open_purchase` (which pays
// the merchant up front into their escrow balance); the merchant later calls
// `merchant_withdraw(merchant)` to sweep `escrow_of(merchant)` to their wallet.
//
// Every write takes the caller address + a `sign` function from useStellarWallet().
import {
  CONTRACTS,
  fromUnits,
  invoke,
  simulateRead,
  sv,
  toUnits,
  type SignFn,
} from "./stellar";

const CORE = CONTRACTS.irionCore;

/** On-chain `Config` returned by IrionCore::get_config (addresses as strkeys). */
export type IrionConfig = {
  usdc: string;
  blend_pool: string;
  usdc_reserve_index: number;
  verifier: string;
  treasury: string;
  borrow_interest_bps: number;
};

export const merchant = {
  // ---------------------------------------------------------------- writes ---

  /**
   * Withdraw the calling merchant's full settled escrow balance to their wallet.
   * Maps to IrionCore::merchant_withdraw(merchant). Returns the swept amount.
   */
  merchantWithdraw: (merchantAddr: string, sign: SignFn) =>
    invoke(merchantAddr, CORE, "merchant_withdraw", [sv.addr(merchantAddr)], sign),

  /**
   * Shopper settlement against a bill: open a BNPL purchase that pays `amountUsdc`
   * up front into the merchant's escrow. `collateralUsdc` must be >= the amount
   * (the contract locks it from the buyer); `termLedgers` is the repayment term.
   * Maps to IrionCore::open_purchase(buyer, merchant, amount, collateral, term)
   * and returns the new loan id.
   */
  settlePayment: (
    buyerAddr: string,
    merchantAddr: string,
    amountUsdc: number,
    collateralUsdc: number,
    termLedgers: number,
    sign: SignFn
  ) =>
    invoke(
      buyerAddr,
      CORE,
      "open_purchase",
      [
        sv.addr(buyerAddr),
        sv.addr(merchantAddr),
        sv.i128(toUnits(amountUsdc)),
        sv.i128(toUnits(collateralUsdc)),
        sv.u32(termLedgers),
      ],
      sign
    ),

  // ----------------------------------------------------------------- reads ---

  /** Raw settled escrow balance owed to a merchant, in USDC base units (i128). */
  escrowOf: (merchantAddr: string) =>
    simulateRead(CORE, "escrow_of", [sv.addr(merchantAddr)]) as Promise<bigint>,

  /** Convenience: settled escrow balance owed to a merchant, in human USDC. */
  escrowBalance: async (merchantAddr: string): Promise<number> => {
    const raw = (await simulateRead(CORE, "escrow_of", [sv.addr(merchantAddr)])) as
      | bigint
      | null;
    return raw == null ? 0 : fromUnits(raw);
  },

  /** Read the IrionCore protocol config (settlement asset, treasury, etc.). */
  getConfig: () => simulateRead(CORE, "get_config") as Promise<IrionConfig>,
};
