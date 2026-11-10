import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
  Card,
  Input,
  Select,
  Table,
  Td,
  TextLink,
  Th,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { getStore } from "@/lib/db";
import {
  SANKHYA_ACTIONS,
  STOCK_ACTIONS,
  ruleProblem,
  type ProcessEventKey,
} from "@/lib/process-rules";
import { getProcessRules } from "@/lib/services/process-engine";
import { getSankhyaErpSettings } from "@/lib/integrations/sankhya-settings";
import {
  runSankhyaSyncAction,
  saveProcessRulesAction,
  saveSyncDefaultsAction,
  setSankhyaExecutionAction,
} from "../../actions/processes";
import { listPendingSync } from "@/lib/integrations/sankhya-sync";
import { one } from "./_shared";

/*
 * Configurações → Processos (só o administrador; docs/PROCESSES.md): para cada
 * status do portal, o que acontece no estoque e no Sankhya. Execução no
 * Sankhya desligada = simulação (fica registrado o que seria feito).
 */

type Params = Record<string, string | string[] | undefined>;

/** Rótulo do evento a partir das traduções que o portal já tem. */
export function eventLabel(t: Translate, event: ProcessEventKey) {
  const [kind, key, moment] = event.split(":");
  if (kind === "request")
    return `${t("processes.kind.request")}: ${t(`reqStatusLabel.${key}` as DictionaryKey)}`;
  if (kind === "stage")
    return `${t(`stage.${key}` as DictionaryKey)}: ${t(`processes.moment.${moment}` as DictionaryKey)}`;
  if (kind === "sync")
    return `${t("processes.sync")}: ${t(`processes.sync.entity.${key}` as DictionaryKey)}`;
  return t(`processes.event.${key}` as DictionaryKey);
}

const STATUS_TONE = {
  done: "success",
  simulated: "info",
  skipped: "neutral",
  error: "danger",
} as const;

