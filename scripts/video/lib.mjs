/* Utilidades comuns da produção dos vídeos: servidor estático do palco e navegador. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

export const ROOT = fileURLToPath(new URL(".", import.meta.url));
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

/** Serve scripts/video (palco em /film/, fontes em /node_modules/) e a marca do portal em /brand/. */
export function serve() {
  const server = createServer(async (req, res) => {
    try {
      const path = normalize(
        decodeURIComponent(new URL(req.url, "http://x").pathname),
      );
      // A marca vem do próprio portal (public/brand), sem cópia aqui.
      const body = await readFile(
        path.startsWith("/brand/")
          ? join(ROOT, "../../public", path)
          : join(ROOT, path),
      );
      res.writeHead(200, {
        "content-type": TYPES[extname(path)] ?? "application/octet-stream",
      });
      res.end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve({ server, port: server.address().port }),
    ),
  );
}

/** Abre o palco de um vídeo e idioma e espera fontes e imagens. */
export async function openFilm(browser, port, video, lang) {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  page.on("pageerror", (e) => {
    console.error("erro na página:", e.message);
    process.exitCode = 1;
  });
  page.on(
    "console",
    (m) => m.type() === "error" && console.error("console:", m.text()),
  );
  await page.goto(
    `http://127.0.0.1:${port}/film/index.html?video=${video}&lang=${lang}`,
  );
  await page.waitForFunction(() => window.FILM?.ready, null, {
    timeout: 120_000,
  });
  const film = await page.evaluate(() => window.FILM);
  return { page, film };
}

/** `extra`: argumentos a mais do Chromium (ex.: --lang=pt-BR nas capturas). */
export const launch = (extra = []) =>
  chromium.launch({
    executablePath: process.env.PW_CHROMIUM || undefined,
    args: [
      ...extra,
      "--force-color-profile=srgb",
      "--font-render-hinting=none",
      "--disable-lcd-text",
    ],
  });
