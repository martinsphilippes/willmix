"use server";

import { z } from "zod";
import { isWellmix } from "@/lib/auth/permissions";
import { files, requireUser, run, str } from "./helpers";

/*
 * Tarifário de frete (planilha das companhias marítimas). O serviço confere o
 * papel (a companhia importa a própria planilha; a Wellmix importa em nome de
 * uma companhia ou a consolidada; só o admin muda o frete por m³ das
 * Configurações à mão); aqui, formato e limites.
 */

const BACK = "/app/freight/tariff";
const ID = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/);
const DAY = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) => new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v,
    "date",
  );
const DESTINATION = z.string().regex(/^[A-Z]{2,5}$/);
/** Nome de um bloco da planilha (a companhia diz qual é o dela). */
const BLOCK = z.string().trim().min(1).max(120);

/** Volta para o tarifário ou para o pedido de onde veio o botão. */
function backFrom(form: FormData) {
  const from = str(form, "from");
  return /^\/app\/orders\/[A-Za-z0-9_-]{1,64}$/.test(from) ? from : null;
}

export async function importFreightTariffAction(form: FormData) {
  const user = await requireUser();
  const from = backFrom(form);
  const back = from ? `${BACK}?from=${encodeURIComponent(from)}` : BACK;
  await run(back, async () => {
    const [file] = files(form, "file");
    if (!file) throw new Error("tariff_file_required");
    const raw = str(form, "referenceDate");
    let referenceDate: string | null = null;
    if (raw) {
      const parsed = DAY.safeParse(raw);
      if (!parsed.success) throw new Error("tariff_date_invalid");
      referenceDate = parsed.data;
    }
    // Wellmix escolhe de quem é a planilha (sem padrão: evita trocar a
    // consolidada pela tabela de uma companhia só); a companhia, nunca.
    let shippingLineId: string | null = null;
    if (isWellmix(user)) {
      const company = str(form, "shippingLineId");
      if (!company) throw new Error("tariff_company_required");
      shippingLineId = company === "consolidated" ? null : ID.parse(company);
    }
    // Bloco que é da companhia (quando nenhum tem o nome dela).
    const rawBlock = str(form, "block");
    const block = rawBlock ? BLOCK.parse(rawBlock) : null;
    const { importFreightTariff } =
      await import("@/lib/services/freight-tariff");
    const { TariffError } = await import("@/lib/services/freight-tariff-calc");
    let row;
    try {
      row = await importFreightTariff(
        user,
        file,
        referenceDate,
        shippingLineId,
        { block },
      );
    } catch (error) {
      // Planilha sem o bloco da companhia: a tela mostra os blocos achados
      // para escolher qual é o dela (com a mesma companhia e data).
      if (
        error instanceof TariffError &&
        error.message === "tariff_other_companies" &&
        error.detail.length
      ) {
        const params = new URLSearchParams({
          error: error.message,
          blocks: error.detail
            .map((b) => b.replace(/\|/g, " "))
            .join("|")
            .slice(0, 2600),
        });
        if (shippingLineId) params.set("company", shippingLineId);
        if (referenceDate) params.set("date", referenceDate);
        if (from) params.set("from", from);
        return `${BACK}?${params.toString()}`;
      }
      throw error;
    }
    const params = new URLSearchParams({ imported: row.id });
    if (from) params.set("from", from);
    return `${BACK}?${params.toString()}`;
  });
}

export async function applyTariffPerCbmAction(form: FormData) {
  const user = await requireUser();
  const tariffId = str(form, "tariffId");
  const destination = str(form, "destination");
  const from = backFrom(form);
  // Volta para o mesmo tarifário e destino (e o link do pedido, se veio de lá).
  const params = new URLSearchParams();
  // "current" é o comparativo (a tela sem ?id=).
  if (tariffId !== "current" && ID.safeParse(tariffId).success)
    params.set("id", tariffId);
  if (DESTINATION.safeParse(destination).success)
    params.set("dest", destination);
  if (from) params.set("from", from);
  const back = params.size ? `${BACK}?${params.toString()}` : BACK;
  await run(back, async () => {
    const id = ID.parse(tariffId);
    const dest = DESTINATION.parse(destination);
    const { applyTariffPerCbm } = await import("@/lib/services/freight-tariff");
    await applyTariffPerCbm(user, id, dest);
    params.set("perCbm", "1");
    return `${BACK}?${params.toString()}`;
  });
}
