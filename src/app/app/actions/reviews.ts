"use server";

import { z } from "zod";
import { assertWellmix } from "@/lib/auth/permissions";
import { REVIEW_STATUSES } from "@/lib/db";
import { resolveReviewById } from "@/lib/services/reviews";
import { requireUser, run, str } from "./helpers";

/*
 * Fila "itens para revisão" (Wellmix): resolver ou dispensar um item, com
 * observação opcional. O serviço audita a decisão (quem, quando, nota).
 */

const decisionSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(["resolved", "dismissed"]),
  note: z.string().max(2000).nullable(),
  status: z.enum(REVIEW_STATUSES),
});

export async function decideReviewAction(form: FormData) {
  const user = await requireUser();
  const statusRaw = str(form, "status");
  const status = (REVIEW_STATUSES as readonly string[]).includes(statusRaw)
    ? statusRaw
    : "open";
  const back = `/app/reviews?status=${status}`;
  await run(back, async () => {
    assertWellmix(user);
    const parsed = decisionSchema.safeParse({
      id: str(form, "id"),
      decision: str(form, "decision"),
      note: str(form, "note") || null,
      status,
    });
    if (!parsed.success) throw new Error("invalid");
    await resolveReviewById(
      user,
      parsed.data.id,
      parsed.data.decision,
      parsed.data.note,
    );
  });
}
