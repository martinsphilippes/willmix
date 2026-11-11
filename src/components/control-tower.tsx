import type { Translate } from "@/i18n";
import type { ReactNode } from "react";
import type { User } from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";
import {
  SCREENS,
  SCREEN_LABEL,
  canOpen,
  hasNoFunction,
  type Screen,
} from "@/lib/auth/screens";
import { getT } from "@/i18n/server";
import { ChatOpenButton } from "./chat-open-button";
import type { TowerRow } from "@/lib/services/control-tower";
import {
  loadControlTower,
  loadTowerTotals,
  type TowerTotals,
} from "@/lib/services/control-tower";
import { isBoardCardKey, loadTowerBoard } from "@/lib/services/tower-board";
import {
  actionCardsFor,
  buildTowerStages,
  findGroupOfCard,
  isActionCardKey,
} from "@/lib/tower-stages";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { ActionStrip, StageBoard } from "./tower-stages";
import {
  Alert,
  Badge,
  Card,
  cx,
  Empty,
  PageHeader,
  Progress,
  Stat,
  Table,
  Td,
  TextLink,
  Th,
  formatDate,
  formatMoney,
  rowClass,
  stageTone,
} from "./ui";

/** Valores por moeda ("USD 1.000,00 · CNY 500,00"); zero na moeda de venda quando não há nada. */
function moneyByCurrency(
  map: Record<string, number>,
  fallback: string,
  t: Translate,
) {
  return (
    Object.entries(map)
      .filter(([, v]) => v > 0.005)
      .map(([c, v]) => formatMoney(v, c, t))
      .join(" · ") || formatMoney(0, fallback, t)
  );
}

const hasValue = (map: Record<string, number>) =>
  Object.values(map).some((v) => v > 0.005);

/** Percentual com 1 casa (ex.: 42,5%). */
const percent = (v: number | null, intl: string) =>
  v === null
    ? "—"
    : `${new Intl.NumberFormat(intl, { maximumFractionDigits: 1 }).format(v)}%`;

/** Valor monetário no card: um pouco menor que o padrão do Stat para o número não quebrar no meio. */
function Money({ children }: { children: ReactNode }) {
  return (
    <span className="block text-lg leading-tight tabular-nums sm:text-xl">
      {children}
    </span>
  );
}

/**
 * Faixa "Financeiro" (docs/EVOLUTION_PLAN.md, item 27): reutiliza o
 * financeiro; só o que foi lançado, nada estimado. A faixa "Operação" virou
 * os quadros de ponta a ponta (tower-board.tsx).
 */
function FinanceStrip({
  totals,
  t,
}: {
  totals: TowerTotals;
  t: Awaited<ReturnType<typeof getT>>;
}) {
  return (
    <section aria-label={t("ct.finance.title")} className="mb-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {t("ct.finance.title")}
        </h2>
        <p className="text-xs text-zinc-500">{t("ct.totals.hint")}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat
          label={t("finance.sold")}
          value={
            <Money>{formatMoney(totals.sold, totals.sellCurrency, t)}</Money>
          }
          href="/app/finance"
        />
        <Stat
          label={t("finance.received")}
          value={
            <Money>
              {formatMoney(totals.received, totals.sellCurrency, t)}
            </Money>
          }
          href="/app/finance"
        />
        <Stat
          label={t("finance.receivable")}
          value={
            <Money>
              {formatMoney(totals.receivable, totals.sellCurrency, t)}
            </Money>
          }
          href="/app/finance"
          tone={totals.receivable > 0 ? "warning" : undefined}
        />
        <Stat
          label={t("ct.finance.purchased")}
          value={
            <Money>
              {moneyByCurrency(totals.purchasedByCurrency, "USD", t)}
            </Money>
          }
          href="/app/finance"
        />
        <Stat
          label={t("ct.finance.paid")}
          value={
            <Money>{moneyByCurrency(totals.paidByCurrency, "USD", t)}</Money>
          }
          href="/app/finance"
        />
        <Stat
          label={t("ct.finance.payable")}
          value={
            <Money>{moneyByCurrency(totals.payableByCurrency, "USD", t)}</Money>
          }
          href="/app/finance"
          tone={hasValue(totals.payableByCurrency) ? "warning" : undefined}
        />
      </div>
    </section>
  );
}

