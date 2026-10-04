import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import Image from "next/image";

export function baseOptions(): BaseLayoutProps {
  return {
    githubUrl: "https://github.com/demigohu/paraape",
    links: [
      {
        type: "icon",
        url: "https://paraape.xyz",
        text: "App",
        label: "Open the app",
        external: true,
        on: "menu",
        icon: (
          <Image
            src="/paraape_logo.png"
            alt=""
            width={24}
            height={24}
            className="size-6 object-contain"
          />
        ),
      },
      {
        type: "icon",
        url: "https://x.com/paraape_xyz",
        text: "Twitter",
        label: "Twitter",
        external: true,
        on: "menu",
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
          </svg>
        ),
      },
    ],
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
