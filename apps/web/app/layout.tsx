import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import localFont from "next/font/local";
import { Chrome } from "@/components/chrome";
import { Web3Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SmoothScroll } from "@/components/smooth-scroll";
import "./globals.css";

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://paraape.xyz"),
  title: "Paraape | Get rugged. Get paid.",
  description:
    "Hold the memecoin. Name the crash. If it falls that far, you get paid in USDG.",
  icons: { icon: "/paraape_logo.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistMono.variable} ${archivo.variable}`}>
      <body className="flex min-h-[100dvh] flex-col antialiased">
        <Web3Providers>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:bg-signal focus:px-4 focus:py-2 focus:text-fg"
          >
            Skip to content
          </a>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </Web3Providers>
        <SmoothScroll />
        <Chrome />
      </body>
    </html>
  );
}
