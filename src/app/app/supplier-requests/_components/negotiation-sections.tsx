import { packLabels } from "@/components/request-variant";
import type { ReactNode } from "react";
import Link from "next/link";
import type { SupplierRequest, SupplierRequestEvent } from "@/lib/db/schema";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { cx, linkClass } from "@/components/ui";
import type { RequestItemSpecs } from "@/lib/supplier-request-specs";
import { pendingProposal } from "@/lib/supplier-requests";
import type {
  NegotiationPeople,
  NegotiationPerson,
} from "@/lib/services/supplier-request-people";
import { answerText } from "./status";
import { dateTime } from "./negotiation";

/*
 * Pedaços da tela da negociação reorganizada (docs/SUPPLIER_REQUESTS.md,
 * "Tela da negociação reorganizada"): a seção numerada do card "O que está
 * sendo negociado", a ficha do produto em grade (cada informação com a
 * unidade e a referência), a faixa da resposta do fornecedor com as rodadas,
 * a linha única de preço, moeda, mínimo, produção e Incoterm dos formulários
 * e o "De / Para" de quem envia e de quem recebe. Só exibição: as regras
 * continuam nos serviços de sempre.
 */

/** Número com a casa decimal do idioma; vazio é "—" e zero continua 0. */
export function numberText(
  t: Translate,
  n: number | null | undefined,
  digits = 4,
): string {
  return n === null || n === undefined || !Number.isFinite(n)
    ? "—"
    : n.toLocaleString(t.intl, { maximumFractionDigits: digits });
}

const text = (v: string | null | undefined) => (v && v.trim() ? v : "—");

/** Uma seção numerada do card central. */
export function NegotiationSection({
  n,
  title,
  mark,
  id,
  aside,
  children,
}: {
  n: number;
  title: string;
  /** Marcador `data-negotiation-section` (testes e links). */
  mark: string;
  id?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="min-w-0 scroll-mt-20 border-t border-zinc-200/70 pt-3 first:border-t-0 first:pt-0"
      aria-labelledby={`negotiation-${mark}`}
      data-negotiation-section={mark}
    >
      <header className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3
          id={`negotiation-${mark}`}
          className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
        >
          <span className="mr-1 tabular-nums text-zinc-400">{n}.</span>
          {title}
        </h3>
        {aside}
      </header>
      {children}
    </section>
  );
}

/** Rótulo pequeno em cima, valor embaixo: uma informação por célula. */
export function InfoCell({
  label,
  mark,
  hint,
  wide,
  children,
}: {
  label: ReactNode;
  mark?: string;
  hint?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cx("min-w-0", wide && "col-span-2")}
      data-sheet-field={mark}
    >
      <dt className="text-[11px] font-medium leading-4 text-zinc-500">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-[13px] font-medium leading-5 tabular-nums text-zinc-900">
        {children}
      </dd>
      {hint ? (
        <p className="mt-0.5 text-[11px] leading-4 text-zinc-500">{hint}</p>
      ) : null}
    </div>
  );
}

/** Grade de células que cresce com a largura do quadro (não da tela). */
export function InfoGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="@container">
      <dl
        className={cx(
          "grid grid-cols-2 gap-x-4 gap-y-2 @md:grid-cols-3 @2xl:grid-cols-5",
          className,
        )}
      >
        {children}
      </dl>
    </div>
  );
}

/**
 * Ficha do produto: a cópia gravada na solicitação, completada pelo item
 * exato do Book (`requestItemSpecs`, a mesma regra da tabela). Medidas e
 * pesos são da peça (dono, 15/11/2026); o CBM é o da caixa master, e o total
 * do pedido vem das caixas inteiras.
 */
