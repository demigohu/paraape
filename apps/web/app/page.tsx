import { Flow } from "@/components/landing/flow";
import { Hero } from "@/components/landing/hero";
import { LandingShell } from "@/components/landing/landing-shell";
import { Roles } from "@/components/landing/roles";
import { Safeguards } from "@/components/landing/safeguards";
import { Statement } from "@/components/landing/statement";
import { TriggerChart } from "@/components/landing/trigger-chart";

export default function LandingPage() {
  return (
    <LandingShell>
      <Hero />
      <Statement />
      <TriggerChart />
      <Roles />
      <Flow />
      <Safeguards />
    </LandingShell>
  );
}
