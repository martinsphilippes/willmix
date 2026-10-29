import Link from "next/link";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { getStore, type PackagingBrief, type Request } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import {
  briefForRequest,
  suggestedPackagingOwner,
} from "@/lib/services/packaging-brief";
import {
  ITEM_COLUMN,
  missingPackagingItems,
} from "@/lib/services/packaging-brief-calc";
import {
  assignPackagingBriefAction,
  cancelPackagingBriefAction,
  openPackagingBriefAction,
  savePackagingBriefTextAction,
} from "@/app/app/actions/packaging-brief";
import { SubmitButton } from "./submit-button";
import {
  Badge,
  Card,
  Field,
  LinkButton,
  Select,
  Textarea,
  formatDate,
  type Tone,
} from "./ui";

/*
 * Embalagem (faca e arte) na solicitação, para a Wellmix: os campos que vão
 * no formulário "Abrir RFQ" (quem faz, abrir agora, instruções) e o cartão
 * com a situação do briefing, o dono e os entregáveis.
 */

export const BRIEF_TONE: Record<PackagingBrief["status"], Tone> = {
  open: "warning",
  ready: "success",
  transferred: "info",
  cancelled: "neutral",
};

async function activeAgencies() {
  return getStore().list("parties", {
    filter: { type: "agency", active: true },
    orderBy: "name",
  });
}

