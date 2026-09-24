import type { User } from "@/lib/db";
import { getT } from "@/i18n/server";
import { loadControlTower } from "@/lib/services/control-tower";
import {
  Badge,
  Card,
  cx,
  Empty,
  PageHeader,
  Stat,
  Table,
  Td,
  TextLink,
  Th,
  formatDate,
  rowClass,
  stageTone,
} from "./ui";

export async function ControlTower({
  user,
  filter,
}: {
  user: User;
  filter?: string;
}) {
  const t = await getT();
  const data = await loadControlTower();
  const cards: Array<{
    key: keyof typeof data.buckets;
    label: string;
    tone?: "danger" | "warning";
  }> = [
    { key: "active", label: t("ct.active") },
    { key: "requestsOpen", label: t("ct.requestsOpen") },
    { key: "waitingSupplier", label: t("ct.waitingSupplier") },
    { key: "waitingCustomer", label: t("ct.waitingCustomer") },
    { key: "preparation", label: t("ct.preparation") },
    { key: "inspection", label: t("ct.inspection") },
    { key: "shipping", label: t("ct.shipping") },
    { key: "customs", label: t("ct.customs") },
    { key: "transport", label: t("ct.transport") },
    { key: "overdue", label: t("ct.overdue"), tone: "danger" },
    { key: "problems", label: t("ct.problems"), tone: "warning" },
    { key: "closed", label: t("ct.closed") },
  ];
  const selected =
    filter && filter in data.buckets
      ? (filter as keyof typeof data.buckets)
      : "active";
  const rows = data.buckets[selected];

  return (
    <>
      <PageHeader
        help={{ body: "help.ct.body", steps: "help.ct.cards" }}
        t={t}
        title={t("ct.title")}
        subtitle={t("home.welcome", { name: user.name })}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <Stat
            key={c.key}
            label={c.label}
            value={data.buckets[c.key].length}
            href={`/app?filter=${c.key}`}
            tone={data.buckets[c.key].length > 0 ? c.tone : undefined}
            active={c.key === selected}
          />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card
          className="min-w-0 lg:col-span-2"
          title={cards.find((c) => c.key === selected)?.label}
        >
          {rows.length === 0 ? (
            <Empty>{t("common.none")}</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>{t("common.customer")}</Th>
                  <Th>{t("common.product")}</Th>
                  <Th>{t("orders.stage")}</Th>
                  <Th>{t("common.responsible")}</Th>
                  <Th>{t("common.due")}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={rowClass}>
                    <Td>
                      <TextLink href={row.link}>{row.number}</TextLink>
                    </Td>
                    <Td>{row.customer}</Td>
                    <Td>{row.product}</Td>
                    <Td className="whitespace-nowrap">
                      <Badge
                        tone={stageTone(
                          row.stageKey === "CLOSED"
                            ? "done"
                            : row.blocked
                              ? "blocked"
                              : "active",
                        )}
                      >
                        {row.stageKey
                          ? t(`stage.${row.stageKey}`)
                          : t(`reqStatusLabel.${row.requestStatus!}`)}
                        {row.blocked ? ` · ${t("stageStatus.blocked")}` : ""}
                      </Badge>
                    </Td>
                    <Td>
                      {row.responsible ? t(`role.${row.responsible}`) : "—"}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <span
                        className={cx(
                          row.overdue && "font-semibold text-red-700",
                        )}
                      >
                        {formatDate(row.dueAt)}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        <Card className="min-w-0" title={t("ct.exceptions")}>
          {data.exceptions.length === 0 ? (
            <Empty>{t("common.none")}</Empty>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.exceptions.map((e, i) => (
                <li
                  key={i}
                  className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200/80 p-3"
                >
                  <div className="min-w-0">
                    <Badge tone={e.severity === "high" ? "danger" : "warning"}>
                      {t(`ct.exception.${e.kind}`)}
                    </Badge>
                    <p className="mt-1.5 text-zinc-700">{e.detail}</p>
                  </div>
                  <TextLink href={e.link} className="whitespace-nowrap text-xs">
                    {t("tasks.open")}
                  </TextLink>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
