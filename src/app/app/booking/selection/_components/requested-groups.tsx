import Link from "next/link";
import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import type { BookingItem } from "@/lib/db";
import { otherGroupItems } from "@/lib/booking-selection";
import { priceInUsd } from "@/lib/supplier-requests";
import type { SelectionRow } from "@/lib/services/supplier-requests";
import type { SelectionGroupEntry } from "@/lib/services/selection-groups";
import { ExpandRow } from "@/components/expand-row";
import { Badge, LinkButton, cx, linkClass } from "@/components/ui";

/*
 * Seleção de itens → "Com solicitação aberta" (docs/SUPPLIER_REQUESTS.md,
 * "Escolha por grupo"): lista compacta, uma linha de largura total por grupo
 * comparado. Na linha: o grupo, o link da solicitação, o resumo do item
 * escolhido (quantidade, programação de compra e preço) e "Rever a escolha".
 * A seta abre, embaixo da própria linha, os itens comparados que não foram
 * escolhidos, com os mesmos dados dos cartões (nome, fornecedor e preço).
 *
 * A unidade é o grupo: dois grupos na mesma solicitação são duas linhas.
 * Só a apresentação mudou: os vínculos com as solicitações e o endereço de
 * "Rever a escolha" são os mesmos dos cartões das outras seções. A linha
 * aberta mostra o grupo inteiro mesmo com busca ou filtro na tela (quem
 * chama passa em `rows` também os itens que o filtro deixou de fora), e o
 * item sem descrição aparece pelo código da fábrica.
 */

export interface RequestedGroupCard {
  key: string;
  label: string;
  /** Itens do bloco sugerido (ou do grupo montado à mão), como nos cartões. */
  ids: string[];
  /** Fornecedores do bloco sugerido; nulo no grupo montado à mão. */
  suppliers: number | null;
  entry: SelectionGroupEntry;
}

/*
 * As colunas, pela largura da lista (@container):
 * - estreita (celular): grupo e ação; embaixo a solicitação; embaixo o
 *   escolhido e o preço;
 * - média (a partir de 28rem, o iPad em pé): grupo, solicitação e ação;
 *   embaixo o escolhido e o preço;
 * - larga (a partir de 48rem, o iPad deitado): tudo numa linha só. As
 *   larguras são fixas ou em fração (nenhuma pelo conteúdo), para as colunas
 *   baterem entre as linhas e com os itens não escolhidos, embaixo: o preço
 *   deles fica sob o preço do escolhido.
 */
const WIDE_COLS =
  "@3xl:grid-cols-[minmax(0,1fr)_10.5rem_minmax(0,1.8fr)_5.5rem_8.25rem]";
const ROW = cx(
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-3 py-1.5 text-[13px] text-zinc-800 transition",
  "hover:bg-brand-50/40 data-[expand-row=open]:bg-brand-50/40",
  "@md:grid-cols-[minmax(0,1fr)_auto_auto]",
  WIDE_COLS,
);
const OTHER_ROW = cx(
  "grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_5.5rem] items-baseline gap-x-3 py-1",
  WIDE_COLS,
);
/** Recuo para ficar sob o nome do grupo (a seta e o espaço dela). */
const UNDER_NAME = "pl-[1.375rem]";

/**
 * Parte do resumo do escolhido, separada da anterior por "·". O resumo
 * quebra entre as partes; o ponto de quem cai no começo de uma linha fica
 * para fora da caixa (recortado), e a linha não começa com ponto.
 */
function Part({
  first,
  className,
  children,
  ...data
}: {
  first?: boolean;
  className?: string;
  children: ReactNode;
} & { [key: `data-${string}`]: string | number | undefined }) {
  return (
    <span className={cx("relative pl-4", className)} {...data}>
      {first ? null : (
        <span aria-hidden className="absolute left-1.5">
          ·
        </span>
      )}
      {children}
    </span>
  );
}

