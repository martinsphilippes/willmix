/*
 * Ícones dos vídeos: copia do pacote lucide-static só os que as cenas usam
 * para film/assets/icons.json (nome → miolo do SVG). Rodar: node icons.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

export const ICONS = [
  "lock",
  "check",
  "sparkles",
  "mail",
  "file-spreadsheet",
  "message-circle",
  "phone",
  "file-text",
  "paperclip",
  "store",
  "factory",
  "palette",
  "ship",
  "anchor",
  "truck",
  "scale",
  "badge-check",
  "landmark",
  "container",
  "shopping-cart",
  "users",
  "shield-check",
  "languages",
  "bell",
  "clipboard-check",
  "gauge",
  "smartphone",
  "history",
  "pen-tool",
  "camera",
  "video",
  "search-check",
  "package",
  "package-check",
  "calendar-check",
  "wallet",
  "receipt",
  "chart-column",
  "layout-dashboard",
  "list-checks",
  "globe",
  "route",
  "plane",
  "warehouse",
  "file-check",
  "file-signature",
  "megaphone",
  "boxes",
  "clock",
  "eye",
  "key-round",
  "database",
  "refresh-cw",
  "zap",
  "star",
  "map-pin",
  "building-2",
  "briefcase",
  "user-cog",
  "circle-dollar-sign",
  "image",
  "tag",
  "arrow-right",
  "messages-square",
  "inbox",
  "triangle-alert",
  "handshake",
  "target",
  "layers",
  "link",
];

const out = {};
for (const name of ICONS) {
  const svg = readFileSync(
    new URL(`./node_modules/lucide-static/icons/${name}.svg`, import.meta.url),
    "utf8",
  );
  out[name] = svg
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<svg[^>]*>/, "")
    .replace("</svg>", "")
    .replace(/\s+/g, " ")
    .trim();
}
// film/assets não é versionada (só tem arquivos gerados): cria na primeira vez.
mkdirSync(new URL("./film/assets/", import.meta.url), { recursive: true });
writeFileSync(
  new URL("./film/assets/icons.json", import.meta.url),
  JSON.stringify(out),
);
console.log("icons.json:", Object.keys(out).length, "ícones");
