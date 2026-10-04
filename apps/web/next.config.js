/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep wallet connector graphs out of the RSC bundle (Reown / wagmi).
  serverExternalPackages: [
    "@reown/appkit-adapter-wagmi",
    "@wagmi/connectors",
    "@coinbase/cdp-sdk",
    "@base-org/account",
  ],
  async rewrites() {
    const target = process.env.INDEXER_PROXY_URL?.trim().replace(/\/$/, "") ?? "";
    const loopback = /^(https?:\/\/)?(127\.0\.0\.1|localhost)(:|\/|$)/.test(target);
    if (!/^https?:\/\//.test(target) || (process.env.NODE_ENV === "production" && loopback)) {
      return [];
    }
    return [
      {
        source: "/api/indexer/:path*",
        destination: `${target}/:path*`,
      },
    ];
  },
};

export default nextConfig;
