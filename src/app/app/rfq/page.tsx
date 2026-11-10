import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { getStore } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { fallbackError } from "@/i18n/error-text";
import {
  Alert,
  Badge,
  Card,
  PageHeader,
  Table,
  Td,
  TextLink,
  Th,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { setRfqEnabledAction } from "../actions/rfq";

/*
 * RFQ em espera (docs/RFQ_STANDBY.md): a tela que guarda a RFQ (pedido de
 * preço a vários fornecedores, comparação e disputa) fora do caminho
 * principal. Mostra como o fluxo está funcionando, o que ficou guardado, o
 * interruptor (só o administrador) e as solicitações em cotação.
 */
const QUOTING = ["REQUESTED", "RFQ_OPEN", "QUOTATION_RECEIVED"] as const;

export default async function RfqPage({ searchParams }: PageProps<"/app/rfq">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/rfq");
  requireScreen(user, "rfq");
  const t = await getT();
  const { saved, error } = await searchParams;
  const settings = await getSettings();
  const on = settings.rfqEnabled;
  const store = getStore();
  const requests = (
    await store.list("requests", {
      filter: { status: [...QUOTING] },
      orderBy: "createdAt",
      direction: "desc",
      limit: 50,
    })
  ).filter((r) => (QUOTING as readonly string[]).includes(r.status));
  const [quotes, suppliers] = await Promise.all([
    requests.length
      ? store.list("quotes", {
          filter: { requestId: requests.map((r) => r.id) },
        })
      : [],
    store.list("parties", { filter: { type: "supplier" } }),
  ]);
  const supplierName = new Map(suppliers.map((s) => [s.id, s.name]));
  const canOpenRequests = canOpen(user, "requests");

  return (
    <>
      <PageHeader
        t={t}
        title={t("rfqStandby.title")}
        subtitle={t("rfqStandby.subtitle")}
        actions={
          <span data-rfq-state={on ? "on" : "off"}>
            <Badge tone={on ? "success" : "warning"}>
              {t(on ? "rfqStandby.state.on" : "rfqStandby.state.off")}
            </Badge>
          </span>
        }
      />
      {typeof error === "string" && error ? (
        <div className="mb-3">
          <Alert tone="danger">{fallbackError(t, error)}</Alert>
        </div>
      ) : null}
      {saved === "on" || saved === "off" ? (
        <div className="mb-3">
          <Alert tone="success">
            {t(`rfqStandby.saved.${saved}` as DictionaryKey)}
          </Alert>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <Card title={t("rfqStandby.now.title")} className="lg:col-span-2">
          <p className="text-sm text-zinc-700" data-rfq-now>
            {t(on ? "rfqStandby.now.on" : "rfqStandby.now.off")}
          </p>
          <h3 className="mt-4 text-sm font-semibold text-zinc-900">
            {t("rfqStandby.kept.title")}
          </h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-zinc-700">
            {(["1", "2", "3", "4"] as const).map((n) => (
              <li key={n}>{t(`rfqStandby.kept.${n}` as DictionaryKey)}</li>
            ))}
          </ul>
        </Card>
        <Card title={t("rfqStandby.switch.title")}>
          <p className="text-sm text-zinc-600">
            {t(on ? "rfqStandby.switch.hintOn" : "rfqStandby.switch.hintOff")}
          </p>
          {isAdmin(user) ? (
            <form action={setRfqEnabledAction} className="mt-3">
              <input type="hidden" name="enabled" value={on ? "off" : "on"} />
              <SubmitButton
                variant={on ? "secondary" : "primary"}
                data-rfq-switch={on ? "off" : "on"}
              >
                {t(on ? "rfqStandby.switch.off" : "rfqStandby.switch.on")}
              </SubmitButton>
            </form>
          ) : (
            <p className="mt-3 text-xs text-zinc-500">
              {t("rfqStandby.switch.adminOnly")}
            </p>
          )}
        </Card>
      </div>
      <div className="mt-4">
        <Card title={t("rfqStandby.list.title")}>
          {requests.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>{t("rfqStandby.list.number")}</Th>
                  <Th>{t("rfqStandby.list.product")}</Th>
                  <Th>{t("rfqStandby.list.status")}</Th>
                  <Th>{t("rfqStandby.list.suppliers")}</Th>
                  <Th>{t("rfqStandby.list.answered")}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const mine = quotes.filter((q) => q.requestId === r.id);
                  const answered = mine.filter(
                    (q) => q.status !== "invited",
                  ).length;
                  return (
                    <tr key={r.id} data-rfq-request={r.id}>
                      <Td className="whitespace-nowrap">{r.number ?? "—"}</Td>
                      <Td>{r.productName}</Td>
                      <Td className="whitespace-nowrap">
                        {t(`reqStatusLabel.${r.status}` as DictionaryKey)}
                      </Td>
                      <Td>
                        {mine.length
                          ? mine
                              .map(
                                (q) =>
                                  supplierName.get(q.supplierId) ??
                                  q.supplierId,
                              )
                              .join(", ")
                          : t("rfqStandby.list.none")}
                      </Td>
                      <Td className="whitespace-nowrap tabular-nums">
                        {mine.length ? `${answered} / ${mine.length}` : "—"}
                      </Td>
                      <Td className="whitespace-nowrap text-right">
                        {canOpenRequests ? (
                          <TextLink href={`/app/requests/${r.id}`}>
                            {t("rfqStandby.list.open")}
                          </TextLink>
                        ) : null}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          ) : (
            <p className="text-sm text-zinc-500">
              {t("rfqStandby.list.empty")}
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
