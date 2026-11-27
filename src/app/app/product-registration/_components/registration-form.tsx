import type { ReactNode } from "react";
import type { ProductLine } from "@/lib/db/schema";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { Translate } from "@/i18n";
import {
  REGISTRATION_FIELDS,
  REGISTRATION_SECTIONS,
  matchOption,
  nameKey,
  type ColumnResolution,
  type RegistrationField,
  type RegistrationSection,
  type RegistrationState,
  type RegistrationValues,
} from "@/lib/product-registration";
import { Card, Input, Select, Textarea, cx } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { labelKey } from "@/lib/product-registration";
import type {
  ListKind,
  RegistrationLookups,
} from "@/lib/services/sankhya-lookups";
import { registrationAction } from "../../actions/product-registration";
import {
  GroupField,
  LookupField,
  type GroupLabels,
  type GroupTuple,
  type LookupChoice,
} from "./lookup-fields";

/** O que os campos com lista precisam (listas do Sankhya e os grupos). */
export interface FormExtras {
  lines: ProductLine[];
  lists: RegistrationLookups["lists"];
  groups: GroupTuple[];
  groupsFromSankhya: boolean;
  family: { code: string; name: string } | null;
  groupLabels: GroupLabels;
}

/*
 * O formulário do cadastro (docs/PRODUCT_REGISTRATION.md): os campos da tela
 * do Sankhya e da planilha de cadastro, por seção, cada um com a coluna do
 * Sankhya para onde vai (ou "Só no portal"). Um formulário só, com três
 * botões: gravar o rascunho, cadastrar o produto (sem produto ainda) ou
 * gravar e enviar ao Sankhya (com o produto).
 */

const fieldLabel = (t: Translate, id: string) =>
  t(`productRegistration.field.${id}` as DictionaryKey);

/** Atributos que o E2E e os testes já usavam no bloco antigo. */
const LEGACY_ATTR: Record<string, Record<string, string>> = {
  descrPt: { "data-request-product-name": "" },
  group: { "data-request-product-line": "" },
};

/**
 * O escolhido de partida numa lista: o código gravado; sem ele, a opção com
 * o mesmo nome do que o processo trouxe (ex.: a embalagem do book "COLOR
 * BOX"); fora da lista, o código como está.
 */
function initialChoice(
  options: readonly LookupChoice[],
  code: string,
  name: string,
): LookupChoice | null {
  if (code) {
    const hit = options.find((o) => o.code === code);
    return hit ?? { code, name: name || code };
  }
  if (!name) return null;
  const key = labelKey(name);
  return options.find((o) => labelKey(o.name) === key) ?? null;
}

function ColumnHint({
  resolution,
  t,
}: {
  resolution: ColumnResolution | undefined;
  t: Translate;
}) {
  const text = resolution?.column
    ? t("productRegistration.column", { column: resolution.column })
    : resolution?.source === "off"
      ? t("productRegistration.column.off")
      : t("productRegistration.column.none");
  return (
    <span
      className={cx(
        "block text-[11px] leading-4",
        resolution?.column ? "text-zinc-400" : "text-amber-700",
      )}
      data-registration-column={resolution?.column ?? ""}
    >
      {text}
    </span>
  );
}

function OptionSelect({
  name,
  value,
  options,
  t,
  attrs,
}: {
  name: string;
  value: string;
  options: ColumnResolution["options"];
  t: Translate;
  attrs?: Record<string, string>;
}) {
  const current = value ? (matchOption(options, value) ?? value) : "";
  const known = options.some((o) => o.value === current);
  return (
    <Select name={name} defaultValue={current} {...attrs}>
      <option value="">{t("common.select")}</option>
      {!known && current ? <option value={current}>{current}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.value === o.label ? o.label : `${o.value} - ${o.label}`}
        </option>
      ))}
    </Select>
  );
}

