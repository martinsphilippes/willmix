"use server";

import { z } from "zod";
import { files, requireUser, run, str } from "./helpers";

/*
 * Tarifário de frete (planilha das companhias marítimas). O serviço confere o
 * papel (Wellmix importa; só o admin muda o frete por m³ das Configurações);
 * aqui, formato e limites.
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
    const { importFreightTariff } =
      await import("@/lib/services/freight-tariff");
    const row = await importFreightTariff(user, file, referenceDate);
    const params = new URLSearchParams({ imported: row.id });
    if (from) params.set("from", from);
    return `${BACK}?${params.toString()}`;
  });
}

export async function applyTariffPerCbmAction(form: FormData) {
  const user = await requireUser();
  const tariffId = str(form, "tariffId");
  const destination = str(form, "destination");
  const back = ID.safeParse(tariffId).success
    ? `${BACK}?id=${encodeURIComponent(tariffId)}`
    : BACK;
  await run(back, async () => {
    const id = ID.parse(tariffId);
    const dest = DESTINATION.parse(destination);
    const { applyTariffPerCbm } = await import("@/lib/services/freight-tariff");
    await applyTariffPerCbm(user, id, dest);
    return `${BACK}?id=${encodeURIComponent(id)}&dest=${dest}&perCbm=1`;
  });
}