export async function ProcessTab({ t, q }: { t: Translate; q: Params }) {
  const [rules, erp, events, pending] = await Promise.all([
    getProcessRules(),
    getSankhyaErpSettings(),
    getStore()
      .list("process_events", {
        orderBy: "createdAt",
        direction: "desc",
        limit: 50,
      })
      .catch(() => []),
    listPendingSync().catch(() => null),
  ]);
  const count = (list: Array<{ kind: string }> | undefined, kind: string) =>
    (list ?? []).filter((p) => p.kind === kind).length;
  const syncRan = one(q.sync);
  const saved = one(q.saved);
  const error = one(q.error);
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(t.intl, { timeZone: "America/Sao_Paulo" });

  return (
    <div className="grid gap-4">
      <Card title={t("processes.execution")}>
        <div id="execution" className="scroll-mt-4" />
        <p className="mb-3 text-sm text-zinc-600">
          {t("processes.execution.hint")}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={erp.ordersEnabled ? "success" : "warning"}>
            {erp.ordersEnabled
              ? t("processes.execution.on")
              : t("processes.execution.off")}
          </Badge>
          <form action={setSankhyaExecutionAction}>
            <input
              type="hidden"
              name="enabled"
              value={erp.ordersEnabled ? "0" : "1"}
            />
            <SubmitButton
              variant={erp.ordersEnabled ? "secondary" : "primary"}
              pendingText="…"
              confirmText={
                erp.ordersEnabled ? undefined : t("processes.execution.confirm")
              }
            >
              {erp.ordersEnabled
                ? t("processes.execution.turnOff")
                : t("processes.execution.turnOn")}
            </SubmitButton>
          </form>
        </div>
      </Card>

      <Card title={t("processes.sync")}>
        <div id="sync" className="scroll-mt-4" />
        <p className="mb-3 text-sm text-zinc-600">{t("processes.sync.hint")}</p>
        {syncRan === "ran" ? (
          <Alert tone={one(q.errors) !== "0" ? "warning" : "success"}>
            {t("processes.sync.ran", {
              done: one(q.done) || "0",
              errors: one(q.errors) || "0",
              remaining: one(q.remaining) || "0",
            })}
          </Alert>
        ) : syncRan === "off" ? (
          <Alert tone="warning">{t("processes.sync.off")}</Alert>
        ) : null}
        {one(q.defaults) ? (
          <Alert tone="success">{t("processes.sync.defaultsSaved")}</Alert>
        ) : null}
        <p className="mb-2 text-sm">
          {erp.syncSince
            ? t("processes.sync.since", { at: fmt(erp.syncSince) })
            : t("processes.sync.notStarted")}
        </p>
        {pending ? (
          <Table>
            <thead>
              <tr>
                <Th>{t("processes.sync.what")}</Th>
                <Th>{t("processes.sync.create")}</Th>
                <Th>{t("processes.sync.update")}</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td>{t("processes.sync.parties")}</Td>
                <Td>{count(pending.parties, "create")}</Td>
                <Td>{count(pending.parties, "update")}</Td>
              </tr>
              <tr>
                <Td>{t("processes.sync.products")}</Td>
                <Td>{count(pending.products, "create")}</Td>
                <Td>{count(pending.products, "update")}</Td>
              </tr>
              <tr>
                <Td>{t("processes.sync.orders")}</Td>
                <Td>—</Td>
                <Td>{pending.orders.length}</Td>
              </tr>
            </tbody>
          </Table>
        ) : null}
        <form action={runSankhyaSyncAction} className="mt-3">
          <SubmitButton pendingText="…" disabled={!erp.ordersEnabled}>
            {t("processes.sync.run")}
          </SubmitButton>
        </form>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-zinc-800">
            {t("processes.sync.defaults")}
          </summary>
          <p className="my-2 text-xs text-zinc-500">
            {t("processes.sync.defaultsHint")}
          </p>
          <form
            action={saveSyncDefaultsAction}
            className="grid gap-2 md:grid-cols-2"
          >
            <label className="grid gap-1 text-sm">
              {t("processes.sync.partnerDefaults")}
              <textarea
                name="partnerDefaults"
                defaultValue={JSON.stringify(
                  erp.partnerDefaults ?? {},
                  null,
                  2,
                )}
                className="min-h-28 rounded-md border border-zinc-300 p-2 font-mono text-xs"
              />
            </label>
            <label className="grid gap-1 text-sm">
              {t("processes.sync.productDefaults")}
              <textarea
                name="productDefaults"
                defaultValue={JSON.stringify(
                  erp.productDefaults ?? {},
                  null,
                  2,
                )}
                className="min-h-28 rounded-md border border-zinc-300 p-2 font-mono text-xs"
              />
            </label>
            <div>
              <SubmitButton variant="secondary" pendingText="…">
                {t("processes.sync.saveDefaults")}
              </SubmitButton>
            </div>
          </form>
        </details>
      </Card>

      <Card title={t("processes.rules")}>
        <div id="rules" className="scroll-mt-4" />
        <p className="mb-3 text-sm text-zinc-600">
          {t("processes.rules.hint")}
        </p>
        {saved ? <Alert tone="success">{t("processes.saved")}</Alert> : null}
        {error ? (
          <Alert tone="danger">
            {t("sankhyaInt.error.invalid_input", {
              detail: one(q.detail) || "—",
            })}
          </Alert>
        ) : null}
        <form action={saveProcessRulesAction}>
          <Table>
            <thead>
              <tr>
                <Th>{t("processes.col.event")}</Th>
                <Th>{t("processes.col.active")}</Th>
                <Th>{t("processes.col.stock")}</Th>
                <Th>{t("processes.col.sankhya")}</Th>
                <Th>TOP</Th>
                <Th>{t("processes.col.note")}</Th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule, i) => {
                const problem = ruleProblem(rule);
                return (
                  <tr key={rule.event} data-process-event={rule.event}>
                    <Td className="min-w-52 text-sm font-medium">
                      <input
                        type="hidden"
                        name={`rules.${i}.event`}
                        value={rule.event}
                      />
                      {eventLabel(t, rule.event)}
                      {problem ? (
                        <span className="block text-xs text-amber-700">
                          {t(`processes.problem.${problem}` as DictionaryKey)}
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <Select
                        name={`rules.${i}.active`}
                        defaultValue={rule.active ? "1" : "0"}
                        dense
                      >
                        <option value="1">{t("sankhyaInt.yes")}</option>
                        <option value="0">{t("sankhyaInt.no")}</option>
                      </Select>
                    </Td>
                    <Td>
                      <Select
                        name={`rules.${i}.stock`}
                        defaultValue={rule.stock}
                        dense
                      >
                        {STOCK_ACTIONS.map((a) => (
                          <option key={a} value={a}>
                            {t(`processes.stock.${a}` as DictionaryKey)}
                          </option>
                        ))}
                      </Select>
                    </Td>
                    <Td>
                      <Select
                        name={`rules.${i}.sankhya`}
                        defaultValue={rule.sankhya}
                        dense
                      >
                        {SANKHYA_ACTIONS.map((a) => (
                          <option key={a} value={a}>
                            {t(`processes.sankhya.${a}` as DictionaryKey)}
                          </option>
                        ))}
                      </Select>
                    </Td>
                    <Td>
                      <Input
                        name={`rules.${i}.top`}
                        inputMode="numeric"
                        defaultValue={rule.top == null ? "" : String(rule.top)}
                        className="w-24"
                        dense
                      />
                    </Td>
                    <Td>
                      <Input
                        name={`rules.${i}.note`}
                        defaultValue={rule.note ?? ""}
                        maxLength={200}
                        dense
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <div className="mt-3">
            <SubmitButton pendingText="…">{t("processes.save")}</SubmitButton>
          </div>
        </form>
      </Card>

      <Card title={t("processes.log")}>
        <p className="mb-3 text-sm text-zinc-600">{t("processes.log.hint")}</p>
        {events.length ? (
          <Table className="max-h-[32rem] overflow-y-auto">
            <thead>
              <tr>
                <Th>{t("processes.log.when")}</Th>
                <Th>{t("processes.col.event")}</Th>
                <Th>{t("processes.log.ref")}</Th>
                <Th>{t("processes.log.status")}</Th>
                <Th>{t("processes.log.detail")}</Th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <Td className="whitespace-nowrap text-xs">
                    {fmt(e.createdAt)}
                  </Td>
                  <Td className="text-xs">
                    {eventLabel(t, e.event as ProcessEventKey)}
                  </Td>
                  <Td className="whitespace-nowrap text-xs">
                    {e.entity === "party" && e.entityId ? (
                      <TextLink href={`/app/parties/${e.entityId}`}>
                        {t("processes.sync.entity.party")}
                      </TextLink>
                    ) : e.entity === "product" && e.entityId ? (
                      <TextLink href={`/app/products/${e.entityId}`}>
                        {t("processes.sync.entity.product")}
                      </TextLink>
                    ) : e.orderId ? (
                      <TextLink href={`/app/orders/${e.orderId}`}>
                        {t("processes.log.order")}
                      </TextLink>
                    ) : e.requestId ? (
                      <TextLink href={`/app/requests/${e.requestId}`}>
                        {t("processes.log.request")}
                      </TextLink>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td className="text-xs">
                    <Badge tone={STATUS_TONE[e.status]}>
                      {t(`processes.status.${e.status}` as DictionaryKey)}
                    </Badge>
                  </Td>
                  <Td className="text-xs text-zinc-600">{e.detail ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="text-sm text-zinc-500">{t("processes.log.empty")}</p>
        )}
      </Card>
    </div>
  );
}
