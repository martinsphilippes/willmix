import type { OrderSheet } from "@/lib/services/order-sheet";
import {
  ORDER_SHEET_BAND_A,
  orderSheetBandB,
  orderSheetCargoTotals,
  orderSheetCurrencySign,
  orderSheetGeneralNotes,
  orderSheetHeaderBlocks,
  orderSheetValueTotals,
  orderSheetValuesA,
  orderSheetValuesB,
  type OrderSheetColumn,
} from "@/lib/order-sheet-layout";
import {
  ORDER_PROCEDURES,
  ORDER_PROCEDURES_TITLE,
} from "@/lib/order-procedures";

/*
 * A folha do pedido na tela, no mesmo desenho do PDF (o modelo de pedido da
 * Wellmix): cabeçalho, cada item em duas faixas, totais, comentários e os
 * procedimentos. Os rótulos são os do documento (em inglês, como vão ao
 * fornecedor) e vêm do mesmo lugar que os do PDF.
 */

const cell = "border border-zinc-400 px-1 py-0.5 text-center align-top";

function Band({
  columns,
  values,
  name,
}: {
  columns: readonly OrderSheetColumn[];
  values: string[];
  name: string;
}) {
  const total = columns.reduce((sum, [, weight]) => sum + weight, 0);
  return (
    <table
      className="w-full table-fixed border-collapse"
      data-order-sheet-band={name}
    >
      <colgroup>
        {columns.map(([label, weight]) => (
          <col key={label} style={{ width: `${(weight / total) * 100}%` }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {columns.map(([label]) => (
            <th key={label} className={`${cell} font-normal text-zinc-700`}>
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {values.map((value, i) => (
            <td key={columns[i][0]} className={`${cell} h-8 break-words`}>
              {value}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

export function OrderSheetView({ sheet }: { sheet: OrderSheet }) {
  const sign = orderSheetCurrencySign(sheet.currency);
  const bandB = orderSheetBandB(sign);
  // Na tela não há "impresso por/em": isso é do arquivo gerado.
  const blocks = orderSheetHeaderBlocks(sheet.header, null, null);
  return (
    <div className="overflow-x-auto" data-order-sheet={sheet.items.length}>
      <div className="min-w-[68rem] space-y-2 text-[10px] leading-tight text-zinc-900">
        <p className="border border-zinc-500 py-0.5 text-center text-sm font-bold">
          {sheet.header.company.toUpperCase()}
        </p>
        <div className="grid grid-cols-[1fr_1.35fr_1fr] border border-zinc-500">
          {blocks.map((rows, i) => (
            <dl
              key={i}
              className="space-y-1 border-l border-zinc-500 p-1.5 first:border-l-0"
            >
              {rows.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[7rem_1fr] gap-1">
                  <dt className="text-zinc-600">{label}</dt>
                  <dd className={i === 2 ? "font-semibold" : undefined}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          ))}
        </div>
        {sheet.items.map((item) => (
          <div key={item.n} data-order-sheet-item={item.n}>
            <Band
              columns={ORDER_SHEET_BAND_A}
              values={orderSheetValuesA(item)}
              name="a"
            />
            <Band columns={bandB} values={orderSheetValuesB(item)} name="b" />
            <div className="grid grid-cols-[1fr_12rem] border border-t-0 border-zinc-400">
              <p className="min-h-10 whitespace-pre-line p-1">
                Comments / Specifications: {item.comments ?? ""}
              </p>
              <div className="border-l border-zinc-400">
                <p className="border-b border-zinc-400 p-1 text-center">
                  Factory
                </p>
                <p className="p-1">{item.factory ?? ""}</p>
              </div>
            </div>
          </div>
        ))}
        <div className="flex flex-wrap items-start justify-end gap-6">
          <table className="border-collapse" data-order-sheet-cargo>
            <thead>
              <tr>
                {orderSheetCargoTotals(sheet).map(([label]) => (
                  <th key={label} className={`${cell} w-40 font-bold`}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {orderSheetCargoTotals(sheet).map(([label, value]) => (
                  <td key={label} className={`${cell} h-5 font-bold`}>
                    {value}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <table className="border-collapse" data-order-sheet-value>
            <tbody>
              {orderSheetValueTotals(sheet).map(([label, value]) => (
                <tr key={label}>
                  <th className={`${cell} w-52 font-bold`}>{label}</th>
                  <td className={`${cell} w-44 font-bold`}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <p className="border border-zinc-500 bg-zinc-200 py-0.5 text-center text-sm font-bold">
            Comments /Specifications
          </p>
          <div className="min-h-10 border border-t-0 border-zinc-500 p-1">
            {orderSheetGeneralNotes(sheet).map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
        <div data-order-sheet-procedures>
          <p className="border border-zinc-500 bg-zinc-200 py-0.5 text-center text-sm font-bold">
            {ORDER_PROCEDURES_TITLE}
          </p>
          <div className="max-w-3xl">
            {ORDER_PROCEDURES.map((section) => (
              <div key={section.title}>
                <p className="border border-t-0 border-zinc-400 px-1 py-0.5 text-xs font-bold">
                  {section.title}
                </p>
                {section.lines.map((line) => (
                  <p
                    key={line}
                    className="border border-t-0 border-zinc-400 px-1 py-0.5 text-[11px]"
                  >
                    {" "}
                    - {line}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
