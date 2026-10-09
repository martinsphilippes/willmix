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
  /** Fotos do cadastro (servidas por /api/files, com checagem de acesso). */
  photos: { documentId: string; caption: string }[];
  productName: string;
  description: string;
  specification: string;
  /** Estoque da Wellmix (itens de container sem pedido); `detail` só para a Wellmix. */
  stock: { available: boolean; detail: string | null };
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
  prefix = "",
}: {
  products: ProductFill[];
  /** Prefixo dos nomes dos campos (várias linhas de produto no mesmo formulário). */
  prefix?: string;
  presetProductId: string;
  defaultNotInCatalog: boolean;
  suggestions: Partial<Record<Field, Option[]>>;
  sourceLabels: Record<string, string>;
  labels: {
    fromCatalog: string;
    inStock: string;
    noStock: string;
    change: string;
    notInCatalog: string;
    notInCatalogHint: string;
    product: string;
    select: string;
    filledHint: string;
    filledBadge: string;
    photos: string;
    photosNone: string;
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

  const selected = products.find((p) => p.id === productId) ?? null;

  const chip =
    "inline-flex max-w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition";
  const on =
    "border-brand-600 bg-brand-50 text-brand-900 ring-2 ring-brand-100";
  const off =
    "border-zinc-300 bg-white text-zinc-800 hover:border-brand-300 hover:bg-brand-50/40";

  function field(name: Field, label: string, multiline: boolean) {
    const options = suggestions[name] ?? [];
    const common = {
      id: `rp-${prefix}${name}`,
      name: `${prefix}${name}`,
      value: values[name],
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => setValues((v) => ({ ...v, [name]: e.target.value })),
      className: inputClass,
    };
    return (
      <div className="col-span-2 min-w-0 space-y-1">
        <label
          htmlFor={`rp-${prefix}${name}`}
          className="block text-xs font-medium leading-5 text-zinc-700"
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
              Math.max(2, values[name].split("\n").length + 1),
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

  /* Os blocos entram na grade da linha de produto (RequestItems: 2 colunas no
     celular, 4 a partir de sm): quadro do catálogo na linha toda; produto,
     nome, descrição, especificação e anexos em meia linha (dois por linha). */
  return (
    <>
      {/* 1) Com produto escolhido: o quadro mostra que é do catálogo e o estoque.
             Sem produto: "fora do catálogo", antes da escolha do produto. */}
      {selected ? (
        <div
          role="status"
          className="col-span-2 flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50/70 px-3 py-2 sm:col-span-4"
        >
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-emerald-600 text-[11px] font-bold leading-none text-white"
          >
            ✓
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-emerald-900">
              {labels.fromCatalog}
              {selected.stock.available ? ` · ${labels.inStock}` : ""}
            </span>
            {selected.stock.available && !selected.stock.detail ? null : (
              <span className="mt-0.5 block text-xs leading-relaxed text-emerald-800">
                {selected.stock.available
                  ? selected.stock.detail
                  : labels.noStock}
              </span>
            )}
            <button
              type="button"
              onClick={() => toggleNotInCatalog(true)}
              className="mt-1 text-xs font-medium text-zinc-600 underline underline-offset-2 hover:text-brand-700"
            >
              {labels.change}
            </button>
          </span>
        </div>
      ) : (
        <label className="col-span-2 flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-2 sm:col-span-4">
          <input
            type="checkbox"
            name={`${prefix}sourcingDemand`}
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
      )}

      {/* 2) Produto da Wellmix: preenche os campos com a ficha. */}
      {!notInCatalog ? (
        <div className="col-span-2 min-w-0 space-y-1">
          <label
            htmlFor={`rp-${prefix}productId`}
            className="block text-xs font-medium leading-5 text-zinc-700"
          >
            {labels.product}
          </label>
          <select
            id={`rp-${prefix}productId`}
            name={`${prefix}productId`}
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
          {selected ? (
            <div className="space-y-1 pt-1">
              <p className="text-xs font-medium leading-5 text-zinc-700">
                {labels.photos}
              </p>
              {selected.photos.length > 0 ? (
                <ul className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
                  {selected.photos.map((ph) => (
                    <li key={ph.documentId}>
                      <a
                        href={`/api/files/${ph.documentId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 hover:border-brand-300"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
                        <img
                          src={`/api/files/${ph.documentId}`}
                          alt={ph.caption}
                          loading="lazy"
                          className="aspect-square w-full object-cover"
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-zinc-500">{labels.photosNone}</p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {field("productName", labels.productName, false)}
      {field("description", labels.description, true)}
      {field("specification", labels.specification, true)}

      {/* 3) Anexos só para produto fora do catálogo (fotos do que se procura). */}
      {notInCatalog ? (
        <div className="col-span-2 min-w-0 space-y-1">
          <label
            htmlFor={`rp-${prefix}attachments`}
            className="block text-xs font-medium leading-5 text-zinc-700"
          >
            {labels.attachments}
          </label>
          <input
            id={`rp-${prefix}attachments`}
            name={`${prefix}attachments`}
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
