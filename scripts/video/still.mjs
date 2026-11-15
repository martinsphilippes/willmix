/*
 * Quadros soltos para conferir o visual sem renderizar o vídeo:
 *   node still.mjs <vídeo> <idioma> <t1,t2,…>
 * Grava out/still/<vídeo>.<idioma>.<t>.jpg (t em segundos do filme, depois da vinheta).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ROOT, launch, openFilm, serve } from "./lib.mjs";

const [video = "short", lang = "pt", times = "0"] = process.argv.slice(2);
const { server, port } = await serve();
const browser = await launch();
const { page, film } = await openFilm(browser, port, video, lang);
await mkdir(join(ROOT, "out/still"), { recursive: true });
for (const t of times.split(",").map(Number)) {
  await page.evaluate((t) => window.seek(t), t);
  const buf = await page.screenshot({
    type: "jpeg",
    quality: 88,
    scale: "css",
  });
  const file = join(ROOT, `out/still/${video}.${lang}.${t.toFixed(2)}.jpg`);
  await writeFile(file, buf);
  console.log(file);
}
console.log("duração", film.duration);
await browser.close();
server.close();
