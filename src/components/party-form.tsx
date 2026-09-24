import type { Party } from "@/lib/db";
import { PARTY_TYPES } from "@/lib/db";
import type { Translate } from "@/i18n";
import { savePartyAction } from "@/app/app/actions";
import { Field, Input, Select, Textarea } from "./ui";
import { SubmitButton } from "./submit-button";

export function PartyForm({
  party,
  t,
}: {
  party?: Party | null;
  t: Translate;
}) {
  return (
    <form action={savePartyAction} className="space-y-4">
      {party ? <input type="hidden" name="id" value={party.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("parties.type")}>
          <Select name="type" required defaultValue={party?.type ?? "supplier"}>
            {PARTY_TYPES.map((pt) => (
              <option key={pt} value={pt}>
                {t(`party.${pt}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("common.name")}>
          <Input name="name" required defaultValue={party?.name ?? ""} />
        </Field>
        <Field label={t("parties.country")}>
          <Input
            name="country"
            defaultValue={party?.country ?? ""}
            placeholder="BR, CN"
          />
        </Field>
        <Field label={t("common.email")}>
          <Input name="email" type="email" defaultValue={party?.email ?? ""} />
        </Field>
        <Field label="Telefone / WhatsApp">
          <Input name="phone" defaultValue={party?.phone ?? ""} />
        </Field>
        <Field label="CNPJ / Tax ID">
          <Input name="taxId" defaultValue={party?.taxId ?? ""} />
        </Field>
      </div>
      <Field label={t("common.note")}>
        <Textarea name="notes" defaultValue={party?.notes ?? ""} />
      </Field>
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
    </form>
  );
}
