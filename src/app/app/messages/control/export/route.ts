import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { getT } from "@/i18n/server";
import {
  messageControlCsv,
  messageControlFor,
  type Ball,
} from "@/lib/services/message-control";
import { TOPIC_KINDS } from "@/lib/db/schema";
import { topicLabel } from "@/lib/services/messages";

export const dynamic = "force-dynamic";

/** Controladoria de mensagens em CSV (só a Wellmix), com os mesmos filtros da tela. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isWellmix(user) || !canOpen(user, "messages"))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const t = await getT();
  const q = request.nextUrl.searchParams;
  const show = q.get("show") ?? "all";
  const ball: Ball | "all" =
    show === "wellmix" || show === "overdue"
      ? "wellmix"
      : show === "party"
        ? "party"
        : "all";
  const view = await messageControlFor(user, {
    scope: q.get("scope") === "mine" ? "mine" : "all",
    ball,
    overdueOnly: show === "overdue",
    partyId: q.get("party") || null,
    productId: q.get("product") || null,
  });
  const csv = messageControlCsv(view.rows, {
    header: t("msgctl.csv.header").split(";"),
    ball: { wellmix: t("msgctl.ball.wellmix"), party: t("msgctl.ball.party") },
    kind: Object.fromEntries(
      TOPIC_KINDS.map((k) => [k, topicLabel(t, { kind: k, title: "" }).trim()]),
    ) as Record<(typeof TOPIC_KINDS)[number], string>,
    yes: t("msgctl.yes"),
    no: t("msgctl.no"),
  });
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mensagens-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