/** Visão comercial por container aberto: vendido × disponível em volume e valor vendido. */
function CommercialCard({
  totals,
  t,
}: {
  totals: TowerTotals;
  t: Awaited<ReturnType<typeof getT>>;
}) {
  return (
    <Card className="mt-4 min-w-0" title={t("ct.commercial.title")}>
      <p className="mb-2 text-xs text-zinc-500">{t("ct.commercial.hint")}</p>
      {totals.commercial.length === 0 ? (
        <Empty>{t("ct.commercial.none")}</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("containers.code")}</Th>
              <Th>{t("common.customer")}</Th>
              <Th className="min-w-36">{t("containers.occupancy")}</Th>
              <Th className="text-right">{t("containers.soldPercent")}</Th>
              <Th className="text-right">{t("containers.availablePercent")}</Th>
              <Th className="text-right">{t("containers.soldValue")}</Th>
            </tr>
          </thead>
          <tbody>
            {totals.commercial.map((c) => (
              <tr key={c.id} className={rowClass}>
                <Td className="whitespace-nowrap">
                  <TextLink href={`/app/containers/${c.id}`}>{c.code}</TextLink>
                </Td>
                <Td>{c.customer ?? t("containers.noCustomer")}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <Progress percent={c.occupancyPercent} tone="danger" />
                    <span
                      className={cx(
                        "w-14 shrink-0 text-right text-xs font-semibold tabular-nums",
                        c.occupancyPercent > 100
                          ? "text-red-700"
                          : "text-zinc-700",
                      )}
                    >
                      {percent(c.occupancyPercent, t.intl)}
                    </span>
                  </div>
                </Td>
                <Td className="text-right font-medium tabular-nums text-emerald-700">
                  {percent(c.soldPercent, t.intl)}
                </Td>
                <Td className="text-right tabular-nums">
                  {percent(c.availablePercent, t.intl)}
                </Td>
                <Td className="whitespace-nowrap text-right tabular-nums">
                  {formatMoney(c.soldValue, c.soldCurrency, t)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

export async function ControlTower({
  user,
  filter,
  card,
  stage,
  group,
  denied,
}: {
  user: User;
  filter?: string;
  /** Ponto de ação escolhido (?card=…); chave antiga de quadrado também vale. */
  card?: string;
  /** Etapa aberta (?stage=…) e o passo escolhido dentro dela (?group=CHAVE_DO_QUADRADO). */
  stage?: string;
  group?: string;
  /** Tela que o login tentou abrir sem acesso (?denied=…): aviso no início. */
  denied?: string;
}) {
  const t = await getT();
  const wellmix = isWellmix(user);
  const finance = canOpen(user, "finance");
  const operations = canOpen(user, "orders");
  const deniedScreen = (SCREENS as readonly string[]).includes(denied ?? "")
    ? (denied as Screen)
    : null;
  const [data, totals, board] = await Promise.all([
    loadControlTower(),
    wellmix ? loadTowerTotals() : Promise.resolve(null),
    wellmix && operations ? loadTowerBoard({ finance }) : Promise.resolve(null),
  ]);
  const stages = board ? buildTowerStages(board) : null;
  const actionCards = board
    ? actionCardsFor(board, (screen) => canOpen(user, screen))
    : [];

  /* O que foi escolhido: ponto de ação ou passo da etapa. Link antigo
     (?card=CHAVE): ponto de ação do perfil, senão o passo que contém o quadrado. */
  let actionKey: string | null = null;
  let stageKey: string | null = null;
  let groupKey: string | null = null;
  if (isBoardCardKey(card)) {
    if (isActionCardKey(card) && actionCards.some((c) => c.key === card))
      actionKey = card;
    else {
      const found = findGroupOfCard(card);
      if (found) {
        stageKey = found.stage;
        groupKey = found.group;
      }
    }
  }
  const openStage = stages?.find((s) => s.key === (stageKey ?? stage)) ?? null;
  if (openStage) {
    stageKey = openStage.key;
    const wanted = groupKey ?? group;
    groupKey =
      openStage.groups.find((g) => g.key === wanted)?.key ??
      openStage.single ??
      null;
  } else groupKey = null;
  // Uma lista por vez: o ponto de ação tem prioridade sobre o passo.
  if (actionKey) {
    stageKey = null;
    groupKey = null;
  }
  const actionCard = actionKey
    ? (board?.cards.find((c) => c.key === actionKey && !c.href) ?? null)
    : null;
  const groupDef = openStage?.groups.find((g) => g.key === groupKey) ?? null;
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
  // Visões gerais: nada escolhido, nenhuma lista (ela aparece ao tocar num
  // quadrado, logo abaixo do grupo dele; tocar de novo fecha).
  const picked = !!(actionCard || groupDef);
  const selected =
    !picked && filter && filter in data.buckets
      ? (filter as keyof typeof data.buckets)
      : null;
  // Quadrados que abrem um cartão (não uma lista): exceções e visão comercial.
  const extra =
    !picked && (filter === "exceptions" || filter === "commercial")
      ? filter
      : null;

  /* Lista do escolhido: aparece logo abaixo dele. */
  const renderList = (
    rows: TowerRow[],
    title: string | undefined,
    key: string,
  ) => (
    <div className="mb-4 mt-2 scroll-mt-24" id="tower-list">
      <Card className="min-w-0" title={title}>
        <div data-tower-list={key}>
          {rows.length === 0 ? (
            <Empty>{t("common.none")}</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>{t("tower.col.party")}</Th>
                  <Th>{t("common.product")}</Th>
                  <Th>{t("orders.stage")}</Th>
                  <Th>{t("common.responsible")}</Th>
                  <Th>{t("common.due")}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.kind ?? ""}${row.id}`} className={rowClass}>
                    <Td className="whitespace-nowrap">
                      <TextLink href={row.link}>{row.number}</TextLink>
                    </Td>
                    <Td>{row.customer}</Td>
                    <Td>{row.product}</Td>
                    <Td className="whitespace-nowrap">
                      {row.kind === "cert" ? (
                        <Badge tone="warning">{t("board.cert")}</Badge>
                      ) : row.statusKey ? (
                        <Badge tone="info">
                          {t(row.statusKey as DictionaryKey)}
                        </Badge>
                      ) : row.cancelled ? (
                        <Badge tone="danger">
                          {t("board.cancelled")}
                          {row.stageKey
                            ? ` · ${t(`stage.${row.stageKey}`)}`
                            : ""}
                        </Badge>
                      ) : (
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
                      )}
                      {row.origin === "sankhya" ? (
                        <span
                          className="ml-1.5 text-[11px] font-medium text-zinc-500"
                          title={t("tower.origin.sankhyaHint")}
                          data-origin="sankhya"
                        >
                          {t("tower.origin.sankhya")}
                        </span>
                      ) : null}
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
                        {formatDate(row.dueAt, t)}
                      </span>
                    </Td>
                    {/* Conversa daquele pedido/solicitação: sempre na última coluna. */}
                    <Td className="whitespace-nowrap text-right">
                      {row.kind === "cert" ||
                      row.kind === "booking" ||
                      row.kind === "supplier_request" ? null : (
                        <ChatOpenButton
                          target={
                            row.kind === "request" ||
                            (!row.kind && row.requestStatus)
                              ? { requestId: row.id }
                              : { orderId: row.id }
                          }
                          label={t("chat.open")}
                        />
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
  const cardTitle = (key: string) => t(`board.card.${key}` as DictionaryKey);
  const actionList = actionCard
    ? renderList(actionCard.rows, cardTitle(actionCard.key), actionCard.key)
    : null;
  const groupList = groupDef
    ? renderList(groupDef.rows, cardTitle(groupDef.key), groupDef.key)
    : null;
  const filterList =
    selected && !picked
      ? renderList(
          data.buckets[selected],
          cards.find((c) => c.key === selected)?.label,
          selected,
        )
      : null;
  // "Mais visões" abre sozinho quando o escolhido está lá dentro.
  const moreOpen = !!(selected || extra);

  return (
    <>
      <PageHeader
        help={{ body: "help.ct.body", steps: "help.ct.cards" }}
        t={t}
        title={t("ct.title")}
        subtitle={t("home.welcome", { name: user.name })}
      />
      {deniedScreen ? (
        <div className="mb-4">
          <Alert tone="warning">
            {t("access.denied", { screen: t(SCREEN_LABEL[deniedScreen]) })}
          </Alert>
        </div>
      ) : null}
      {hasNoFunction(user) ? (
        <div className="mb-4" data-no-function>
          <Alert tone="info">{t("access.noFunction")}</Alert>
        </div>
      ) : null}
      {totals && operations && finance ? (
        <FinanceStrip totals={totals} t={t} />
      ) : null}
      {board && stages ? (
        <>
          <ActionStrip
            cards={actionCards}
            t={t}
            selected={actionCard?.key ?? null}
            detail={actionList}
          />
          <StageBoard
            stages={stages}
            t={t}
            stage={stageKey}
            group={groupKey}
            detail={groupList}
            currency={board.currency}
          />
        </>
      ) : null}
      {operations ? (
        <details
          className="group mb-4 rounded-xl border border-zinc-200/80 bg-white/60 p-3"
          open={moreOpen}
          data-tower-more
        >
          <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
            {t("tower.more.title")}
            <span className="font-normal normal-case tracking-normal text-zinc-500">
              {t("tower.more.hint")}
            </span>
          </summary>
          <div className="mt-4">
<<<<<<< HEAD
=======
            {board ? (
              <section aria-label={t("tower.detail.title")} className="mb-2">
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {t("tower.detail.title")}
                </h2>
                <TowerBoardView
                  board={board}
                  t={t}
                  param="tile"
                  selected={tileCard?.key ?? null}
                  detail={tileList}
                  newRequestHref={newRequestHref}
                  occupancy={
                    totals?.containers.avgOccupancyPercent !== null &&
                    totals?.containers.avgOccupancyPercent !== undefined
                      ? t("board.occupancy", {
                          pct: percent(
                            totals.containers.avgOccupancyPercent,
                            t.intl,
                          ),
                        })
                      : null
                  }
                />
              </section>
            ) : null}
>>>>>>> origin/wellmix
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {t("board.general")}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {cards.map((c) => (
                <Stat
                  key={c.key}
                  label={c.label}
                  value={data.buckets[c.key].length}
                  // Tocar no escolhido fecha a lista.
                  href={c.key === selected ? "/app" : `/app?filter=${c.key}`}
                  tone={data.buckets[c.key].length > 0 ? c.tone : undefined}
                  active={c.key === selected}
                />
              ))}
              {/* Exceções e visão comercial abrem pelo quadrado de cada uma;
                  tocar de novo fecha. */}
              <Stat
                label={t("ct.exceptions")}
                value={data.exceptions.length}
                href={
                  extra === "exceptions" ? "/app" : "/app?filter=exceptions"
                }
                tone={data.exceptions.length > 0 ? "warning" : undefined}
                active={extra === "exceptions"}
              />
              {totals && finance ? (
                <Stat
                  label={t("ct.commercial.title")}
                  value={totals.commercial.length}
                  href={
                    extra === "commercial" ? "/app" : "/app?filter=commercial"
                  }
                  active={extra === "commercial"}
                />
              ) : null}
            </div>
            {filterList}

            {extra === "exceptions" ? (
              <div className="mt-4" data-tower-extra="exceptions">
                <Card className="min-w-0" title={t("ct.exceptions")}>
                  {data.exceptions.length === 0 ? (
                    <Empty>{t("common.none")}</Empty>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {data.exceptions.map((e, i) => (
                        <li
                          key={i}
                          className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200/80 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <Badge
                              tone={
                                e.severity === "high" ? "danger" : "warning"
                              }
                            >
                              {t(`ct.exception.${e.kind}`)}
                            </Badge>
                            <p className="mt-1 text-zinc-700">{e.detail}</p>
                          </div>
                          <TextLink
                            href={e.link}
                            className="whitespace-nowrap text-xs"
                          >
                            {t("tasks.open")}
                          </TextLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            ) : null}
            {totals && finance && extra === "commercial" ? (
              <div data-tower-extra="commercial">
                <CommercialCard totals={totals} t={t} />
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </>
  );
}
