import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import {
  FLOW_OVERVIEW_BLOCKS,
  blockLabelKey,
  findStep,
  listOnlyFor,
  overviewHref,
  stepHelpKey,
  stepLabelKey,
} from "@/lib/flow";
import {
  FLOW_STEP_PAGE,
  flowCasesOf,
  flowPartnerAllFor,
  flowStepEntities,
} from "@/lib/services/flow";
import { ServerPager } from "@/components/server-table";
import { FlowAll } from "@/components/flow-all";
import { isWellmix } from "@/lib/auth/permissions";
import { partnerStepsOf, stepId } from "@/lib/flow";
import { FlowCases } from "@/components/flow-cases";
import { FlowStepWork } from "@/components/flow-step-work";
import {
  FlowFreightWork,
  FlowProductionWork,
  FlowReceivingWork,
  FlowRequirementWork,
  FlowSalesWork,
} from "@/components/flow-step-forms";
import { Alert, Button, Input } from "@/components/ui";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { PageHeader, TextLink } from "@/components/ui";
import { LiveSearch } from "@/components/live-search";

/*
 * Tela de um passo do fluxo (dono, 14/11/2026; docs/FLOW_MENU.md): o que
 * espera ação do login naquele passo, com o prazo, há quantos dias chegou e
 * o atalho para a tela focada onde se resolve. Os filtros de prazo são links
 * (?due=overdue|today|week). Duas abas (dono, 14/11/2026): Pendências (o
 * que espera ação do login, padrão) e "Todos no passo" (?tab=all: todos os
 * pedidos que estão no passo agora, de qualquer responsável; só a Wellmix).
 * Na Certificação e na Arte (dono, 14/11/2026) a tela é só a lista, uma
 * linha por produto: o "Resolver" abre o produto no detalhe do pedido no
 * passo, onde ficam o envio da foto ou do arquivo e a validação. Para a
 * Wellmix (administradores e operadores), todos os passos são só a lista,
 * com o trabalho no pedido no passo (listOnlyFor).
 */
const DUES = ["overdue", "today", "week"] as const;

