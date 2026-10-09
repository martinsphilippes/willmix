import type { Party } from "@/lib/db";
import { PARTY_TYPES } from "@/lib/db";
import type { Translate } from "@/i18n";
import { savePartyAction } from "@/app/app/actions";
import { Field, Input, Select, Textarea } from "./ui";
import { SubmitButton } from "./submit-button";

/*
 * Cadastro do parceiro. Grade pela largura do cartão (@container): no cartão
 * estreito, dois campos por linha; no largo, seis colunas com o campo do
 * tamanho do conteúdo (tipo e país curtos, nome e e-mail mais largos).
 */
export function PartyForm({
  party,
  t,
}: {
  party?: Party | null;
  t: Translate;
}) {
  return (
    <form action={savePartyAction} className="@container space-y-3">
      {party ? <input type="hidden" name="id" value={party.id} /> : null}
      <div className="grid gap-3 @sm:grid-cols-2 @lg:grid-cols-6">
        <div className="min-w-0 @lg:col-span-2">
          <Field label={t("parties.type")}>
            <Select
              name="type"
              required
              defaultValue={party?.type ?? "supplier"}
            >
              {PARTY_TYPES.map((pt) => (
                <option key={pt} value={pt}>
                  {t(`party.${pt}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="min-w-0 @lg:col-span-4">
          <Field label={t("common.name")}>
            <Input name="name" required defaultValue={party?.name ?? ""} />
          </Field>
        </div>
        <div className="min-w-0 @lg:col-span-2">
          <Field label={t("parties.country")}>
            <Input
              name="country"
              defaultValue={party?.country ?? ""}
              placeholder={t("ph.party.country")}
            />
          </Field>
        </div>
        <div className="min-w-0 @lg:col-span-4">
          <Field label={t("common.email")}>
            <Input
              name="email"
              type="email"
              defaultValue={party?.email ?? ""}
            />
          </Field>
        </div>
        <div className="min-w-0 @lg:col-span-3">
          <Field label={t("parties.phone")}>
            <Input name="phone" defaultValue={party?.phone ?? ""} />
          </Field>
        </div>
        <div className="min-w-0 @lg:col-span-3">
          <Field label={t("parties.taxId")}>
            <Input name="taxId" defaultValue={party?.taxId ?? ""} />
          </Field>
        </div>
      </div>
      <Field label={t("common.note")}>
        <Textarea name="notes" rows={2} defaultValue={party?.notes ?? ""} />
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
