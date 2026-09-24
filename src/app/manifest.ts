import type { MetadataRoute } from "next";

/** Permite "Adicionar à tela de início" no celular e tablet com ícone e cor da Wellmix. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Portal Wellmix",
    short_name: "Wellmix",
    description: "Importação do pedido à entrega: cliente, fornecedor e parceiros.",
    start_url: "/app",
    display: "standalone",
    background_color: "#f5f5f6",
    theme_color: "#bf2026",
    lang: "pt-BR",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/brand/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
