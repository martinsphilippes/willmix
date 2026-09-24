import type { NextConfig } from "next";

/** Endereço principal do portal. O antigo (willmix.vercel.app) redireciona para cá. */
const PRIMARY_HOST = "portal-wellmix.vercel.app";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "willmix.vercel.app" }],
        destination: `https://${PRIMARY_HOST}/:path*`,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
