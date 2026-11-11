/*
 * Service worker do Portal Wellmix (PWA).
 *
 * O que faz: guarda só o que é público e não muda (arquivos do aplicativo em
 * /_next/static, ícones e a tela "sem conexão") e mostra a tela "sem conexão"
 * quando uma página não abre por falta de rede.
 *
 * O que NÃO faz: nunca guarda páginas, respostas de API ou arquivos do
 * portal. Tudo que tem dado de pedido, cliente ou fornecedor vem sempre do
 * servidor, com a sessão conferida.
 */
const VERSION = "wellmix-pwa-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [
  OFFLINE_URL,
  "/brand/icon-192.png",
  "/brand/icon-512.png",
  "/brand/wellmix-logo-white.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Arquivos públicos e imutáveis (nome com hash) ou da marca. */
function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/brand/")
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Abrir uma página: sempre do servidor; sem rede, a tela "sem conexão".
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((page) => page || Response.error()),
      ),
    );
    return;
  }

  // Arquivos do aplicativo: do aparelho quando já baixados, senão da rede.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(VERSION).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
  // O resto (API, arquivos do portal, dados): direto na rede, sem guardar.
});
