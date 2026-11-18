"use server";

import { z } from "zod";
import { run, str } from "./helpers";

/*
 * Resposta do cliente ao link de confirmação de atendimento (dono,
 * 18/11/2026; docs/TRADE_COMERCIAL.md): sem login. Quem abre o link confirma
 * o atendimento ou diz que não aconteceu (com o motivo). O link é assinado
 * pelo servidor e vale uma vez; a regra fica em src/lib/services/portfolio.ts.
 */

const tokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{8,64}\.[A-Za-z0-9_-]{32}$/);

export async function answerAttendanceAction(form: FormData) {
  const raw = str(form, "token");
  const token = tokenSchema.safeParse(raw).success ? raw : "invalido";
  const back = `/atendimento/${encodeURIComponent(token)}`;
  await run(back, async () => {
    const input = z
      .object({
        answer: z.enum(["confirm", "dispute"]),
        name: z.string().max(160),
        note: z.string().max(2000).nullable(),
      })
      .parse({
        answer: str(form, "answer"),
        name: str(form, "name"),
        note: str(form, "note") || null,
      });
    const { answerAttendance } = await import("@/lib/services/portfolio");
    await answerAttendance(token, input);
    return `${back}?done=${input.answer === "confirm" ? "confirmed" : "disputed"}`;
  });
}