/** Seletor "quem faz": agências ativas e o marketing Wellmix. */
export function OwnerSelect({
  t,
  agencies,
  value,
  current,
  name = "packagingOwner",
  ariaLabel,
}: {
  t: Translate;
  agencies: Array<{ id: string; name: string }>;
  value: string | null;
  /** Dono atual fora da lista (agência inativa): continua visível, não cai na primeira. */
  current?: { id: string; name: string } | null;
  name?: string;
  ariaLabel?: string;
}) {
  const missing =
    current && value === current.id && !agencies.some((a) => a.id === value)
      ? current
      : null;
  return (
    <Select
      name={name}
      defaultValue={value ?? "wellmix"}
      aria-label={ariaLabel}
      data-packaging-owner
    >
      {missing ? (
        <option value={missing.id}>
          {t("packBrief.owner.inactive", { name: missing.name })}
        </option>
      ) : null}
      {agencies.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
      <option value="wellmix">{t("packBrief.owner.wellmix")}</option>
    </Select>
  );
}

/**
 * Campos da embalagem dentro do formulário da RFQ (uma solicitação ou o
 * lote). Já vêm preenchidos com o dono padrão: no caso comum, nenhum clique a
 * mais. Nada é mostrado quando a configuração adia o briefing ou quando a
 * solicitação já tem o seu.
 */
export async function PackagingRfqFields({
  t,
  hasBrief = false,
  withBrief = true,
}: {
  t: Translate;
  hasBrief?: boolean;
  /** Campo de instruções (só na solicitação; no lote não). */
  withBrief?: boolean;
}) {
  if (hasBrief) return null;
  const settings = await getSettings();
  if (settings.packagingBriefAt !== "rfq") return null;
  const [agencies, owner] = await Promise.all([
    settings.agencyValidationEnabled ? activeAgencies() : [],
    suggestedPackagingOwner(),
  ]);
  return (
    <div
      className="space-y-2 rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-2.5"
      data-packaging-rfq
    >
      <input type="hidden" name="packagingForm" value="1" />
      <label className="flex items-center gap-2 text-sm text-zinc-800">
        <input
          type="checkbox"
          name="packagingEnabled"
          defaultChecked
          className="h-4 w-4 accent-brand-600"
          data-packaging-enabled
        />
        <span className="font-medium">{t("packBrief.rfq.openNow")}</span>
      </label>
      <p className="text-xs leading-relaxed text-zinc-500">
        {t("packBrief.rfq.hint")}
      </p>
      {settings.agencyValidationEnabled ? (
        <Field label={t("packBrief.rfq.owner")}>
          <OwnerSelect t={t} agencies={agencies} value={owner.agencyId} />
        </Field>
      ) : null}
      {withBrief ? (
        <Field label={t("packBrief.rfq.brief")}>
          <Textarea
            name="packagingBrief"
            rows={2}
            maxLength={2000}
            placeholder={t("packBrief.instructions.placeholder")}
          />
        </Field>
      ) : null}
    </div>
  );
}

const ITEM_KEYS = [
  "dieline",
  "art",
  "print_ready",
  "packaging_sample",
] as const;

/** Cartão da solicitação (Wellmix): situação, dono, entregáveis e ações. */
export async function PackagingBriefCard({
  t,
  request,
  saved,
}: {
  t: Translate;
  request: Request;
  saved?: string;
}) {
  const brief = await briefForRequest(request.id);
  const settings = await getSettings();
  const canOpen =
    !brief || brief.status === "cancelled"
      ? !["ORDERED", "CANCELLED"].includes(request.status)
      : false;
  if (!brief && !canOpen) return null;
  const [agencies, owner, agency] = await Promise.all([
    settings.agencyValidationEnabled ? activeAgencies() : [],
    !brief || brief.status === "cancelled" ? suggestedPackagingOwner() : null,
    brief?.agencyId ? getStore().get("parties", brief.agencyId) : null,
  ]);
  const back = `/app/requests/${request.id}#packaging`;
  const live = brief && brief.status !== "cancelled" ? brief : null;
  const missing = new Set<string>(live ? missingPackagingItems(live) : []);
  // Depois do pedido, a arte pode ter sido enviada pelo próprio pedido.
  const orderArtDone = live?.orderArtRequirementId
    ? (await getStore().get("requirements", live.orderArtRequirementId))
        ?.status === "done"
    : false;
  if (orderArtDone) missing.delete("art");

  return (
    <div data-packaging-card className="min-w-0">
      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span id="packaging" className="scroll-mt-24">
              {t("packBrief.card.title")}
            </span>
            {brief ? (
              <Badge tone={BRIEF_TONE[brief.status]}>
                {t(`packBrief.status.${brief.status}` as DictionaryKey)}
              </Badge>
            ) : null}
            {live && !live.orderId && request.status !== "ORDERED" ? (
              <Badge tone="warning">{t("packBrief.presale")}</Badge>
            ) : null}
          </span>
        }
        actions={
          live ? (
            <LinkButton href={`/app/packaging/${live.id}`} variant="secondary">
              {t("packBrief.card.view")}
            </LinkButton>
          ) : null
        }
      >
        {saved === "packaging" || saved === "owner" || saved === "brief" ? (
          <p className="mb-2 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800">
            {t("packBrief.saved")}
          </p>
        ) : null}
        {live ? (
          <div className="space-y-3 text-sm">
            <ul className="grid gap-1.5 sm:grid-cols-2" data-packaging-items>
              {ITEM_KEYS.map((key) => {
                const required = live.requiredKeys.includes(key);
                const done =
                  (!!live[ITEM_COLUMN[key]] ||
                    (key === "art" && orderArtDone)) &&
                  !missing.has(key);
                return (
                  <li
                    key={key}
                    className="flex items-center gap-2 rounded-lg border border-zinc-200 px-2.5 py-1.5"
                    data-packaging-item={key}
                    data-done={done ? "1" : "0"}
                  >
                    <span
                      className={
                        done
                          ? "text-emerald-700"
                          : required
                            ? "text-amber-700"
                            : "text-zinc-400"
                      }
                      aria-hidden
                    >
                      {done ? "✓" : "—"}
                    </span>
                    <span className="flex-1">
                      {t(`packBrief.item.${key}` as DictionaryKey)}
                      {required ? null : (
                        <span className="ml-1 text-xs text-zinc-500">
                          ({t("packBrief.item.optional")})
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {t("packBrief.card.owner")}
                </dt>
                <dd data-packaging-owner-name>
                  {agency?.name ?? t("packBrief.owner.wellmix")}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {t("packBrief.card.due")}
                </dt>
                <dd>{formatDate(live.dueAt, t)}</dd>
              </div>
              {live.dimsChangedAt ? (
                <div className="sm:col-span-2 text-amber-700">
                  {t("packBrief.card.dimsChanged", {
                    date: formatDate(live.dimsChangedAt, t),
                  })}
                </div>
              ) : null}
              {live.orderId ? (
                <div className="sm:col-span-2">
                  <Link
                    href={`/app/orders/${live.orderId}`}
                    className="text-brand-700 underline-offset-2 hover:underline"
                  >
                    {t("packBrief.openOrder")} →
                  </Link>
                </div>
              ) : null}
            </dl>
            {settings.agencyValidationEnabled &&
            live.status !== "transferred" ? (
              <form
                action={assignPackagingBriefAction}
                className="flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="briefId" value={live.id} />
                <input type="hidden" name="back" value={back} />
                <div className="min-w-48 flex-1">
                  <Field label={t("packBrief.owner.label")}>
                    <OwnerSelect
                      t={t}
                      agencies={agencies}
                      value={live.agencyId}
                      current={
                        agency ? { id: agency.id, name: agency.name } : null
                      }
                      name="agencyId"
                      ariaLabel={t("packBrief.owner.label")}
                    />
                  </Field>
                </div>
                <SubmitButton variant="secondary">
                  {t("packBrief.owner.save")}
                </SubmitButton>
              </form>
            ) : null}
            <form action={savePackagingBriefTextAction} className="space-y-1.5">
              <input type="hidden" name="briefId" value={live.id} />
              <input type="hidden" name="back" value={back} />
              <Field label={t("packBrief.instructions")}>
                <Textarea
                  name="brief"
                  rows={2}
                  maxLength={4000}
                  defaultValue={live.brief ?? ""}
                  placeholder={t("packBrief.instructions.placeholder")}
                />
              </Field>
              <SubmitButton variant="secondary">
                {t("packBrief.instructions.save")}
              </SubmitButton>
            </form>
            {live.status !== "transferred" ? (
              <form action={cancelPackagingBriefAction} className="text-right">
                <input type="hidden" name="briefId" value={live.id} />
                <input type="hidden" name="back" value={back} />
                <SubmitButton
                  variant="danger"
                  confirmText={t("packBrief.cancelConfirm")}
                  data-packaging-cancel
                >
                  {t("packBrief.cancel")}
                </SubmitButton>
              </form>
            ) : null}
          </div>
        ) : canOpen ? (
          <form action={openPackagingBriefAction} className="space-y-2">
            <input type="hidden" name="requestId" value={request.id} />
            <p className="text-sm text-zinc-600">{t("packBrief.card.none")}</p>
            {settings.agencyValidationEnabled ? (
              <Field label={t("packBrief.rfq.owner")}>
                <OwnerSelect
                  t={t}
                  agencies={agencies}
                  value={owner?.agencyId ?? null}
                />
              </Field>
            ) : null}
            <Field label={t("packBrief.rfq.brief")}>
              <Textarea
                name="packagingBrief"
                rows={2}
                maxLength={2000}
                placeholder={t("packBrief.instructions.placeholder")}
              />
            </Field>
            <SubmitButton variant="secondary" data-packaging-open>
              {t("packBrief.openNow")}
            </SubmitButton>
          </form>
        ) : (
          // Cancelado e a solicitação já fechada: só o registro.
          <p className="text-sm text-zinc-500">
            {t("packBrief.cancelledHint")}
          </p>
        )}
      </Card>
    </div>
  );
}
