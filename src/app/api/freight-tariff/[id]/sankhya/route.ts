import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { audit } from "@/lib/services/audit";
import { comparativeTariff } from "@/lib/services/freight-tariff";
import {
  normalizeTariffData,
  sankhyaCsv,
} from "@/lib/services/freight-tariff-calc";

export const dynamic = "force-dynamic";

/**
 * AD_FREINT.CSV do tarifário (o arquivo que a macro da planilha gerava para o
 * Sankhya): ponto e vírgula, datas DD/MM/AAAA, vírgula decimal, UTF-8 sem
 * BOM. `current` = o comparativo (cada companhia com a data da planilha
 * dela); um id = aquela planilha. Só a Wellmix (tem as tarifas de todas as
 * companhias).
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/freight-tariff/[id]/sankhya">,
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (!isWellmix(user) || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(id))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  let csv: string;
  let summary: string;
  if (id === "current") {
    const comparative = await comparativeTariff(user);
    if (!comparative)
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    csv = sankhyaCsv(comparative.data, comparative.referenceDate);
    summary = `AD_FREINT.CSV baixado (comparativo de ${comparative.sources.length} planilha(s), até ${comparative.referenceDate})`;
  } else {
    const tariff = await getStore().get("freight_tariffs", id);
    if (!tariff)
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    csv = sankhyaCsv(normalizeTariffData(tariff.data), tariff.referenceDate);
    summary = `AD_FREINT.CSV baixado (tarifário de ${tariff.referenceDate})`;
  }
  await audit(
    user,
    "freight_tariff.export",
    "freight_tariff",
    id,
    summary,
  ).catch(() => null);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="AD_FREINT.CSV"',
      "Cache-Control": "no-store",
    },
  });
}
