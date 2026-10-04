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
    const target = process.env.INDEXER_PROXY_URL ?? "http://127.0.0.1:42069";
    return [
      {
        source: "/api/indexer/:path*",
        destination: `${target}/:path*`,
      },
    ];
  },
};

export default nextConfig;
