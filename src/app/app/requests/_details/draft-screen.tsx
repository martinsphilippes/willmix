import "server-only";

import type { ReactNode } from "react";
import type { User } from "@/lib/db";
import { getStore } from "@/lib/db";
import { isAdmin, isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { canSeeMoney } from "@/lib/auth/function-access";
import { productNameText, type Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
  Card,
  LinkButton,
  TextLink,
  formatDate,
} from "@/components/ui";
import { productPhotoList } from "@/lib/services/product-list";
import { getSettings } from "@/lib/settings";
import { RequestScheduleTable } from "@/components/request-schedule-table";
import { RequestCompanyAllocations } from "@/components/request-company-allocations";
import {
  ResponsibleTip,
  draftResponsible,
} from "@/components/request-responsible-tip";
import { ListReturnLink } from "@/components/list-return";
import { ChatOpenButton } from "@/components/chat-open-button";
import type { PackingSourceKind } from "@/lib/services/request-packing";
import type { DetailsProduct, RequestDetailsScreenProps } from "./details-view";
import {
  draftDetailsModel,
  draftPieces,
  type DraftDetails,
  type DraftPackedProduct,
  type DraftProduct,
} from "./draft-details";

/*
 * O rascunho na tela de detalhes (dono, 19/11/2026; docs/ORDER_LEVEL_LISTS.md,
 * seção 7): o número do rascunho na lista abre /app/requests/batch/<id do
 * rascunho>, a mesma página e a mesma tela da solicitação enviada
 * (`RequestDetailsScreen`). Aqui só o que é do estado de rascunho:
 * - "Solicitação nº N" com o número persistente, o cliente, a data em que foi
 *   criado, "Rascunho" e "Próximo passo: Concluir e enviar" com quem o salvou;
 * - o aviso privado (só quem salvou vê; nada foi enviado);
 * - "Continuar edição" (o formulário de onde veio, com o que foi salvo);
 * - por produto: "Rascunho" (e "Incompleto"), sem prazo nem pedido; o
 *   produto abre os detalhes dele aqui mesmo (`?item=<posição>`).
 * Só consulta (draft-details.ts): nada é gravado ao montar a tela.
 */

/** As peças da tela de detalhes para o rascunho de quem vê. */
export async function draftScreenProps(
  user: User,
  t: Translate,
  details: DraftDetails,
  input: {
    /** Endereço da tela (o mesmo da lista: /app/requests/batch/<id>). */
    base: string;
    /** Produto aberto (`?item=<posição>`). */
    item: string | null;
  },
): Promise<RequestDetailsScreenProps> {
  const { draft, number, products } = details;
  const nameOf = (p: DraftProduct) => productNameText(t, p.productName);
  const productIds = details.catalog.map((p) => p.id);
  const [photos, settings] = await Promise.all([
    productIds.length
      ? getStore().list("product_photos", {
          filter: { productId: productIds },
        })
      : Promise.resolve([]),
    getSettings(),
  ]);
  const reference =
    [...settings.containerTypes].sort(
      (a, b) => b.capacityCbm - a.capacityCbm,
    )[0] ?? null;
  const model = await draftDetailsModel(details, {
    nameOf,
    capacityCbm: reference?.capacityCbm ?? null,
  });
  const catalogById = new Map(details.catalog.map((p) => [p.id, p]));
  const wellmix = isWellmix(user);
  // Venda prevista: só com "Ver valores e margem" (no rascunho, ainda "—").
  const seeSale = wellmix && canSeeMoney(user);
  // Produto aberto (?item=<posição>): a tabela mostra só ele, com os detalhes.
  const focus =
    input.item && /^\d{1,3}$/.test(input.item)
      ? (model.rows.find((r) => r.product.position === Number(input.item)) ??
        null)
      : null;
  const shown = focus ? [focus] : model.rows;
  return {
    t,
    state: "draft",
    title: number
      ? t("reqBatch.titleNumbered", { number, n: products.length })
      : t("reqDraft.title", { n: products.length }),
    customerName: details.customerName ?? t("requestDraft.noCustomer"),
    date: formatDate(draft.createdAt, t),
    status: (
      <span
        className="inline-flex flex-wrap items-center gap-2"
        data-draft-status=""
      >
        <Badge tone="neutral">{t("requestDraft.status")}</Badge>
        <span className="text-sm text-zinc-700" data-request-next="draft">
          {t("reqList.col.next")}:{" "}
          <span className="font-medium text-zinc-900">
            {t("reqList.draft.next")}
          </span>
          {/* Quem age: quem salvou o rascunho (só ele o vê). */}
          <ResponsibleTip
            r={draftResponsible(user, isAdmin(user))}
            t={t}
            className="ml-1.5 inline-block max-w-full align-baseline"
          />
        </span>
      </span>
    ),
    actions: (
      <>
        {/* Continuar edição: o formulário da tela de onde o rascunho veio,
            com tudo o que foi salvo (o envio é só por lá). */}
        {details.canResume ? (
          <LinkButton
            href={details.resumeHref}
            variant="primary"
            data-draft-resume=""
          >
            {t("reqDraft.resume")}
          </LinkButton>
        ) : null}
        <ListReturnLink list="requests" data-details-back="">
          {t("reqDelete.backToList")}
        </ListReturnLink>
      </>
    ),
    notices: (
      <div className="mb-3" data-draft-private="">
        <Alert tone="info">
          {t("reqDraft.notice")}{" "}
          <span className="whitespace-nowrap text-zinc-600">
            (
            {t("requestDraft.updated", {
              date: formatDate(draft.updatedAt, t),
            })}
            )
          </span>
        </Alert>
      </div>
    ),
    focus: focus ? (
      <DraftItemCard
        t={t}
        row={focus}
        total={products.length}
        base={input.base}
        wellmix={wellmix}
        catalogHref={
          focus.product.productId && canOpen(user, "products")
            ? `/app/products/${encodeURIComponent(focus.product.productId)}`
            : null
        }
      />
    ) : null,
    hint: t("reqDraft.pageHint"),
    products: model.distinctProducts,
    rounds: model.rounds,
    totals: model.totals,
    wellmix,
    seeSale,
    empty: t("reqDraft.noProducts"),
    items: shown.map(({ product: p, packing, line }): DetailsProduct => {
      const catalog = p.productId
        ? (catalogById.get(p.productId) ?? null)
        : null;
      return {
        key: `p${p.position}`,
        itemId: `draft-${p.position}`,
        name: nameOf(p),
        href: `${input.base}?item=${p.position}`,
        openLabel: t("reqDraft.openProduct"),
        sku: catalog?.sku ?? null,
        variantName: p.variant?.name ?? null,
        photos: catalog ? productPhotoList(catalog, photos) : [],
        packing,
        line,
        quantity: draftPieces(p),
        unit: p.unit,
        // A previsão de venda é gravada no envio.
        forecast: null,
        noPriceHint: t("reqDraft.priceHint"),
        rounds: Math.max(1, p.schedule?.items.length ?? 0),
        status: (
          <span className="flex flex-wrap gap-1">
            <Badge tone="neutral">{t("requestDraft.status")}</Badge>
            {p.incomplete ? (
              <span
                title={t("reqBatch.incompleteHint")}
                data-draft-incomplete=""
              >
                <Badge tone="warning">{t("reqBatch.incomplete")}</Badge>
              </span>
            ) : null}
          </span>
        ),
        deadline: (
          <span
            className="text-zinc-400"
            title={t("reqDraft.noDeadline")}
            data-draft-deadline=""
          >
            —
          </span>
        ),
        order: (
          <span className="text-zinc-400" title={t("reqDraft.noOrder")}>
            —
          </span>
        ),
        // A conversa do rascunho com o cliente (uma para o rascunho todo;
        // passa para a solicitação no envio).
        actions: (
          <ChatOpenButton
            target={{ draftId: draft.id }}
            label={`${t("chat.openDraft")}: ${nameOf(p)}`}
          />
        ),
      };
    }),
  };
}

const fmt = (t: Translate, n: number, digits = 0) =>
  n.toLocaleString(t.intl, { maximumFractionDigits: digits });

/** Um produto do rascunho aberto: o que foi salvo nele e a embalagem. */
function DraftItemCard({
  t,
  row,
  total,
  base,
  wellmix,
  catalogHref,
}: {
  t: Translate;
  row: DraftPackedProduct;
  total: number;
  base: string;
  wellmix: boolean;
  catalogHref: string | null;
}) {
  const { product: p, packing: pk, line } = row;
  const dash = <span className="text-zinc-400">—</span>;
  /* De onde veio cada número (a mesma ideia dos selos da ficha completa):
     o que o rascunho salvou, a variação, a negociação, o Book, a ficha atual
     do produto ou a conta. */
  const sourceText = (kind: PackingSourceKind) =>
    kind === "request"
      ? t("requestDraft.status")
      : kind === "variant"
        ? t("reqBatch.colVariant")
        : kind === "negotiation" || kind === "book"
          ? t(`reqDraft.src.${kind}`)
          : kind === "order"
            ? null
            : t(`requestSheet.src.${kind}` as DictionaryKey);
  const source = (kind: PackingSourceKind | null | undefined) => {
    const text = kind ? sourceText(kind) : null;
    return text ? (
      <span className="block text-[11px] font-normal text-zinc-500">
        {text}
      </span>
    ) : null;
  };
  const dims = pk?.boxDims?.value.values
    .map((v) => `${fmt(t, v.value, 2)}${v.unit ? ` ${v.unit}` : ""}`)
    .join(" × ");
  const fields: Array<{ key: string; label: string; value: ReactNode }> = [
    {
      key: "description",
      label: t("reqDraft.field.description"),
      value: p.description || dash,
    },
    {
      key: "specification",
      label: t("reqDraft.field.specification"),
      value: p.specification ? (
        <span className="whitespace-pre-line">{p.specification}</span>
      ) : (
        dash
      ),
    },
    {
      key: "quantity",
      label: t("reqDraft.field.quantity"),
      value: p.quantity !== null ? `${fmt(t, p.quantity, 2)} ${p.unit}` : dash,
    },
    {
      key: "pieces",
      label: t("reqDraft.field.pieces"),
      value:
        line.pieces !== null ? (
          <>
            {fmt(t, line.pieces, 2)}
            {source(pk?.pieces?.kind)}
          </>
        ) : (
          dash
        ),
    },
    {
      key: "perBox",
      label: t("reqDraft.field.perBox"),
      value: pk?.perBox ? (
        <>
          {fmt(t, pk.perBox.value)}
          {source(pk.perBox.kind)}
        </>
      ) : (
        dash
      ),
    },
    {
      key: "boxes",
      label: t("reqDraft.field.boxes"),
      value: line.boxes !== null ? fmt(t, line.boxes) : dash,
    },
    {
      key: "inner",
      label: t("reqDraft.field.inner"),
      value: pk?.inner ? (
        <>
          {fmt(t, pk.inner.value)}
          {source(pk.inner.kind)}
        </>
      ) : (
        dash
      ),
    },
    {
      key: "innerBoxes",
      label: t("reqDraft.field.innerBoxes"),
      value: line.innerBoxes !== null ? fmt(t, line.innerBoxes) : dash,
    },
    {
      key: "boxDims",
      label: t("reqDraft.field.boxDims"),
      value: dims ? (
        <>
          {dims}
          {source(pk?.boxDims?.kind)}
        </>
      ) : (
        dash
      ),
    },
    {
      key: "cbmPerBox",
      label: t("reqDraft.field.cbmPerBox"),
      value: pk?.cbmPerBox ? (
        <>
          {fmt(t, pk.cbmPerBox.value, 7)}
          {source(pk.cbmPerBox.kind)}
        </>
      ) : (
        dash
      ),
    },
    {
      key: "cbm",
      label: t("reqDraft.field.cbm"),
      value:
        line.cbm !== null
          ? line.cbm.toLocaleString(t.intl, {
              minimumFractionDigits: 3,
              maximumFractionDigits: 3,
            })
          : dash,
    },
    ...(wellmix
      ? [
          {
            key: "moq",
            label: t("reqDraft.field.moq"),
            value: line.moq !== null ? fmt(t, line.moq) : dash,
          },
        ]
      : []),
  ];
  return (
    <div className="mb-3" data-draft-item-focus={p.position}>
      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            {t("reqDraft.item.title", { n: p.position })}
            {p.incomplete ? (
              <Badge tone="warning">{t("reqBatch.incomplete")}</Badge>
            ) : null}
          </span>
        }
        actions={
          <TextLink href={base} data-draft-item-all="">
            {t("reqDraft.item.all", { n: total })}
          </TextLink>
        }
      >
        <p className="text-base font-semibold text-zinc-900">
          {productNameText(t, p.productName)}
          {p.outside ? (
            <span className="ml-2 align-middle">
              <Badge tone="info">{t("reqDraft.item.outside")}</Badge>
            </span>
          ) : null}
        </p>
        {catalogHref ? (
          <p className="mt-0.5 text-sm">
            <TextLink href={catalogHref} data-draft-item-catalog="">
              {t("reqDraft.item.openCatalog")}
            </TextLink>
          </p>
        ) : null}
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((f) => (
            <div key={f.key} className="min-w-0" data-draft-item-field={f.key}>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                {f.label}
              </dt>
              <dd className="mt-0.5 break-words text-sm text-zinc-900">
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
        <RequestScheduleTable
          schedule={p.schedule}
          unit={p.unit}
          t={t}
          typed={p.scheduleTyped}
        />
        <RequestCompanyAllocations
          request={{ companyAllocations: p.companyAllocations }}
          t={t}
        />
      </Card>
    </div>
  );
}
