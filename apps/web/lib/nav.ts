export const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.paraape.xyz";

type NavItem = {
  href: string;
  label: string;
  external?: boolean;
};

export const NAV: readonly NavItem[] = [
  { href: "/protect", label: "Protect" },
  { href: "/underwrite", label: "Underwrite" },
  { href: "/dashboard", label: "Dashboard" },
  { href: DOCS_URL, label: "Docs", external: true },
];
