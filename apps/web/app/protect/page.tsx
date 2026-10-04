import type { Metadata } from "next";
import { Suspense } from "react";
import { PageIntro } from "@/components/app/ui";
import { ProtectForm } from "./protect-form";

export const metadata: Metadata = { title: "Protect | Paraape" };

export default function ProtectPage() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-12 md:px-8 md:py-16">
      <PageIntro
        title="Protect"
        body="Cover tokens you hold. Pick the drop, the term, and the payout, then pay in USDG."
      />
      <Suspense fallback={<p className="text-sm text-fg-muted">Loading…</p>}>
        <ProtectForm />
      </Suspense>
    </div>
  );
}
