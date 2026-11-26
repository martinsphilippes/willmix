"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { cx } from "@/components/ui";
import {
  CARTONS_EVENT,
  COLORS_EVENT,
  PACKING_EVENT,
  SPLIT_EVENT,
  type CartonsEventDetail,
  type ColorsEventDetail,
  type PackingEventDetail,
  type SplitEventDetail,
} from "@/components/selection-quantity";
import { shrink } from "@/components/photo-input";
import { uploadDirect } from "@/components/direct-upload";
import { uploadSelectionArtAction } from "@/app/app/actions/supplier-requests";
import type { SelectionPacking } from "@/lib/db/schema";
import {
  MAX_PACKS,
  MAX_VARIATIONS,
  alteredCbm,
  artKey,
  cleanVariation,
  packCombos,
  packOptions,
  packSku,
  type PackCombo,
  type PackVariation,
} from "@/lib/selection-packing";

/*
 * Logo abaixo da tabela do grupo (Seleção de itens): com um vencedor
 * marcado em "Escolher", a barra diz qual é e quantos itens ficaram
 * recolhidos, com "Rever opções" para abrir a comparação de novo (o
 * recolher é do CSS, por `data-selection-review`).
 *
 * Embalagens e variações (dono, 26/11/2026; docs/SUPPLIER_REQUESTS.md,
 * "Embalagens e variações"):
 * 1. "Alterar" abre uma tabela de uma linha igual ao vencedor com a
 *    Qtd/caixa editável (x0 → x1); o CBM acompanha (CBM × x1 ÷ x0).
 * 2. "+ Embalagem" abre, um pouco à direita, a tabela das novas embalagens:
 *    cada linha tem a Qtd/Embalagem (N divide a Qtd/caixa final), o preço
 *    × N nas duas moedas, a Qtd/caixa ÷ N e o MOQ ÷ N para cima. O "+"
 *    continua para mais embalagens.
 * 3. No fim, o toggle: a tabela pai (a alterada, ou o vencedor) conta ou
 *    não como mais uma opção de embalagem.
 * 4. Card "Variações": uma linha por variação (cores do Book e as digitadas
 *    no "+ Variação", já incluídas) e uma coluna por embalagem com as caixas
 *    de cada combinação (divisão igual ou digitada; a conta é a do gerador
 *    da quantidade, `SelectionQuantity`, pelos eventos do formulário).
 * 5. "Mix de cores" no alto, à direita do card.
 * 6. A arte de exemplo de cada combinação ou, com o Mix, de cada embalagem.
 * Ao gravar, cada combinação vira uma cotação (o JSON `packing.<item>`).
 */

export interface VariationItem {
  id: string;
  name: string;
  /** Cores do item no Book. */
  colors: string[];
  /** Peças por caixa master (x0). */
  carton?: number | null;
  photo?: string | null;
  supplier?: string;
  price?: number | null;
  currency?: string | null;
  incoterm?: string | null;
  priceUsd?: number | null;
  moq?: number | null;
  /** CBM da caixa (o do Book ou o das medidas). */
  cbm?: number | null;
  /** Medidas, capacidade e material já escritos (só leitura). */
  dims?: [string, string, string];
  capacity?: string;
  material?: string | null;
}

export interface VariationLabels {
  intl: string;
  chosen: string;
  collapsed: string;
  review: string;
  reviewHint: string;
  title: string;
  hint: string;
  include: string;
  excluded: string;
  count: string;
  pieces: string;
  line: string;
  /** Campo "Caixas" ao lado das peças de cada cor e o rótulo acessível dele. */
  cartons: string;
  cartonsOf: string;
  /** "Inclua pelo menos uma cor". */
  none: string;
}

/** Textos das embalagens (chaves `packing.*`, com os {marcadores}). */
export type PackingLabels = Record<
  | "alter"
  | "alterHint"
  | "alteredTitle"
  | "undo"
  | "add"
  | "addHint"
  | "packsTitle"
  | "colUnits"
  | "remove"
  | "packName"
  | "parentAltered"
  | "parentItem"
  | "errorUnits"
  | "errorDivide"
  | "errorRepeat"
  | "errorCarton"
  | "optionUnit"
  | "optionPack"
  | "perCarton"
  | "mix"
  | "mixHint"
  | "variationAdd"
  | "variationPlaceholder"
  | "variationRemove"
  | "variationCustom"
  | "variationsHint"
  | "count"
  | "cellCartonsOf"
  | "cellUnits"
  | "art"
  | "artAdd"
  | "artRemove"
  | "artRow"
  | "artUploading"
  | "artFailed"
  | "combo"
  | "unitOnly"
  | "variationRepeat"
  | "bookCarton",
  string
> & {
  /** Títulos das colunas da tabela do item. */
  col: Record<
    | "photo"
    | "item"
    | "supplier"
    | "price"
    | "priceUsd"
    | "moq"
    | "box"
    | "cbm"
    | "length"
    | "width"
    | "height"
    | "capacity"
    | "material",
    string
  >;
};

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));

let seq = 0;
const newId = () => `r${++seq}`;

