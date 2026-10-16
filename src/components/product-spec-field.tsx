"use client";

import { useEffect, useRef, useState } from "react";
import { Textarea } from "./ui";
import {
  buildProductSpec,
  specNumber,
  type ProductSpecData,
  type ProductSpecLabels,
} from "@/lib/product-spec";

/*
 * Especificação do produto que se monta sozinha com os dados do cadastro
 * (material, cor e Pantone, medidas, peso, caixa) e da ficha mestre
 * (embalagem, capacidade, energia). Enquanto não é editada à mão, acompanha
 * ao vivo o que se preenche no formulário; editada, fica como a pessoa
 * escreveu, e um botão monta de novo com os dados.
 */
export function ProductSpecField({
  id,
  name,
  defaultValue,
  initialAuto,
  extras,
  labels,
  texts,
}: {
  id?: string;
  name: string;
  defaultValue: string;
  /** O texto salvo é o montado com os dados (ou estava vazio). */
  initialAuto: boolean;
  /** Dados que não estão neste formulário (ficha mestre). */
  extras: Pick<
    ProductSpecData,
    "capacityMl" | "packageType" | "powerSource" | "powerDetail"
  >;
  labels: ProductSpecLabels;
  texts: { auto: string; manual: string; rebuild: string; empty: string };
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [auto, setAuto] = useState(initialAuto);
  const autoRef = useRef(initialAuto);
  // A leitura mais recente (dados da ficha mestre mudam com a tela).
  const currentRef = useRef<() => string>(() => "");

  // Dados do produto como estão no formulário agora.
  function current(): string {
    const form = ref.current?.form;
    if (!form) return "";
    const v = (field: string) => {
      const el = form.elements.namedItem(field);
      return el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement
        ? el.value
        : "";
    };
    let pantones: Array<{ code: string }> = [];
    try {
      const raw = v("colorPantones");
      const list: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list))
        pantones = list.filter(
          (c): c is { code: string } =>
            !!c && typeof (c as { code?: unknown }).code === "string",
        );
    } catch {
      // Campo de cores ilegível: segue sem elas.
    }
    return buildProductSpec(
      {
        ...extras,
        material: v("material"),
        color: v("color"),
        colorPantones: pantones,
        lengthCm: specNumber(v("lengthCm")),
        widthCm: specNumber(v("widthCm")),
        heightCm: specNumber(v("heightCm")),
        netWeightKg: specNumber(v("netWeightKg")),
        grossWeightKg: specNumber(v("grossWeightKg")),
        masterBoxQty: specNumber(v("masterBoxQty")),
        innerBoxQty: specNumber(v("innerBoxQty")),
        boxLengthCm: specNumber(v("boxLengthCm")),
        boxWidthCm: specNumber(v("boxWidthCm")),
        boxHeightCm: specNumber(v("boxHeightCm")),
        // CBM calculado (campo desativado) não é enviado: o servidor usa as
        // medidas da caixa, e a montagem também.
        cbm: (() => {
          const el = form.elements.namedItem("cbm");
          return el instanceof HTMLInputElement && !el.disabled
            ? specNumber(el.value)
            : null;
        })(),
      },
      labels,
    );
  }

  useEffect(() => {
    currentRef.current = current;
  });

  // Tela atualizada (ex.: ficha mestre salva): o automático acompanha.
  useEffect(() => {
    if (autoRef.current && ref.current)
      ref.current.value = currentRef.current();
  }, [
    extras.capacityMl,
    extras.packageType,
    extras.powerSource,
    extras.powerDetail,
  ]);

  // Outro campo do formulário mudou: a especificação automática acompanha.
  useEffect(() => {
    const el = ref.current;
    const form = el?.form;
    if (!el || !form) return;
    let timer = 0;
    const onChange = (e: Event) => {
      if (e.target === el || !autoRef.current) return;
      // Depois do React (cores Pantone e campos controlados já atualizados).
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (autoRef.current) el.value = currentRef.current();
      }, 0);
    };
    form.addEventListener("input", onChange);
    form.addEventListener("change", onChange);
    return () => {
      window.clearTimeout(timer);
      form.removeEventListener("input", onChange);
      form.removeEventListener("change", onChange);
    };
  }, []);

  function setMode(next: boolean) {
    autoRef.current = next;
    setAuto(next);
  }

  return (
    <div className="space-y-1">
      {/* O servidor monta de novo com os dados salvos enquanto é automática. */}
      <input type="hidden" name={`${name}Auto`} value={auto ? "1" : ""} />
      <Textarea
        ref={ref}
        id={id}
        name={name}
        rows={6}
        maxLength={10_000}
        defaultValue={defaultValue}
        placeholder={texts.empty}
        // Escrever à mão para de acompanhar; apagar tudo volta ao automático.
        onInput={(e) => setMode(e.currentTarget.value.trim() === "")}
        className="leading-6"
        dense
        data-product-spec={auto ? "auto" : "manual"}
      />
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
        <span>{auto ? texts.auto : texts.manual}</span>
        {!auto ? (
          <button
            type="button"
            className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
            onClick={() => {
              if (ref.current) ref.current.value = currentRef.current();
              setMode(true);
            }}
            data-product-spec-rebuild
          >
            {texts.rebuild}
          </button>
        ) : null}
      </p>
    </div>
  );
}
