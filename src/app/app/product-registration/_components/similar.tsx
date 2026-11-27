import Link from "next/link";
import type { Product } from "@/lib/db/schema";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { productNameText, type Translate } from "@/i18n";
import {
  hasName,
  nameKey,
  registrationField,
  type RegistrationValues,
} from "@/lib/product-registration";
import type { SimilarProduct } from "@/lib/services/product-registration";
import { Card, Field, Input, linkClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

/*
 * "É semelhante a algum do catálogo?" (dono, 27/11/2026;
 * docs/PRODUCT_REGISTRATION.md): na coluna da direita, fixa na rolagem, os
 * produtos parecidos (sugestões ou a busca). "Associar" grava o rascunho e
 * abre o quadro do que trazer do escolhido: só os campos que o processo não
 * preencheu. Os botões e as escolhas pertencem ao formulário do cadastro
 * (`form="cadastro"`): o que foi digitado vai junto e não se perde.
 */

export function SimilarColumn({
  requestId,
  candidates,
  query,
  chosen,
  t,
}: {
  requestId: string;
  candidates: Product[];
  query: string;
  chosen: string;
  t: Translate;
}) {
  return (
    <Card dense title={t("productRegistration.similar.title")}>
      <div data-registration-similar>
        <p className="mb-2 text-xs text-zinc-600">
          {t("productRegistration.similar.hint")}
        </p>
        <form
          method="get"
          action={`/app/product-registration/${requestId}`}
          className="mb-2 flex items-end gap-2"
        >
          <div className="min-w-0 flex-1">
            <Field label={t("productRegistration.similar.search")}>
              <Input
                name="pq"
                type="search"
                defaultValue={query}
                maxLength={80}
                data-request-product-search="pq"
              />
            </Field>
          </div>
          <SubmitButton variant="secondary">
            {t("srProduct.search")}
          </SubmitButton>
        </form>
        {!query && candidates.length ? (
          <p className="mb-1 text-xs text-zinc-500">
            {t("productRegistration.similar.suggested")}
          </p>
        ) : null}
        {candidates.length ? (
          <>
            <ul className="max-h-[50vh] divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200 text-sm">
              {candidates.map((p) => (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-start gap-2 px-2.5 py-2">
                    <input
                      type="radio"
                      name="similarId"
                      value={p.id}
                      form="cadastro"
                      defaultChecked={p.id === chosen}
                      className="mt-1"
                      data-registration-similar-choose={p.id}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-zinc-800">
                        {productNameText(t, p.name)}
                      </span>
                      <span className="block text-xs text-zinc-500">
                        {[
                          p.sankhyaCode ? `CODPROD ${p.sankhyaCode}` : null,
                          p.sku,
                          p.supplierSku,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-2">
              <SubmitButton
                form="cadastro"
                name="intent"
                value="similarPick"
                variant="secondary"
                pendingText={t("productRegistration.pending")}
                data-registration-similar-associate
              >
                {t("productRegistration.similar.associate")}
              </SubmitButton>
            </div>
          </>
        ) : (
          <p className="text-xs text-zinc-500">
            {t("productRegistration.similar.none")}
          </p>
        )}
      </div>
    </Card>
  );
}

/** Valor de um campo para ler no quadro (código com o nome; Sim/Não). */
function shown(values: RegistrationValues, id: string, t: Translate) {
  const field = registrationField(id);
  const v = values[id] ?? "";
  if (!field || !v) return "—";
  if (field.type === "yesno")
    return v === "S"
      ? t("productRegistration.yes")
      : t("productRegistration.no");
  if (hasName(field)) {
    const name = values[nameKey(id)];
    return name && name !== v ? `${v} - ${name}` : v;
  }
  return v;
}

export function SimilarModal({
  requestId,
  similar,
  fields,
  current,
  t,
}: {
  requestId: string;
  similar: SimilarProduct;
  fields: string[];
  current: RegistrationValues;
  t: Translate;
}) {
  const p = similar.product;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-900/40 p-4 sm:items-center"
      id="semelhante"
      role="dialog"
      aria-modal="true"
      aria-labelledby="semelhante-titulo"
      data-registration-similar-modal
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white p-4 shadow-xl">
        <h2
          id="semelhante-titulo"
          className="text-base font-semibold text-zinc-900"
        >
          {t("productRegistration.similar.modal.title")}
        </h2>
        <p className="mt-1 text-sm text-zinc-700">
          <Link href={`/app/products/${p.id}`} className={linkClass}>
            {productNameText(t, p.name)}
          </Link>
          {p.sankhyaCode ? ` · CODPROD ${p.sankhyaCode}` : ""}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {similar.fromSankhya
            ? t("productRegistration.similar.modal.fromSankhya", {
                code: p.sankhyaCode ?? "",
              })
            : t("productRegistration.similar.modal.fromPortal")}
        </p>
        <p className="mt-2 text-xs text-zinc-600">
          {t("productRegistration.similar.modal.hint")}
        </p>
        <input type="hidden" name="similarId" value={p.id} form="cadastro" />
        {fields.length ? (
          <ul className="mt-3 max-h-[55vh] divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200 text-sm">
            {fields.map((id) => {
              const typed = current[id] && current[id] !== similar.values[id];
              return (
                <li key={id}>
                  <label className="flex cursor-pointer items-start gap-2 px-3 py-2">
                    <input
                      type="checkbox"
                      name="similarField"
                      value={id}
                      form="cadastro"
                      defaultChecked={!current[id]}
                      className="mt-1"
                      data-registration-similar-field={id}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-zinc-500">
                        {t(`productRegistration.field.${id}` as DictionaryKey)}
                      </span>
                      <span className="block font-medium text-zinc-800">
                        {shown(similar.values, id, t)}
                      </span>
                      {typed ? (
                        <span className="block text-xs text-amber-700">
                          {t("productRegistration.similar.modal.typed", {
                            value: shown(current, id, t),
                          })}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-zinc-600">
            {t("productRegistration.similar.modal.empty")}
          </p>
        )}
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Link
            href={`/app/product-registration/${requestId}`}
            className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            data-registration-similar-cancel
          >
            {t("productRegistration.similar.modal.cancel")}
          </Link>
          {fields.length ? (
            <SubmitButton
              form="cadastro"
              name="intent"
              value="similarApply"
              pendingText={t("productRegistration.pending")}
              data-registration-similar-apply
            >
              {t("productRegistration.similar.modal.apply")}
            </SubmitButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}
