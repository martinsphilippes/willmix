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
  saveProcessRulesAction,
  setSankhyaExecutionAction,
} from "../../actions/processes";
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
  return t(`processes.event.${key}` as DictionaryKey);
}

const STATUS_TONE = {
  done: "success",
  simulated: "info",
  skipped: "neutral",
  error: "danger",
} as const;

export async function ProcessTab({ t, q }: { t: Translate; q: Params }) {
  const [rules, erp, events] = await Promise.all([
    getProcessRules(),
    getSankhyaErpSettings(),
    getStore()
      .list("process_events", {
        orderBy: "createdAt",
        direction: "desc",
        limit: 50,
      })
      .catch(() => []),
  ]);
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
                    {e.orderId ? (
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
