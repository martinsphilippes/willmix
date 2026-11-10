import type { Translate } from "@/i18n";
import type { Request } from "@/lib/db";
import type { RequestStageRow, RequestStageState } from "@/lib/request-stages";
import { loadRequestStages } from "@/lib/services/request-stages";
import { ChatOpenButton } from "./chat-open-button";
import {
  Badge,
  Card,
  StepDot,
  Table,
  Td,
  Th,
  cx,
  formatDate,
  stageTone,
  type StepState,
} from "./ui";

/*
 * "Etapas da solicitação" (só a Wellmix): da solicitação nova ao sinal, como
 * as "Etapas do pedido". Cada linha com quem está, prazo, quando terminou e
 * o botão de mensagem para quem responde por ela (fornecedores, o fornecedor
 * escolhido ou o cliente). Regras em src/lib/request-stages.ts.
 */

const DOT: Record<RequestStageState, StepState> = {
  done: "done",
  active: "active",
  pending: "pending",
  skipped: "pending",
  cancelled: "cancelled",
};

export async function RequestStagesCard({
  t,
  request,
}: {
  t: Translate;
  request: Request;
}) {
  const view = await loadRequestStages(request);
  const draft = (row: RequestStageRow) =>
    t("orderView.stage.chatDraft", { stage: t(`reqStage.${row.key}`) });
  // Com quem conversar em cada linha (as internas da Wellmix não têm).
  const chat = (row: RequestStageRow) => {
    if (row.state === "skipped") return null;
    if (row.who === "customer")
      return {
        partyId: request.customerId,
        who: t("reqStage.who.customer"),
      };
    if (row.who === "supplier" && view.supplier)
      return {
        partyId: view.supplier.id,
        who: `${t("reqStage.who.supplier")} (${view.supplier.name})`,
      };
    if (row.who === "suppliers" && view.invited.length) {
      const first = view.invited[0];
      return {
        partyId: first.id,
        who: `${t("reqStage.who.supplier")} (${first.name})`,
      };
    }
    return null;
  };
  return (
    <div id="request-stages" className="scroll-mt-24" data-request-stages>
      <Card title={t("reqStage.title")}>
        <p className="mb-2 text-xs text-zinc-600">{t("reqStage.hint")}</p>
        <Table>
          <thead>
            <tr>
              <Th className="w-10">#</Th>
              <Th>{t("reqStage.col.stage")}</Th>
              <Th>{t("reqStage.col.state")}</Th>
              <Th>{t("reqStage.col.who")}</Th>
              <Th>{t("reqStage.col.due")}</Th>
              <Th>{t("reqStage.col.done")}</Th>
            </tr>
          </thead>
          <tbody>
            {view.rows.map((row, index) => {
              const target = chat(row);
              return (
                <tr
                  key={row.key}
                  className={cx(
                    "border-t border-zinc-100",
                    row.state === "active" && "bg-brand-50/60",
                    row.late && "bg-red-50/60",
                  )}
                  data-request-stage={row.key}
                  data-request-stage-state={row.state}
                >
                  <Td className="w-10">
                    <StepDot state={DOT[row.state]}>{index + 1}</StepDot>
                  </Td>
                  <Td className="min-w-44">
                    <span
                      className={cx(
                        "block",
                        row.state === "pending" || row.state === "skipped"
                          ? "text-zinc-500"
                          : row.state === "active"
                            ? "font-semibold text-brand-800"
                            : "font-medium text-zinc-900",
                      )}
                    >
                      {t(`reqStage.${row.key}`)}
                    </span>
                    <span className="block text-xs text-zinc-500">
                      {row.answered && row.answered.total > 0
                        ? t("reqStage.answered", row.answered)
                        : row.superplan
                          ? t("reqStage.dieline.hint.superplan")
                          : t(`reqStage.${row.key}.hint`)}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <Badge
                      tone={
                        row.late
                          ? "danger"
                          : row.state === "skipped"
                            ? "neutral"
                            : stageTone(DOT[row.state])
                      }
                    >
                      {row.late
                        ? t("reqStage.late")
                        : t(`reqStage.state.${row.state}`)}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-zinc-700">
                    {row.state === "skipped" ? (
                      "—"
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        {t(`reqStage.who.${row.who}`)}
                        {row.level
                          ? ` · ${t(`approvals.level.${row.level}`)}`
                          : ""}
                        {target ? (
                          <span data-request-stage-chat={row.key}>
                            <ChatOpenButton
                              target={{
                                requestId: request.id,
                                partyId: target.partyId,
                                draft: draft(row),
                              }}
                              label={t("reqStage.chat", { who: target.who })}
                            />
                          </span>
                        ) : null}
                      </span>
                    )}
                  </Td>
                  <Td
                    className={cx(
                      "whitespace-nowrap tabular-nums",
                      row.late ? "font-semibold text-red-700" : "text-zinc-700",
                    )}
                  >
                    {row.dueAt ? formatDate(row.dueAt, t) : "—"}
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums text-zinc-700">
                    {row.doneAt ? formatDate(row.doneAt, t) : "—"}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
