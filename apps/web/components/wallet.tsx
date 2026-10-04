"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CaretDown, Copy, Drop, SignOut, Wallet } from "@phosphor-icons/react";
import { modal } from "@reown/appkit/react";
import { useAccount, useDisconnect, usePublicClient, useWriteContract } from "wagmi";
import type { Address } from "viem";
import { demoMintAbi } from "@/lib/abi";
import { robinhoodTestnet } from "@/lib/chains";
import { FRESH_ADDRESS, PAPE_ADDRESS, USDG_ADDRESS } from "@/lib/env";
import { shortAddress } from "@/lib/protocol";
import { useToast } from "@/components/app/toaster";

/** One click. pUSDG covers several premiums or a small deposit. Each meme bag is about 100 USDG at the demo pool, not enough to move the 1B LP. */
const FAUCET = [
  { symbol: "pUSDG", address: USDG_ADDRESS, amount: 10_000n * 1_000_000n, label: "10,000" },
  { symbol: "PAPE", address: PAPE_ADDRESS, amount: 10_000_000n * 10n ** 18n, label: "10,000,000" },
  { symbol: "FRESH", address: FRESH_ADDRESS, amount: 10_000_000n * 10n ** 18n, label: "10,000,000" },
] as const;

function openConnectModal() {
  modal?.open();
}

/** Compatibility shim for pages that expect the demo wallet API. */
export function useWallet() {
  const { address, isConnected, isConnecting } = useAccount();
  const { disconnect } = useDisconnect();

  return {
    address: address ?? null,
    status: isConnecting
      ? ("connecting" as const)
      : isConnected
        ? ("connected" as const)
        : ("idle" as const),
    connect: openConnectModal,
    disconnect: () => disconnect(),
  };
}

export function ConnectButton({ className = "" }: { className?: string }) {
  const { address, isConnected, isConnecting, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending: minting } = useWriteContract();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (isConnected && address) {
    const copyAddress = async () => {
      try {
        await navigator.clipboard.writeText(address);
        push({ title: "Address copied", tone: "ok" });
      } catch {
        push({ title: "Could not copy the address", tone: "danger" });
      }
      setOpen(false);
    };

    const disconnectWallet = () => {
      disconnect();
      setOpen(false);
      push({ title: "Wallet disconnected" });
    };

    const faucet = async (token: Address, amount: bigint, symbol: string, label: string) => {
      if (!publicClient) return;
      if (chainId !== robinhoodTestnet.id) {
        push({ title: "Switch to Robinhood testnet", tone: "danger" });
        return;
      }
      if (token === "0x") {
        push({ title: `${symbol} address is not set`, tone: "danger" });
        return;
      }
      setOpen(false);
      try {
        push({ title: `Minting ${label} ${symbol}` });
        const hash = await writeContractAsync({
          address: token,
          abi: demoMintAbi,
          functionName: "mint",
          args: [address, amount],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        push({ title: `${label} ${symbol} received`, tone: "ok" });
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 140) : "Mint failed";
        push({ title: `Could not mint ${symbol}`, body: message, tone: "danger" });
      }
    };

    return (
      <div ref={rootRef} className={`relative ${className}`}>
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-controls={menuId}
          onClick={() => setOpen((value) => !value)}
          className="btn btn-ghost w-full"
        >
          <Wallet size={16} weight="bold" aria-hidden />
          {shortAddress(address)}
          <CaretDown size={14} weight="bold" aria-hidden className={open ? "rotate-180" : ""} />
        </button>
        {open && (
          <div
            id={menuId}
            role="menu"
            aria-label="Wallet"
            className="absolute right-0 z-50 mt-2 min-w-[15.5rem] border border-line-strong bg-surface"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => void copyAddress()}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-surface-raised focus-visible:bg-surface-raised"
            >
              <Copy size={16} weight="bold" aria-hidden />
              Copy address
            </button>
            {FAUCET.map((token) => (
              <button
                key={token.symbol}
                type="button"
                role="menuitem"
                disabled={minting}
                onClick={() => void faucet(token.address, token.amount, token.symbol, token.label)}
                className="flex w-full items-center gap-2 border-t border-line px-4 py-3 text-left text-sm hover:bg-surface-raised focus-visible:bg-surface-raised disabled:opacity-45"
              >
                <Drop size={16} weight="bold" aria-hidden />
                {token.label} {token.symbol}
              </button>
            ))}
            <button
              type="button"
              role="menuitem"
              onClick={disconnectWallet}
              className="flex w-full items-center gap-2 border-t border-line px-4 py-3 text-left text-sm hover:bg-surface-raised focus-visible:bg-surface-raised"
            >
              <SignOut size={16} weight="bold" aria-hidden />
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={openConnectModal}
      disabled={isConnecting}
      aria-busy={isConnecting}
      className={`btn btn-inverse ${className}`}
    >
      <Wallet size={16} weight="bold" aria-hidden />
      {isConnecting ? "Connecting" : "Connect wallet"}
    </button>
  );
}
