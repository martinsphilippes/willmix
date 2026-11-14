"use client";

import { useRef, useState } from "react";
import { inputClass } from "@/components/ui";
import { ProductPicker } from "@/components/product-picker";
import type {
  SearchOption,
  SearchPickerLabels,
} from "@/components/search-picker";

/*
 * Parte "produto" da nova solicitação:
 * 1) "Produto não está no catálogo" vem primeiro; marcado, desliga a escolha
 *    de produto e mostra os anexos (fotos/arquivos do produto procurado).
 * 2) Escolher um produto da Wellmix preenche nome, descrição e especificação
 *    com a ficha (campos seguem editáveis). Os dados vêm do servidor, só com
 *    o que o cliente pode ver (sem preço nem fornecedor).
 * 3) Sugestões da busca por foto/link continuam como botões por campo.
 *
 * O produto é escolhido por busca (nome ou código) desde a auditoria de
 * performance (14/11/2026): a lista com o catálogo inteiro (~15 mil
 * produtos, com a ficha de cada um) deixava a página com 15 MB. A ficha do
 * produto escolhido vem de /api/products/fill; a do produto que já chega
 * escolhido (vitrine, busca por foto, programação de compra) vem pronta em
 * `products`.
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
  /** Pedido mínimo em peças (ficha mestre, senão cadastro); nulo sem mínimo. */
  moq: number | null;
  /**
   * Variações do produto (vazio = produto sem variações, como sempre). Com
   * variações, a escolha é obrigatória e preenche especificação, mínimo e foto.
   */
  variants: ProductVariantFill[];
}
export interface ProductVariantFill {
  id: string;
  name: string;
  /** Mínimo da variação (senão ficha mestre, senão cadastro); nulo sem mínimo. */
  moq: number | null;
  /** Especificação montada com os dados da variação. */
  specification: string;
  photoDocumentId: string | null;
}
type Field = "productName" | "description" | "specification";
type Option = { value: string; source: string };