export function RequestedGroups({
  t,
  cards,
  rows,
  rmbPerUsd,
  hrefOf,
}: {
  t: Translate;
  cards: RequestedGroupCard[];
  /** Itens dos grupos, por id (os da tela e os que o filtro deixou de fora). */
  rows: Map<string, SelectionRow>;
  /** RMB por US$ (câmbio do dia), para o preço em dólar. */
  rmbPerUsd: number | null;
  /** Endereço de "Rever a escolha" (o grupo aberto para comparar). */
  hrefOf: (ids: string[]) => string;
}) {
  const nameOf = (item: BookingItem | null) =>
    item?.description ?? item?.productName ?? item?.factoryItemCode ?? "—";
  const usdOf = (item: BookingItem | null) => {
    const usd = item ? priceInUsd(item.price, item.currency, rmbPerUsd) : null;
    return usd === null
      ? "—"
      : `US$ ${usd.toLocaleString(t.intl, { maximumFractionDigits: 3 })}`;
  };
  return (
    <ul
      className="@container divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white"
      data-selection-requested-list={cards.length}
    >
      {cards.map((card) => {
        const { group: g, request } = card.entry;
        const chosen = rows.get(g.chosenItemId)?.item ?? card.entry.chosen;
        const chosenName = nameOf(chosen);
        // O bloco como está hoje (a ordem dos cartões) e, depois, o que
        // foi comparado na escolha e o filtro da tela tirou do bloco.
        const ids = [...new Set([...card.ids, ...g.itemIds])];
        const others = otherGroupItems(ids, g.chosenItemId, (id) =>
          rows.get(id),
        );
        const rounds = g.schedule?.items.length ?? 0;
        return (
          <li
            key={card.key}
            data-selection-block={card.ids.length}
            data-selection-resolved={g.status}
            data-selection-group-row={g.id}
          >
            <ExpandRow
              className={ROW}
              toggleClassName="col-start-1 row-start-1"
              title={
                <span
                  className="line-clamp-2 text-sm font-semibold break-words text-zinc-900 capitalize"
                  title={card.label}
                >
                  {card.label}
                </span>
              }
              detailClassName="border-t border-zinc-100 bg-zinc-50/70 px-3 py-2 text-[13px] text-zinc-700"
              detail={
                <div data-selection-group-others={others.rows.length}>
                  <div
                    className={cx(
                      "mb-1 flex flex-wrap items-center gap-2",
                      UNDER_NAME,
                    )}
                  >
                    <span className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
                      {t("supplierRequests.selection.requestedRow.others")}
                    </span>
                    <Badge tone="info">
                      {card.suppliers === null || ids.length > card.ids.length
                        ? t("supplierRequests.selection.blocks.sizeManual", {
                            n: ids.length,
                          })
                        : t("supplierRequests.selection.blocks.size", {
                            n: card.ids.length,
                            suppliers: card.suppliers,
                          })}
                    </Badge>
                  </div>
                  {others.rows.length ? (
                    <ul className="divide-y divide-zinc-200/70">
                      {others.rows.map((row) => {
                        const name = nameOf(row.item);
                        return (
                          <li
                            key={row.item.id}
                            className={OTHER_ROW}
                            data-selection-other={row.item.id}
                          >
                            <span
                              className={cx(
                                "min-w-0 truncate @3xl:col-span-2",
                                UNDER_NAME,
                              )}
                              title={name}
                            >
                              {name}
                            </span>
                            <span className="min-w-0 truncate text-zinc-500 @3xl:col-start-3">
                              {row.supplier?.name ?? "—"}
                            </span>
                            <span className="text-right whitespace-nowrap tabular-nums @3xl:col-start-4">
                              {usdOf(row.item)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : others.missing ? null : (
                    <p className={cx("text-zinc-500", UNDER_NAME)}>
                      {t("supplierRequests.selection.requestedRow.none")}
                    </p>
                  )}
                  {others.missing ? (
                    <p
                      className={cx("mt-1 text-xs text-zinc-500", UNDER_NAME)}
                      data-selection-others-missing={others.missing}
                    >
                      {t("supplierRequests.selection.requestedRow.gone", {
                        n: others.missing,
                      })}
                    </p>
                  ) : null}
                </div>
              }
            >
              {/* Solicitação: o link fica fora do botão da seta. */}
              <div
                className={cx(
                  "col-span-2 col-start-1 row-start-2",
                  UNDER_NAME,
                  "@md:col-span-1 @md:col-start-2 @md:row-start-1 @md:pl-0",
                )}
              >
                {request ? (
                  <Link
                    href={`/app/supplier-requests/${request.id}`}
                    className={cx(linkClass, "whitespace-nowrap")}
                    data-selection-request-link
                  >
                    {t("supplierRequests.selection.requested", {
                      n: request.number,
                    })}
                  </Link>
                ) : (
                  <Badge tone="success">
                    {t("supplierRequests.selection.requestedNoLink")}
                  </Badge>
                )}
              </div>
              {/* Item escolhido: nome, quantidade e programação de compra. */}
              <div
                className={cx(
                  "col-start-1 row-start-3 min-w-0",
                  UNDER_NAME,
                  "@md:col-span-2 @md:row-start-2",
                  "@3xl:col-span-1 @3xl:col-start-3 @3xl:row-start-1 @3xl:pl-0",
                )}
              >
                <div
                  className="w-fit max-w-full overflow-hidden rounded-md bg-emerald-100 py-0.5 pr-1.5 text-emerald-900"
                  title={t("supplierRequests.selection.requestedRow.chosen")}
                  data-selection-winner
                >
                  <div className="-ml-2.5 flex flex-wrap items-baseline">
                    <Part
                      first
                      className="max-w-full min-w-0 truncate font-semibold"
                    >
                      <span className="sr-only">
                        {t("supplierRequests.selection.requestedRow.chosen")}
                        :{" "}
                      </span>
                      ✓ {chosenName}
                    </Part>
                    <Part className="whitespace-nowrap">
                      {t("supplierRequests.detail.pieces", {
                        n: g.quantity.toLocaleString(t.intl),
                      })}
                    </Part>
                    {rounds ? (
                      <Part
                        className="whitespace-nowrap"
                        data-selection-winner-schedule={rounds}
                      >
                        {t("purchaseRounds.summary.short", {
                          rounds,
                          days: g.schedule!.intervalDays,
                        })}
                      </Part>
                    ) : null}
                  </div>
                </div>
              </div>
              {/* Preço do escolhido (US$), alinhado entre as linhas. */}
              <div
                className="col-start-2 row-start-3 text-right font-semibold whitespace-nowrap text-zinc-900 tabular-nums @md:col-start-3 @md:row-start-2 @3xl:col-start-4 @3xl:row-start-1"
                data-selection-winner-price
              >
                {usdOf(chosen)}
              </div>
              <div className="col-start-2 row-start-1 justify-self-end @md:col-start-3 @3xl:col-start-5">
                <LinkButton
                  href={hrefOf(card.ids)}
                  className="px-2.5 py-1 text-xs whitespace-nowrap"
                  data-selection-block-open
                >
                  {t("supplierRequests.selection.blocks.reopen")}
                </LinkButton>
              </div>
            </ExpandRow>
          </li>
        );
      })}
    </ul>
  );
}
