import type { NextConfig } from "next";

/** Endereço principal do portal. O antigo (willmix.vercel.app) redireciona para cá. */
const PRIMARY_HOST = "portal-wellmix.vercel.app";

const nextConfig: NextConfig = {
  // Fotos e planilhas chegam pelas Server Actions; o padrão (1 MB) não basta.
  // Na Vercel o corpo da requisição tem teto próprio (~4,5 MB): o PhotoInput
  // comprime as fotos no aparelho antes de enviar.
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
    ...(process.env.E2E_TURBO_EVICT === "full"
      ? { turbopackMemoryEviction: "full" as const }
      : {}),
  },
  async headers() {
    return [
      {
        // Service worker do PWA: o navegador sempre confere a versão nova.
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
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
