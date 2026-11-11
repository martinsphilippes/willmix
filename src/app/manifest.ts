import type { MetadataRoute } from "next";

/**
 * Aplicativo instalável (PWA): "Instalar" no Chrome/Edge (notebook, Galaxy) e
 * "Adicionar à Tela de Início" no Safari (iPhone, iPad, MacBook), com ícone e
 * cor da Wellmix, abrindo em janela própria, sem a barra do navegador.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "Portal Wellmix",
    short_name: "Wellmix",
    description:
      "Importação do pedido à entrega: cliente, fornecedor e parceiros.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#f5f5f6",
    theme_color: "#bf2026",
    lang: "pt-BR",
    categories: ["business", "productivity"],
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
    // Atalhos do ícone (toque longo no celular, clique direito no computador).
    shortcuts: [
      {
        name: "Minhas pendências",
        short_name: "Pendências",
        url: "/app/tasks",
        icons: [{ src: "/brand/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Pedidos",
        url: "/app/orders",
        icons: [{ src: "/brand/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Notificações",
        url: "/app/notifications",
        icons: [{ src: "/brand/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
