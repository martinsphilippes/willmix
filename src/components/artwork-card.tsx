import type { Order } from "@/lib/db";
import type { ArtworkView } from "@/lib/services/artwork";
import {
  assignDesignerAction,
  fixArtIssueAction,
  reportArtIssueAction,
  reviewArtFixAction,
} from "@/app/app/actions/artwork";
import {
  Alert,
  Badge,
  Card,
  Input,
  Select,
  Table,
  Td,
  Th,
  formatDate,
  rowClass,
} from "./ui";
import { SubmitButton } from "./submit-button";
import type { getT } from "@/i18n/server";
import Link from "next/link";
import { ASSIGN_HREF } from "@/lib/assign-href";

/*
 * Artes do pedido (Fase F): designer, não conformidade por SKU com a volta ao
 * designer e "baixar todas as artes" (zip só com o que o usuário pode abrir).
 */

type Translate = Awaited<ReturnType<typeof getT>>;

const fileClass =
  "block w-full text-sm text-zinc-700 file:mr-2 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm";

export function ArtworkCard({
  t,
  order,
  view,
  wellmix,
  notice,
}: {
  t: Translate;
  order: Order;
  view: ArtworkView;
  wellmix: boolean;
  notice: string | null;
}) {
  const hidden = <input type="hidden" name="orderId" value={order.id} />;
  const tone = (s: string) =>
    s === "accepted" ? "success" : s === "fixed" ? "warning" : "danger";

  return (
    <Card
      title={t("artwork.title")}
      actions={
        <a
          href={`/api/orders/${order.id}/artwork`}
          className="text-sm font-medium text-brand-700 underline"
          data-artwork-zip
        >
          {t("artwork.downloadAll")}
        </a>
      }
    >
      <span id="artwork" className="block scroll-mt-24" />
      <div className="space-y-3" data-artwork-card>
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        {/* Designer do pedido numa linha. */}
        <Table>
          <thead>
            <tr>
              <Th>{t("artwork.col.designer")}</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td className="min-w-56">
                {wellmix ? (
                  <form
                    action={assignDesignerAction}
                    className="flex flex-wrap items-center gap-2"
                  >
                    {hidden}
                    <Select
                      name="designerUserId"
                      defaultValue={order.designerUserId ?? ""}
                      aria-label={t("artwork.designer")}
                      className="min-w-0 flex-1"
                    >
                      <option value="">—</option>
                      {view.candidates.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                          {u.role === "agency" ? ` (${t("role.agency")})` : ""}
                        </option>
                      ))}
                    </Select>
                    <SubmitButton
                      variant="secondary"
                      className="px-2.5 py-1 text-xs"
                      data-artwork-designer
                    >
                      {t("artwork.saveDesigner")}
                    </SubmitButton>
                    {!view.candidates.length ? (
                      <span className="w-full text-xs text-zinc-500">
                        {t("artwork.noCandidates")}
                      </span>
                    ) : null}
                    {/* Visão interna: quem recebe as correções e a aplicação
                        do selo agora, e o aviso quando falta o designer. */}
                    {view.maker ? (
                      <span
                        className="w-full text-xs text-zinc-600"
                        data-artwork-maker={view.maker.via}
                      >
                        {t("artwork.maker", {
                          name: view.maker.label ?? t("artwork.maker.team"),
                        })}
                      </span>
                    ) : null}
                    {view.maker?.missing === "designer" ? (
                      <span
                        className="w-full text-xs font-medium text-amber-700"
                        data-artwork-missing="designer"
                      >
                        {t("artwork.missingDesigner", {
                          who: view.maker.label ?? t("artwork.maker.team"),
                        })}
                      </span>
                    ) : null}
                    {view.maker?.missing === "analyst" ? (
                      <span
                        className="w-full text-xs font-medium text-amber-700"
                        data-artwork-missing="analyst"
                      >
                        {t("certFlow.missing.analyst")}{" "}
                        <Link
                          href={ASSIGN_HREF.analyst(order.id)}
                          className="text-brand-700 underline"
                        >
                          {t("certFlow.assign.analyst")}
                        </Link>
                      </span>
                    ) : null}
                  </form>
                ) : (
                  (view.designer?.name ?? "—")
                )}
              </Td>
            </tr>
          </tbody>
        </Table>

        {/* Não conformidade por SKU: uma por linha (SKU sem nenhuma, uma
            linha "sem não conformidade"). */}
        <Table>
          <thead>
            <tr>
              <Th>{t("artwork.col.sku")}</Th>
              <Th>{t("artwork.col.status")}</Th>
              <Th>{t("artwork.col.issue")}</Th>
              <Th>{t("artwork.col.fix")}</Th>
              <Th>{t("artwork.col.action")}</Th>
            </tr>
          </thead>
          <tbody>
            {view.items.flatMap(({ item, issues }) =>
              issues.length === 0
                ? [
                    <tr
                      key={item.id}
                      className={rowClass}
                      data-artwork-item={item.id}
                    >
                      <Td className="min-w-40 font-medium">{item.name}</Td>
                      <Td className="whitespace-nowrap">
                        <Badge tone="neutral">{t("artwork.noIssues")}</Badge>
                      </Td>
                      <Td>—</Td>
                      <Td>—</Td>
                      <Td>—</Td>
                    </tr>,
                  ]
                : issues.map((issue, n) => (
                    <tr
                      key={issue.id}
                      id={`artwork-issue-${issue.id}`}
                      className={`${rowClass} scroll-mt-24`}
                      data-artwork-item={n === 0 ? item.id : undefined}
                      data-artwork-issue={issue.status}
                    >
                      <Td className="min-w-40 font-medium">{item.name}</Td>
                      <Td className="whitespace-nowrap">
                        <Badge tone={tone(issue.status)}>
                          {t(`artwork.status.${issue.status}`)}
                        </Badge>
                      </Td>
                      <Td className="min-w-48">
                        <span className="whitespace-pre-line">
                          {issue.note}
                        </span>
                        {issue.documentId ? (
                          <a
                            href={`/api/files/${issue.documentId}`}
                            className="ml-1 text-brand-700 underline"
                          >
                            {t("artwork.file")}
                          </a>
                        ) : null}
                      </Td>
                      <Td className="min-w-48 text-zinc-600">
                        {issue.fixNote ? (
                          <>
                            {t("artwork.fix", {
                              note: issue.fixNote,
                              date: formatDate(issue.fixedAt, t),
                            })}
                            {issue.fixDocumentId ? (
                              <a
                                href={`/api/files/${issue.fixDocumentId}`}
                                className="ml-1 text-brand-700 underline"
                              >
                                {t("artwork.file")}
                              </a>
                            ) : null}
                          </>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td className="min-w-64">
                        {issue.status === "open" && view.canFix ? (
                          <form
                            action={fixArtIssueAction}
                            className="flex flex-wrap items-end gap-2"
                          >
                            {hidden}
                            <input
                              type="hidden"
                              name="issueId"
                              value={issue.id}
                            />
                            <Input
                              name="fixNote"
                              required
                              maxLength={2000}
                              placeholder={t("artwork.fixPh")}
                            />
                            <input
                              type="file"
                              name="file"
                              className={fileClass}
                              aria-label={t("artwork.file")}
                            />
                            <SubmitButton
                              className="px-2.5 py-1 text-xs"
                              data-artwork-fix
                            >
                              {t("artwork.sendFix")}
                            </SubmitButton>
                          </form>
                        ) : issue.status === "fixed" && view.canReview ? (
                          <form
                            action={reviewArtFixAction}
                            className="flex flex-wrap items-end gap-2"
                          >
                            {hidden}
                            <input
                              type="hidden"
                              name="issueId"
                              value={issue.id}
                            />
                            <Input
                              name="note"
                              maxLength={2000}
                              placeholder={t("artwork.reopenPh")}
                            />
                            <SubmitButton
                              name="decision"
                              value="accept"
                              className="px-2.5 py-1 text-xs"
                              data-artwork-accept
                            >
                              {t("artwork.accept")}
                            </SubmitButton>
                            <SubmitButton
                              name="decision"
                              value="reopen"
                              variant="danger"
                              className="px-2.5 py-1 text-xs"
                              data-artwork-reopen
                            >
                              {t("artwork.reopen")}
                            </SubmitButton>
                          </form>
                        ) : (
                          "—"
                        )}
                      </Td>
                    </tr>
                  )),
            )}
          </tbody>
        </Table>

        {/* Nova não conformidade (Wellmix): escolhe o SKU numa linha só. */}
        {wellmix && view.items.length ? (
          <details className="rounded-xl border border-zinc-200 bg-white">
            <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-brand-700 [&::-webkit-details-marker]:hidden">
              {t("artwork.reportTitle")}
            </summary>
            <form
              action={reportArtIssueAction}
              className="flex flex-wrap items-end gap-2 border-t border-zinc-200 p-3"
            >
              {hidden}
              <Select
                name="orderItemId"
                required
                defaultValue={view.items[0].item.id}
                aria-label={t("artwork.col.sku")}
              >
                {view.items.map(({ item }) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
              <Input
                name="note"
                required
                maxLength={2000}
                placeholder={t("artwork.issuePh")}
                className="min-w-0 flex-1"
              />
              <input
                type="file"
                name="file"
                className={fileClass}
                aria-label={t("artwork.file")}
              />
              <SubmitButton
                variant="secondary"
                className="px-2.5 py-1 text-xs"
                data-artwork-report
              >
                {t("artwork.report")}
              </SubmitButton>
            </form>
          </details>
        ) : null}
      </div>
    </Card>
  );
}