function FieldControl({
  field,
  values,
  resolution,
  extras,
  t,
}: {
  field: RegistrationField;
  values: RegistrationValues;
  resolution: ColumnResolution | undefined;
  extras: FormExtras;
  t: Translate;
}) {
  const name = `f.${field.id}`;
  const value = values[field.id] ?? "";
  const attrs = LEGACY_ATTR[field.id] ?? {};
  const options = resolution?.options ?? [];
  const unit = field.unit
    ? t(`productRegistration.unit.${field.unit}` as DictionaryKey)
    : null;
  const label = fieldLabel(t, field.id);
  if (field.type === "lookup" && field.lookup === "group") {
    // Sem a árvore do Sankhya: as linhas do portal (o grupo delas vai).
    if (!extras.groupsFromSankhya)
      return (
        <div className="space-y-1">
          <Select
            name={name}
            defaultValue={value}
            aria-label={label}
            {...attrs}
          >
            <option value="">{t("common.select")}</option>
            {extras.lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.sankhyaCode
                  ? `${l.name} · ${l.sankhyaCode}`
                  : `${l.name} (${t("productRegistration.lineNoGroup")})`}
              </option>
            ))}
          </Select>
          <p className="text-xs text-amber-700">
            {t("productRegistration.groupFallback")}
          </p>
        </div>
      );
    return (
      <GroupField
        groups={extras.groups}
        initial={value || null}
        family={extras.family}
        labels={extras.groupLabels}
        ariaLabel={label}
      />
    );
  }
  if (field.type === "lookup" && field.lookup) {
    const choices = extras.lists[field.lookup as ListKind]?.options ?? [];
    if (choices.length)
      return (
        <LookupField
          fieldId={field.id}
          options={choices}
          initial={initialChoice(
            choices,
            value,
            values[nameKey(field.id)] ?? "",
          )}
          labels={extras.groupLabels.picker}
          ariaLabel={label}
        />
      );
  }
  switch (field.type) {
    case "yesno":
      return (
        <Select name={name} defaultValue={value || "N"} {...attrs}>
          <option value="S">{t("productRegistration.yes")}</option>
          <option value="N">{t("productRegistration.no")}</option>
        </Select>
      );
    case "longtext":
      return (
        <Textarea
          name={name}
          defaultValue={value}
          maxLength={field.max}
          rows={4}
          {...attrs}
        />
      );
    case "date":
      return <Input type="date" name={name} defaultValue={value} {...attrs} />;
    case "code":
    case "lookup":
      // Sem a lista do Sankhya: o código e o nome digitados.
      return (
        <div className="flex gap-1.5">
          {options.length ? (
            <OptionSelect
              name={name}
              value={value}
              options={options}
              t={t}
              attrs={attrs}
            />
          ) : (
            <>
              <Input
                name={name}
                defaultValue={value}
                maxLength={field.max}
                className="w-24 shrink-0"
                aria-label={fieldLabel(t, field.id)}
                {...attrs}
              />
              <Input
                name={`f.${nameKey(field.id)}`}
                defaultValue={values[nameKey(field.id)] ?? ""}
                maxLength={120}
                placeholder={t("productRegistration.codeName")}
                aria-label={`${fieldLabel(t, field.id)} · ${t("productRegistration.codeName")}`}
              />
            </>
          )}
        </div>
      );
    case "number":
    case "int":
      return (
        <div className="flex items-center gap-1.5">
          <Input
            name={name}
            defaultValue={value}
            inputMode={field.type === "int" ? "numeric" : "decimal"}
            maxLength={20}
            {...attrs}
          />
          {unit ? (
            <span className="shrink-0 text-xs text-zinc-500">{unit}</span>
          ) : null}
        </div>
      );
    default:
      return options.length ? (
        <OptionSelect
          name={name}
          value={value}
          options={options}
          t={t}
          attrs={attrs}
        />
      ) : (
        <Input
          name={name}
          defaultValue={value}
          maxLength={field.max}
          {...attrs}
        />
      );
  }
}

