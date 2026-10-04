export const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.paraape.xyz";

export const NAV = [
  { href: "/protect", label: "Protect" },
  { href: "/underwrite", label: "Underwrite" },
  { href: "/dashboard", label: "Dashboard" },
  { href: DOCS_URL, label: "Docs" },
] as const;
