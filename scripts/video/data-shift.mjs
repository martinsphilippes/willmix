/*
 * Leva as datas de uma base de demonstração para "hoje". As bases dos vídeos
 * foram criadas em um dia (as telas do vídeo completo são de 16/11/2026); dias
 * depois, os mesmos prazos apareceriam todos vencidos. Este script soma os
 * mesmos N dias a toda data e data-hora gravada (AAAA-MM-DD e ISO completo),
 * para o portal mostrar hoje o que mostrava no dia de referência: "vence em 4
 * dias" continua "vence em 4 dias".
 *   node data-shift.mjs <pasta da base> [--ref 2026-11-16]
 * Pare o portal antes (o modo memória lê db.json ao subir e regrava ao salvar).
 * Rodar de novo no mesmo dia não muda nada: a pasta guarda quantos dias já
 * foram somados (.shift.json) e só a diferença entra. Datas escritas dentro de
 * um texto ("20/10/2026" digitado em um passo) ficam como estão.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib.mjs";

const args = process.argv.slice(2);
const dirArg = args.find((a) => !a.startsWith("--"));
if (!dirArg) throw new Error("uso: node data-shift.mjs <pasta> [--ref data]");
const dir = join(ROOT, "../..", dirArg);
const ref = args.includes("--ref")
  ? args[args.indexOf("--ref") + 1]
  : "2026-11-16";

const DAY = 86_400_000;
/** Dia de hoje no Brasil (o portal conta os prazos pelo dia de São Paulo). */
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
}).format(new Date());
const want = Math.round((Date.parse(today) - Date.parse(ref)) / DAY);
const marker = join(dir, ".shift.json");
const done = existsSync(marker)
  ? JSON.parse(readFileSync(marker, "utf8")).days
  : 0;
const days = want - done;
if (!days) {
  console.log(`${dir}: já está em ${today} (${done} dias somados)`);
  process.exit(0);
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;
let n = 0;
const shift = (v) => {
  if (typeof v === "string") {
    if (DATE.test(v)) {
      n++;
      return new Date(Date.parse(v) + days * DAY).toISOString().slice(0, 10);
    }
    if (STAMP.test(v)) {
      const t = Date.parse(v);
      if (Number.isNaN(t)) return v;
      n++;
      const out = new Date(t + days * DAY).toISOString();
      // Mesmo formato do original (com ou sem milésimos, com ou sem "Z").
      return v.endsWith("Z")
        ? v.includes(".")
          ? out
          : out.replace(/\.\d+Z$/, "Z")
        : out.slice(0, v.length);
    }
    return v;
  }
  if (Array.isArray(v)) return v.map(shift);
  if (v && typeof v === "object") {
    for (const k of Object.keys(v)) v[k] = shift(v[k]);
    return v;
  }
  return v;
};
const file = join(dir, "db.json");
const db = shift(JSON.parse(readFileSync(file, "utf8")));
writeFileSync(file, JSON.stringify(db));
writeFileSync(marker, JSON.stringify({ ref, days: want, at: today }));
console.log(
  `${dir}: ${n} datas ${days > 0 ? "+" : ""}${days} dias (referência ${ref}, hoje ${today})`,
);
