"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Wallet } from "@phosphor-icons/react";

type WalletState = {
  address: string | null;
  status: "idle" | "connecting" | "connected";
  connect: () => void;
  disconnect: () => void;
};

const WalletContext = createContext<WalletState | null>(null);

const DEMO_ADDRESS = "0x3e9Bc41f07A2d5c86e1F4a90b7D23c58E61a4f2D";

/** Demo wallet. Swap for wagmi/viem once contracts are deployed. */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<WalletState["status"]>("idle");

  const connect = useCallback(() => {
    setStatus("connecting");
    window.setTimeout(() => {
      setAddress(DEMO_ADDRESS);
      setStatus("connected");
    }, 700);
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setStatus("idle");
  }, []);

  const value = useMemo(
    () => ({ address, status, connect, disconnect }),
    [address, status, connect, disconnect],
  );

  return <WalletContext value={value}>{children}</WalletContext>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}

export function ConnectButton({ className = "" }: { className?: string }) {
  const { address, status, connect, disconnect } = useWallet();

  if (address) {
    return (
      <button
        type="button"
        onClick={disconnect}
        className={`btn btn-ghost ${className}`}
        aria-label={`Connected as ${address}. Disconnect wallet`}
      >
        <Wallet size={16} weight="bold" aria-hidden />
        {address.slice(0, 6)}...{address.slice(-4)}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={connect}
      disabled={status === "connecting"}
      aria-busy={status === "connecting"}
      className={`btn btn-inverse ${className}`}
    >
      <Wallet size={16} weight="bold" aria-hidden />
      {status === "connecting" ? "Connecting" : "Connect wallet"}
    </button>
  );
}
