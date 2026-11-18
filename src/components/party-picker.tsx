"use client";

import {
  SearchPicker,
  type SearchOption,
  type SearchPickerLabels,
} from "./search-picker";

/** Textos do campo (já no idioma de quem vê). */
export type PartyPickerLabels = SearchPickerLabels;

/**
 * Campo de cliente/fornecedor com busca: com a carga do Sankhya são ~26 mil
 * clientes e ~5,7 mil fornecedores, que não cabem numa lista de seleção (a
 * página mandava todos ao navegador). Busca pelo nome a partir de 2 letras
 * (/api/parties/search) e grava o id num campo escondido com o mesmo `name`
 * do antigo <select>: os formulários e as ações continuam iguais. O campo em
 * si é o SearchPicker (src/components/search-picker.tsx).
 */
export function PartyPicker({
  name,
  type,
  initial,
  required,
  disabled,
  activeOnly,
  includeStock,
  alsoTypes,
  dense,
  className,
  inputClassName,
  inputId,
  ariaLabel,
  labels,
  onChoose,
  onDeselect,
}: {
  name?: string;
  type: "customer" | "supplier";
  initial?: SearchOption | null;
  required?: boolean;
  disabled?: boolean;
  /** Só parceiros ativos. */
  activeOnly?: boolean;
  /**
   * Inclui a empresa interna "Estoque Wellmix" (fica fora por padrão): só
   * onde a lista antiga a mostrava (ex.: cliente do container).
   */
  includeStock?: boolean;
  /**
   * Outros tipos de parceiro na mesma busca (só a Wellmix; ex.: Trading,
   * Supplier e Factory no convite da cotação de compra).
   */
  alsoTypes?: readonly string[];
  dense?: boolean;
  className?: string;
  /** Classes a mais no campo de texto. */
  inputClassName?: string;
  /** Id do campo de texto (para o <label htmlFor>). */
  inputId?: string;
  ariaLabel?: string;
  labels: PartyPickerLabels;
  /** Avisado a cada escolha (ex.: incluir a empresa numa lista). */
  onChoose?: (option: SearchOption | null) => void;
  /** Avisado quando a escolha some porque a pessoa voltou a digitar. */
  onDeselect?: () => void;
}) {
  const params = new URLSearchParams({ type });
  if (activeOnly) params.set("active", "1");
  if (includeStock) params.set("stock", "1");
  if (alsoTypes?.length) params.set("also", alsoTypes.join(","));
  return (
    <SearchPicker
      endpoint={`/api/parties/search?${params}`}
      marker="party-picker"
      kind={type}
      name={name}
      inputId={inputId}
      initial={initial}
      required={required}
      disabled={disabled}
      dense={dense}
      className={className}
      inputClassName={inputClassName}
      ariaLabel={ariaLabel}
      labels={labels}
      onChoose={onChoose}
      onDeselect={onDeselect}
    />
  );
}
