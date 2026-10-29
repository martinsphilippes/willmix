import type { Order } from "@/lib/db";
import type { ArtworkView } from "@/lib/services/artwork";
import {
  assignDesignerAction,
  fixArtIssueAction,
  reportArtIssueAction,
  reviewArtFixAction,
} from "@/app/app/actions/artwork";
import { Alert, Badge, Card, Input, Select, formatDate } from "./ui";
import { SubmitButton } from "./submit-button";
import type { getT } from "@/i18n/server";

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
        {/* Designer do pedido. */}
        {wellmix ? (
          <form
            action={assignDesignerAction}
            className="flex flex-wrap items-end gap-2"
          >
            {hidden}
            <label className="text-sm font-medium text-zinc-800">
              {t("artwork.designer")}
              <Select
                name="designerUserId"
                defaultValue={order.designerUserId ?? ""}
              >
                <option value="">—</option>
                {view.candidates.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {u.role === "agency" ? ` (${t("role.agency")})` : ""}
                  </option>
                ))}
              </Select>
            </label>
            <SubmitButton
              variant="secondary"
              className="px-2.5 py-1 text-xs"
              data-artwork-designer
            >
              {t("artwork.saveDesigner")}
            </SubmitButton>
            {!view.candidates.length ? (
              <p className="w-full text-xs text-zinc-500">
                {t("artwork.noCandidates")}
              </p>
            ) : null}
          </form>
        ) : (
          <p className="text-sm">
            {t("artwork.designer")}: {view.designer?.name ?? "—"}
          </p>
        )}

        {/* Não conformidade por SKU. */}
        <ul className="space-y-2.5">
          {view.items.map(({ item, issues }) => (
            <li
              key={item.id}
              className="rounded-lg border border-zinc-200 p-2.5 text-sm"
              data-artwork-item={item.id}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{item.name}</span>
                {!issues.length ? (
                  <Badge tone="neutral">{t("artwork.noIssues")}</Badge>
                ) : null}
              </div>
              {issues.map((issue) => (
                <div
                  key={issue.id}
                  className="mt-2 border-l-2 border-zinc-200 pl-2"
                  data-artwork-issue={issue.status}
                >
                  <Badge tone={tone(issue.status)}>
                    {t(`artwork.status.${issue.status}`)}
                  </Badge>{" "}
                  <span className="whitespace-pre-line">{issue.note}</span>
                  {issue.documentId ? (
                    <a
                      href={`/api/files/${issue.documentId}`}
                      className="ml-1 text-brand-700 underline"
                    >
                      {t("artwork.file")}
                    </a>
                  ) : null}
                  {issue.fixNote ? (
                    <p className="mt-1 text-zinc-600">
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
                    </p>
                  ) : null}
                  {issue.status === "open" && view.canFix ? (
                    <form
                      action={fixArtIssueAction}
                      className="mt-1.5 flex flex-wrap items-end gap-2"
                    >
                      {hidden}
                      <input type="hidden" name="issueId" value={issue.id} />
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
                  ) : null}
                  {issue.status === "fixed" && wellmix ? (
                    <form
                      action={reviewArtFixAction}
                      className="mt-1.5 flex flex-wrap items-end gap-2"
                    >
                      {hidden}
                      <input type="hidden" name="issueId" value={issue.id} />
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
                  ) : null}
                </div>
              ))}
              {wellmix ? (
                <form
                  action={reportArtIssueAction}
                  className="mt-2 flex flex-wrap items-end gap-2"
                >
                  {hidden}
                  <input type="hidden" name="orderItemId" value={item.id} />
                  <Input
                    name="note"
                    required
                    maxLength={2000}
                    placeholder={t("artwork.issuePh")}
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
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