export function ItemSheetGrid({
  specs,
  item,
  ncm,
  bookHref,
  units = 1,
  t,
}: {
  specs: RequestItemSpecs;
  /** Peças por embalagem da cotação de um SKU: a caixa e os pesos contam embalagens. */
  units?: number;
  item: SupplierRequest["item"];
  /** NCM do item do Book (só a Wellmix). */
  ncm: string | null;
  /** Book do item (só a Wellmix). */
  bookHref: string | null;
  t: Translate;
}) {
  const pack = packLabels(units, t);
  const k = (key: string) =>
    (key === "master" || key === "net" || key === "gross" ? pack[key] : null) ??
    t(`negotiationScreen.sheet.${key}` as DictionaryKey);
  const n = (v: number | null | undefined, digits = 4) =>
    numberText(t, v, digits);
  const fromBook = (field: (typeof specs.fromBook)[number]) =>
    specs.fromBook.includes(field) ? (
      <span
        className="ml-1 rounded bg-zinc-100 px-1 align-middle text-[10px] font-semibold text-zinc-500"
        title={k("fromBook")}
        data-sheet-from-book
      >
        Book
      </span>
    ) : null;
  const name =
    specs.productName && specs.productName !== specs.description
      ? specs.productName
      : null;
  return (
    <div className="space-y-2" data-negotiation-sheet>
      <InfoGrid>
        <InfoCell label={k("master")} mark="master">
          {n(specs.masterCartonQty, 0)}
          {fromBook("masterCartonQty")}
        </InfoCell>
        <InfoCell label={k("inner")} mark="inner">
          {n(specs.innerQty, 0)}
          {fromBook("innerQty")}
        </InfoCell>
        <InfoCell label={k("cbmBox")} mark="cbmBox">
          {n(specs.cbmPerCarton)}
          {fromBook("cbmPerCarton")}
        </InfoCell>
        <InfoCell label={k("cartons")} mark="cartons">
          {n(specs.totalCartons, 0)}
        </InfoCell>
        <InfoCell
          label={k("cbmTotal")}
          mark="cbmTotal"
          hint={specs.cbmFromMeasures ? k("cbmApprox") : null}
        >
          {specs.totalCbm === null
            ? "—"
            : `${specs.cbmFromMeasures ? "≈ " : ""}${n(specs.totalCbm)}`}
        </InfoCell>
        <InfoCell label={k("length")} mark="length">
          {n(specs.lengthCm, 2)}
          {fromBook("lengthCm")}
        </InfoCell>
        <InfoCell label={k("width")} mark="width">
          {n(specs.widthCm, 2)}
          {fromBook("widthCm")}
        </InfoCell>
        <InfoCell label={k("height")} mark="height">
          {n(specs.heightCm, 2)}
          {fromBook("heightCm")}
        </InfoCell>
        <InfoCell label={k("capacity")} mark="capacity">
          {n(specs.capacityMl, 0)}
          {fromBook("capacityMl")}
        </InfoCell>
        <InfoCell label={k("size")} mark="size">
          {text(specs.sizeText)}
          {fromBook("sizeText")}
        </InfoCell>
        <InfoCell label={k("material")} mark="material">
          {text(specs.material)}
          {fromBook("material")}
        </InfoCell>
        <InfoCell label={k("package")} mark="package">
          {text(specs.packageType)}
          {fromBook("packageType")}
        </InfoCell>
        <InfoCell label={k("colors")} mark="colors">
          {text(specs.colorAssortment)}
          {fromBook("colorAssortment")}
        </InfoCell>
        <InfoCell label={k("net")} mark="net">
          {n(specs.netWeightPcKg)}
          {fromBook("netWeightPcKg")}
        </InfoCell>
        <InfoCell label={k("gross")} mark="gross">
          {n(specs.grossWeightPcKg)}
          {fromBook("grossWeightPcKg")}
        </InfoCell>
        <InfoCell label={k("power")} mark="power">
          {text(specs.powerDetail)}
          {fromBook("powerDetail")}
        </InfoCell>
        <InfoCell label={k("code")} mark="code">
          {text(item.factoryItemCode)}
        </InfoCell>
        <InfoCell label={k("itemNumber")} mark="itemNumber">
          {text(item.itemNumber)}
        </InfoCell>
        {name ? (
          <InfoCell label={k("name")} mark="name">
            {name}
          </InfoCell>
        ) : null}
        {bookHref ? (
          <InfoCell label={k("ncm")} mark="ncm">
            {text(ncm)}
          </InfoCell>
        ) : null}
      </InfoGrid>
      {bookHref ? (
        <Link
          href={bookHref}
          className={cx(linkClass, "inline-block text-xs font-medium")}
          data-negotiation-sheet-book
        >
          {k("full")}
        </Link>
      ) : null}
    </div>
  );
}

