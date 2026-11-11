import type { Party } from "@/lib/db";
import type { Translate } from "@/i18n";
import { savePartyAction } from "@/app/app/actions";
import { quickPartnerTypeAction } from "@/app/app/actions/partner-types";
import type { PartyDraft } from "@/lib/party-draft";
import { Field, Input, Select, Textarea } from "./ui";
import { SubmitButton } from "./submit-button";

/*
 * Cadastro do parceiro. Grade pela largura do cartão (@container): no cartão
 * estreito, dois campos por linha; no largo, seis colunas com o campo do
 * tamanho do conteúdo (tipo e país curtos, nome e e-mail mais largos).
 */
export interface PartyTypeOption {
  value: string;
  label: string;
}

export function PartyForm({
  party,
  t,
  types,
  selected,
  draft,
  quickType,
}: {
  party?: Party | null;
  t: Translate;
  /** Tipos oferecidos neste fluxo (do catálogo, docs/PARTNER_TYPES.md). */
  types: PartyTypeOption[];
  /** Tipo já escolhido; vazio = o usuário escolhe (nada vem marcado). */
  selected: string;
  /** O que já estava digitado antes de criar um tipo pelo atalho. */
  draft?: PartyDraft;
  /** Atalho "+ Novo tipo" ao lado do campo (só o administrador). */
  quickType?: boolean;
}) {
  const value = (field: keyof PartyDraft, saved: string | null | undefined) =>
    draft?.[field] ?? saved ?? "";
  return (
    <form action={savePartyAction} className="@container space-y-3">
      {party ? <input type="hidden" name="id" value={party.id} /> : null}
      <div className="grid gap-3 @sm:grid-cols-2 @lg:grid-cols-6">
        <div className="min-w-0 @lg:col-span-2">
          <Field label={t("parties.type")}>
            <Select
              name="type"
              required
              defaultValue={selected}
              data-party-type
            >
              {selected ? null : (
                <option value="" disabled>
                  {t("partnerTypes.choose")}
                </option>
              )}
              {types.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="min-w-0 @lg:col-span-4">
          <Field label={t("common.name")}>
            <Input
              name="name"
              required
              defaultValue={value("name", party?.name)}
            />
          </Field>
        </div>
        <div className="min-w-0 @lg:col-span-2">
          <Field label={t("parties.country")}>
            <Input
              name="country"
              defaultValue={value("country", party?.country)}
              placeholder={t("ph.party.country")}
            />
          </Field>
        </div>
        <div className="min-w-0 @lg:col-span-4">
          <Field label={t("common.email")}>
            <Input
              name="email"
              type="email"
              defaultValue={value("email", party?.email)}
            />
          </Field>
        </div>
        <div className="min-w-0 @lg:col-span-3">
          <Field label={t("parties.phone")}>
            <Input name="phone" defaultValue={value("phone", party?.phone)} />
          </Field>
        </div>
        <div className="min-w-0 @lg:col-span-3">
          <Field label={t("parties.taxId")}>
            <Input name="taxId" defaultValue={value("taxId", party?.taxId)} />
          </Field>
        </div>
      </div>
      {quickType ? (
        <details
          className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/60 px-3 py-2 text-sm"
          data-party-quick-type
        >
          <summary className="w-fit cursor-pointer font-medium text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
            {t("partnerTypes.quick.open")}
          </summary>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1 basis-56">
              <Field label={t("partnerTypes.quick.label")}>
                <Input name="newTypeName" maxLength={120} />
              </Field>
            </div>
            <SubmitButton
              variant="secondary"
              formAction={quickPartnerTypeAction}
              formNoValidate
              data-party-quick-type-submit
            >
              {t("partnerTypes.quick.submit")}
            </SubmitButton>
          </div>
          <p className="mt-1.5 text-xs text-zinc-500">
            {t("partnerTypes.quick.hint")}
          </p>
        </details>
      ) : null}
      <Field label={t("common.note")}>
        <Textarea
          name="notes"
          rows={2}
          defaultValue={value("notes", party?.notes)}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {party ? (
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-zinc-800">
            <input type="hidden" name="active" value={"off"} />
            <input
              type="checkbox"
              name="active"
              value="on"
              defaultChecked={party.active}
              className="h-4 w-4 cursor-pointer accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            />{" "}
            {t("common.status")}: {t("common.yes")}
          </label>
        ) : null}
        <SubmitButton>{t("common.save")}</SubmitButton>
      </div>
    </form>
  );
}
