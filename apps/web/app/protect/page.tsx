import type { Metadata } from "next";
import { PageIntro } from "@/components/app/ui";
import { ProtectForm } from "./protect-form";

export const metadata: Metadata = { title: "Protect | Paraape" };

export default function ProtectPage() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-12 md:px-8 md:py-16">
      <PageIntro
        title="Protect"
        body="Paste the memecoin's address, pick a trigger, pay the premium in USDG. If the trigger fires before expiry, the payout arrives on its own."
      />
      <ProtectForm />
    </div>
  );
}
