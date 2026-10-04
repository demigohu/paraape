import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import Image from "next/image";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="inline-flex items-center gap-2 text-[13px] uppercase tracking-[0.08em]">
          <Image
            src="/paraape_logo.png"
            alt=""
            width={28}
            height={28}
            className="size-7 shrink-0"
            priority
          />
          Paraape
        </span>
      ),
    },
  };
}
