import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  defaultDesk,
  desksFor,
  isDeskKey,
  loadDesk,
} from "@/lib/services/desks";
import {
  Badge,
  Card,
  LinkButton,
  PageHeader,
  Table,
  Td,
  Th,
  cx,
  formatDate,
  linkClass,
} from "@/components/ui";

/*
 * Mesa de trabalho por papel (docs/DESKS.md): o que espera cada área na
 * etapa Pedido, com o prazo de cada passo. Dentro de Pendências: todos os
 * papéis que têm mesa já abrem essa tela.
 */
export default async function DeskPage({
  searchParams,
}: PageProps<"/app/tasks/desk">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/tasks/desk");
  requireScreen(user, "tasks");
  const desks = desksFor(user);
  if (!desks.length) redirect("/app/tasks");
  const { desk: asked } = await searchParams;
  const desk =
    isDeskKey(asked) && desks.includes(asked) ? asked : defaultDesk(user)!;
  const t = await getT();
  const queues = await loadDesk(user, desk);
  const total = queues.reduce((n, q) => n + q.rows.length, 0);

  return (
    <>
      <PageHeader
        t={t}
        title={t("desk.title")}
        subtitle={t(`desk.${desk}.subtitle` as DictionaryKey)}
        actions={
          <Link href="/app/tasks" className={linkClass}>
            {t("desk.back")}
          </Link>
        }
      />
      {desks.length > 1 ? (
        <nav className="mb-4 flex flex-wrap gap-2" data-desk-tabs>
          {desks.map((d) => (
            <Link
              key={d}
              href={`/app/tasks/desk?desk=${d}`}
              data-desk-tab={d}
              aria-current={d === desk ? "page" : undefined}
              className={cx(
                "rounded-full border px-3 py-1 text-sm",
                d === desk
                  ? "border-brand-600 bg-brand-50 font-medium text-brand-700"
                  : "border-zinc-200 text-zinc-600 hover:bg-zinc-50",
              )}
            >
              {t(`desk.${d}.name` as DictionaryKey)}
            </Link>
          ))}
        </nav>
      ) : null}
      <div className="space-y-4" data-desk={desk} data-desk-total={total}>
        {queues.map((q) => (
          <Card
            key={q.key}
            title={t(`desk.queue.${desk}.${q.key}` as DictionaryKey)}
            actions={
              <Badge tone={q.rows.length ? "warning" : "neutral"}>
                {q.rows.length}
              </Badge>
            }
          >
            <div data-desk-queue={q.key} data-count={q.rows.length}>
              {q.rows.length ? (
                <Table tools={false}>
                  <thead>
                    <tr>
                      <Th>{t("desk.col.item")}</Th>
                      <Th>{t("desk.col.order")}</Th>
                      <Th>{t("desk.col.due")}</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {q.rows.map((r) => {
                      const late = !!r.late;
                      return (
                        <tr key={r.id} data-desk-row={r.id}>
                          <Td>
                            <span className="font-medium text-zinc-900">
                              {r.title}
                            </span>
                            {r.note ? (
                              <span className="block text-xs text-amber-700">
                                {r.note}
                              </span>
                            ) : null}
                          </Td>
                          <Td>{r.orderNumber ? `#${r.orderNumber}` : "—"}</Td>
                          <Td>
                            {r.dueAt ? (
                              <span
                                className={late ? "text-red-700" : undefined}
                              >
                                {formatDate(r.dueAt, t)}
                                {late ? ` · ${t("desk.late")}` : ""}
                              </span>
                            ) : (
                              "—"
                            )}
                          </Td>
                          <Td className="text-right">
                            <LinkButton href={r.link} variant="secondary">
                              {t("desk.open")}
                            </LinkButton>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              ) : (
                <p className="text-sm text-zinc-500">{t("desk.empty")}</p>
              )}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
