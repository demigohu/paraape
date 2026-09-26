import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import localFont from "next/font/local";
import { Chrome } from "@/components/chrome";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SmoothScroll } from "@/components/smooth-scroll";
import { WalletProvider } from "@/components/wallet";
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
  title: "Paraape | Rug-pull protection on Robinhood Chain",
  description:
    "Buy isolated, automatically-settled protection against rug-pull crashes. Underwrite it with USDG and earn the premiums.",
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
        <WalletProvider>
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
        </WalletProvider>
        <SmoothScroll />
        <Chrome />
      </body>
    </html>
  );
}
