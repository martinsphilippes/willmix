"use server";

import { z } from "zod";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpenNewRequest } from "@/lib/auth/screens";
import {
  saveGroupShares,
  type EconomicGroup,
} from "@/lib/services/economic-groups";
import { requireUser } from "./helpers";

/*
 * Distribuição padrão do grupo econômico (dono, 18/11/2026;
 * docs/ECONOMIC_GROUPS.md): o modal ao lado do cliente na Nova solicitação
 * grava o percentual de cada empresa do grupo. Quem abre as telas de nova
 * solicitação da Wellmix.
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const INPUT = z.object({
  customerId: ID,
  shares: z.record(ID, z.number().min(0).max(100)),
});

export type SaveGroupSharesResult =
  | { ok: true; group: EconomicGroup }
  | { ok: false; error: "forbidden" | "invalid" | "total" | "not_group" };

export async function saveGroupSharesAction(
  input: unknown,
): Promise<SaveGroupSharesResult> {
  const user = await requireUser();
  if (!isWellmix(user) || !canOpenNewRequest(user))
    return { ok: false, error: "forbidden" };
  const parsed = INPUT.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    const group = await saveGroupShares(
      user,
      parsed.data.customerId,
      parsed.data.shares,
    );
    return { ok: true, group };
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    if (m === "percent_total") return { ok: false, error: "total" };
    if (m === "not_a_group") return { ok: false, error: "not_group" };
    return { ok: false, error: "invalid" };
  }
}