const WIDE = new Set<RegistrationField["type"]>(["longtext"]);
const DOUBLE = new Set<RegistrationField["type"]>(["code", "lookup"]);

function SectionCard({
  section,
  values,
  columns,
  extras,
  t,
}: {
  section: RegistrationSection;
  values: RegistrationValues;
  columns: Record<string, ColumnResolution>;
  extras: FormExtras;
  t: Translate;
}) {
  const fields = REGISTRATION_FIELDS.filter((x) => x.section === section);
  return (
    <Card
      dense
      title={t(`productRegistration.section.${section}` as DictionaryKey)}
    >
      <div
        className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-4"
        data-registration-section={section}
      >
        {fields.map((field) => (
          <div
            key={field.id}
            className={cx(
              "min-w-0",
              WIDE.has(field.type) && "sm:col-span-2 lg:col-span-4",
              DOUBLE.has(field.type) && "sm:col-span-2",
            )}
            data-registration-field={field.id}
          >
            {/* Rótulo com o campo dentro: o aviso de erro acha o nome. */}
            <FieldBox list={field.type === "lookup"}>
              <span
                className="block text-xs font-medium leading-5 text-zinc-700"
                data-field-label=""
              >
                {fieldLabel(t, field.id)}
                {field.required ? (
                  <span
                    className={
                      field.required === "portal"
                        ? "text-red-600"
                        : "text-amber-600"
                    }
                    aria-hidden
                  >
                    {" *"}
                  </span>
                ) : null}
              </span>
              <FieldControl
                field={field}
                values={values}
                resolution={columns[field.id]}
                extras={extras}
                t={t}
              />
            </FieldBox>
            <ColumnHint resolution={columns[field.id]} t={t} />
          </div>
        ))}
      </div>
      {section === "group" ? (
        <p className="mt-2 text-xs text-zinc-500">
          {t("productRegistration.groupHint")}
        </p>
      ) : null}
    </Card>
  );
}

/** Rótulo em volta do campo; nas listas com busca, um bloco (o rótulo não abre a lista). */
function FieldBox({ list, children }: { list: boolean; children: ReactNode }) {
  return list ? (
    <div className="block min-w-0 space-y-1">{children}</div>
  ) : (
    <label className="block min-w-0 space-y-1">{children}</label>
  );
}

export function RegistrationForm({
  requestId,
  values,
  columns,
  extras,
  state,
  items,
  t,
}: {
  requestId: string;
  values: RegistrationValues;
  columns: Record<string, ColumnResolution>;
  extras: FormExtras;
  state: RegistrationState;
  /** Os itens do book a ligar (só antes de o produto existir). */
  items?: ReactNode;
  t: Translate;
}) {
  const hasProduct = state === "to_send" || state === "done";
  return (
    <form
      action={registrationAction}
      className="space-y-3"
      id="cadastro"
      data-registration-form
    >
      <input type="hidden" name="id" value={requestId} />
      {items}
      {REGISTRATION_SECTIONS.map((section) => (
        <SectionCard
          key={section}
          section={section}
          values={values}
          columns={columns}
          extras={extras}
          t={t}
        />
      ))}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white/95 p-3 shadow-sm backdrop-blur">
        <SubmitButton
          name="intent"
          value="draft"
          variant="secondary"
          pendingText={t("productRegistration.pending")}
          data-registration-submit="draft"
        >
          {t("productRegistration.saveDraft")}
        </SubmitButton>
        {hasProduct ? (
          <SubmitButton
            name="intent"
            value="send"
            pendingText={t("productRegistration.pending")}
            data-registration-submit="send"
          >
            {t("productRegistration.send")}
          </SubmitButton>
        ) : (
          <SubmitButton
            name="intent"
            value="register"
            disabled={state === "waiting_sample"}
            pendingText={t("productRegistration.pending")}
            data-registration-submit="register"
            data-request-product-create
          >
            {t("productRegistration.register")}
          </SubmitButton>
        )}
      </div>
    </form>
  );
}
