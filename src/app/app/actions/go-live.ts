"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertRole } from "@/lib/auth/permissions";
import type { GoLiveStep } from "@/lib/services/go-live";
import { requireUser } from "./helpers";

const BACK = "/app/settings/go-live";

/** Cada rodada bem abaixo dos 5 minutos da página (como os resumos). */
const STEP_BUDGET_MS = 45_000;

/** O administrador confirma que a situação real já veio do Sankhya. */
const startSchema = z.object({ confirm: z.literal("on") });

async function auditDone(
  user: Awaited<ReturnType<typeof requireUser>>,
  result: GoLiveStep,
) {
  if (result.state !== "done") return;
  const { audit } = await import("@/lib/services/audit");
  await audit(
    user,
    "sankhya.go_live",
    "settings",
    "sankhyaHistoryHold",
    "Go-live: etapas e pendências do histórico do Sankhya liberadas",
  );
}

/**
 * Go-live (docs/SANKHYA.md, "Histórico em espera"): liga a liberação das
 * etapas e pendências em espera e faz a primeira rodada. Terminou: volta
 * com `ran=1`; senão a tela segue com as rodadas (`continueGoLiveAction`).
 * Só o administrador, com a confirmação marcada.
 */
export async function startGoLiveAction(form: FormData) {
  const user = await requireUser();
  assertRole(user, ["admin"]);
  if (!startSchema.safeParse({ confirm: form.get("confirm") }).success)
    redirect(`${BACK}?error=confirm`);
  let target: string;
  try {
    const { releaseHistoryStep, goLiveStatus } =
      await import("@/lib/services/go-live");
    const before = await goLiveStatus();
    const { audit } = await import("@/lib/services/audit");
    await audit(
      user,
      "sankhya.go_live.start",
      "settings",
      "sankhyaHistoryHold",
      `Go-live iniciado: ${before.stages} etapas e ${before.requirements} pendências em espera`,
    );
    const result = await releaseHistoryStep({
      budgetMs: STEP_BUDGET_MS,
      userId: user.id,
    });
    await auditDone(user, result);
    target = result.state === "done" ? `${BACK}?ran=1` : BACK;
  } catch (error) {
    console.error("[go-live]", error);
    target = `${BACK}?error=${encodeURIComponent(
      String((error as Error).message ?? error).slice(0, 300),
    )}`;
  }
  redirect(target);
}

/** Uma rodada da liberação em andamento, chamada pela tela até terminar. */
export async function continueGoLiveAction(): Promise<
  GoLiveStep | { state: "error"; detail: string }
> {
  const user = await requireUser();
  assertRole(user, ["admin"]);
  try {
    const { releaseHistoryStep, historyHoldActive } =
      await import("@/lib/services/go-live");
    // Só continua uma liberação começada pelo botão.
    if (await historyHoldActive())
      return { state: "error", detail: "not-started" };
    const result = await releaseHistoryStep({
      budgetMs: STEP_BUDGET_MS,
      userId: user.id,
    });
    await auditDone(user, result);
    return result;
  } catch (error) {
    console.error("[go-live]", error);
    return {
      state: "error",
      detail: String((error as Error).message ?? error).slice(0, 300),
    };
  }
}
