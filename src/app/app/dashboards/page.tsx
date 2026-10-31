import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { canOpen } from "@/lib/auth/screens";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  DASHBOARD_AREAS,
  areaPanel,
  type DashboardArea,
} from "@/lib/services/dashboards";
import { canSeeAudit } from "@/lib/services/audit-view";
import { Card, Empty, PageHeader, Stat, TextLink } from "@/components/ui";
import { ChatOpenButton } from "@/components/chat-open-button";

/*
 * Painéis por área (Fase G): compras, produção, embarque/desembaraço,
 * recebimento, certificação/artes e financeiro. Só a Wellmix. Cada número
 * leva à tela onde se age; a lista mostra os pedidos que pedem atenção.
 */
export default async function DashboardsPage({
  searchParams,
}: PageProps<"/app/dashboards">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "dashboards");
  const t = await getT();
  const { area: raw } = await searchParams;
  const area: DashboardArea = (DASHBOARD_AREAS as readonly string[]).includes(
    String(raw),
  )
    ? (raw as DashboardArea)
    : "purchasing";
  // Financeiro é só do administrador (docs/ACCESS.md).
  const areas = DASHBOARD_AREAS.filter(
    (a) => a !== "finance" || canOpen(user, "finance"),
  );
  if (!areas.includes(area)) redirect("/app?denied=finance");
  const panel = await areaPanel(user, area);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("dash.title")}
        subtitle={t("dash.subtitle")}
        actions={
          canSeeAudit(user) ? (
            <TextLink href="/app/audit">{t("audit.title")}</TextLink>
          ) : undefined
        }
      />
      <nav className="flex flex-wrap gap-1.5" data-dash-tabs>
        {areas.map((a) => (
          <Link
            key={a}
            href={`/app/dashboards?area=${a}`}
            className={`rounded-full border px-3 py-1 text-sm ${
              a === area
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
            aria-current={a === area ? "page" : undefined}
          >
            {t(`dash.area.${a}` as DictionaryKey)}
          </Link>
        ))}
      </nav>
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        data-dash-area={area}
      >
        {panel.metrics.map((m) => (
          <Stat
            key={m.key}
            label={t(`dash.metric.${m.key}` as DictionaryKey)}
            value={m.value}
            tone={m.tone ?? "neutral"}
            href={m.href}
          />
        ))}
      </div>
      <Card title={t("dash.attention")}>
        {!panel.attention.length ? (
          <Empty>{t("dash.noAttention")}</Empty>
        ) : (
          <ul className="divide-y divide-zinc-100 text-sm">
            {panel.attention.map((r, i) => (
              <li key={`${r.id}-${i}`} className="flex flex-wrap gap-2 py-2">
                <TextLink href={`/app/orders/${r.id}`}>
                  {t("dash.order", { n: String(r.number) })}
                </TextLink>
                <ChatOpenButton
                  target={{ orderId: r.id }}
                  label={t("chat.open")}
                />
                <span className="text-zinc-600">{r.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="text-xs text-zinc-500">{t("dash.erpNote")}</p>
    </div>
  );
}
