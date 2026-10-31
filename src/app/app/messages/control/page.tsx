import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { ForbiddenError, isAdmin, isWellmix } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import type { Translate } from "@/i18n";
import {
  messageControlFor,
  type Ball,
  type MessageControlRow,
} from "@/lib/services/message-control";
import { topicLabel } from "@/lib/services/messages";
import {
  Badge,
  Button,
  Card,
  Empty,
  LinkButton,
  PageHeader,
  Select,
  Stat,
  Table,
  Td,
  TextLink,
  Th,
  cx,
  rowClass,
} from "@/components/ui";
import { ChatOpenButton } from "@/components/chat-open-button";

/*
 * Controladoria de mensagens (Wellmix): cartões de indicadores que filtram a
 * tabela (com a Wellmix, atrasadas, com a empresa), filtros por empresa e
 * produto, uma linha por assunto com quem está a bola, há quanto tempo o outro
 * lado espera e o prazo; embaixo, a visão por produto. CSV pelo botão.
 */

type Show = "all" | "wellmix" | "overdue" | "party";

const param = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

function waitingText(t: Translate, hours: number) {
  return hours >= 48
    ? t("msgctl.waiting.days", { n: Math.floor(hours / 24) })
    : t("msgctl.waiting.hours", { n: Math.round(hours) });
}

