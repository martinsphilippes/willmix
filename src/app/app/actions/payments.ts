"use server";

import { z } from "zod";
import { submitDownPaymentProof } from "@/lib/services/down-payment";
import { files, requireUser, run, str } from "./helpers";

/*
 * Sinal da solicitação: o cliente paga (Pix copia e cola ou QR Code) e anexa o
 * comprovante aqui. A Wellmix confere e confirma (confirmDownPaymentAction).
 */
export async function submitDownPaymentProofAction(form: FormData) {
  const user = await requireUser();
  const requestId = str(form, "requestId").slice(0, 64);
  const back = `/app/requests/${encodeURIComponent(requestId)}`;
  await run(back, async () => {
    z.string()
      .regex(/^[A-Za-z0-9_-]{1,64}$/)
      .parse(requestId);
    const [proof] = files(form, "proof");
    if (!proof) throw new Error("proof_required");
    await submitDownPaymentProof(user, requestId, proof);
    return `${back}?proofSent=1#proposal`;
  });
}
