// Sui configuration for the XORR merchant checkout app (migrated from EVM/Sepolia).
// Set these in .env.local after publishing the merchant_escrow Move package to testnet:
//   NEXT_PUBLIC_SUI_NETWORK=testnet
//   NEXT_PUBLIC_MERCHANT_ESCROW_PACKAGE_ID=0x...   (published Move package id)

export type SuiNetwork = "testnet" | "mainnet" | "devnet" | "localnet";

export const SUI_NETWORK: SuiNetwork =
  (process.env.NEXT_PUBLIC_SUI_NETWORK as SuiNetwork) ?? "testnet";

// Hardcoded fullnode RPC URLs (the @mysten/sui 2.19 `getFullnodeUrl` helper was
// removed; these endpoints are stable and version-proof).
export const SUI_RPC_URLS: Record<SuiNetwork, string> = {
  testnet: "https://fullnode.testnet.sui.io:443",
  mainnet: "https://fullnode.mainnet.sui.io:443",
  devnet: "https://fullnode.devnet.sui.io:443",
  localnet: "http://127.0.0.1:9000",
};

/** Published Move package id that holds the `merchant_escrow` + `usdt` modules.
 *  Defaults to the published v2 package (override via env). */
export const MERCHANT_ESCROW_PACKAGE_ID =
  process.env.NEXT_PUBLIC_MERCHANT_ESCROW_PACKAGE_ID ??
  "0xa105190b2218938815920010957f7adf856940452e304a63e195e132f14713b9";

/** Settlement coin type — `usdc::USDC` lives in the same published package. */
export const USDT_COIN_TYPE = `${MERCHANT_ESCROW_PACKAGE_ID}::usdc::USDC`;

// USDT/USDC are both 6-decimal in this demo. Kept as USDC_DECIMALS for the
// existing UI copy; USDT settlement uses the same scale.
export const USDC_DECIMALS = 6;
export const USDT_DECIMALS = 6;

export const suiscanTxUrl = (digest: string) =>
  `https://suiscan.xyz/${SUI_NETWORK}/tx/${digest}`;

export const suiscanAddressUrl = (address: string) =>
  `https://suiscan.xyz/${SUI_NETWORK}/account/${address}`;
