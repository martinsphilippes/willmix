"use client";

import { useRef, useState } from "react";

/** Fornecedor cadastrado, como o seletor da ficha mestre precisa. */
export interface SupplierOption {
  id: string;
  name: string;
  /** Do cadastro do fornecedor: vão para Local, Nº da loja e Telefone. */
  city: string | null;
  storeNumber: string | null;
  phone: string | null;
  /** Código do item na fábrica deste fornecedor para este produto. */
  code: string | null;
  /** Já é fornecedor deste produto (aparece primeiro). */
  linked: boolean;
}

/** Valor da opção que guarda o nome antigo digitado à mão. */
export const LEGACY_SUPPLIER = "__legacy__";

/**
 * "Nome do fornecedor" da ficha mestre: escolha entre os fornecedores
 * cadastrados (os deste produto primeiro). Ao escolher, Local, Nº da loja,
 * Telefone e Código do item vêm do cadastro; o servidor grava o fornecedor
 * escolhido como principal do produto. Nome antigo, de fornecedor não
 * cadastrado, continua como opção até alguém escolher outro.
 */
export function SupplierPicker({
  options,
  initialId,
  initialName,
  labels,
  className,
  id,
}: {
  /** Repassado pelo FieldRow para o rótulo apontar para o seletor. */
  id?: string;
  options: SupplierOption[];
  initialId: string | null;
  initialName: string | null;
  labels: {
    placeholder: string;
    linked: string;
    others: string;
    legacy: string;
  };
  className?: string;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const known = options.some((o) => o.id === initialId);
  const legacyName = !known && initialName ? initialName : null;
  // O bloco já é de algum fornecedor (cadastrado ou nome antigo) — desde a
  // abertura da tela ou depois da primeira escolha. Só sem fornecedor nenhum
  // o que foi digitado fica quando o cadastro do escolhido não tem.
  const hadSupplier = useRef(known || !!legacyName);
  const [value, setValue] = useState(
    known ? initialId! : legacyName ? LEGACY_SUPPLIER : "",
  );
  const chosen = options.find((o) => o.id === value) ?? null;
  const name = chosen?.name ?? (value === LEGACY_SUPPLIER ? legacyName : "");

  function choose(id: string) {
    setValue(id);
    const option = options.find((o) => o.id === id);
    const form = root.current?.closest("form");
    if (!option || !form) return;
    // O bloco Fornecedor passa a ser do escolhido: valores do cadastro. Vindo
    // de outro fornecedor, o que o cadastro não tem fica vazio (não sobra dado
    // do anterior); sem fornecedor antes, o que foi digitado fica.
    const fromSupplier = hadSupplier.current;
    hadSupplier.current = true;
    const set = (field: string, v: string | null) => {
      const el = form.elements.namedItem(field);
      if (!(el instanceof HTMLInputElement)) return;
      if (!v && !fromSupplier) return;
      el.value = v ?? "";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    set("location", option.city);
    set("supplierStore", option.storeNumber);
    set("supplierPhone", option.phone);
    set("factoryItemCode", option.code);
  }

  const linked = options.filter((o) => o.linked);
  const others = options.filter((o) => !o.linked);
  return (
    <span ref={root} className="block" data-supplier-picker>
      <input type="hidden" name="supplierName" value={name ?? ""} />
      <select
        id={id}
        name="supplierId"
        value={value}
        onChange={(e) => choose(e.target.value)}
        className={className}
      >
        <option value="" disabled>
          {labels.placeholder}
        </option>
        {legacyName ? (
          <option value={LEGACY_SUPPLIER}>
            {labels.legacy.replace("{name}", legacyName)}
          </option>
        ) : null}
        {linked.length ? (
          <optgroup label={labels.linked}>
            {linked.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </optgroup>
        ) : null}
        {others.length ? (
          <optgroup label={linked.length ? labels.others : labels.placeholder}>
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>
    </span>
  );
}
