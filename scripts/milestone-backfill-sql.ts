/*
 * SQL revisado da migração dos marcos (fase 5b, docs/MILESTONES.md "Fase 5"):
 * IMPRIME (não roda) um UPDATE que preenche `requirements.step` e
 * `requirements.milestoneKey` dos itens que ainda não têm, pelo de-para
 * (chave da etapa, chave-base do item) → (passo, marco) que o portal usa
 * (`requirementFlowFields`, src/lib/milestones.ts). Para rodar pela
 * ferramenta do Supabase quando for mais rápido que a migração pela tela
 * (~613 mil itens). Os marcos do pedido (`order_milestones`) e o marco atual
 * (`orders.milestoneKey`) continuam pela tela: dependem das subtarefas.
 *
 * Uso: node scripts/milestone-backfill-sql.ts > marcos-itens.sql
 */
import { register } from "node:module";
import { resolve as resolvePath } from "node:path";
import { pathToFileURL } from "node:url";

// "@/..." e imports sem extensão de src/ (o Next resolve; o node não).
const src = pathToFileURL(
  resolvePath(import.meta.dirname, "..", "src") + "/",
).href;
register(
  "data:text/javascript," +
    encodeURIComponent(`
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const SRC = ${JSON.stringify(src)};
export async function resolve(spec, ctx, next) {
  let base = null;
  if (spec.startsWith("@/")) base = new URL(spec.slice(2), SRC).href;
  else if ((spec.startsWith("./") || spec.startsWith("../")) && ctx.parentURL?.startsWith(SRC) && !/\\.[cm]?[jt]s$/.test(spec))
    base = new URL(spec, ctx.parentURL).href;
  if (base)
    for (const end of [".ts", ".tsx", "/index.ts"])
      if (existsSync(fileURLToPath(base + end))) return next(base + end, ctx);
  return next(spec, ctx);
}`),
);

const { STAGE_KEYS } = await import("../src/lib/db/schema.ts");
const { REQUIREMENT_STEP_KEYS } = await import("../src/lib/flow.ts");
const { requirementFlowFields } = await import("../src/lib/milestones.ts");
const { LANE_SEPARATOR } = await import("../src/lib/purchase-lanes.ts");

const lit = (v: string | null) =>
  v === null ? "null" : `'${v.replace(/'/g, "''")}'`;

// Chave que não existe: o item vai pelo passo e pelo marco da etapa.
const NO_KEY = "\u0000sem-chave";
const defaults = STAGE_KEYS.map((stage) => {
  const f = requirementFlowFields(stage, NO_KEY);
  return `(${lit(stage)}, ${lit(f.step)}, ${lit(f.milestoneKey)})`;
});
const specific: string[] = [];
for (const stage of STAGE_KEYS)
  for (const base of REQUIREMENT_STEP_KEYS) {
    const f = requirementFlowFields(stage, base);
    specific.push(
      `(${lit(stage)}, ${lit(base)}, ${lit(f.step)}, ${lit(f.milestoneKey)})`,
    );
  }

console.log(`-- Gerado por scripts/milestone-backfill-sql.ts (fase 5b, docs/MILESTONES.md).
-- Preenche requirements.step e requirements.milestoneKey só onde os dois estão vazios.
-- Revisar antes de rodar. Não mexe em held nem em nenhuma outra coluna; rodar de novo não muda nada.
with by_key (stage_key, base_key, step, milestone) as (
  values
    ${specific.join(",\n    ")}
),
by_stage (stage_key, step, milestone) as (
  values
    ${defaults.join(",\n    ")}
),
target as (
  select r."id",
         case when k.stage_key is not null then k.step else s.step end as step,
         case when k.stage_key is not null then k.milestone else s.milestone end as milestone
  from public."requirements" r
  join public."stages" st on st."id" = r."stageId"
  left join by_key k
    on k.stage_key = st."key"
   and k.base_key = split_part(r."key", ${lit(LANE_SEPARATOR)}, 1)
  left join by_stage s on s.stage_key = st."key"
  where r."step" is null and r."milestoneKey" is null
)
update public."requirements" r
   set "step" = t.step, "milestoneKey" = t.milestone, "updatedAt" = now()
  from target t
 where r."id" = t."id"
   and (t.step is not null or t.milestone is not null);`);
