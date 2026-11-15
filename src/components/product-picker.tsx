"use client";

import {
  SearchPicker,
  type SearchOption,
  type SearchPickerLabels,
} from "./search-picker";

/** Que produtos o campo oferece (src/lib/services/product-search.ts). */
export type ProductPickerScope = "all" | "active" | "catalog";

/**
 * Campo de produto com busca (nome ou código, a partir de 2 letras, em
 * /api/products/search): o cadastro tem ~17 mil produtos, que não cabem numa
 * lista de seleção. Grava o id num campo escondido com o mesmo `name` do
 * antigo <select>: os formulários e as ações continuam iguais.
 */
export function ProductPicker({
  scope,
  query,
  ...props
}: {
  scope: ProductPickerScope;
  /** Filtros a mais na busca (ex.: "country=CHINA&line=linha-x"). */
  query?: string;
  name?: string;
  inputId?: string;
  initial?: SearchOption | null;
  required?: boolean;
  disabled?: boolean;
  dense?: boolean;
  className?: string;
  inputClassName?: string;
  ariaLabel?: string;
  labels: SearchPickerLabels;
  onChoose?: (option: SearchOption | null) => void;
}) {
  return (
    <SearchPicker
      endpoint={`/api/products/search?scope=${scope}${query ? `&${query}` : ""}`}
      marker="product-picker"
      kind={scope}
      {...props}
    />
  );
}