interface PackRow {
  id: string;
  text: string;
}
interface CustomRow {
  id: string;
  text: string;
}
/** O que foi mexido para um item (trocar de vencedor e voltar mantém). */
interface ItemState {
  alterOn: boolean;
  alterText: string;
  packs: PackRow[];
  parentOption: boolean;
  mix: boolean;
  /** Cores do Book incluídas (nulo = todas). */
  picked: string[] | null;
  customs: CustomRow[];
}

/** Arte escolhida: o arquivo (no formulário), o já subido ou a gravada. */
type Art =
  | { kind: "file"; file: File; url: string }
  | { kind: "uploaded"; id: string; url: string }
  | { kind: "kept"; docId: string };

function blank(item: VariationItem): ItemState {
  return {
    alterOn: false,
    alterText: item.carton ? String(item.carton) : "",
    packs: [],
    parentOption: true,
    mix: false,
    picked: null,
    customs: [],
  };
}

function fromSaved(
  item: VariationItem,
  saved: SelectionPacking | null,
  savedColors: string[] | null,
): ItemState {
  if (!saved)
    return { ...blank(item), picked: savedColors ? [...savedColors] : null };
  return {
    alterOn: !!saved.carton,
    alterText: String(saved.carton ?? item.carton ?? ""),
    packs: saved.packs.map((n) => ({ id: newId(), text: String(n) })),
    parentOption: saved.parentOption,
    mix: saved.mix,
    picked: saved.variations.filter((v) => !v.custom).map((v) => v.label),
    customs: saved.variations
      .filter((v) => v.custom)
      .map((v) => ({ id: newId(), text: v.label })),
  };
}

function savedArts(saved: SelectionPacking | null): Record<string, Art> {
  const out: Record<string, Art> = {};
  for (const l of saved?.lines ?? [])
    if (l.artDocumentId)
      out[artKey(saved!.mix, l.variation, l.units)] = {
        kind: "kept",
        docId: l.artDocumentId,
      };
  return out;
}

const intOf = (text: string) => {
  const t = text.trim();
  return /^\d{1,7}$/.test(t) ? Number(t) : NaN;
};

