import type { Metadata } from "next";
import { PageIntro } from "@/components/app/ui";
import { DashboardView } from "./dashboard-view";

export const metadata: Metadata = { title: "Dashboard | Paraape" };

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-12 md:px-8 md:py-16">
      <PageIntro
        title="Dashboard"
        body="Your policies, your underwriting positions and every market you can enter, in one place."
      />
      <DashboardView />
    </div>
  );
}
