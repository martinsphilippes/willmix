import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import type { RequestPriceForecast } from "@/lib/order-terms";
import type { RequestPacking } from "@/lib/services/request-packing";
import type { EncomendaTotals, TotalsLine } from "@/lib/request-totals";
import { containersText, type RequestRounds } from "@/lib/request-rounds";
import {
  Empty,
  OpenLink,
  PageHeader,
  Table,
  Td,
  TextLink,
  Th,
  formatDate,
  rowClass,
} from "@/components/ui";
import { PhotoGallery } from "@/components/photo-gallery";
import { galleryProps } from "@/components/photo-gallery-props";
import {
  SaleTotalValue,
  TotalValue,
  moneyValue,
  unitLabel,
} from "@/components/request-total-cells";

/*
 * Tela de detalhes da solicitação (dono, 19/11/2026; docs/ORDER_LEVEL_LISTS.md,
 * seção 7): uma tela só, /app/requests/batch/<id>, para a solicitação
 * enviada e para o rascunho (o id dele). O cabeçalho, os avisos, o resumo, os
 * totais e a tabela de produtos são os mesmos (`RequestDetailsScreen`); muda
 * só o que é do estado do registro (a situação, a próxima ação, as ações, o
 * prazo e o pedido de cada produto). A conta é a mesma
 * (src/lib/services/request-packing.ts e src/lib/request-totals.ts). Só
 * apresentação: nada aqui lê ou grava no banco.
 */

/** Um produto na tabela de detalhes. */
export interface DetailsProduct {
  /** Chave da linha (o id da solicitação; no rascunho, a posição). */
  key: string;
  /** Valor de `data-batch-item` (testes e atalhos da tela). */
  itemId: string;
  name: string;
  /** Detalhes do produto (a página dele na solicitação; no rascunho, `?item=`). */
  href: string;
  openLabel: string;
  sku: string | null;
  variantName: string | null;
  photos: { documentId: string; kind: string | null }[];
  packing: RequestPacking | undefined;
  line: TotalsLine;
  /** Quantidade como foi pedida; nula quando o rascunho ainda não tem. */
  quantity: number | null;
  unit: string;
  forecast: RequestPriceForecast | null;
  /** Programações (entregas) do produto; 1 sem programação. */
  rounds: number;
  status: ReactNode;
  deadline: ReactNode;
  order: ReactNode;
  /** Ações depois do "Abrir" (conversa, excluir, enviado em…). */
  actions?: ReactNode;
  /** Dica do preço quando não há previsão gravada. */
  noPriceHint?: string;
}

const num = (t: Translate, n: number, digits = 0) =>
  n.toLocaleString(t.intl, { maximumFractionDigits: digits });

/** "2 produto(s) · 3 programação(ões) · containers por programação: 2 em cada". */
export function DetailsSummary({
  t,
  products,
  rounds,
}: {
  t: Translate;
  products: number;
  rounds: RequestRounds;
}) {
  return (
    <p className="mb-3 text-sm font-medium text-zinc-800" data-batch-summary>
      {t("reqBatch.summary", {
        products,
        rounds: rounds.rounds,
        containers: rounds.containers
          ? containersText(rounds.containers, (n) =>
              t("reqList.containers.each", { n }),
            )
          : "—",
      })}
    </p>
  );
}

