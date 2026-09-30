"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui";

/*
 * Parte "produto" da nova solicitação:
 * 1) "Produto não está no catálogo" vem primeiro; marcado, desliga a escolha
 *    de produto e mostra os anexos (fotos/arquivos do produto procurado).
 * 2) Escolher um produto da Wellmix preenche nome, descrição e especificação
 *    com a ficha (campos seguem editáveis). Os dados vêm prontos do servidor,
 *    só com o que o cliente pode ver (sem preço nem fornecedor).
 * 3) Sugestões da busca por foto/link continuam como botões por campo.
 */
export interface ProductFill {
  id: string;
  label: string;
  productName: string;
  description: string;
  specification: string;
}
type Field = "productName" | "description" | "specification";
type Option = { value: string; source: string };

export function RequestProductFields({
  products,
  presetProductId,
  defaultNotInCatalog,
  suggestions,
  sourceLabels,
  labels,
}: {
  products: ProductFill[];
  presetProductId: string;
  defaultNotInCatalog: boolean;
  suggestions: Partial<Record<Field, Option[]>>;
  sourceLabels: Record<string, string>;
  labels: {
    notInCatalog: string;
    notInCatalogHint: string;
    product: string;
    select: string;
    filledHint: string;
    filledBadge: string;
    productName: string;
    placeholder: string;
    description: string;
    specification: string;
    attachments: string;
    attachmentsHint: string;
    suggestionsHint: string;
    none: string;
  };
}) {
  const initial = products.find((p) => p.id === presetProductId) ?? null;
  const [notInCatalog, setNotInCatalog] = useState(
    defaultNotInCatalog && !initial,
  );
  const [productId, setProductId] = useState(initial?.id ?? "");
  const [values, setValues] = useState<Record<Field, string>>({
    productName: initial?.productName ?? "",
    description: initial?.description ?? "",
    specification: initial?.specification ?? "",
  });
  const [picked, setPicked] = useState<Record<Field, number | null>>({
    productName: null,
    description: null,
    specification: null,
  });
  const [filledFrom, setFilledFrom] = useState<string | null>(
    initial?.id ?? null,
  );

  function fillFrom(id: string) {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    setPicked({ productName: null, description: null, specification: null });
    if (p) {
      setValues({
        productName: p.productName,
        description: p.description,
        specification: p.specification,
      });
      setFilledFrom(p.id);
    } else if (filledFrom) {
      // Tirou o produto: limpa o que tinha vindo da ficha.
      setValues({ productName: "", description: "", specification: "" });
      setFilledFrom(null);
    }
  }

  function toggleNotInCatalog(checked: boolean) {
    setNotInCatalog(checked);
    if (checked && productId) fillFrom("");
  }

  const chip =
    "inline-flex max-w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition";
  const on =
    "border-brand-600 bg-brand-50 text-brand-900 ring-2 ring-brand-100";
  const off =
    "border-zinc-300 bg-white text-zinc-800 hover:border-brand-300 hover:bg-brand-50/40";

  function field(name: Field, label: string, multiline: boolean) {
    const options = suggestions[name] ?? [];
    const common = {
      id: `rp-${name}`,
      name,
      value: values[name],
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => setValues((v) => ({ ...v, [name]: e.target.value })),
      className: inputClass,
    };
    return (
      <div className="space-y-2">
        <label
          htmlFor={`rp-${name}`}
          className="block text-sm font-medium text-zinc-800"
        >
          {label}
        </label>
        {options.length > 0 ? (
          <div
            role="group"
            aria-label={labels.suggestionsHint}
            className="space-y-1.5"
          >
            <p className="text-xs text-zinc-500">{labels.suggestionsHint}</p>
            <div className="flex flex-wrap gap-2">
              {options.map((o, i) => (
                <button
                  key={`${o.source}-${i}`}
                  type="button"
                  aria-pressed={picked[name] === i}
                  onClick={() => {
                    setPicked((p) => ({ ...p, [name]: i }));
                    setValues((v) => ({ ...v, [name]: o.value }));
                  }}
                  className={`${chip} ${picked[name] === i ? on : off}`}
                >
                  <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                    {sourceLabels[o.source] ?? o.source}
                  </span>
                  <span className="min-w-0 break-words">{o.value}</span>
                </button>
              ))}
              <button
                type="button"
                aria-pressed={picked[name] === null}
                onClick={() => setPicked((p) => ({ ...p, [name]: null }))}
                className={`${chip} ${picked[name] === null ? on : off}`}
              >
                {labels.none}
              </button>
            </div>
          </div>
        ) : null}
        {multiline ? (
          <textarea
            {...common}
            rows={Math.min(
              10,
              Math.max(3, values[name].split("\n").length + 1),
            )}
            required={name === "description"}
            minLength={name === "description" ? 2 : undefined}
          />
        ) : (
          <input {...common} placeholder={labels.placeholder} />
        )}
      </div>
    );
  }

  return (
    <>
      {/* 1) Produto fora do catálogo: primeiro, antes da escolha do produto. */}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3">
        <input
          type="checkbox"
          name="sourcingDemand"
          checked={notInCatalog}
          onChange={(e) => toggleNotInCatalog(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
        />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-zinc-800">
            {labels.notInCatalog}
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">
            {labels.notInCatalogHint}
          </span>
        </span>
      </label>

      {/* 2) Produto da Wellmix: preenche os campos com a ficha. */}
      {!notInCatalog ? (
        <div className="space-y-1.5">
          <label
            htmlFor="rp-productId"
            className="block text-sm font-medium text-zinc-800"
          >
            {labels.product}
          </label>
          <select
            id="rp-productId"
            name="productId"
            value={productId}
            onChange={(e) => fillFrom(e.target.value)}
            className={inputClass}
          >
            <option value="">{labels.select}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-zinc-500">
            {filledFrom ? (
              <span className="mr-1.5 inline-block rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
                {labels.filledBadge}
              </span>
            ) : null}
            {labels.filledHint}
          </p>
        </div>
      ) : null}

      {field("productName", labels.productName, false)}
      {field("description", labels.description, true)}
      {field("specification", labels.specification, true)}

      {/* 3) Anexos só para produto fora do catálogo (fotos do que se procura). */}
      {notInCatalog ? (
        <div className="space-y-1.5">
          <label
            htmlFor="rp-attachments"
            className="block text-sm font-medium text-zinc-800"
          >
            {labels.attachments}
          </label>
          <input
            id="rp-attachments"
            name="attachments"
            type="file"
            multiple
            accept="image/*,application/pdf"
            className={inputClass}
          />
          <p className="text-xs text-zinc-500">{labels.attachmentsHint}</p>
        </div>
      ) : null}
    </>
  );
}
