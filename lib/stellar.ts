// Irion ⟶ Stellar/Soroban integration (replaces the old lib/sui.ts).
// Single source of truth for network config, deployed contract ids, and the
// build → simulate → assemble → sign → send invocation helpers.
import * as StellarSdk from "@stellar/stellar-sdk";

export const NETWORK = (process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet") as
  | "testnet"
  | "mainnet";

export const STELLAR = {
  testnet: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    horizonUrl: "https://horizon-testnet.stellar.org",
    networkPassphrase: StellarSdk.Networks.TESTNET,
    explorer: "https://stellar.expert/explorer/testnet",
  },
  mainnet: {
    rpcUrl: process.env.NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL || "https://soroban.stellar.org",
    horizonUrl: "https://horizon.stellar.org",
    networkPassphrase: StellarSdk.Networks.PUBLIC,
    explorer: "https://stellar.expert/explorer/public",
  },
}[NETWORK];

// Deployed on Stellar testnet (see irion-contracts-stellar/deployments.testnet.json).
export const CONTRACTS = {
  irionCore:
    process.env.NEXT_PUBLIC_IRION_CORE_ID ||
    "CANPO5IPMZ44TJSSXKUI44JQJDKCXMCCHVEUE4ULWQ6XKBWU642X7W4R",
  usdc:
    process.env.NEXT_PUBLIC_USDC_ID ||
    "CA76PS5S6NRZRKPFU7GIOXPBMLI6WCXCMBH5XLCN423IIPGZS7TKCDNO",
};

export const USDC_DECIMALS = 7;
export const toUnits = (usdc: number) => BigInt(Math.round(usdc * 10 ** USDC_DECIMALS));
export const fromUnits = (units: bigint | string | number) =>
  Number(BigInt(units)) / 10 ** USDC_DECIMALS;

export const rpc = new StellarSdk.rpc.Server(STELLAR.rpcUrl);
export const explorerTx = (hash: string) => `${STELLAR.explorer}/tx/${hash}`;
export const explorerAccount = (addr: string) => `${STELLAR.explorer}/account/${addr}`;
export const explorerContract = (id: string) => `${STELLAR.explorer}/contract/${id}`;

// A valid (funded) account only used as the source for read-only simulations.
const READ_SOURCE = "GBKZC3N4UVFZ54CAM7I26NWIDQLQJVPPUVDNLDBAS5PC3BAUA3GYOYXR";

// ScVal builders for the Irion contract ABI.
export const sv = {
  addr: (a: string) => StellarSdk.Address.fromString(a).toScVal(),
  i128: (n: bigint | number) => StellarSdk.nativeToScVal(BigInt(n), { type: "i128" }),
  u64: (n: bigint | number) => StellarSdk.nativeToScVal(BigInt(n), { type: "u64" }),
  u32: (n: number) => StellarSdk.nativeToScVal(n, { type: "u32" }),
  bytes: (hexOrBuf: string | Uint8Array) =>
    StellarSdk.nativeToScVal(
      typeof hexOrBuf === "string"
        ? Buffer.from(hexOrBuf.replace(/^0x/, ""), "hex")
        : Buffer.from(hexOrBuf),
      { type: "bytes" }
    ),
};

export type SignFn = (xdr: string) => Promise<string>;

/** Read-only: simulate a contract call and decode the native return value. */
export async function simulateRead(
  contractId: string,
  method: string,
  args: StellarSdk.xdr.ScVal[] = []
) {
  const source = new StellarSdk.Account(READ_SOURCE, "0");
  const contract = new StellarSdk.Contract(contractId);
  const tx = new StellarSdk.TransactionBuilder(source, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: STELLAR.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(sim)) throw new Error(`Simulation failed: ${sim.error}`);
  const retval = sim.result?.retval;
  return retval ? StellarSdk.scValToNative(retval) : null;
}

/** Write: build → simulate → assemble → sign (wallet) → send → poll. */
export async function invoke(
  publicKey: string,
  contractId: string,
  method: string,
  args: StellarSdk.xdr.ScVal[],
  sign: SignFn
): Promise<{ hash: string; returnValue: unknown }> {
  const account = await rpc.getAccount(publicKey);
  const contract = new StellarSdk.Contract(contractId);

  let tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: STELLAR.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(180)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(sim)) throw new Error(`Simulation failed: ${sim.error}`);
  tx = StellarSdk.rpc.assembleTransaction(tx, sim).build();

  const signedXdr = await sign(tx.toXDR());
  const signedTx = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    STELLAR.networkPassphrase
  ) as StellarSdk.Transaction;

  const sent = await rpc.sendTransaction(signedTx);
  if (sent.status === "ERROR") throw new Error(`Send failed: ${JSON.stringify(sent.errorResult)}`);

  let got = await rpc.getTransaction(sent.hash);
  for (let i = 0; got.status === "NOT_FOUND" && i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    got = await rpc.getTransaction(sent.hash);
  }
  if (got.status !== "SUCCESS") throw new Error(`Transaction ${sent.hash} failed: ${got.status}`);
  return {
    hash: sent.hash,
    returnValue: got.returnValue ? StellarSdk.scValToNative(got.returnValue) : null,
  };
}