export default async function FlowStepPage({
  params,
  searchParams,
}: PageProps<"/app/flow/[block]/[step]">) {
  const { block, step: key } = await params;
  const step = findStep(block, key);
  if (!step || step.badgeOnly) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/app/flow/${block}/${key}`);
  // Parceiros (dono, 14/11/2026): só os passos dele, com a tela Pedidos.
  const wellmix = isWellmix(user);
  if (
    !wellmix &&
    !partnerStepsOf(user.role).some(
      (x) => x.key === step.key && x.block === step.block,
    )
  )
    notFound();
  requireScreen(user, wellmix ? step.screen : "orders");
  const {
    tab,
    page,
    q: rawQuery,
    due,
    importStep,
    certStep,
    production,
    receiving,
    freight,
    freightN,
    saved,
  } = await searchParams;
  const done = [importStep, certStep].find(
    (v) =>
      typeof v === "string" &&
      ["submitted", "validated", "rejected"].includes(v),
  ) as string | undefined;
  const t = await getT();
  const all = await flowCasesOf(user, step);
  // Sem os cartões por pedido embaixo da lista (o trabalho fica no pedido no
  // passo, aberto pelo "Resolver"): Certificação e Arte para todos; os
  // outros passos para a Wellmix (administradores e operadores).
  const listOnly = listOnlyFor(user, step);
  const filter = (DUES as readonly string[]).includes(String(due))
    ? String(due)
    : null;
  const tasks = filter ? all.filter((x) => x.due === filter) : all;
  const base = `/app/flow/${block}/${key}`;
  // Aba "Todos no passo": a Wellmix vê todos; o parceiro, os pedidos dele,
  // só com o que é dele.
  const showAll = tab === "all";
  // Wellmix: só a página mostrada é lida (com o histórico do Sankhya são
  // milhares de pedidos no passo); na aba Pendências, só a contagem.
  const pageNumber =
    typeof page === "string" && /^\d{1,5}$/.test(page) ? Number(page) : 1;
  // Busca da aba (dono, 17/11/2026): em todos os pedidos do passo, não só
  // na página (a tabela não tem outra caixa de busca).
  const query =
    showAll && typeof rawQuery === "string"
      ? rawQuery.trim().slice(0, 120)
      : "";
  const stepAll = wellmix
    ? await flowStepEntities(user, step, {
        page: pageNumber,
        load: showAll,
        q: query,
      })
    : null;
  const entities = stepAll
    ? stepAll.entities
    : ((await flowPartnerAllFor(user)).get(stepId(step)) ?? []);
  const allCount = stepAll ? stepAll.total : entities.length;
  // Voltar ao Overview (Wellmix). O "Criar pedido" saiu do passo Pedidos
  // (dono, 18/11/2026); continua no Overview e na lista de pedidos.
  const headerActions = (
    <>
      {wellmix && FLOW_OVERVIEW_BLOCKS.includes(step.block) ? (
        <TextLink href={overviewHref(step.block)} data-flow-back>
          {t("flow.step.back", { block: t(blockLabelKey(step.block)) })}
        </TextLink>
      ) : null}
    </>
  );
  const tabs = (
    <nav
      aria-label={t("flow.tabs")}
      className="mb-4 flex gap-1 border-b border-zinc-200 text-sm"
      data-flow-tabs
    >
      {(
        [
          ["pending", base, all.length],
          ["all", `${base}?tab=all`, allCount],
        ] as const
      ).map(([id, href, n]) => {
        const active = (id === "all") === showAll;
        return (
          <a
            key={id}
            href={href}
            aria-current={active ? "page" : undefined}
            data-flow-tab={id}
            className={`-mb-px border-b-2 px-3 py-2 ${
              active
                ? "border-brand-600 font-semibold text-brand-700"
                : "border-transparent text-zinc-600 hover:text-zinc-900"
            }`}
          >
            {t(id === "all" ? "flow.tab.all" : "flow.tab.pending")} ({n})
          </a>
        );
      })}
    </nav>
  );
  if (showAll)
    return (
      <div data-flow-step={`${block}/${key}`}>
        <PageHeader
          title={t(stepLabelKey(step))}
          subtitle={t(stepHelpKey(step))}
          actions={headerActions}
        />
        {tabs}
        {stepAll ? (
          // Busca (GET, ao digitar): o resultado fica no endereço.
          <form
            method="get"
            action={base}
            className="mb-3 flex flex-wrap items-center gap-2"
            data-flow-all-search
          >
            <input type="hidden" name="tab" value="all" />
            <Input
              type="search"
              name="q"
              defaultValue={query}
              placeholder={t("flow.all.search")}
              aria-label={t("flow.all.search")}
              className="w-full max-w-md"
            />
            <LiveSearch />
            <Button type="submit" variant="primary">
              {t("flow.all.searchButton")}
            </Button>
            {query ? (
              <>
                <TextLink href={`${base}?tab=all`}>
                  {t("flow.all.clear")}
                </TextLink>
                <span className="text-sm text-zinc-500" data-flow-all-found>
                  {t("flow.all.found", {
                    n: stepAll.matched,
                    total: stepAll.total,
                  })}
                </span>
              </>
            ) : null}
          </form>
        ) : null}
        <FlowAll
          step={step}
          entities={entities}
          t={t}
          partner={!wellmix}
          paged={!!stepAll}
          emptyText={query ? t("flow.all.searchEmpty") : undefined}
        />
        {stepAll && stepAll.pages > 1 ? (
          <ServerPager
            page={{
              page: stepAll.page - 1,
              pages: stepAll.pages,
              from: (stepAll.page - 1) * FLOW_STEP_PAGE + 1,
              to: Math.min(stepAll.matched, stepAll.page * FLOW_STEP_PAGE),
              matched: stepAll.matched,
            }}
            href={(n) => {
              const params = new URLSearchParams({ tab: "all" });
              if (query) params.set("q", query);
              if (n) params.set("page", String(n + 1));
              return `${base}?${params.toString()}`;
            }}
            t={t}
          />
        ) : null}
      </div>
    );
  // Aviso de "feito" das ações da produção e da arte (os cartões leem o seu).
  const productionNotice =
    typeof production === "string" &&
    ["saved", "followup", "scheduled", "inspected", "fixed"].includes(
      production,
    )
      ? t(`production.done.${production}` as DictionaryKey)
      : null;
  const receivingNotice =
    typeof receiving === "string" &&
    ["saved", "counted", "ric", "returned", "closed"].includes(receiving)
      ? t(`receiving.done.${receiving}` as DictionaryKey)
      : null;
  return (
    <div data-flow-step={`${block}/${key}`}>
      <PageHeader
        title={t(stepLabelKey(step))}
        subtitle={t(stepHelpKey(step))}
        actions={headerActions}
      />
      {tabs}
      {step.block === "order" && step.key === "orders" ? (
        <p className="mb-3 text-sm">
          <TextLink href="/app/orders" data-flow-orders-list>
            {t("flow.orders.list")}
          </TextLink>
        </p>
      ) : null}
      <nav
        aria-label={t("flow.cases.filter")}
        className="mb-3 flex flex-wrap gap-2 text-sm"
      >
        {[null, ...DUES].map((d) => {
          const n = d ? all.filter((x) => x.due === d).length : all.length;
          const active = d === filter;
          return (
            <a
              key={d ?? "all"}
              href={d ? `${base}?due=${d}` : base}
              aria-current={active ? "page" : undefined}
              data-flow-filter={d ?? "all"}
              className={`rounded-full border px-3 py-1 ${
                active
                  ? "border-brand-600 bg-brand-50 font-semibold text-brand-700"
                  : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {t(`flow.due.${d ?? "all"}` as const)} ({n})
            </a>
          );
        })}
      </nav>
      {saved === "1" ? (
        <div className="mb-3">
          <Alert tone="success">{t("flow.work.saved")}</Alert>
        </div>
      ) : null}
      <FlowCases step={step} tasks={tasks} t={t} />
      {listOnly ? null : (
        <>
          <FlowRequirementWork user={user} step={step} tasks={all} t={t} />
          {step.block === "production" &&
          (step.key === "production" ||
            step.key === "inspection" ||
            step.key === "pre-production") ? (
            <FlowProductionWork
              user={user}
              step={step}
              tasks={all}
              t={t}
              notice={productionNotice}
            />
          ) : null}
          {step.block === "production" && step.key === "logistics" ? (
            <FlowFreightWork
              user={user}
              step={step}
              tasks={all}
              t={t}
              notice={typeof freight === "string" ? freight : null}
              count={
                typeof freightN === "string" && /^\d{1,3}$/.test(freightN)
                  ? Number(freightN)
                  : 0
              }
            />
          ) : null}
          {step.block === "delivery" &&
          (step.key === "storage" || step.key === "return") ? (
            <FlowReceivingWork
              step={step}
              tasks={all}
              t={t}
              notice={receivingNotice}
            />
          ) : null}
          <FlowStepWork
            user={user}
            step={step}
            tasks={all}
            t={t}
            notice={done ? t(`importFlow.done.${done}` as DictionaryKey) : null}
          />
        </>
      )}
      {/* Vendas → Amostras e Ofertas (Wellmix): o registro de a quem foi
          oferecido e o histórico só existem aqui (não repetem a lista), então
          seguem também no "só a lista". */}
      {step.block === "sales" &&
      (step.key === "samples" || step.key === "offers") &&
      wellmix ? (
        <FlowSalesWork step={step} tasks={all} t={t} />
      ) : null}
    </div>
  );
}
