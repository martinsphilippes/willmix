import type { SupplierRequest } from "@/lib/db/schema";
import { ColorLines } from "@/components/color-lines";
import { colorTotals } from "@/lib/color-split";
import { SHEET_CURRENCIES, SHEET_INCOTERMS } from "@/lib/db/schema";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  answerTimes,
  canPostMessage,
  currentOffer,
  finalConditions,
  initialConditions,
  type ConditionsState,
  type RequestConditions,
  negotiationTurn,
  pendingProposal,
  supplierCanAnswer,
} from "@/lib/supplier-requests";
import { slaOf } from "@/lib/services/supplier-request-negotiation";
import {
  Badge,
  Card,
  Field,
  Input,
  LinkButton,
  Select,
  Table,
  Td,
  Textarea,
  Th,
  cx,
  rowClass,
  type Tone,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { PhotoGallery } from "@/components/photo-gallery";
import { QuickDialog } from "@/components/quick-dialog";
import {
  answerSupplierRequestAction,
  postSupplierRequestMessageAction,
  respondOfferAction,
  respondProposalAction,
} from "../../actions/supplier-requests";
import { SAMPLING_TONE, STATUS_TONE } from "./status";
import {
  SAMPLING_SLA_DAYS,
  samplingLate,
  samplingOf,
} from "@/lib/supplier-request-sampling";
import Link from "next/link";
import { roundsDates } from "@/components/purchase-rounds";
import { dateTime } from "./negotiation";
import {
  ChatBubbleIcon,
  CheckIcon,
  OpenIcon,
  RefuseIcon,
  SwapIcon,
} from "./icons";
import { SlaDueToggle } from "./sla-due-toggle";
import {
  requestItemSpecs,
  type RequestBookSpecs,
} from "@/lib/supplier-request-specs";

/*
 * O que se vê primeiro ao abrir uma solicitação (docs/SUPPLIER_REQUESTS.md,
 * "Tabela da solicitação"): os produtos pedidos ao mesmo fornecedor no mesmo
 * booking, uma informação por coluna, e as ações rápidas por linha, só com
 * ícones: mensagem e abrir a tela do produto e, para o fornecedor que ainda
 * responde, aprovar, renegociar ou recusar a oferta. O fornecedor responde
 * (só ele; a Wellmix não responde por ele).
 */

/*
 * Situação / SLA | Ações: as duas últimas colunas, fixas à direita na rolagem
 * horizontal (pedido do dono, 13/11/2026). A situação e o SLA dividem uma
 * coluna compacta (o SLA embaixo da situação, com o prazo recolhido atrás do
 * "+"); até então eram duas colunas. Cada coluna fixa precisa saber a
 * largura das que ficam à direita dela; por isso o conteúdo vai numa caixa de
 * largura certa (as variáveis abaixo, postas na moldura da tabela) e a coluna
 * mede sempre a caixa mais o respiro da célula (`--pin-pad`, o `px-2.5` do
 * <Td> dos dois lados). As duas fixam a partir de 1024px de tela (iPad
 * deitado, computador), quando sobra tabela para rolar ao lado do menu; em
 * tela menor (iPad em pé, celular) só as ações ficam fixas, como antes.
 */
const PIN_VARS = "[--pin-pad:1.25rem] [--pin-status:8.5rem]";
/**
 * Caixa das ações (dono, 14/11/2026): só ícones, com 0,5rem entre eles. Dois
 * por linha (mensagem e abrir) ou, para o fornecedor que ainda responde,
 * três na segunda linha (aprovar, renegociar, recusar). Ícone de 1,75rem com
 * mouse e de 2rem no toque (celular, iPad). Antes os três eram botões com
 * texto empilhados e a caixa tinha 10,5rem.
 */
const PIN_ACTIONS = {
  icons: "[--pin-actions:4rem] pointer-coarse:[--pin-actions:4.5rem]",
  answers: "[--pin-actions:6.25rem] pointer-coarse:[--pin-actions:7rem]",
} as const;
/**
 * Botão só com ícone da coluna Ações: o desenho é um quadrado de 28px (o
 * mesmo da paginação das tabelas; 32px no toque) e a área de toque vai 4px
 * além dele para cada lado (o `after` invisível; 5px a partir de dentro da
 * borda de 1px): 36px com mouse, 40px no toque. Com 8px entre os botões, as
 * áreas de toque se encostam sem se sobrepor.
 */
const ICON_BUTTON =
  "relative h-7 w-7 shrink-0 gap-0 rounded-md p-0 text-xs shadow-none after:absolute after:-inset-[5px] pointer-coarse:h-8 pointer-coarse:w-8";
/** Cor de cada ação (a forma do ícone já distingue; a cor reforça). */
const ICON_TONE = {
  neutral:
    "border border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50",
  approve:
    "border border-emerald-300 bg-white text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50",
  renegotiate:
    "border border-amber-300 bg-white text-amber-600 hover:border-amber-400 hover:bg-amber-50",
  refuse:
    "border border-red-300 bg-white text-red-700 hover:border-red-400 hover:bg-red-50",
} as const;
/** Dica do botão só com ícone: o nome e, embaixo, o que ele faz. */
const tooltip = (name: string, hint: string) => `${name}\n${hint}`;
const PIN = {
  // A borda esquerda do conjunto: um fio e uma sombra separam do que rola.
  status:
    "lg:sticky lg:z-10 lg:right-[calc(var(--pin-actions)_+_var(--pin-pad))] lg:shadow-[inset_1px_0_0_var(--color-zinc-200),-6px_0_6px_-6px_rgba(0,0,0,0.15)]",
  // Em tela menor a borda é das ações (as únicas fixas), como sempre foi.
  actions:
    "sticky right-0 z-10 shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)] lg:shadow-none",
};
/** Fundo opaco das células fixas; acompanha o realce da linha (`group/row`). */
const PIN_BG =
  "bg-white transition-colors group-hover/row:bg-[color-mix(in_srgb,var(--color-brand-50)_40%,white)]";
const PIN_BG_CURRENT = "bg-brand-50 group-hover/row:bg-brand-50";

const STATE_TONE: Record<ConditionsState, Tone> = {
  answer: "info",
  pending: "warning",
  accepted: "success",
  rejected: "danger",
  counter: "info",
};

export function SupplierRequestTable({
  rows,
  currentId,
  slaMinutes,
  samplingSlaDays = SAMPLING_SLA_DAYS,
  wellmix,
  legacy,
  bookSpecs,
  t,
}: {
  rows: SupplierRequest[];
  currentId: string;
  slaMinutes: number;
  /** SLA da amostragem (dias). */
  samplingSlaDays?: number;
  wellmix: boolean;
  /** Respostas antigas (auditoria), para a 1ª e a última resposta. */
  legacy: Map<string, Array<{ at: string }>>;
  /** Ficha do item exato do Book (por solicitação): completa a cópia gravada. */
  bookSpecs?: Map<string, RequestBookSpecs>;
  t: Translate;
}) {
  const intl = t.intl;
  const num = (n: number | null | undefined, digits = 4) =>
    n === null || n === undefined
      ? "—"
      : n.toLocaleString(intl, { maximumFractionDigits: digits });
  const decimal = intl.startsWith("pt") ? "," : ".";
  const raw = (n: number | null) =>
    n === null ? "" : String(n).replace(".", decimal);
  const k = (key: string) =>
    t(`supplierRequests.table.${key}` as DictionaryKey);
  const before = [
    "photo",
    "number",
    "item",
    "factoryCode",
    "itemNumber",
    "material",
    "packageType",
    "measures",
    "capacity",
    "masterCartonQty",
    "innerQty",
    "cbmPerCarton",
    "rounds",
    "perRound",
    "quantity",
    "totalCartons",
    "totalCbm",
    "bookingMoq",
    "bookingPrice",
    "bookingCurrency",
    "bookingIncoterm",
    "needs",
    "canDo",
  ];
  // Condições iniciais (primeira resposta) e finais (as que valem hoje).
  const conditionCols = ["price", "currency", "moq", "incoterm", "leadTime"];
  // Depois das condições; "Situação / SLA" fecha a tabela, com as ações.
  const after = ["turn", "openedAt", "firstAnswerAt", "lastAnswerAt"];
  const nowrap = "whitespace-nowrap";
  // Só o fornecedor responde: enquanto pode, a linha tem as três respostas
  // (aprovar, renegociar, recusar) na segunda linha dos ícones.
  const canAnswerRow = (r: SupplierRequest) =>
    !wellmix && supplierCanAnswer(r.status);
  const actionSlots = rows.some(canAnswerRow) ? "answers" : "icons";

  /**
   * As colunas de condições de uma linha: as iniciais (do booking) e as
   * finais (a última proposta enviada, com a situação dela).
   */
  const conditionCells = (
    c: (RequestConditions & { state?: ConditionsState }) | null,
    group: "initial" | "final",
    id: string,
  ) => {
    const final = group === "final";
    const cells = [
      <Td
        key={`${group}-price`}
        className={cx(nowrap, "border-l border-zinc-100 tabular-nums")}
        data-supplier-table-answer-price={final ? id : undefined}
        data-supplier-table-initial-price={final ? undefined : id}
      >
        {c ? num(c.price) : "—"}
      </Td>,
      <Td key={`${group}-currency`} className={nowrap}>
        {c?.currency ?? "—"}
      </Td>,
      <Td key={`${group}-moq`} className={cx(nowrap, "tabular-nums")}>
        {c ? num(c.moq, 0) : "—"}
      </Td>,
      <Td
        key={`${group}-incoterm`}
        className={nowrap}
        data-supplier-table-incoterm={final ? id : undefined}
      >
        {c?.incoterm ?? "—"}
      </Td>,
      <Td key={`${group}-lead`} className={cx(nowrap, "tabular-nums")}>
        {c ? num(c.leadTimeDays, 0) : "—"}
      </Td>,
    ];
    if (final)
      cells.push(
        <Td
          key="final-state"
          className={nowrap}
          data-supplier-table-final-state={c?.state ? id : undefined}
        >
          {c?.state ? (
            <Badge tone={STATE_TONE[c.state]}>{k(`state.${c.state}`)}</Badge>
          ) : (
            "—"
          )}
        </Td>,
      );
    return cells;
  };

  return (
    <Card title={k("title")}>
      <div className="mb-3 space-y-1 text-xs text-zinc-500">
        <p>{k(wellmix ? "hintWellmix" : "hint")}</p>
        {/* Legenda das respostas com os mesmos ícones da coluna: no toque
            (celular, iPad) não há dica ao passar o mouse. */}
        {actionSlots === "answers" ? (
          <p
            className="flex flex-wrap items-center gap-x-2.5 gap-y-1"
            data-supplier-table-legend
          >
            <span>{k("hintAnswers")}</span>
            {(
              [
                ["approve", CheckIcon, "text-emerald-700"],
                ["renegotiate", SwapIcon, "text-amber-600"],
                ["refuse", RefuseIcon, "text-red-700"],
              ] as const
            ).map(([key, Icon, color]) => (
              <span key={key} className="inline-flex items-center gap-1">
                <Icon className={cx("h-3.5 w-3.5 shrink-0", color)} />
                {k(key)}
              </span>
            ))}
          </p>
        ) : null}
      </div>
      <Table className={cx(PIN_VARS, PIN_ACTIONS[actionSlots])}>
        <thead>
          <tr>
            {before.map((c) => (
              <Th key={c} className={nowrap} rowSpan={2}>
                {k(`col.${c}`)}
              </Th>
            ))}
            <Th
              className="border-l border-zinc-200 text-center"
              colSpan={conditionCols.length}
            >
              {k("col.initial")}
            </Th>
            <Th
              className="border-l border-zinc-200 text-center"
              colSpan={conditionCols.length + 1}
            >
              {k("col.final")}
            </Th>
            {after.map((c) => (
              <Th key={c} className={nowrap} rowSpan={2}>
                {k(`col.${c}`)}
              </Th>
            ))}
            <Th
              className={cx(nowrap, "bg-zinc-50", PIN.status)}
              rowSpan={2}
              data-supplier-table-pin="status"
            >
              {k("col.statusSla")}
            </Th>
            <Th
              className={cx("bg-zinc-50 text-right", PIN.actions)}
              rowSpan={2}
              data-supplier-table-pin="actions"
            >
              {k("col.actions")}
            </Th>
          </tr>
          <tr>
            {["initial", "final"].flatMap((g) =>
              conditionCols.map((c, i) => (
                <Th
                  key={`${g}-${c}`}
                  className={cx(nowrap, i === 0 && "border-l border-zinc-200")}
                >
                  {k(`col.cond.${c}`)}
                </Th>
              )),
            )}
            <Th className={nowrap}>{k("col.cond.state")}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, index) => {
            const it = r.item;
            const book = bookSpecs?.get(r.id) ?? null;
            // Cópia da solicitação; o que ela não guarda, do item do Book.
            const specs = requestItemSpecs(r, book);
            const name = specs.description ?? specs.productName ?? "—";
            const bookCol = (key: string) =>
              t(`bookingLots.item.col.${key}` as DictionaryKey);
            // Dados complementares: só os que existem aparecem.
            const details = (
              [
                // A descrição já é o nome da linha; o nome só quando é outro.
                [
                  "productName",
                  k("detail.productName"),
                  specs.productName !== name ? specs.productName : null,
                ],
                ["colors", bookCol("colorAssortment"), specs.colorAssortment],
                ["power", bookCol("powerDetail"), specs.powerDetail],
                [
                  "netWeight",
                  bookCol("netWeightPcKg"),
                  specs.netWeightPcKg === null
                    ? null
                    : num(specs.netWeightPcKg),
                ],
                [
                  "grossWeight",
                  bookCol("grossWeightPcKg"),
                  specs.grossWeightPcKg === null
                    ? null
                    : num(specs.grossWeightPcKg),
                ],
                ["ncm", k("detail.ncm"), wellmix ? (book?.ncm ?? null) : null],
              ] as Array<[string, string, string | null]>
            ).filter((d): d is [string, string, string] => !!d[2]);
            // Na solicitação com vários produtos, cada linha é um produto dela
            // (2.1, 2.2…): nenhuma é "esta solicitação".
            const current = r.id === currentId && !r.batchId;
            const pending = !!pendingProposal(r.negotiation);
            // Só o fornecedor responde (a Wellmix não responde por ele).
            // Três respostas por produto: aprovar a oferta vigente,
            // renegociar (formulário já preenchido) ou recusar.
            const offer = canAnswerRow(r) ? currentOffer(r) : null;
            // Nome (com o preço) e explicação de aprovar: só na oferta que
            // dá para aprovar direto (a regra é de `currentOffer`).
            const approve = offer?.confirmable
              ? {
                  name: t("supplierRequests.table.confirm", {
                    price: [
                      num(offer.conditions.price),
                      offer.conditions.currency,
                    ]
                      .filter(Boolean)
                      .join(" "),
                  }),
                  hint: k(`confirmHint.${offer.source}`),
                }
              : null;
            const refuseHint = offer ? k(`refuseHint.${offer.source}`) : "";
            // Explicação de cada resposta, lida depois do nome do botão.
            const describedBy = (action: string) =>
              `supplier-table-${action}-${r.id}`;
            // Aprovada: a amostragem (fotos e vídeos da amostra).
            const sampling = samplingOf(r);
            const pinBg = cx(PIN_BG, current && PIN_BG_CURRENT);
            const turn = negotiationTurn(r);
            const sla = slaOf(r, slaMinutes);
            const times = answerTimes(
              r,
              (legacy.get(r.id) ?? []).map((a) => a.at),
            );
            const yes = r.supplierCanDo === "yes";
            const href = `/app/supplier-requests/${r.id}?view=item`;
            return (
              <tr
                key={r.id}
                className={cx(
                  rowClass,
                  "group/row",
                  current && "bg-brand-50/60",
                )}
                data-supplier-table-row={r.id}
                data-current={current ? "1" : undefined}
              >
                <Td>
                  <PhotoGallery
                    photos={
                      it.photoDocumentId
                        ? [{ id: it.photoDocumentId, label: null }]
                        : []
                    }
                    name={name}
                    className="h-12 w-12"
                    labels={{
                      title: k("photo"),
                      close: k("close"),
                      open: k("photoOpen"),
                      count: t("supplierRequests.detail.title", {
                        n: r.number,
                      }),
                      noPhoto: k("noPhoto"),
                    }}
                  />
                </Td>
                <Td className={cx(nowrap, "tabular-nums font-medium")}>
                  {r.batchId && rows.length > 1
                    ? `${r.number}.${index + 1}`
                    : r.number}
                  {current ? (
                    <span className="mt-1 block">
                      <Badge tone="info">{k("current")}</Badge>
                    </span>
                  ) : null}
                </Td>
                <Td>
                  <span className="block min-w-48 max-w-72 whitespace-normal font-medium text-zinc-900">
                    {name}
                  </span>
                  {details.length || wellmix ? (
                    <details
                      className="group/specs mt-1 min-w-48 max-w-72 text-xs"
                      data-supplier-table-details={r.id}
                    >
                      <summary className="inline-flex min-h-6 cursor-pointer list-none items-center gap-1 rounded font-medium text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-brand-600 [&::-webkit-details-marker]:hidden">
                        {k("details")}
                        <svg
                          aria-hidden
                          viewBox="0 0 20 20"
                          className="h-3.5 w-3.5 transition-transform group-open/specs:rotate-180"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 8l5 5 5-5" />
                        </svg>
                      </summary>
                      <div className="mt-1 space-y-1 whitespace-normal rounded-md border border-zinc-200 bg-zinc-50/70 p-2">
                        {details.length ? (
                          <dl className="space-y-1">
                            {details.map(([key, label, value]) => (
                              <div key={key} data-supplier-table-detail={key}>
                                <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                  {label}
                                </dt>
                                <dd className="break-words text-zinc-800">
                                  {value}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        ) : (
                          <p className="text-zinc-500">{k("detailsNone")}</p>
                        )}
                        {wellmix ? (
                          <Link
                            href={`/app/booking/lots/${r.bookingLotId}`}
                            className="inline-block font-medium text-brand-700 hover:underline"
                            data-supplier-table-book={r.id}
                          >
                            {k("detail.book")}
                          </Link>
                        ) : null}
                      </div>
                    </details>
                  ) : null}
                </Td>
                <Td className={nowrap}>{it.factoryItemCode ?? "—"}</Td>
                <Td className={nowrap}>{it.itemNumber ?? "—"}</Td>
                <Td className={nowrap}>{specs.material ?? "—"}</Td>
                {/* Ficha técnica: a mesma que o Book mostra. */}
                <Td data-supplier-table-package={r.id}>
                  <span className="block max-w-40 whitespace-normal">
                    {specs.packageType ?? "—"}
                  </span>
                </Td>
                <Td
                  className={cx(nowrap, "tabular-nums")}
                  data-supplier-table-measures={r.id}
                >
                  {[specs.lengthCm, specs.widthCm, specs.heightCm].some(
                    (n) => n !== null,
                  )
                    ? [specs.lengthCm, specs.widthCm, specs.heightCm]
                        .map((n) => num(n, 2))
                        .join(" × ")
                    : "—"}
                </Td>
                <Td
                  className={cx(nowrap, "tabular-nums")}
                  data-supplier-table-capacity={r.id}
                >
                  {typeof specs.capacity === "number"
                    ? `${num(specs.capacity, 0)} ml`
                    : (specs.capacity ?? "—")}
                </Td>
                <Td
                  className={cx(nowrap, "tabular-nums")}
                  data-supplier-table-master={r.id}
                >
                  {num(specs.masterCartonQty, 0)}
                </Td>
                <Td
                  className={cx(nowrap, "tabular-nums")}
                  data-supplier-table-inner={r.id}
                >
                  {num(specs.innerQty, 0)}
                </Td>
                <Td
                  className={cx(nowrap, "tabular-nums")}
                  data-supplier-table-cbm={r.id}
                >
                  {num(specs.cbmPerCarton)}
                </Td>
                {/* Programação de compra: rodadas, peças por rodada e o total. */}
                <Td
                  className={cx(nowrap, "tabular-nums")}
                  data-supplier-table-rounds={r.id}
                >
                  <span title={roundsDates(r.schedule, t) ?? undefined}>
                    {r.schedule?.items.length ?? 1}
                  </span>
                </Td>
                <Td
                  className={cx(nowrap, "tabular-nums")}
                  data-supplier-table-per-round={r.id}
                >
                  <span title={roundsDates(r.schedule, t) ?? undefined}>
                    {r.schedule?.items.length
                      ? r.schedule.items
                          .map((i) => i.quantity.toLocaleString(intl))
                          .join(" / ")
                      : r.quantity.toLocaleString(intl)}
                  </span>
                </Td>
                <Td className={cx(nowrap, "tabular-nums")}>
                  {r.quantity.toLocaleString(intl)}
                  {/* Variações de cor: uma linha por cor, somando o total. */}
                  <ColorLines
                    colors={colorTotals(r.colorPlan)}
                    name={it.description ?? it.productName ?? ""}
                    intl={intl}
                  />
                </Td>
                <Td
                  className={cx(nowrap, "tabular-nums")}
                  data-supplier-table-total-cartons={r.id}
                >
                  {num(specs.totalCartons, 0)}
                </Td>
                <Td
                  className={cx(nowrap, "tabular-nums")}
                  data-supplier-table-total-cbm={r.id}
                >
                  <span
                    title={
                      specs.cbmFromMeasures ? k("cbmFromMeasures") : undefined
                    }
                  >
                    {specs.cbmFromMeasures ? "≈ " : ""}
                    {num(specs.totalCbm)}
                  </span>
                </Td>
                <Td className={cx(nowrap, "tabular-nums")}>
                  {it.moq === null ? "—" : `${num(it.moq, 0)} ${r.unit}`}
                </Td>
                <Td className={cx(nowrap, "tabular-nums")}>{num(it.price)}</Td>
                <Td className={nowrap}>{it.currency ?? "—"}</Td>
                <Td className={nowrap}>{it.incoterm ?? "—"}</Td>
                <Td>
                  <span
                    className="block max-w-56 truncate text-xs text-zinc-600"
                    title={r.needs ?? undefined}
                  >
                    {r.needs ?? "—"}
                  </span>
                </Td>
                <Td className={nowrap}>
                  <span data-supplier-table-answer-text={r.id}>
                    {r.supplierCanDo ? (
                      <Badge tone={yes ? "success" : "danger"}>
                        {k(yes ? "canDoYes" : "canDoNo")}
                      </Badge>
                    ) : (
                      <span className="text-zinc-500">{k("canDoWaiting")}</span>
                    )}
                  </span>
                </Td>
                {conditionCells(initialConditions(r), "initial", r.id)}
                {conditionCells(finalConditions(r), "final", r.id)}
                <Td className="text-xs">
                  {turn
                    ? t(
                        `supplierRequests.negotiation.turn.${turn}` as DictionaryKey,
                      )
                    : "—"}
                  {pending ? (
                    <span
                      className="mt-0.5 block max-w-40 text-amber-800"
                      data-supplier-table-pending
                    >
                      {k(
                        wellmix ? "proposalPendingWellmix" : "proposalPending",
                      )}
                    </span>
                  ) : null}
                </Td>
                <Td className={cx(nowrap, "text-xs tabular-nums")}>
                  {dateTime(r.createdAt, t)}
                </Td>
                <Td className={cx(nowrap, "text-xs tabular-nums")}>
                  {dateTime(times.first, t)}
                </Td>
                <Td className={cx(nowrap, "text-xs tabular-nums")}>
                  {dateTime(times.last, t)}
                </Td>
                {/* Situação / SLA: a situação geral do produto (na aprovada,
                    com a amostragem) e, embaixo, o SLA com o prazo recolhido. */}
                <Td
                  className={cx(pinBg, PIN.status)}
                  data-supplier-table-pin="status"
                  data-supplier-table-status={r.status}
                >
                  <div className="w-[var(--pin-status)]">
                    <span data-supplier-table-status-badge>
                      <Badge tone={STATUS_TONE[r.status]}>
                        {t(
                          `supplierRequests.status.${r.status}` as DictionaryKey,
                        )}
                      </Badge>
                    </span>
                    {sampling ? (
                      <Link
                        href={`${href}#amostragem`}
                        className="mt-1 block rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                        data-supplier-table-sampling={sampling.status}
                      >
                        <span className="block text-[10px] leading-tight font-semibold tracking-wide text-zinc-500 uppercase">
                          {t("sampling.table.open")}
                        </span>
                        <Badge
                          tone={SAMPLING_TONE[sampling.status]}
                          className="mt-0.5 rounded-md px-1.5 text-[11px] leading-tight whitespace-normal"
                        >
                          {t(
                            `sampling.status.${sampling.status}` as DictionaryKey,
                          )}
                          {samplingLate(sampling, samplingSlaDays)
                            ? ` · ${t("sampling.late")}`
                            : ""}
                        </Badge>
                      </Link>
                    ) : null}
                    {/* SLA (só enquanto a solicitação está ativa): o selo e o
                        "+" na mesma linha; a data e a hora do prazo ficam
                        recolhidas até o "+" (que vira "−"). */}
                    {sla ? (
                      <span
                        className="mt-1 block"
                        data-supplier-request-sla={sla.late ? "late" : "ok"}
                      >
                        <SlaDueToggle
                          due={dateTime(sla.dueAt, t)}
                          late={sla.late}
                          labels={{ show: k("slaShow"), hide: k("slaHide") }}
                        >
                          <span
                            className="inline-flex"
                            data-supplier-table-sla-badge
                          >
                            <Badge tone={sla.late ? "danger" : "neutral"}>
                              {k(sla.late ? "late" : "onTime")}
                            </Badge>
                          </span>
                        </SlaDueToggle>
                      </span>
                    ) : null}
                  </div>
                </Td>
                <Td
                  className={cx(pinBg, PIN.actions)}
                  data-supplier-table-pin="actions"
                >
                  {/* Duas linhas (dono, 14/11/2026), só ícones, à direita: em
                      cima mensagem e abrir o produto; embaixo, enquanto o
                      fornecedor responde, aprovar, renegociar e recusar.
                      Sem resposta possível, não há a segunda linha. */}
                  <div
                    className="flex w-[var(--pin-actions)] flex-col items-end gap-2"
                    data-supplier-table-actions={r.id}
                  >
                    <div className="flex items-center justify-end gap-2">
                      {canPostMessage(r.status) ? (
                        <QuickDialog
                          label={<ChatBubbleIcon />}
                          hint={k("message")}
                          title={t("supplierRequests.table.messageTitle", {
                            n: r.number,
                          })}
                          closeLabel={k("close")}
                          className={cx(ICON_BUTTON, ICON_TONE.neutral)}
                          data-supplier-table-message={r.id}
                        >
                          <form
                            action={postSupplierRequestMessageAction}
                            className="space-y-2"
                            data-supplier-table-message-form
                          >
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="view" value="table" />
                            <Field label={k("messageText")}>
                              <Textarea
                                name="text"
                                rows={3}
                                maxLength={4000}
                                required
                                data-supplier-table-message-text
                              />
                            </Field>
                            <SubmitButton
                              pendingText={k("sending")}
                              data-supplier-table-message-submit
                            >
                              {k("send")}
                            </SubmitButton>
                          </form>
                        </QuickDialog>
                      ) : null}
                      <LinkButton
                        href={href}
                        className={cx(ICON_BUTTON, ICON_TONE.neutral)}
                        title={k("open")}
                        aria-label={k("open")}
                        data-supplier-table-open={r.id}
                      >
                        <OpenIcon />
                      </LinkButton>
                    </div>
                    {offer ? (
                      <div
                        className="flex items-center justify-end gap-2"
                        data-supplier-table-offer={offer.source}
                      >
                        {approve ? (
                          <form action={respondOfferAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="view" value="table" />
                            <input
                              type="hidden"
                              name="action"
                              value="confirm"
                            />
                            <input
                              type="hidden"
                              name="offer"
                              value={offer.token}
                            />
                            <span id={describedBy("confirm")} hidden>
                              {approve.hint}
                            </span>
                            <SubmitButton
                              variant="secondary"
                              iconOnly
                              className={cx(ICON_BUTTON, ICON_TONE.approve)}
                              title={tooltip(approve.name, approve.hint)}
                              aria-label={approve.name}
                              aria-describedby={describedBy("confirm")}
                              data-supplier-table-confirm={r.id}
                            >
                              <CheckIcon />
                            </SubmitButton>
                          </form>
                        ) : null}
                        <QuickDialog
                          label={<SwapIcon />}
                          hint={tooltip(k("renegotiate"), k("renegotiateHint"))}
                          name={k("renegotiate")}
                          description={k("renegotiateHint")}
                          title={t("supplierRequests.table.renegotiateTitle", {
                            n: r.number,
                          })}
                          closeLabel={k("close")}
                          className={cx(ICON_BUTTON, ICON_TONE.renegotiate)}
                          data-supplier-table-answer-open={r.id}
                        >
                          {/* Com contraproposta esperando: nova proposta; sem,
                              a resposta "faz" com as condições que ele editar. */}
                          <form
                            action={
                              pending
                                ? respondProposalAction
                                : answerSupplierRequestAction
                            }
                            className="space-y-2"
                            data-supplier-table-answer-form
                          >
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="view" value="table" />
                            {pending ? (
                              <input
                                type="hidden"
                                name="action"
                                value="counter"
                              />
                            ) : (
                              <input type="hidden" name="canDo" value="yes" />
                            )}
                            {/* Mantém o prazo vigente (muda na tela do produto). */}
                            <input
                              type="hidden"
                              name="leadTimeDays"
                              value={raw(
                                offer.conditions.leadTimeDays ??
                                  r.supplierLeadTimeDays,
                              )}
                            />
                            <p className="text-xs text-zinc-500">
                              {k("renegotiateText")}
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              <Field
                                label={t(
                                  "supplierRequests.detail.answer.price",
                                )}
                              >
                                <Input
                                  name="price"
                                  inputMode="decimal"
                                  required
                                  defaultValue={raw(offer.conditions.price)}
                                  data-supplier-table-answer-price-input
                                />
                              </Field>
                              <Field
                                label={t(
                                  "supplierRequests.detail.answer.currency",
                                )}
                              >
                                <Select
                                  name="currency"
                                  defaultValue={
                                    offer.conditions.currency ?? "USD"
                                  }
                                >
                                  {SHEET_CURRENCIES.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </Select>
                              </Field>
                              <Field
                                label={t("supplierRequests.detail.answer.moq")}
                              >
                                <Input
                                  name="moq"
                                  inputMode="numeric"
                                  defaultValue={raw(offer.conditions.moq)}
                                  data-supplier-table-answer-moq
                                />
                              </Field>
                              <Field
                                label={t(
                                  "supplierRequests.detail.answer.incoterm",
                                )}
                              >
                                <Select
                                  name="incoterm"
                                  defaultValue={
                                    offer.conditions.incoterm ?? "FOB"
                                  }
                                  data-supplier-table-answer-incoterm
                                >
                                  {SHEET_INCOTERMS.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </Select>
                              </Field>
                            </div>
                            <Field
                              label={t("supplierRequests.detail.answer.note")}
                            >
                              <Textarea
                                name={pending ? "text" : "note"}
                                rows={2}
                                maxLength={4000}
                                defaultValue={
                                  pending ? "" : (r.supplierNote ?? "")
                                }
                              />
                            </Field>
                            <SubmitButton
                              pendingText={k("sending")}
                              data-supplier-table-answer="yes"
                            >
                              {k("renegotiateSend")}
                            </SubmitButton>
                          </form>
                        </QuickDialog>
                        <form action={respondOfferAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="view" value="table" />
                          <input type="hidden" name="action" value="refuse" />
                          <input
                            type="hidden"
                            name="offer"
                            value={offer.token}
                          />
                          <span id={describedBy("refuse")} hidden>
                            {refuseHint}
                          </span>
                          <SubmitButton
                            variant="danger"
                            iconOnly
                            className={cx(ICON_BUTTON, ICON_TONE.refuse)}
                            title={tooltip(k("refuse"), refuseHint)}
                            aria-label={k("refuse")}
                            aria-describedby={describedBy("refuse")}
                            data-supplier-table-refuse={r.id}
                          >
                            <RefuseIcon />
                          </SubmitButton>
                        </form>
                      </div>
                    ) : null}
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}