export function RequestProductFields({
  products,
  presetProductId,
  presetVariantId = "",
  defaultNotInCatalog,
  suggestions,
  sourceLabels,
  labels,
  pickerLabels,
  prefix = "",
  onProductChange,
}: {
  /** Fichas já prontas (o produto que chega escolhido); as outras vêm sob demanda. */
  products: ProductFill[];
  /**
   * Produto ou variação escolhidos mudaram ("" = nenhum): a linha ajusta a
   * quantidade ao mínimo (da variação, quando há uma). `fill` é a ficha do
   * produto (nula sem produto).
   */
  onProductChange?: (
    productId: string,
    variantId: string,
    fill: ProductFill | null,
  ) => void;
  /** Textos do campo de produto com busca. */
  pickerLabels: SearchPickerLabels;
  /** Prefixo dos nomes dos campos (várias linhas de produto no mesmo formulário). */
  prefix?: string;
  presetProductId: string;
  /** Variação pré-escolhida (?variantId=), junto com o produto. */
  presetVariantId?: string;
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
    variant: string;
    variantChoose: string;
    variantHint: string;
    variantPhoto: string;
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
    /** Carregando a ficha do produto escolhido. */
    fillLoading: string;
    /** A ficha não veio (rede, produto saiu do catálogo). */
    fillError: string;
  };
}) {
  const initial = products.find((p) => p.id === presetProductId) ?? null;
  // Fichas conhecidas nesta linha (a pronta e as que vieram da busca).
  const [fills, setFills] = useState<Record<string, ProductFill>>(() =>
    Object.fromEntries(products.map((p) => [p.id, p])),
  );
  // Ficha pedida e ainda não chegada; só a última escolha vale.
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [fillFailed, setFillFailed] = useState(false);
  const wanted = useRef<string>(presetProductId);
  // Remonta o campo de busca vazio quando a ficha não vem.
  const [pickerKey, setPickerKey] = useState(0);
  const initialVariant =
    initial?.variants.find((v) => v.id === presetVariantId) ?? null;
  const [notInCatalog, setNotInCatalog] = useState(
    defaultNotInCatalog && !initial,
  );
  const [productId, setProductId] = useState(initial?.id ?? "");
  // Variação escolhida (só para produto com variações; "" = ainda não escolheu).
  const [variantId, setVariantId] = useState(initialVariant?.id ?? "");
  const [values, setValues] = useState<Record<Field, string>>({
    productName: initial?.productName ?? "",
    description: initial?.description ?? "",
    specification:
      initialVariant?.specification ?? initial?.specification ?? "",
  });
  const [picked, setPicked] = useState<Record<Field, number | null>>({
    productName: null,
    description: null,
    specification: null,
  });
  const [filledFrom, setFilledFrom] = useState<string | null>(
    initial?.id ?? null,
  );

  function fillFrom(id: string, p: ProductFill | null) {
    wanted.current = id;
    setLoadingId(null);
    setProductId(id);
    // Outro produto: a variação começa do zero (o campo fica obrigatório).
    setVariantId("");
    onProductChange?.(id, "", p);
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

  /** Produto escolhido na busca: a ficha (já conhecida ou pedida ao servidor) preenche os campos. */
  async function choose(option: SearchOption | null) {
    setFillFailed(false);
    if (!option) {
      fillFrom("", null);
      return;
    }
    const known = fills[option.id];
    if (known) {
      fillFrom(option.id, known);
      return;
    }
    // Já vale o produto novo: o que veio da ficha anterior sai na hora (a
    // solicitação nunca leva o texto de um produto com o código de outro).
    fillFrom(option.id, null);
    setLoadingId(option.id);
    try {
      const res = await fetch(
        `/api/products/fill?id=${encodeURIComponent(option.id)}`,
      );
      const body = (await res.json()) as { fill?: ProductFill };
      if (!res.ok || !body.fill) throw new Error(String(res.status));
      const fill = body.fill;
      setFills((all) => ({ ...all, [fill.id]: fill }));
      // Escolheu outro enquanto esperava: esta ficha não preenche nada.
      if (wanted.current === option.id) fillFrom(option.id, fill);
    } catch {
      if (wanted.current !== option.id) return;
      // Sem a ficha, nada fica escolhido (o campo volta vazio); o que a
      // pessoa digitou enquanto esperava fica.
      wanted.current = "";
      setLoadingId(null);
      setProductId("");
      setVariantId("");
      onProductChange?.("", "", null);
      setFillFailed(true);
      setPickerKey((k) => k + 1);
    }
  }

  /** Variação escolhida: a especificação passa a ser a dela (o nome é composto no servidor). */
  function pickVariant(id: string) {
    setVariantId(id);
    const p = fills[productId] ?? null;
    onProductChange?.(productId, id, p);
    const v = p?.variants.find((x) => x.id === id);
    setPicked((k) => ({ ...k, specification: null }));
    setValues((cur) => ({
      ...cur,
      specification: v?.specification ?? p?.specification ?? "",
    }));
  }

  function toggleNotInCatalog(checked: boolean) {
    setNotInCatalog(checked);
    setFillFailed(false);
    if (checked && (productId || loadingId)) fillFrom("", null);
  }

  const selected = (productId && fills[productId]) || null;
  const selectedVariant =
    selected?.variants.find((v) => v.id === variantId) ?? null;

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
          <ProductPicker
            key={pickerKey}
            scope="catalog"
            inputId={`rp-${prefix}productId`}
            name={`${prefix}productId`}
            initial={
              selected ? { id: selected.id, name: selected.label } : null
            }
            ariaLabel={labels.product}
            labels={pickerLabels}
            onChoose={(option) => void choose(option)}
          />
          {loadingId ? (
            <p className="text-xs text-zinc-500" data-request-fill-loading>
              {labels.fillLoading}
            </p>
          ) : fillFailed ? (
            <p
              className="text-xs font-medium text-red-700"
              data-request-fill-error
            >
              {labels.fillError}
            </p>
          ) : null}
          <p className="text-xs text-zinc-500">
            {filledFrom ? (
              <span className="mr-1.5 inline-block rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
                {labels.filledBadge}
              </span>
            ) : null}
            {labels.filledHint}
          </p>
          {/* Produto com variações: a escolha é obrigatória e preenche
              especificação, pedido mínimo e foto. Produto sem variações: nada muda. */}
          {selected && selected.variants.length > 0 ? (
            <div className="space-y-1 pt-1">
              <label
                htmlFor={`rp-${prefix}variantId`}
                className="block text-xs font-medium leading-5 text-zinc-700"
              >
                {labels.variant}
              </label>
              <select
                id={`rp-${prefix}variantId`}
                name={`${prefix}variantId`}
                value={variantId}
                required
                onChange={(e) => pickVariant(e.target.value)}
                data-request-variant
                className={inputClass}
              >
                <option value="">{labels.variantChoose}</option>
                {selected.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-zinc-500">{labels.variantHint}</p>
              {selectedVariant?.photoDocumentId ? (
                <a
                  href={`/api/files/${selectedVariant.photoDocumentId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-20 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 hover:border-brand-300"
                  title={labels.variantPhoto}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
                  <img
                    src={`/api/files/${selectedVariant.photoDocumentId}`}
                    alt={`${labels.variantPhoto}: ${selectedVariant.name}`}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                </a>
              ) : null}
            </div>
          ) : null}
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
