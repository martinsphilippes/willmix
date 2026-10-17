"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui";

/*
 * Escolha entre as opções sugeridas pela IA (rádio) ou outro valor (texto).
 * - Tocar de novo na opção marcada (ou em "Limpar") desmarca: dá para voltar
 *   a deixar em branco.
 * - Escolher uma opção ou digitar outro valor já marca o "Aplicar" do campo;
 *   limpar desmarca. Com "Aplicar" marcado e nada escolhido, o envio pede o
 *   valor (o navegador aponta o campo "Outro").
 * Os rádios e o texto compartilham o `name`, como antes: sem JavaScript o
 * formulário continua funcionando (a action lê o primeiro valor enviado).
 */
export function AiChoiceInput({
  name,
  options,
  label,
  maxLength,
  labels,
}: {
  name: "material" | "color";
  options: string[];
  label: string;
  maxLength: number;
  labels: {
    suggested: string;
    other: string;
    clear: string;
    hint: string;
  };
}) {
  const ref = useRef<HTMLFieldSetElement>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [applyOn, setApplyOn] = useState(false);

  // Caixa "Aplicar" do mesmo campo (fica no cartão em volta).
  const applyBox = () =>
    ref.current
      ?.closest("[data-apply-row]")
      ?.querySelector<HTMLInputElement>('input[name="apply"]') ?? null;

  useEffect(() => {
    ref.current?.setAttribute("data-ready", "1");
    // A caixa começa desmarcada; daqui em diante acompanha o toque nela.
    const box = applyBox();
    if (!box) return;
    const sync = () => setApplyOn(box.checked);
    box.addEventListener("change", sync);
    return () => box.removeEventListener("change", sync);
  }, []);

  /** Marca ou desmarca o "Aplicar" conforme há valor escolhido. */
  const setApply = (on: boolean) => {
    const box = applyBox();
    if (box && box.checked !== on) {
      box.checked = on;
      setApplyOn(on);
    }
  };

  const pick = (option: string) => {
    if (picked === option) {
      // Tocar de novo na marcada desmarca.
      setPicked(null);
      setApply(other.trim() !== "");
      return;
    }
    setPicked(option);
    setOther("");
    setApply(true);
  };

  const clear = () => {
    setPicked(null);
    setOther("");
    setApply(false);
  };

  const hasValue = picked !== null || other.trim() !== "";
  return (
    <fieldset
      ref={ref}
      aria-label={label}
      className="space-y-1.5"
      data-ai-choice={name}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">{labels.suggested}:</p>
        {hasValue ? (
          <button
            type="button"
            onClick={clear}
            className="text-xs font-medium text-brand-700 underline-offset-2 hover:underline"
            data-ai-choice-clear=""
          >
            {labels.clear}
          </button>
        ) : null}
      </div>
      {options.map((o) => (
        <label
          key={o}
          className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800"
        >
          <input
            type="radio"
            name={name}
            value={o}
            checked={picked === o}
            // Controlado pelo clique (o clique na marcada também desmarca).
            onChange={() => {}}
            onClick={() => pick(o)}
            className="h-5 w-5 shrink-0 cursor-pointer accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          />
          <span className="break-words">{o}</span>
        </label>
      ))}
      <label className="flex items-center gap-2 text-sm text-zinc-800">
        <span className="shrink-0 text-zinc-500">{labels.other}:</span>
        <Input
          name={name}
          value={other}
          onChange={(e) => {
            const v = e.currentTarget.value;
            setOther(v);
            if (v.trim()) {
              setPicked(null);
              setApply(true);
            } else if (picked === null) setApply(false);
          }}
          // "Aplicar" marcado sem nada escolhido: o envio pede o valor.
          required={applyOn && picked === null}
          aria-label={`${label} · ${labels.other}`}
          maxLength={maxLength}
          className="min-w-0 flex-1"
        />
      </label>
      <p className="text-xs text-zinc-500">{labels.hint}</p>
    </fieldset>
  );
}

/**
 * Categoria e descrição sugeridas: editar o texto já marca o "Aplicar" do
 * campo (como escolher material e cor). Antes o texto editado ficava de fora
 * se a caixa não fosse marcada, e a sugestão fechava sem ele.
 */
export function ApplyAutoTick() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const row = ref.current?.closest("[data-apply-row]");
    const box = row?.querySelector<HTMLInputElement>('input[name="apply"]');
    if (!row || !box) return;
    const onInput = (e: Event) => {
      const el = e.target;
      if (el === box) return;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
        box.checked = true;
    };
    row.addEventListener("input", onInput);
    return () => row.removeEventListener("input", onInput);
  }, []);
  return <span ref={ref} hidden />;
}
