"use server";

import { z } from "zod";
import { assertWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import { requireUser, run, str } from "./helpers";

/*
 * Aprovação do produto novo (dono, 17/11/2026; docs/NEW_PRODUCT.md): aprovar
 * ou recusar (o administrador ou um superior de quem pediu) e reenviar o
 * recusado depois de corrigido. As regras ficam no serviço
 * (src/lib/services/product-approval.ts); aqui, a leitura do formulário.
 */

const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export async function decideProductApprovalAction(form: FormData) {
  const user = await requireUser();
  const productId = idSchema.parse(str(form, "productId"));
  const back = `/app/products/${productId}#approval`;
  await run(back, async () => {
    assertWellmix(user);
    assertScreen(user, "products");
    const input = z
      .object({
        decision: z.enum(["approve", "reject"]),
        note: z.string().max(1000).nullable(),
      })
      .parse({
        decision: str(form, "decision"),
        note: str(form, "note") || null,
      });
    const { decideProductApproval } =
      await import("@/lib/services/product-approval");
    const approve = input.decision === "approve";
    await decideProductApproval(user, productId, {
      approve,
      note: input.note,
    });
    return `/app/products/${productId}?approval=${approve ? "approved" : "rejected"}`;
  });
}

export async function resubmitProductApprovalAction(form: FormData) {
  const user = await requireUser();
  const productId = idSchema.parse(str(form, "productId"));
  await run(`/app/products/${productId}#approval`, async () => {
    assertWellmix(user);
    assertScreen(user, "products");
    const { resubmitProductApproval } =
      await import("@/lib/services/product-approval");
    await resubmitProductApproval(user, productId);
    return `/app/products/${productId}?approval=resubmitted#approval`;
  });
}
