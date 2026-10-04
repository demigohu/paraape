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
        body="Back one token with USDG. Pick the drop you will pay. A milder tier can also cover a deeper policy."
      />
      <Suspense>
        <UnderwriteForm />
      </Suspense>
    </div>
  );
}