/** "Nome (login)", com "Você" para quem está vendo. */
export function PersonLabel({
  person,
  meId,
  t,
}: {
  person: NegotiationPerson | null | undefined;
  meId: string;
  t: Translate;
}) {
  if (!person) return <>—</>;
  return (
    <span className="break-words" data-negotiation-person={person.userId}>
      <span className="font-medium text-zinc-900">{person.name}</span>
      {person.userId === meId ? (
        <span className="text-zinc-500"> · {t("negotiationScreen.you")}</span>
      ) : null}
      {person.login ? (
        <span className="text-zinc-500" data-negotiation-login>
          {" "}
          ({person.login})
        </span>
      ) : null}
      {!person.active ? (
        <span className="ml-1 rounded bg-zinc-200 px-1 text-[10px] font-semibold uppercase text-zinc-600">
          {t("negotiationScreen.inactive")}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Quem recebe o aviso do que um lado manda (a regra de `notifyOther`): a
 * Wellmix avisa os logins ativos do fornecedor; o fornecedor, o responsável.
 */
export function recipientText(
  from: "wellmix" | "supplier",
  people: NegotiationPeople,
  supplierName: string,
  t: Translate,
): string {
  if (from === "supplier") {
    const o = people.owner;
    if (!o) return t("negotiationScreen.ownerUnknown");
    return o.login ? `${o.name} (${o.login})` : o.name;
  }
  const logins = people.supplierLogins
    .map((p) => p.login ?? p.name)
    .filter(Boolean);
  return logins.length
    ? t("negotiationScreen.supplierLogins", {
        company: supplierName,
        logins: logins.join(", "),
      })
    : t("negotiationScreen.supplierNoLogin", { company: supplierName });
}

/** "De: eu · Para: o outro lado", acima do botão de enviar. */
export function FromTo({
  people,
  supplierName,
  t,
}: {
  people: NegotiationPeople;
  supplierName: string;
  t: Translate;
}) {
  const me = people.me;
  return (
    <p
      className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-zinc-600"
      data-negotiation-from-to
    >
      <span>
        <span className="font-semibold text-zinc-500">
          {t("negotiationScreen.from")}:
        </span>{" "}
        <PersonLabel person={me} meId={me.userId} t={t} />
      </span>
      <span data-negotiation-to>
        <span className="font-semibold text-zinc-500">
          {t("negotiationScreen.to")}:
        </span>{" "}
        {recipientText(me.side, people, supplierName, t)}
      </span>
    </p>
  );
}

const OFFER_STEPS = new Set([
  "answer",
  "proposal",
  "accept",
  "counter",
  "reject",
]);

/** Os valores de um passo de oferta (o aceite leva os da contraproposta aceita). */
function stepValues(events: SupplierRequestEvent[], index: number) {
  const e = events[index];
  if (e.kind !== "accept") return e;
  for (let i = index - 1; i >= 0; i--)
    if (events[i].kind === "proposal") return events[i];
  return null;
}

/**
 * Resposta do fornecedor (seção 3): a oferta recebida numa faixa compacta,
 * a contraproposta da Wellmix que espera o fornecedor (outra cor, para não
 * confundir com a oferta recebida) e as rodadas anteriores, recolhidas.
 */
export function SupplierResponseStrip({
  request: r,
  people,
  supplierName,
  seesPrice,
  t,
}: {
  request: SupplierRequest;
  people: NegotiationPeople;
  supplierName: string;
  seesPrice: boolean;
  t: Translate;
}) {
  const k = (key: string, vars?: Record<string, string | number>) =>
    t(`negotiationScreen.${key}` as DictionaryKey, vars);
  const n = (v: number | null | undefined, digits = 4) =>
    numberText(t, v, digits);
  const meId = people.me.userId;
  const events = (r.negotiation ?? []).filter((e) => e.kind !== "keep");
  const lastOffer = [...events]
    .reverse()
    .find(
      (e) =>
        e.side === "supplier" &&
        (e.kind === "answer" || e.kind === "counter" || e.kind === "accept"),
    );
  const accepted =
    lastOffer?.kind === "accept"
      ? stepValues(events, events.indexOf(lastOffer))
      : null;
  const responder =
    (r.respondedByUserId ? people.byId[r.respondedByUserId] : null) ??
    (lastOffer ? people.byId[lastOffer.byUserId] : null) ??
    null;
  const supplierFiles = events.filter(
    (e) => e.side === "supplier" && e.kind === "message" && e.documentId,
  );
  const other = [
    accepted ? k("answer.accepted", { date: dateTime(accepted.at, t) }) : null,
    lastOffer?.onBehalf ? k("answer.onBehalf") : null,
  ].filter((v): v is string => !!v);
  const proposal = pendingProposal(r.negotiation);
  const rounds = events
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => OFFER_STEPS.has(e.kind));

  return (
    <div className="space-y-2">
      {r.supplierCanDo ? (
        <div
          className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-2.5"
          data-supplier-answer
        >
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="rounded-full bg-amber-100 px-2 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-900">
              {k("answer.received")}
            </span>
            <p className="text-sm font-semibold text-zinc-900">
              {answerText(t, r, seesPrice)}
            </p>
          </div>
          <InfoGrid>
            {seesPrice ? (
              <>
                <InfoCell label={k("f.price")} mark="answerPrice">
                  {n(r.supplierPrice)}
                </InfoCell>
                <InfoCell label={k("f.currency")} mark="answerCurrency">
                  {text(r.supplierCurrency)}
                </InfoCell>
              </>
            ) : null}
            <InfoCell label={k("f.moq")} mark="answerMoq">
              {n(r.supplierMoq, 0)}
            </InfoCell>
            <InfoCell label={k("f.leadTime")} mark="answerLeadTime">
              {n(r.supplierLeadTimeDays, 0)}
            </InfoCell>
            <InfoCell label={k("f.incoterm")} mark="answerIncoterm">
              <span data-supplier-answer-incoterm-value>
                {text(r.supplierIncoterm)}
              </span>
            </InfoCell>
            <InfoCell label={k("answer.supplier")} mark="answerSupplier">
              {supplierName}
            </InfoCell>
            <InfoCell label={k("answer.by")} mark="answerBy" wide>
              <PersonLabel person={responder} meId={meId} t={t} />
            </InfoCell>
            <InfoCell label={k("answer.at")} mark="answerAt">
              {dateTime(r.respondedAt, t)}
            </InfoCell>
            <InfoCell label={k("answer.files")} mark="answerFiles">
              {supplierFiles.length ? (
                <span className="flex flex-col gap-0.5">
                  {supplierFiles.map((f) => (
                    <a
                      key={f.id}
                      href={`/api/files/${f.documentId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-sky-700 underline"
                      data-negotiation-file
                    >
                      {f.fileName ?? t("supplierRequests.negotiation.file")}
                    </a>
                  ))}
                </span>
              ) : (
                "—"
              )}
            </InfoCell>
            <InfoCell label={k("answer.other")} mark="answerOther">
              {other.length ? other.join(" · ") : "—"}
            </InfoCell>
            <InfoCell label={k("answer.comment")} mark="answerComment" wide>
              <span className="whitespace-pre-wrap font-normal">
                {text(r.supplierNote)}
              </span>
            </InfoCell>
          </InfoGrid>
        </div>
      ) : (
        <p className="text-sm text-zinc-500" data-supplier-answer-none>
          {t("supplierRequests.detail.answer.none")}
        </p>
      )}

      {proposal ? (
        <div
          className="rounded-lg border border-sky-200 bg-sky-50/60 p-2.5"
          data-negotiation-proposal-waiting
        >
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="rounded-full bg-sky-100 px-2 py-px text-[10px] font-semibold uppercase tracking-wide text-sky-800">
              {k("answer.proposal")}
            </span>
            <p className="text-xs text-sky-900">
              {k("answer.proposalWaiting", {
                date: dateTime(proposal.at, t),
                name: people.byId[proposal.byUserId]?.name ?? "Wellmix",
              })}
            </p>
          </div>
          <InfoGrid>
            {seesPrice ? (
              <>
                <InfoCell label={k("f.price")}>{n(proposal.price)}</InfoCell>
                <InfoCell label={k("f.currency")}>
                  {text(proposal.currency)}
                </InfoCell>
              </>
            ) : null}
            <InfoCell label={k("f.moq")}>{n(proposal.moq, 0)}</InfoCell>
            <InfoCell label={k("f.leadTime")}>
              {n(proposal.leadTimeDays, 0)}
            </InfoCell>
            <InfoCell label={k("f.incoterm")}>
              {text(proposal.incoterm)}
            </InfoCell>
            <InfoCell label={k("answer.comment")} wide>
              <span className="whitespace-pre-wrap font-normal">
                {text(proposal.text)}
              </span>
            </InfoCell>
          </InfoGrid>
        </div>
      ) : null}

      {rounds.length > 1 ? (
        <details className="group/rounds text-xs" data-negotiation-rounds>
          <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 rounded font-medium text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-brand-600 [&::-webkit-details-marker]:hidden">
            {k("rounds.title", { n: rounds.length })}
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              className="h-3.5 w-3.5 transition-transform group-open/rounds:rotate-180"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="m5 8 5 5 5-5" />
            </svg>
          </summary>
          <div className="mt-1 overflow-x-auto rounded-md border border-zinc-200">
            <table className="w-full min-w-[36rem] text-left text-xs">
              <thead className="bg-zinc-50 text-[11px] text-zinc-500">
                <tr>
                  <th className="px-2 py-1 font-medium">{k("rounds.n")}</th>
                  <th className="px-2 py-1 font-medium">{k("rounds.what")}</th>
                  <th className="px-2 py-1 font-medium">{k("rounds.who")}</th>
                  {seesPrice ? (
                    <>
                      <th className="px-2 py-1 text-right font-medium">
                        {k("f.price")}
                      </th>
                      <th className="px-2 py-1 font-medium">
                        {k("f.currency")}
                      </th>
                    </>
                  ) : null}
                  <th className="px-2 py-1 text-right font-medium">
                    {k("f.moq")}
                  </th>
                  <th className="px-2 py-1 text-right font-medium">
                    {k("f.leadTime")}
                  </th>
                  <th className="px-2 py-1 font-medium">{k("f.incoterm")}</th>
                  <th className="px-2 py-1 font-medium">{k("answer.at")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rounds.map(({ e, i }, at) => {
                  const v = e.kind === "reject" ? null : stepValues(events, i);
                  const kind =
                    e.kind === "answer" && e.canDo !== "yes"
                      ? "answerNo"
                      : e.kind;
                  const last = at === rounds.length - 1;
                  return (
                    <tr
                      key={e.id}
                      className={cx(last && "bg-brand-50/40")}
                      data-negotiation-round={e.kind}
                    >
                      <td className="px-2 py-1 tabular-nums">{at + 1}</td>
                      <td className="px-2 py-1">
                        {k(`rounds.kind.${kind}`)}
                        {last ? (
                          <span className="ml-1 rounded bg-brand-100 px-1 text-[10px] font-semibold text-brand-800">
                            {k("rounds.current")}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-1">
                        {t(`supplierRequests.negotiation.side.${e.side}`)}
                        {people.byId[e.byUserId] ? (
                          <span className="text-zinc-500">
                            {" "}
                            · {people.byId[e.byUserId].name}
                          </span>
                        ) : null}
                      </td>
                      {seesPrice ? (
                        <>
                          <td className="px-2 py-1 text-right tabular-nums">
                            {n(v?.price)}
                          </td>
                          <td className="px-2 py-1">{text(v?.currency)}</td>
                        </>
                      ) : null}
                      <td className="px-2 py-1 text-right tabular-nums">
                        {n(v?.moq, 0)}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {n(v?.leadTimeDays, 0)}
                      </td>
                      <td className="px-2 py-1">{text(v?.incoterm)}</td>
                      <td className="whitespace-nowrap px-2 py-1 tabular-nums text-zinc-600">
                        {dateTime(e.at, t)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </div>
  );
}