function formatWhen(value: string, intl: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(intl, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function MessageControlPage({
  searchParams,
}: PageProps<"/app/messages/control">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "messages");
  if (!isWellmix(user)) throw new ForbiddenError();
  const t = await getT();
  const sp = await searchParams;
  const admin = isAdmin(user);
  const show = (
    ["wellmix", "overdue", "party"].includes(param(sp.show) ?? "")
      ? param(sp.show)
      : "all"
  ) as Show;
  const scope = param(sp.scope) === "mine" ? "mine" : "all";
  const partyId = param(sp.party) || null;
  const productId = param(sp.product) || null;
  const ball: Ball | "all" =
    show === "wellmix" || show === "overdue"
      ? "wellmix"
      : show === "party"
        ? "party"
        : "all";
  const view = await messageControlFor(user, {
    scope,
    ball,
    overdueOnly: show === "overdue",
    partyId,
    productId,
  });

  const href = (patch: Partial<Record<string, string | null>>) => {
    const q = new URLSearchParams();
    const merged: Record<string, string | null> = {
      show,
      scope: admin ? view.scope : null,
      party: partyId,
      product: productId,
      ...patch,
    };
    for (const [k, v] of Object.entries(merged))
      if (
        v &&
        !(k === "show" && v === "all") &&
        !(k === "scope" && v === "all")
      )
        q.set(k, v);
    const s = q.toString();
    return `/app/messages/control${s ? `?${s}` : ""}`;
  };
  const { stats } = view;
  const cards: Array<{
    key: Show;
    label: string;
    value: string | number;
    tone?: "danger" | "warning" | "info" | "success" | "neutral";
  }> = [
    {
      key: "wellmix",
      label: t("msgctl.stat.withWellmix"),
      value: stats.withWellmix,
      tone: stats.withWellmix ? "warning" : "neutral",
    },
    {
      key: "overdue",
      label: t("msgctl.stat.overdue"),
      value: stats.overdue,
      tone: stats.overdue ? "danger" : "neutral",
    },
    {
      key: "party",
      label: t("msgctl.stat.withParty"),
      value: stats.withParty,
      tone: "info",
    },
  ];
  const csvHref = `/app/messages/control/export${href({}).replace("/app/messages/control", "")}`;
  const chatTarget = (r: MessageControlRow) =>
    r.orderItemId
      ? { orderItemId: r.orderItemId }
      : r.orderId
        ? { orderId: r.orderId }
        : r.requestId
          ? { requestId: r.requestId }
          : null;

  return (
    <>
      <PageHeader
        t={t}
        title={t("msgctl.title")}
        subtitle={t("msgctl.subtitle", { days: view.slaBusinessDays })}
        actions={<TextLink href="/app/messages">{t("msgctl.back")}</TextLink>}
      />

      {/* Indicadores como filtros: o escolhido fica marcado. */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <Stat
            key={c.key}
            compact
            label={c.label}
            value={c.value}
            href={href({ show: show === c.key ? "all" : c.key })}
            tone={show === c.key ? undefined : c.tone}
            active={show === c.key}
          />
        ))}
        <Stat
          compact
          label={t("msgctl.stat.onTime")}
          value={
            stats.answered30d
              ? t("msgctl.stat.onTimeValue", {
                  onTime: stats.onTime30d,
                  total: stats.answered30d,
                })
              : t("msgctl.stat.none")
          }
          tone={
            !stats.answered30d
              ? "neutral"
              : stats.onTime30d === stats.answered30d
                ? "success"
                : "warning"
          }
        />
        <Stat
          compact
          label={t("msgctl.stat.avg")}
          value={
            stats.avgResponseHours === null
              ? t("msgctl.stat.none")
              : t("msgctl.stat.avgValue", {
                  hours: Math.round(stats.avgResponseHours * 10) / 10,
                })
          }
        />
      </div>

      <form
        method="get"
        action="/app/messages/control"
        className="mb-3 flex flex-wrap items-end gap-2"
        data-msgctl-filters
      >
        {show !== "all" ? (
          <input type="hidden" name="show" value={show} />
        ) : null}
        {admin ? (
          <label className="text-xs text-zinc-600">
            {t("msgctl.scope.all")} / {t("msgctl.scope.mine")}
            <Select
              name="scope"
              defaultValue={view.scope}
              dense
              className="mt-0.5 block"
            >
              <option value="all">{t("msgctl.scope.all")}</option>
              <option value="mine">{t("msgctl.scope.mine")}</option>
            </Select>
          </label>
        ) : null}
        <label className="text-xs text-zinc-600">
          {t("msgctl.filter.party")}
          <Select
            name="party"
            defaultValue={partyId ?? ""}
            dense
            className="mt-0.5 block"
          >
            <option value="">{t("msgctl.filter.anyParty")}</option>
            {view.parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-xs text-zinc-600">
          {t("msgctl.filter.product")}
          <Select
            name="product"
            defaultValue={productId ?? ""}
            dense
            className="mt-0.5 block"
          >
            <option value="">{t("msgctl.filter.anyProduct")}</option>
            {view.products.map((p) => (
              <option key={p.productId} value={p.productId}>
                {p.name}
              </option>
            ))}
          </Select>
        </label>
        <Button type="submit" variant="secondary">
          {t("msgctl.filter.apply")}
        </Button>
        <LinkButton href={csvHref} variant="secondary" data-msgctl-csv>
          {t("msgctl.export")}
        </LinkButton>
      </form>

      {view.rows.length === 0 ? (
        <Empty>{t("msgctl.empty")}</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("msgctl.col.party")}</Th>
              <Th>{t("msgctl.col.subject")}</Th>
              <Th>{t("msgctl.col.ball")}</Th>
              <Th>{t("msgctl.col.waiting")}</Th>
              <Th>{t("msgctl.col.due")}</Th>
              <Th>{t("msgctl.col.last")}</Th>
              <Th>{t("msgctl.col.analyst")}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {view.rows.map((r) => {
              const late = r.ball === "wellmix" && r.overdue;
              const target = chatTarget(r);
              return (
                <tr
                  key={r.topicId}
                  className={cx(rowClass, late && "bg-red-50/40")}
                  data-msgctl-row={r.topicId}
                  data-msgctl-ball={r.ball}
                  data-msgctl-overdue={late ? "true" : undefined}
                >
                  <Td className="whitespace-nowrap font-medium">
                    {r.partyName}
                  </Td>
                  <Td>
                    {topicLabel(t, r)}
                    {r.productNames.length ? (
                      <span className="block text-xs text-zinc-500">
                        {r.productNames.join(", ")}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <Badge tone={r.ball === "wellmix" ? "warning" : "info"}>
                      {t(`msgctl.ball.${r.ball}`)}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">
                    {waitingText(t, r.waitingHours)}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <span className={cx(late && "font-semibold text-red-700")}>
                      {formatWhen(r.dueAt, t.intl)}
                    </span>
                    <span className="block text-xs">
                      {r.overdue ? (
                        <span
                          className={late ? "text-red-700" : "text-zinc-500"}
                        >
                          {t("msgctl.overdue")}
                        </span>
                      ) : (
                        <span className="text-emerald-700">
                          {t("msgctl.onTime")}
                        </span>
                      )}
                    </span>
                  </Td>
                  <Td className="max-w-xs">
                    <span className="block truncate text-zinc-800">
                      {r.lastPreview}
                    </span>
                    <span className="block text-xs text-zinc-500">
                      {r.lastAuthorName} · {formatWhen(r.lastAt, t.intl)}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {r.analystName ?? (
                      <span className="text-zinc-400">
                        {t("msgctl.noAnalyst")}
                      </span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      <TextLink href={r.href}>{t("msgctl.open")}</TextLink>
                      {target ? (
                        <ChatOpenButton
                          target={target}
                          label={t("chat.open")}
                        />
                      ) : null}
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <Card
        title={t("msgctl.products.title")}
        className="mt-4"
        actions={
          productId ? (
            <TextLink href={href({ product: null })} className="text-sm">
              {t("msgctl.products.clear")}
            </TextLink>
          ) : null
        }
      >
        {view.products.length === 0 ? (
          <Empty>{t("msgctl.products.empty")}</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("msgctl.products.col.product")}</Th>
                <Th className="text-right">
                  {t("msgctl.products.col.topics")}
                </Th>
                <Th className="text-right">
                  {t("msgctl.products.col.withWellmix")}
                </Th>
                <Th className="text-right">
                  {t("msgctl.products.col.overdue")}
                </Th>
              </tr>
            </thead>
            <tbody>
              {view.products.map((p) => (
                <tr
                  key={p.productId}
                  className={cx(
                    rowClass,
                    productId === p.productId && "bg-brand-50/60",
                  )}
                  data-msgctl-product={p.productId}
                >
                  <Td>
                    <TextLink href={href({ product: p.productId })}>
                      {p.name}
                    </TextLink>
                  </Td>
                  <Td className="text-right tabular-nums">{p.topics}</Td>
                  <Td className="text-right tabular-nums">{p.withWellmix}</Td>
                  <Td
                    className={cx(
                      "text-right tabular-nums",
                      p.overdue > 0 && "font-semibold text-red-700",
                    )}
                  >
                    {p.overdue}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
