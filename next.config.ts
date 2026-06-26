import type { NextConfig } from "next";

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          // No credentials → `*` origin is valid (browsers reject `*` + credentials).
          // The apps authenticate via the x-wallet-address / x-client-* headers and
          // postMessage, not cross-origin cookies. This allows the irion
          // subdomains (app/merchants/shop/docs) + localhost to call the API.
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-wallet-address" },
        ],
      },
    ];
  },
};

export default nextConfig;

