"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertRole } from "@/lib/auth/permissions";
import type {
  MigrationStats,
  ParityStats,
  SliceState,
} from "@/lib/services/order-milestones";
import { requireUser } from "./helpers";

const BACK = "/app/settings/summaries";

/** Tempo de cada rodada pela tela (como a reconstrução dos resumos). */
const STEP_BUDGET_MS = 45_000;

const JobSchema = z.enum(["migrate", "parity"]);
type Job = z.infer<typeof JobSchema>;

type StepResult =
  | SliceState<MigrationStats>
  | SliceState<ParityStats>
  | { state: "error"; detail: string };

async function step(job: Job, start: boolean) {
  const m = await import("@/lib/services/order-milestones");
  return job === "migrate"
    ? m.migrateMilestonesStep({ budgetMs: STEP_BUDGET_MS, start })
    : m.milestoneParityStep({ budgetMs: STEP_BUDGET_MS, start });
}

async function auditDone(
  user: Awaited<ReturnType<typeof requireUser>>,
  job: Job,
  result: StepResult,
) {
  if (result.state !== "done") return;
  const { audit } = await import("@/lib/services/audit");
  await audit(
    user,
    job === "migrate" ? "milestones.migrate" : "milestones.parity",
    "settings",
    "orderMilestones",
    `${result.marker.orders} pedidos, ${JSON.stringify(result.marker.stats)}, ${result.marker.ms} ms`,
  );
}

/**
 * Fase 5b (docs/MILESTONES.md, "Fase 5"): começa (ou continua) a migração
 * para os marcos (`job=migrate`) ou a conferência (`job=parity`) e faz a
 * primeira rodada; a tela segue com as rodadas seguintes. Só o administrador.
 */
export async function startMilestoneJobAction(form: FormData) {
  const user = await requireUser();
  assertRole(user, ["admin"]);
  const job = JobSchema.safeParse(form.get("job"));
  if (!job.success) redirect(`${BACK}?error=invalid_input#milestones`);
  let target: string;
  try {
    const result = await step(job.data, true);
    await auditDone(user, job.data, result);
    target =
      result.state === "done"
        ? `${BACK}?milestones=${job.data}#milestones`
        : `${BACK}#milestones`;
  } catch (error) {
    console.error("[milestones] migração", error);
    target = `${BACK}?error=${encodeURIComponent(
      String((error as Error).message ?? error).slice(0, 300),
    )}#milestones`;
  }
  redirect(target);
}

async function continueJob(job: Job): Promise<StepResult> {
  const user = await requireUser();
  assertRole(user, ["admin"]);
  try {
    const result = await step(job, false);
    await auditDone(user, job, result);
    return result;
  } catch (error) {
    console.error("[milestones] migração", error);
    return {
      state: "error",
      detail: String((error as Error).message ?? error).slice(0, 300),
    };
  }
}

/** Uma rodada da migração em andamento (a tela chama até terminar). Só admin. */
export async function continueMilestoneMigrationAction() {
  return continueJob("migrate");
}

/** Uma rodada da conferência em andamento (a tela chama até terminar). Só admin. */
export async function continueMilestoneParityAction() {
  return continueJob("parity");
}
