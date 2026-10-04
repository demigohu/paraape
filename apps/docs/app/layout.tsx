import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./global.css";

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://docs.paraape.xyz"),
  title: {
    default: "Paraape Docs",
    template: "%s | Paraape Docs",
  },
  description:
    "Cover for the memecoin you hold. If it falls as far as you named, you get paid in USDG.",
  icons: { icon: "/paraape_logo.png" },
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={geistMono.variable} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col antialiased">
        <RootProvider
          theme={{
            defaultTheme: "light",
            enableSystem: false,
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
