import Image from "next/image";
import Link from "next/link";

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <Image
      src="/paraape_logo.png"
      alt=""
      width={size}
      height={size}
      className="shrink-0"
      loading="eager"
    />
  );
}

export function BrandLink() {
  return (
    <Link
      href="/"
      aria-label="Paraape home"
      className="flex items-center gap-3 text-xs uppercase tracking-[0.08em]"
    >
      <BrandMark />
      <span>paraape</span>
    </Link>
  );
}
