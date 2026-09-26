import type { Metadata } from "next";
import { Suspense } from "react";
import { PageIntro } from "@/components/app/ui";
import { UnderwriteForm } from "./underwrite-form";

export const metadata: Metadata = { title: "Underwrite | Paraape" };

export default function UnderwritePage() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-12 md:px-8 md:py-16">
      <PageIntro
        title="Underwrite"
        body="Deposit USDG into one token's isolated vault. You choose how deep and how fast a crash must be before your capital pays out."
      />
      <Suspense>
        <UnderwriteForm />
      </Suspense>
    </div>
  );
}
