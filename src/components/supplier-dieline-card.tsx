import type { Translate } from "@/i18n";
import type { User } from "@/lib/db";
import {
  dielineBoxText,
  supplierDielineView,
} from "@/lib/services/packaging-brief";
import { uploadDielineAction } from "@/app/app/actions/packaging-brief";
import { FileAutoInput } from "./file-auto-input";
import { PhotoInput } from "./photo-input";
import { Badge, Card, formatDate, linkClass } from "./ui";

/*
 * Faca da embalagem (die-cut) para o fornecedor escolhido: depois da
 * comparação das cotações é ele quem envia a faca da caixa (na cotação
 * escolhida e, com o pedido, no pedido). A agência faz a arte em cima dela.
 * Só aparece para o fornecedor da embalagem; a Wellmix tem o cartão e a tela
 * do briefing.
 */
export async function SupplierDielineCard({
  t,
  user,
  from,
  back,
  justSent,
}: {
  t: Translate;
  user: User;
  from: { quoteId: string } | { orderId: string };
  /** Tela de volta depois do envio (a própria cotação ou o pedido). */
  back: string;
  justSent?: boolean;
}) {
  if (user.role !== "supplier") return null;
  const view = await supplierDielineView(user, from);
  if (!view) return null;
  const doc = view.document;
  const target = (
    <>
      <input type="hidden" name="briefId" value={view.briefId} />
      <input type="hidden" name="back" value={`${back}#die-cut`} />
    </>
  );
  return (
    <div id="die-cut" className="scroll-mt-24" data-supplier-dieline>
      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            {t("packBrief.dieline.title")}
            <Badge tone={doc ? "success" : "warning"}>
              {doc
                ? t("packBrief.dieline.done")
                : t("packBrief.dieline.pending")}
            </Badge>
          </span>
        }
      >
        <div className="space-y-2.5 text-sm">
          {justSent ? (
            <p
              className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800"
              data-dieline-saved
            >
              {t("packBrief.dieline.saved")}
            </p>
          ) : null}
          <p className="text-zinc-700">{t("packBrief.dieline.hint")}</p>
          <p className="text-xs text-zinc-600">
            {view.productName}
            {view.dims ? ` · ${dielineBoxText(t, view.dims)}` : ""}
            {!doc && view.dueAt
              ? ` · ${t("packBrief.dieline.due", { date: formatDate(view.dueAt, t) })}`
              : ""}
          </p>
          {doc ? (
            <p className="text-xs text-zinc-600">
              <a
                href={`/api/files/${doc.id}`}
                target="_blank"
                rel="noreferrer"
                className={linkClass}
                data-dieline-file
              >
                {doc.name}
              </a>{" "}
              {t("packBrief.item.version", {
                version: doc.version,
                date: formatDate(doc.createdAt, t),
              })}
            </p>
          ) : null}
          <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
            <form
              action={uploadDielineAction}
              className="flex flex-wrap items-center gap-1.5"
            >
              {target}
              <FileAutoInput
                name="file"
                label={t("requirement.file.add")}
                pendingLabel={t("requirement.sending")}
                uploadingLabel={t("requirement.file.uploading")}
                tooBigLabel={t("requirement.file.tooBig")}
                serverOnlyLabel={t("requirement.file.serverOnly")}
                failedLabel={t("requirement.file.failed")}
              />
            </form>
            <form
              action={uploadDielineAction}
              className="flex flex-wrap items-center gap-1.5"
            >
              {target}
              <PhotoInput
                name="file"
                multiple={false}
                capture={false}
                maxDimension={2400}
                quality={0.88}
                autoSubmit
                compact
                direct
                label={t("requirement.photo.add")}
                pendingLabel={t("requirement.sending")}
                uploadingLabel={t("photo.uploading")}
                failedLabel={t("photo.failed")}
              />
            </form>
          </div>
        </div>
      </Card>
    </div>
  );
}