/** Totais da encomenda (os mesmos da lista): "—" sem dado, "Total parcial" com parte. */
export function DetailsTotals({
  t,
  totals,
  wellmix,
  seeSale,
}: {
  t: Translate;
  totals: EncomendaTotals;
  wellmix: boolean;
  seeSale: boolean;
}) {
  const items = [
    ...(seeSale
      ? [
          {
            key: "price",
            label: t("reqList.col.price") as ReactNode,
            value: <SaleTotalValue t={t} sale={totals.sale} />,
          },
        ]
      : []),
    ...(wellmix
      ? [
          {
            key: "moq",
            label: t("reqList.col.moq") as ReactNode,
            value: <TotalValue t={t} part={totals.moq} total="moq" />,
          },
        ]
      : []),
    {
      key: "pieces",
      label: t("reqList.col.pieces") as ReactNode,
      value: <TotalValue t={t} part={totals.pieces} total="pieces" />,
    },
    {
      key: "boxes",
      label: t("reqList.col.boxes") as ReactNode,
      value: <TotalValue t={t} part={totals.boxes} total="boxes" />,
    },
    {
      key: "inner",
      label: t("reqList.col.inner") as ReactNode,
      value: <TotalValue t={t} part={totals.inner} total="inner" />,
    },
    {
      key: "cbm",
      label: unitLabel(t("reqList.col.cbm")),
      value: <TotalValue t={t} part={totals.cbm} total="cbm" />,
    },
  ];
  return (
    <section className="mb-3" data-batch-totals>
      <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {t("reqBatch.totals")}
      </h2>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {items.map((item) => (
          <div
            key={item.key}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2"
            data-batch-total={item.key}
          >
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              {item.label}
            </dt>
            <dd className="mt-0.5 text-base font-semibold text-zinc-900">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** A tabela de produtos: foto, produto, embalagem, cubagem e o estado de cada um. */
export function DetailsProductsTable({
  t,
  items,
  wellmix,
  seeSale,
}: {
  t: Translate;
  items: readonly DetailsProduct[];
  wellmix: boolean;
  seeSale: boolean;
}) {
  return (
    <Table>
      <thead>
        <tr>
          <Th className="w-14">{t("reqBatch.col.photo")}</Th>
          <Th>{t("common.product")}</Th>
          <Th className="text-right">{t("reqBatch.col.perBox")}</Th>
          <Th className="text-right">{t("reqBatch.col.pieces")}</Th>
          <Th className="text-right">{t("reqBatch.col.boxes")}</Th>
          <Th className="text-right">{t("reqBatch.col.inner")}</Th>
          <Th className="text-right">{unitLabel(t("reqBatch.col.cbm"))}</Th>
          {wellmix ? (
            <Th className="text-right">{t("reqBatch.col.moq")}</Th>
          ) : null}
          {seeSale ? (
            <Th className="text-right">{t("reqBatch.col.price")}</Th>
          ) : null}
          <Th className="text-right">{t("reqBatch.col.rounds")}</Th>
          <Th>{t("common.status")}</Th>
          <Th>{t("requests.deadline")}</Th>
          <Th>{t("requests.order")}</Th>
          <Th />
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          // Peças por caixa, caixas (por programação), inner e CBM: a
          // embalagem do produto (a mesma regra da lista e da ficha).
          const pk = item.packing;
          const line = item.line;
          const forecast = item.forecast;
          return (
            <tr
              key={item.key}
              className={rowClass}
              data-batch-item={item.itemId}
            >
              <Td className="w-14">
                <PhotoGallery
                  name={item.name}
                  {...galleryProps(t, item.photos)}
                />
              </Td>
              <Td className="min-w-40 font-medium text-zinc-900">
                <TextLink
                  href={item.href}
                  className="text-zinc-900 no-underline hover:underline"
                  data-batch-product-open=""
                >
                  {item.name}
                </TextLink>
                {item.sku ? (
                  <span className="block font-mono text-xs font-normal text-zinc-500">
                    {item.sku}
                  </span>
                ) : null}
                {item.variantName ? (
                  <span className="block text-xs font-normal text-zinc-500">
                    {item.variantName}
                  </span>
                ) : null}
              </Td>
              <Td
                className="whitespace-nowrap text-right tabular-nums"
                data-batch-per-box
              >
                {pk?.perBox ? num(t, pk.perBox.value) : "—"}
              </Td>
              <Td
                className="whitespace-nowrap text-right tabular-nums"
                data-batch-pieces
              >
                {/* Peças de todas as programações; em outra unidade (kg,
                    m), a quantidade como foi pedida; sem quantidade, "—". */}
                {line.pieces !== null
                  ? num(t, line.pieces, 2)
                  : item.quantity !== null
                    ? `${num(t, item.quantity, 2)} ${item.unit}`
                    : "—"}
              </Td>
              <Td
                className="whitespace-nowrap text-right tabular-nums"
                data-batch-boxes
              >
                {/* Sem peças por caixa, "—" (não um 0 enganoso); a dica
                    mostra as caixas de cada programação. */}
                <span
                  title={
                    line.boxes !== null &&
                    pk?.boxes?.perRound &&
                    pk.boxes.perRound.length > 1
                      ? t("reqBatch.boxes.rounds", {
                          list: pk.boxes.perRound
                            .map((n) => num(t, n))
                            .join(" + "),
                        })
                      : undefined
                  }
                >
                  {line.boxes !== null ? num(t, line.boxes) : "—"}
                </span>
              </Td>
              <Td
                className="whitespace-nowrap text-right tabular-nums"
                data-batch-inner
              >
                {line.innerBoxes !== null ? num(t, line.innerBoxes) : "—"}
              </Td>
              <Td
                className="whitespace-nowrap text-right tabular-nums"
                data-batch-cbm
              >
                {/* 3 casas na tela, como a lista; a dica com 4 (a conta). */}
                <span
                  title={
                    line.cbm !== null
                      ? `${line.cbm.toLocaleString(t.intl, { maximumFractionDigits: 4 })} m³`
                      : pk?.cbmOtherBox && pk.perBox
                        ? t("reqBatch.cbm.otherBox", {
                            qty: num(t, pk.cbmOtherBox.boxQty),
                            perBox: num(t, pk.perBox.value),
                          })
                        : undefined
                  }
                  data-batch-cbm-other={
                    line.cbm === null && pk?.cbmOtherBox ? "" : undefined
                  }
                >
                  {line.cbm !== null
                    ? line.cbm.toLocaleString(t.intl, {
                        minimumFractionDigits: 3,
                        maximumFractionDigits: 3,
                      })
                    : "—"}
                </span>
              </Td>
              {wellmix ? (
                <Td
                  className="whitespace-nowrap text-right tabular-nums"
                  data-batch-moq
                >
                  {line.moq !== null ? num(t, line.moq) : "—"}
                </Td>
              ) : null}
              {seeSale ? (
                <Td
                  className="whitespace-nowrap text-right tabular-nums"
                  data-batch-price
                >
                  <span
                    title={
                      forecast
                        ? t("reqBatch.price.hint", {
                            price: moneyValue(
                              t,
                              forecast.unitPrice,
                              forecast.currency,
                            ),
                            pieces: num(t, forecast.pieces),
                            date: formatDate(forecast.at, t),
                          })
                        : (item.noPriceHint ?? t("reqList.total.price.none"))
                    }
                  >
                    {forecast
                      ? moneyValue(t, forecast.total, forecast.currency)
                      : "—"}
                  </span>
                </Td>
              ) : null}
              <Td className="whitespace-nowrap text-right tabular-nums">
                {item.rounds}
              </Td>
              <Td className="whitespace-nowrap">{item.status}</Td>
              <Td className="whitespace-nowrap tabular-nums">
                {item.deadline}
              </Td>
              <Td className="whitespace-nowrap">{item.order}</Td>
              <Td className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <OpenLink href={item.href} label={item.openLabel} />
                  {item.actions}
                </div>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

/** O que a tela de detalhes mostra, no estado do registro (enviada ou rascunho). */
export interface RequestDetailsScreenProps {
  t: Translate;
  /** Estado do registro (`data-details-state`). */
  state: "sent" | "draft";
  title: string;
  /** Cliente (nulo: não mostra, como para quem é de fora). */
  customerName: string | null;
  /** Data do registro, já formatada. */
  date: string;
  /** A situação e a próxima ação com quem age. */
  status: ReactNode;
  actions: ReactNode;
  /** Avisos acima do resumo. */
  notices?: ReactNode;
  /** Um produto aberto (rascunho, `?item=`). */
  focus?: ReactNode;
  hint: string;
  products: number;
  rounds: RequestRounds;
  totals: EncomendaTotals;
  wellmix: boolean;
  seeSale: boolean;
  items: readonly DetailsProduct[];
  /** Sem produtos: o texto no lugar da tabela. */
  empty?: string;
  footer?: ReactNode;
}

/**
 * A tela de detalhes (o número clicado na lista abre esta tela, para a
 * solicitação enviada e para o rascunho): cabeçalho com o número, o cliente,
 * a data, a situação e a próxima ação; os avisos; o resumo; os totais; a
 * tabela de produtos.
 */
export function RequestDetailsScreen(props: RequestDetailsScreenProps) {
  const { t } = props;
  return (
    <>
      <PageHeader
        help={{ body: "help.requests.body", steps: "help.requests.steps" }}
        t={t}
        title={props.title}
        subtitle={
          <span
            className="flex flex-wrap items-center gap-x-3 gap-y-1"
            data-details-state={props.state}
          >
            {props.customerName ? (
              <span
                className="font-medium text-zinc-700"
                data-details-customer=""
              >
                {props.customerName}
              </span>
            ) : null}
            <span>{props.date}</span>
            {props.status}
          </span>
        }
        actions={props.actions}
      />
      {props.notices}
      {props.focus}
      <p className="mb-1 text-sm text-zinc-600">{props.hint}</p>
      <DetailsSummary t={t} products={props.products} rounds={props.rounds} />
      <DetailsTotals
        t={t}
        totals={props.totals}
        wellmix={props.wellmix}
        seeSale={props.seeSale}
      />
      {props.items.length === 0 && props.empty ? (
        <Empty>{props.empty}</Empty>
      ) : (
        <DetailsProductsTable
          t={t}
          items={props.items}
          wellmix={props.wellmix}
          seeSale={props.seeSale}
        />
      )}
      {props.footer}
    </>
  );
}
