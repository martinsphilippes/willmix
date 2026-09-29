import type { Translate } from "@/i18n";
import { VISIT_STATUSES, type Party, type SupplierVisit } from "@/lib/db";
import { Field, Input, LinkButton, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { saveVisitAction } from "../../actions/sourcing";
import { SaveBar, Section, bigField, dateValue, todayValue } from "./shared";

/**
 * Formulário da visita (nova ou edição). Responde: quando fomos, quem esteve,
 * onde, e o que ficou combinado para a próxima. Uma coluna no celular.
 */
export function VisitForm({
  t,
  visit,
  suppliers,
}: {
  t: Translate;
  visit?: SupplierVisit | null;
  suppliers: Party[];
}) {
  const registered = visit?.supplierId
    ? suppliers.find((s) => s.id === visit.supplierId)
    : null;
  // Nome livre só quando difere do cadastrado (senão o campo repetiria o select).
  const otherName =
    visit?.supplierName && visit.supplierName !== registered?.name
      ? visit.supplierName
      : "";
  return (
    <form action={saveVisitAction} className="space-y-3">
      {visit ? <input type="hidden" name="id" value={visit.id} /> : null}
      <Section title={t("sourcing.item.section.identity")} open>
        <Field
          label={t("sourcing.visit.supplier")}
          hint={t("sourcing.visit.supplierHint")}
        >
          <Select
            name="supplierId"
            defaultValue={visit?.supplierId ?? ""}
            className={bigField}
          >
            <option value="">{t("common.select")}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.city ? ` · ${s.city}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("sourcing.visit.otherSupplier")}>
          <Input
            name="supplierName"
            maxLength={160}
            defaultValue={otherName}
            className={bigField}
            autoComplete="organization"
          />
        </Field>
        <Field label={t("sourcing.visit.factory")}>
          <Input
            name="factoryName"
            maxLength={160}
            defaultValue={visit?.factoryName ?? ""}
            className={bigField}
          />
        </Field>
        <Field label={t("sourcing.visit.location")}>
          <Input
            name="location"
            maxLength={160}
            defaultValue={visit?.location ?? ""}
            className={bigField}
            placeholder="Ex.: Feira de Cantão, pavilhão 3"
          />
        </Field>
        <Field label={t("sourcing.visit.city")}>
          <Input
            name="city"
            maxLength={80}
            defaultValue={visit?.city ?? ""}
            className={bigField}
          />
        </Field>
        <Field label={t("sourcing.visit.address")}>
          <Input
            name="address"
            maxLength={255}
            defaultValue={visit?.address ?? ""}
            className={bigField}
          />
        </Field>
      </Section>
      <Section title={t("sourcing.visit.date")} open>
        <Field label={t("sourcing.visit.date")}>
          <Input
            name="visitedAt"
            type="date"
            required
            defaultValue={dateValue(visit?.visitedAt) || todayValue()}
            className={bigField}
          />
        </Field>
        <Field label={t("common.status")}>
          <Select
            name="status"
            defaultValue={visit?.status ?? "done"}
            className={bigField}
          >
            {VISIT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`sourcing.visitStatus.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field
            label={t("sourcing.visit.participants")}
            hint={t("sourcing.visit.participantsHint")}
          >
            <Textarea
              name="participants"
              rows={2}
              defaultValue={visit?.participants ?? ""}
              className={bigField}
            />
          </Field>
        </div>
      </Section>
      <Section title={t("sourcing.visit.followUp")} open>
        <div className="sm:col-span-2">
          <Field label={t("sourcing.visit.notes")}>
            <Textarea
              name="notes"
              rows={3}
              defaultValue={visit?.notes ?? ""}
              className={bigField}
            />
          </Field>
        </div>
        <Field label={t("sourcing.visit.nextVisit")}>
          <Input
            name="nextVisitAt"
            type="date"
            defaultValue={dateValue(visit?.nextVisitAt)}
            className={bigField}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label={t("sourcing.visit.followUp")}>
            <Textarea
              name="followUp"
              rows={2}
              defaultValue={visit?.followUp ?? ""}
              className={bigField}
            />
          </Field>
        </div>
      </Section>
      <SaveBar>
        <SubmitButton
          pendingText="…"
          className="flex-1 py-3 text-base sm:flex-none sm:py-2 sm:text-sm"
        >
          {t("common.save")}
        </SubmitButton>
        <LinkButton
          href={visit ? "/app/sourcing?tab=visits" : "/app/sourcing"}
          variant="ghost"
          className="shrink-0 py-3 sm:py-2"
        >
          {t("common.back")}
        </LinkButton>
      </SaveBar>
    </form>
  );
}