export function SelectionVariations({
  items,
  chosenItemId,
  savedColors,
  savedPacking = null,
  draftArts = null,
  seesPrice = false,
  labels,
  packLabels,
}: {
  items: VariationItem[];
  /** O vencedor da escolha gravada. */
  chosenItemId: string | null;
  /** Cores incluídas na escolha gravada (do `chosenItemId`). */
  savedColors: string[] | null;
  /** Embalagens e variações gravadas (do `chosenItemId`). */
  savedPacking?: SelectionPacking | null;
  /** Artes do rascunho da seleção (combinação → documento), do `chosenItemId`. */
  draftArts?: Record<string, string> | null;
  /** Mostra as colunas de preço (permissão "Ver preço de compra"). */
  seesPrice?: boolean;
  labels: VariationLabels;
  packLabels?: PackingLabels;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [chosen, setChosen] = useState<string | null>(chosenItemId);
  const [states, setStates] = useState<Record<string, ItemState>>(() => {
    const item = items.find((i) => i.id === chosenItemId);
    return item && (savedPacking || savedColors)
      ? { [item.id]: fromSaved(item, savedPacking, savedColors) }
      : {};
  });
  const [arts, setArts] = useState<Record<string, Record<string, Art>>>(() =>
    chosenItemId && (savedPacking || draftArts)
      ? {
          [chosenItemId]: {
            ...savedArts(savedPacking),
            // Rascunho (dono, 26/11/2026): as artes já registradas voltam.
            ...Object.fromEntries(
              Object.entries(draftArts ?? {}).map(([key, docId]) => [
                key,
                { kind: "kept" as const, docId },
              ]),
            ),
          },
        }
      : {},
  );
  const [artBusy, setArtBusy] = useState<string | null>(null);
  const [artError, setArtError] = useState<string | null>(null);
  const [split, setSplit] = useState<SplitEventDetail | null>(null);
  const [open, setOpen] = useState(true);
  // Caixas sendo digitadas (o campo mostra o texto até sair dele).
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const item = items.find((i) => i.id === chosen) ?? null;
  const st = item ? (states[item.id] ?? blank(item)) : null;
  const update = (fn: (s: ItemState) => ItemState) => {
    if (!item) return;
    setStates((p) => ({ ...p, [item.id]: fn(p[item.id] ?? blank(item)) }));
  };

  const markItem = useEffectEvent((next: string | null, byUser: boolean) => {
    setChosen(next);
    // Escolher outro item recolhe de novo a comparação.
    if (byUser) {
      const review = ref.current
        ?.closest("form")
        ?.querySelector<HTMLInputElement>("input[data-selection-review]");
      if (review) review.checked = false;
    }
  });

  // Com algum erro das embalagens ou variações, nada é gravado: a tela leva
  // até ele (o servidor também recusa).
  const blockSubmit = useEffectEvent((e: SubmitEvent) => {
    const bad = ref.current?.querySelector<HTMLElement>("[data-packing-error]");
    if (!bad) return;
    e.preventDefault();
    bad.scrollIntoView({ block: "center", behavior: "smooth" });
  });

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const sync = () => {
      const el = form.querySelector<HTMLInputElement>(
        'input[name="chosen"]:checked',
      );
      markItem(el ? el.value : null, false);
    };
    const onChange = (e: Event) => {
      const el = e.target;
      if (el instanceof HTMLInputElement && el.name === "chosen" && el.checked)
        markItem(el.value, true);
    };
    const onSplit = (e: Event) =>
      setSplit((e as CustomEvent<SplitEventDetail>).detail);
    const onSubmit = (e: SubmitEvent) => blockSubmit(e);
    const frame = requestAnimationFrame(sync);
    form.addEventListener("change", onChange);
    form.addEventListener(SPLIT_EVENT, onSplit);
    form.addEventListener("submit", onSubmit);
    window.addEventListener("pageshow", sync);
    return () => {
      cancelAnimationFrame(frame);
      form.removeEventListener("change", onChange);
      form.removeEventListener(SPLIT_EVENT, onSplit);
      form.removeEventListener("submit", onSubmit);
      window.removeEventListener("pageshow", sync);
    };
  }, []);

  const intl = labels.intl;
  const num = (n: number | null | undefined, digits = 4) =>
    n === null || n === undefined || !Number.isFinite(n)
      ? "—"
      : n.toLocaleString(intl, { maximumFractionDigits: digits });

  /* ---- Caixa alterada e embalagens ---- */
  const x0 = item?.carton && item.carton >= 1 ? Math.round(item.carton) : null;
  const typedCarton = st?.alterOn ? intOf(st.alterText) : NaN;
  const alterError =
    !!st?.alterOn && !(Number.isInteger(typedCarton) && typedCarton >= 1);
  const x1 = st?.alterOn && !alterError ? typedCarton : x0;
  const cbm1 =
    st?.alterOn && !alterError
      ? alteredCbm(item?.cbm ?? null, x0, x1)
      : (item?.cbm ?? null);
  const packRows = (st?.packs ?? []).map((row, i, all) => {
    const units = intOf(row.text);
    const error =
      row.text.trim() === ""
        ? null
        : !Number.isInteger(units) || units < 2
          ? "units"
          : !x1 || x1 % units !== 0
            ? "divide"
            : all.slice(0, i).some((r) => intOf(r.text) === units)
              ? "repeat"
              : null;
    return { ...row, units, error };
  });
  const validPacks = packRows
    .filter((r) => r.text.trim() !== "" && !r.error)
    .map((r) => r.units);
  const options = packOptions({
    packs: validPacks,
    parentOption: st?.parentOption ?? true,
  });

  /* ---- Variações ---- */
  const bookColors = item?.colors ?? [];
  const pickedBook = st?.picked
    ? bookColors.filter((c) => st.picked!.includes(c))
    : bookColors;
  const customRows = (st?.customs ?? []).map((row, i, all) => {
    const label = cleanVariation(row.text);
    const key = label.toLocaleLowerCase("pt-BR");
    const repeat =
      !!label &&
      (bookColors.some((c) => c.toLocaleLowerCase("pt-BR") === key) ||
        all
          .slice(0, i)
          .some(
            (r) => cleanVariation(r.text).toLocaleLowerCase("pt-BR") === key,
          ));
    return { ...row, label, repeat };
  });
  const variations: PackVariation[] = [
    ...pickedBook.map((label) => ({ label, custom: false })),
    ...customRows
      .filter((r) => r.label && !r.repeat)
      .map((r) => ({ label: r.label, custom: true })),
  ];
  const noneError = !!item && bookColors.length > 0 && !variations.length;
  const combos: PackCombo[] = noneError ? [] : packCombos(variations, options);
  const single = options.length === 1;
  const packName = (units: number) =>
    units === 1
      ? (packLabels?.optionUnit ?? "")
      : fill(packLabels?.optionPack ?? "{n}", { n: units });
  const comboName = (c: PackCombo) => {
    const v = c.variation ?? (packLabels?.unitOnly || item?.name || "");
    return single
      ? v
      : c.variation
        ? fill(packLabels?.combo ?? "{variation} · {pack}", {
            variation: c.variation,
            pack: packName(c.units),
          })
        : packName(c.units);
  };
  const names = Object.fromEntries(combos.map((c) => [c.key, comboName(c)]));

  // O gerador da quantidade faz a conta com a caixa final e as combinações.
  const packKey = item ? `${item.id}|${x1 ?? ""}|${cbm1 ?? ""}` : "";
  useEffect(() => {
    if (!item) return;
    const send = () =>
      ref.current?.closest("form")?.dispatchEvent(
        new CustomEvent<PackingEventDetail>(PACKING_EVENT, {
          detail: {
            itemId: item.id,
            carton: st?.alterOn && !alterError ? x1 : null,
            cbm: st?.alterOn && !alterError ? cbm1 : null,
          },
        }),
      );
    send();
    // Ao abrir com a escolha gravada ou o rascunho, a Programação de compra
    // (mais abaixo na tela) ainda não ouve: o aviso vai de novo no quadro
    // seguinte (o repetido não muda nada).
    const frame = requestAnimationFrame(send);
    return () => cancelAnimationFrame(frame);
    // `packKey` resume o item, a caixa e o CBM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packKey]);
  const comboKeys = combos.map((c) => c.key);
  const colorsKey = item
    ? `${item.id}|${JSON.stringify(names)}|${noneError}`
    : "";
  useEffect(() => {
    if (!item) return;
    const send = () =>
      ref.current?.closest("form")?.dispatchEvent(
        new CustomEvent<ColorsEventDetail>(COLORS_EVENT, {
          detail: {
            itemId: item.id,
            colors: comboKeys,
            // Sem nenhuma variação incluída, o aviso é deste card.
            all: noneError ? [] : comboKeys,
            names,
          },
        }),
      );
    send();
    // Como o aviso da caixa: de novo no quadro seguinte, para a Programação
    // de compra que ainda não ouvia ao abrir.
    const frame = requestAnimationFrame(send);
    return () => cancelAnimationFrame(frame);
    // `colorsKey` resume o item e as combinações.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorsKey]);

  const piecesOf = (key: string) =>
    split?.itemId === item?.id
      ? (split?.rows?.find((r) => r.color === key)?.quantity ?? null)
      : null;
  const typeCartons = (key: string, text: string) => {
    setDrafts((d) => ({ ...d, [key]: text }));
    const n = Number(text.replace(/\D/g, ""));
    if (!item || text.trim() === "" || !Number.isInteger(n) || n < 0) return;
    ref.current?.closest("form")?.dispatchEvent(
      new CustomEvent<CartonsEventDetail>(CARTONS_EVENT, {
        detail: { itemId: item.id, color: key, cartons: n },
      }),
    );
  };

  /* ---- Artes ---- */
  const myArts = item ? (arts[item.id] ?? {}) : {};
  const mix = st?.mix ?? false;
  const wantedArts = [
    ...new Set(combos.map((c) => artKey(mix, c.variation, c.units))),
  ];
  const setArt = (key: string, art: Art | null) => {
    if (!item) return;
    setArts((p) => {
      const mine = { ...(p[item.id] ?? {}) };
      const old = mine[key];
      if (old && old.kind !== "kept") URL.revokeObjectURL(old.url);
      if (art) mine[key] = art;
      else delete mine[key];
      return { ...p, [item.id]: mine };
    });
  };
  const pickArt = async (key: string, file: File | undefined) => {
    if (!file) return;
    setArtError(null);
    setArtBusy(key);
    try {
      const reduced = await shrink(file, 1600, 0.82);
      const ids = await uploadDirect([reduced], () => {});
      // A arte vira documento na hora, para ficar no rascunho da seleção
      // (dono, 26/11/2026): direto ao armazenamento quando dá, senão pelo
      // servidor.
      const body = new FormData();
      if (ids?.[0]) body.set("uploaded", ids[0]);
      else body.set("file", reduced);
      const result = await uploadSelectionArtAction(body);
      if (!result.ok || !result.id) throw new Error(result.error ?? "art");
      setArt(key, { kind: "kept", docId: result.id });
    } catch (err) {
      console.error("arte da combinação", err);
      setArtError(packLabels?.artFailed ?? "");
    } finally {
      setArtBusy(null);
    }
  };
  const artCell = (key: string, name: string) => {
    const art = myArts[key];
    const src = !art
      ? null
      : art.kind === "kept"
        ? `/api/files/${art.docId}`
        : art.url;
    const busy = artBusy === key;
    return (
      <span className="inline-flex items-center gap-1" data-packing-art={key}>
        {src ? (
          <>
            <a href={src} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) ou arquivo privado do portal */}
              <img
                src={src}
                alt=""
                className="h-9 w-9 rounded border border-zinc-200 object-cover"
              />
            </a>
            <button
              type="button"
              onClick={() => setArt(key, null)}
              className="rounded px-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              aria-label={`${packLabels?.artRemove ?? ""} · ${name}`}
              title={packLabels?.artRemove}
              data-packing-art-remove
            >
              ×
            </button>
          </>
        ) : (
          <span
            className={cx(
              "relative inline-flex h-9 w-9 items-center justify-center rounded border border-dashed text-sm",
              busy
                ? "cursor-wait border-zinc-200 text-zinc-400"
                : "cursor-pointer border-brand-300 text-brand-700 hover:bg-brand-50",
            )}
            title={fill(packLabels?.artAdd ?? "", { combo: name })}
          >
            {busy ? (
              <span
                aria-hidden
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
              />
            ) : (
              <span aria-hidden>🖼</span>
            )}
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              aria-label={fill(packLabels?.artAdd ?? "", { combo: name })}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              onChange={(e) => {
                const f = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                void pickArt(key, f);
              }}
              data-packing-art-input={key}
            />
          </span>
        )}
      </span>
    );
  };

  const others = Math.max(0, items.length - 1);
  const th =
    "border-b border-zinc-200 bg-zinc-50/80 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap text-zinc-500";
  const td =
    "border-b border-zinc-100 px-2 py-1.5 align-middle text-[13px] text-zinc-800 tabular-nums";
  const inputSm =
    "h-8 w-20 rounded-md border border-zinc-300 bg-white px-2 text-right text-sm tabular-nums text-zinc-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";
  const iconButton =
    "inline-flex items-center gap-1 rounded-md border border-brand-300 bg-white px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50";
  const enterBlur = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter não grava a escolha: só confirma o campo.
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };
  const L = packLabels;

  /** Colunas da tabela de uma linha (a alterada e cada embalagem nova). */
  const itemCells = (opts: {
    units: number;
    carton: number | null;
    cbm: number | null;
    cartonCell?: React.ReactNode;
    name: string;
  }) => {
    if (!item) return null;
    const sku = packSku(
      { price: item.price ?? null, moq: item.moq ?? null, cbm: opts.cbm },
      opts.carton,
      opts.units,
    );
    const usd =
      item.priceUsd === null || item.priceUsd === undefined
        ? null
        : item.priceUsd * opts.units;
    return (
      <>
        <td className={td}>
          {item.photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão
            <img
              src={`/api/files/${item.photo}`}
              alt=""
              loading="lazy"
              className="h-10 w-10 rounded border border-zinc-200 object-cover"
            />
          ) : (
            <span className="text-zinc-400">—</span>
          )}
        </td>
        <td className={cx(td, "min-w-44 whitespace-normal font-medium")}>
          {opts.name}
        </td>
        <td className={cx(td, "whitespace-normal")}>{item.supplier || "—"}</td>
        {seesPrice ? (
          <>
            <td className={cx(td, "whitespace-nowrap")} data-packing-price>
              {num(sku.price)} {item.currency ?? ""}
              {item.incoterm ? (
                <span className="block text-xs text-zinc-500">
                  {item.incoterm}
                </span>
              ) : null}
            </td>
            <td className={cx(td, "whitespace-nowrap")} data-packing-price-usd>
              {usd === null ? "—" : `US$ ${num(usd, 3)}`}
            </td>
          </>
        ) : null}
        <td className={td} data-packing-moq>
          {num(sku.moq, 0)}
        </td>
        <td className={td} data-packing-box>
          {opts.cartonCell ?? num(sku.cartonQty, 0)}
        </td>
        <td className={td} data-packing-cbm>
          {num(sku.cbm)}
        </td>
        {(item.dims ?? ["—", "—", "—"]).map((d, i) => (
          <td key={i} className={cx(td, "whitespace-nowrap")}>
            {d}
          </td>
        ))}
        <td className={td}>{item.capacity ?? "—"}</td>
        <td className={cx(td, "whitespace-normal")}>{item.material ?? "—"}</td>
      </>
    );
  };
  const headCells = (
    <>
      <th className={th}>{L?.col.photo}</th>
      <th className={th}>{L?.col.item}</th>
      <th className={th}>{L?.col.supplier}</th>
      {seesPrice ? (
        <>
          <th className={th}>{L?.col.price}</th>
          <th className={th}>{L?.col.priceUsd}</th>
        </>
      ) : null}
      <th className={th}>{L?.col.moq}</th>
      <th className={th}>{L?.col.box}</th>
      <th className={th}>{L?.col.cbm}</th>
      <th className={th}>{L?.col.length}</th>
      <th className={th}>{L?.col.width}</th>
      <th className={th}>{L?.col.height}</th>
      <th className={th}>{L?.col.capacity}</th>
      <th className={th}>{L?.col.material}</th>
    </>
  );
  const addPackButton =
    st && st.packs.length < MAX_PACKS ? (
      <button
        type="button"
        className={iconButton}
        title={L?.addHint}
        onClick={() =>
          update((s) => ({
            ...s,
            packs: [...s.packs, { id: newId(), text: "" }],
          }))
        }
        data-packing-add
      >
        <span aria-hidden className="text-base leading-none">
          +
        </span>
        {L?.add}
      </button>
    ) : null;

  const packingSection =
    item && st && L ? (
      <section className="space-y-2" data-packing-section={item.id}>
        {!st.alterOn ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={iconButton}
              title={L.alterHint}
              onClick={() =>
                update((s) => ({
                  ...s,
                  alterOn: true,
                  alterText: s.alterText || (x0 ? String(x0) : ""),
                }))
              }
              data-packing-alter
            >
              <span aria-hidden>✎</span>
              {L.alter}
            </button>
            {packRows.length ? null : addPackButton}
          </div>
        ) : (
          <div className="space-y-2" data-packing-altered>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                {L.alteredTitle}
              </span>
              <button
                type="button"
                onClick={() =>
                  update((s) => ({
                    ...s,
                    alterOn: false,
                    alterText: x0 ? String(x0) : "",
                  }))
                }
                className="text-xs font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900"
                data-packing-undo
              >
                {L.undo}
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-zinc-200">
              <table className="w-full min-w-0 text-left">
                <thead>
                  <tr>{headCells}</tr>
                </thead>
                <tbody>
                  <tr>
                    {itemCells({
                      units: 1,
                      carton: x1,
                      cbm: cbm1,
                      name: item.name,
                      cartonCell: (
                        <span className="flex flex-col gap-0.5">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={st.alterText}
                            onChange={(e) =>
                              update((s) => ({
                                ...s,
                                alterText: e.target.value,
                              }))
                            }
                            onKeyDown={enterBlur}
                            aria-label={L.col.box}
                            aria-invalid={alterError || undefined}
                            className={inputSm}
                            data-packing-carton
                          />
                          {x0 ? (
                            <span className="text-[11px] text-zinc-500">
                              {fill(L.bookCarton, {
                                n: x0.toLocaleString(intl),
                              })}
                            </span>
                          ) : null}
                        </span>
                      ),
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
            {alterError ? (
              <p
                className="text-xs font-medium text-red-700"
                role="alert"
                data-packing-error="carton"
              >
                {L.errorCarton}
              </p>
            ) : null}
            {/* Com embalagens novas, o "+" fica junto da tabela delas. */}
            {packRows.length ? null : <div>{addPackButton}</div>}
          </div>
        )}
        {packRows.length ? (
          <div className="ml-4 space-y-2 sm:ml-8" data-packing-packs>
            <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-600">
              {L.packsTitle}
            </span>
            <div className="overflow-x-auto rounded-lg border border-zinc-200">
              <table className="w-full min-w-0 text-left">
                <thead>
                  <tr>
                    <th className={th}>{L.colUnits}</th>
                    {headCells}
                    <th className={th}>
                      <span className="sr-only">{L.remove}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {packRows.map((row) => (
                    <tr key={row.id} data-packing-pack={row.text}>
                      <td className={td}>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={row.text}
                          onChange={(e) =>
                            update((s) => ({
                              ...s,
                              packs: s.packs.map((p) =>
                                p.id === row.id
                                  ? { ...p, text: e.target.value }
                                  : p,
                              ),
                            }))
                          }
                          onKeyDown={enterBlur}
                          aria-label={L.colUnits}
                          aria-invalid={!!row.error || undefined}
                          className={inputSm}
                          data-packing-units
                        />
                        {row.error ? (
                          <span
                            className="mt-0.5 block max-w-44 text-[11px] font-medium whitespace-normal text-red-700"
                            role="alert"
                            data-packing-error={row.error}
                          >
                            {row.error === "units"
                              ? L.errorUnits
                              : row.error === "repeat"
                                ? L.errorRepeat
                                : fill(L.errorDivide, {
                                    n: row.text.trim(),
                                    carton: x1 ?? "—",
                                  })}
                          </span>
                        ) : null}
                      </td>
                      {itemCells({
                        units: row.error || !row.units ? 1 : row.units,
                        carton: x1,
                        cbm: cbm1,
                        name:
                          row.error || !row.units
                            ? item.name
                            : `${item.name} · ${fill(L.packName, { n: row.units })}`,
                      })}
                      <td className={td}>
                        <button
                          type="button"
                          onClick={() =>
                            update((s) => ({
                              ...s,
                              packs: s.packs.filter((p) => p.id !== row.id),
                            }))
                          }
                          className="rounded px-1.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                          aria-label={L.remove}
                          title={L.remove}
                          data-packing-remove
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {addPackButton}
              {/* A tabela pai (não a avó) conta ou não como opção. */}
              <Switch
                on={st.parentOption}
                onChange={(on) => update((s) => ({ ...s, parentOption: on }))}
                label={
                  st.alterOn
                    ? fill(L.parentAltered, { n: x1 ?? "—" })
                    : L.parentItem
                }
                data="parent"
              />
            </div>
          </div>
        ) : null}
      </section>
    ) : null;

  /* ---- O que vai no formulário ---- */
  const payload = item
    ? JSON.stringify({
        carton: st?.alterOn && !alterError ? x1 : null,
        packs: validPacks,
        parentOption: st?.parentOption ?? true,
        mix,
        variations,
      })
    : "";

  const per = x1 && x1 >= 1 ? x1 : null;
  const editable = combos.length > 1 && !!per;
  const cell = (c: PackCombo) => {
    const name = names[c.key];
    const n = piecesOf(c.key);
    return (
      <div
        className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1"
        data-packing-cell={c.key}
      >
        {editable && n !== null ? (
          <input
            type="text"
            inputMode="numeric"
            value={drafts[c.key] ?? String(Math.round(n / per!))}
            onChange={(e) => typeCartons(c.key, e.target.value)}
            onBlur={() =>
              setDrafts((d) => {
                const rest = { ...d };
                delete rest[c.key];
                return rest;
              })
            }
            onKeyDown={enterBlur}
            aria-label={
              single
                ? fill(labels.cartonsOf, { color: name })
                : fill(L?.cellCartonsOf ?? "{combo}", { combo: name })
            }
            className={inputSm}
            data-selection-color-cartons
          />
        ) : null}
        {n !== null ? (
          <span
            className="shrink-0 text-xs font-semibold tabular-nums text-zinc-700"
            data-selection-color-pieces
          >
            {c.units === 1
              ? fill(labels.pieces, { n: n.toLocaleString(intl) })
              : fill(L?.cellUnits ?? "{n}", {
                  n: Math.round(n / c.units).toLocaleString(intl),
                })}
          </span>
        ) : null}
        {!mix ? artCell(artKey(false, c.variation, c.units), name) : null}
      </div>
    );
  };

  // Linhas das variações: cores do Book (com a caixa de incluir), as
  // digitadas (com o campo e o "×") e, sem nenhuma, o item como está.
  const variationRows: Array<{
    key: string;
    label: string;
    on: boolean;
    variation: string | null;
    book?: string;
    custom?: (typeof customRows)[number];
  }> = [
    ...bookColors.map((color) => ({
      key: `b:${color}`,
      label: color,
      on: pickedBook.includes(color),
      variation: color,
      book: color,
    })),
    ...customRows.map((row) => ({
      key: `c:${row.id}`,
      label: row.label,
      on: !!row.label && !row.repeat,
      variation: row.label || null,
      custom: row,
    })),
  ];
  const plainRow = !bookColors.length && !customRows.length;
  const toggleColor = (color: string, on: boolean) =>
    update((s) => {
      const now = new Set(s.picked ?? bookColors);
      if (on) now.add(color);
      else now.delete(color);
      return { ...s, picked: bookColors.filter((c) => now.has(c)) };
    });
  const comboOf = (variation: string | null, units: number) =>
    combos.find((c) => c.variation === variation && c.units === units) ?? null;

  const variationsCard =
    item && st ? (
      <section
        className="rounded-xl border border-zinc-200 bg-white"
        data-selection-variations={item.id}
      >
        <input type="hidden" name={`packing.${item.id}`} value={payload} />
        {/* As artes que valem: arquivo no formulário, já subida ou gravada. */}
        {wantedArts.map((key) => {
          const art = myArts[key];
          if (!art) return null;
          if (art.kind === "kept")
            return (
              <input
                key={key}
                type="hidden"
                name={`artKeep.${key}`}
                value={art.docId}
              />
            );
          if (art.kind === "uploaded")
            return (
              <input
                key={key}
                type="hidden"
                name={`artUploaded.${key}`}
                value={art.id}
              />
            );
          return <ArtFileField key={key} name={`art.${key}`} file={art.file} />;
        })}
        <div className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            data-selection-variations-toggle
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-zinc-900">
                {labels.title}
              </span>
              <span
                className="block text-xs text-zinc-500"
                data-selection-variations-count
              >
                {bookColors.length && single && !customRows.length
                  ? fill(labels.count, {
                      n: pickedBook.length,
                      total: bookColors.length,
                    })
                  : fill(L?.count ?? "{n}", { n: combos.length })}
              </span>
            </span>
            <span aria-hidden className="text-zinc-400">
              {open ? "▴" : "▾"}
            </span>
          </button>
          {L ? (
            <Switch
              on={mix}
              onChange={(on) => update((s) => ({ ...s, mix: on }))}
              label={L.mix}
              hint={L.mixHint}
              data="mix"
            />
          ) : null}
        </div>
        {/* Fechado, os campos continuam no formulário (só escondidos). */}
        <div
          className={cx("space-y-2 px-4 pb-4", !open && "hidden")}
          data-selection-variations-body
        >
          <p className="text-xs text-zinc-500">
            {L?.variationsHint ?? labels.hint}
          </p>
          <div className="overflow-x-auto rounded-lg border border-zinc-200">
            <table className="w-full min-w-0 text-left">
              <thead>
                <tr>
                  <th className={th}>{labels.title}</th>
                  {options.map((o) => (
                    <th
                      key={o.units}
                      className={cx(th, "text-right")}
                      data-packing-option={o.units}
                    >
                      {packName(o.units)}
                      {per ? (
                        <span className="block font-normal normal-case tracking-normal text-zinc-400">
                          {fill(L?.perCarton ?? "{n}", {
                            n: (per / o.units).toLocaleString(intl),
                          })}
                        </span>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plainRow ? (
                  <tr data-selection-color="">
                    <td className={cx(td, "font-medium")}>
                      {L?.unitOnly || item.name}
                    </td>
                    {options.map((o) => {
                      const c = comboOf(null, o.units);
                      return (
                        <td key={o.units} className={cx(td, "text-right")}>
                          {c ? cell(c) : null}
                        </td>
                      );
                    })}
                  </tr>
                ) : (
                  variationRows.map((row) => (
                    <tr
                      key={row.key}
                      className={cx(!row.on && "bg-zinc-50 text-zinc-400")}
                      data-selection-color={row.label}
                      data-selection-color-on={row.on ? "1" : "0"}
                    >
                      <td className={cx(td, "min-w-48")}>
                        {row.book !== undefined ? (
                          <label className="flex cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={row.on}
                              onChange={(e) =>
                                toggleColor(row.book!, e.target.checked)
                              }
                              aria-label={fill(labels.include, {
                                color: row.label,
                              })}
                              className="h-4 w-4 shrink-0 accent-brand-600"
                            />
                            <span className="min-w-0">
                              <span
                                className={cx(
                                  "block font-medium",
                                  row.on ? "text-zinc-900" : "line-through",
                                )}
                              >
                                {fill(labels.line, {
                                  product: item.name,
                                  color: row.label,
                                })}
                              </span>
                              {!row.on ? (
                                <span className="block text-xs">
                                  {labels.excluded}
                                </span>
                              ) : null}
                            </span>
                          </label>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={row.custom!.text}
                              maxLength={60}
                              placeholder={L?.variationPlaceholder}
                              onChange={(e) =>
                                update((s) => ({
                                  ...s,
                                  customs: s.customs.map((c) =>
                                    c.id === row.custom!.id
                                      ? { ...c, text: e.target.value }
                                      : c,
                                  ),
                                }))
                              }
                              onKeyDown={enterBlur}
                              aria-label={L?.variationPlaceholder}
                              aria-invalid={row.custom!.repeat || undefined}
                              className="h-8 min-w-40 flex-1 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                              data-packing-variation-input
                            />
                            <button
                              type="button"
                              onClick={() =>
                                update((s) => ({
                                  ...s,
                                  customs: s.customs.filter(
                                    (c) => c.id !== row.custom!.id,
                                  ),
                                }))
                              }
                              className="rounded px-1.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                              aria-label={L?.variationRemove}
                              title={L?.variationRemove}
                              data-packing-variation-remove
                            >
                              ×
                            </button>
                            {row.custom!.repeat ? (
                              <span
                                className="text-[11px] font-medium text-red-700"
                                role="alert"
                                data-packing-error="variation"
                              >
                                {L?.variationRepeat}
                              </span>
                            ) : null}
                          </span>
                        )}
                      </td>
                      {options.map((o) => {
                        const c =
                          row.on && row.variation
                            ? comboOf(row.variation, o.units)
                            : null;
                        return (
                          <td key={o.units} className={cx(td, "text-right")}>
                            {c ? cell(c) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
                {mix && combos.length ? (
                  <tr data-packing-art-row>
                    <td
                      className={cx(td, "text-xs font-semibold text-zinc-600")}
                    >
                      {L?.artRow}
                    </td>
                    {options.map((o) => (
                      <td key={o.units} className={cx(td, "text-right")}>
                        {artCell(
                          artKey(true, null, o.units),
                          packName(o.units),
                        )}
                      </td>
                    ))}
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {noneError ? (
            <p
              className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800"
              data-packing-error="none"
            >
              {labels.none}
            </p>
          ) : null}
          {artError ? (
            <p className="text-xs font-medium text-red-700" role="alert">
              {artError}
            </p>
          ) : null}
          {L && st.customs.length + bookColors.length < MAX_VARIATIONS ? (
            <button
              type="button"
              className={iconButton}
              onClick={() =>
                update((s) => ({
                  ...s,
                  customs: [...s.customs, { id: newId(), text: "" }],
                }))
              }
              data-packing-variation-add
            >
              <span aria-hidden className="text-base leading-none">
                +
              </span>
              {L.variationAdd}
            </button>
          ) : null}
        </div>
      </section>
    ) : null;

  return (
    <div ref={ref} className="space-y-3" data-selection-variations-block>
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-2 text-sm"
        data-selection-winner-bar
      >
        <span className="min-w-0 text-zinc-800">
          <span className="font-semibold">✓ {labels.chosen}:</span>{" "}
          <span data-selection-winner-name>{item?.name ?? ""}</span>
          {others ? (
            <span className="ml-2 text-xs text-zinc-500">
              {fill(labels.collapsed, { n: others })}
            </span>
          ) : null}
        </span>
        {others ? (
          <label
            className="cursor-pointer text-xs font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900 has-[:checked]:text-brand-700"
            title={labels.reviewHint}
          >
            <input type="checkbox" className="sr-only" data-selection-review />
            {labels.review}
          </label>
        ) : null}
      </div>
      {packingSection}
      {variationsCard}
    </div>
  );
}

/** Interruptor (toggle) com o texto ao lado. */
function Switch({
  on,
  onChange,
  label,
  hint,
  data,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  label: string;
  hint?: string;
  data: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      title={hint}
      className="inline-flex items-center gap-2 rounded-md px-1 py-0.5 text-left text-xs font-medium text-zinc-700 hover:text-zinc-900"
      data-packing-switch={data}
      data-on={on ? "1" : "0"}
    >
      <span
        aria-hidden
        className={cx(
          "relative inline-flex h-5 w-9 shrink-0 rounded-full transition",
          on ? "bg-brand-600" : "bg-zinc-300",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
            on ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
      <span>{label}</span>
    </button>
  );
}

/** Campo escondido com a arte já reduzida (o arquivo vai no formulário). */
function ArtFileField({ name, file }: { name: string; file: File }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    el.files = dt.files;
  }, [file]);
  return <input ref={ref} type="file" name={name} hidden tabIndex={-1} />;
}
