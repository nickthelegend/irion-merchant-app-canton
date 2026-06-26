"use client";
// Stellar Wallets Kit provider + useStellarWallet() hook.
// Replaces @mysten/dapp-kit's useCurrentAccount / useDisconnectWallet.
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  FREIGHTER_ID,
} from "@creit.tech/stellar-wallets-kit";
import { STELLAR, NETWORK } from "./stellar";

// Construct the kit lazily and only in the browser. allowAllModules() probes
// each wallet's isAvailable(), which touches `window`; building it at module load
// would crash Next.js static prerendering (window is not defined on the server).
let _kit: StellarWalletsKit | null = null;
function getKit(): StellarWalletsKit {
  if (typeof window === "undefined") {
    throw new Error("Stellar wallet is only available in the browser");
  }
  if (!_kit) {
    _kit = new StellarWalletsKit({
      network: NETWORK === "mainnet" ? WalletNetwork.PUBLIC : WalletNetwork.TESTNET,
      selectedWalletId: FREIGHTER_ID,
      modules: allowAllModules(),
    });
  }
  return _kit;
}

type WalletCtx = {
  address: string | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  sign: (xdr: string) => Promise<string>;
};

const Ctx = createContext<WalletCtx | null>(null);

export function StellarWalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const kit = getKit();
      await kit.openModal({
        onWalletSelected: async (option) => {
          kit.setWallet(option.id);
          const { address } = await kit.getAddress();
          setAddress(address);
        },
      });
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => setAddress(null), []);

  const sign = useCallback(
    async (xdr: string) => {
      const { signedTxXdr } = await getKit().signTransaction(xdr, {
        networkPassphrase: STELLAR.networkPassphrase,
        address: address ?? undefined,
      });
      return signedTxXdr;
    },
    [address]
  );

  return (
    <Ctx.Provider
      value={{ address, connected: !!address, connecting, connect, disconnect, sign }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useStellarWallet() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStellarWallet must be used inside <StellarWalletProvider>");
  return c;
}
