import "server-only";

import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  getStore,
  PACKAGING_ITEM_KEYS,
  type Document,
  type Order,
  type PackagingBrief,
  type PackagingBriefStatus,
  type PackagingDims,
  type PackagingItemKey,
  type PackagingOwnerSource,
  type Product,
  type ProductPhoto,
  type Quote,
  type Request,
  type Requirement,
  type Stage,
  type User,
} from "@/lib/db";
import {
  ForbiddenError,
  assertWellmix,
  isWellmix,
} from "@/lib/auth/permissions";
import { getSettings, type Settings } from "@/lib/settings";
import { audit } from "./audit";
import {
  catalogShowcasePhotos,
  registerUploadedDocument,
  registerUploadedPhoto,
  uploadDocument,
} from "./documents";
import { notify, notifyWellmix, type NotifyTarget } from "./notifications";
import { getProductSheet } from "./product-sheet";
import { getQuoteSheet } from "./quote-sheet";
import {
  ITEM_COLUMN,
  ITEM_DOCUMENT_TYPE,
  missingPackagingItems,
  normalizeRequiredKeys,
  packagingDimsChanged,
  packagingDimsFor,
} from "./packaging-brief-calc";

/*
 * Briefing de embalagem: quando a Wellmix abre a RFQ, além dos fornecedores
 * receberem a cotação, a agência (ou o marketing da Wellmix) recebe na mesma
 * hora a pendência de preparar a faca (die-cut), a arte, os arquivos para a
 * gráfica e a foto da embalagem física. A agência não vê preço, cotações nem
 * fornecedores concorrentes; os arquivos só chegam ao fornecedor escolhido,
 * depois que o pedido nasce, quando a arte já enviada conclui o item "Arte"
 * da etapa Arte e embalagem e ele só aprova.
 */

export class PackagingBriefError extends Error {}

const LIVE: PackagingBriefStatus[] = ["open", "ready", "transferred"];
const BEFORE_ORDER: PackagingBriefStatus[] = ["open", "ready"];
const WELLMIX_TARGET: NotifyTarget = { role: ["admin", "operator"] };

/** Tabela ou coluna ainda não publicada no Appwrite: o fluxo segue sem o briefing. */
export function isSchemaMissing(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    /unknown attribute/i.test(error.message) ||
    /^(table|collection) with the requested id\b.*could not be found/i.test(
      error.message,
    ) ||
    ["table_not_found", "collection_not_found"].includes(
      String((error as { type?: unknown }).type ?? ""),
    )
  );
}

export function canViewPackagingBrief(
  user: Pick<User, "role" | "partyId">,
  brief: Pick<PackagingBrief, "agencyId">,
): boolean {
  if (isWellmix(user)) return true;
  return (
    user.role === "agency" && !!user.partyId && brief.agencyId === user.partyId
  );
}

/** Dono (agência) ou Wellmix editam; mais ninguém. */
export const canEditPackagingBrief = canViewPackagingBrief;

const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

const ownerTarget = (brief: Pick<PackagingBrief, "agencyId">): NotifyTarget =>
  brief.agencyId ? { role: "agency", partyId: brief.agencyId } : WELLMIX_TARGET;

const refOf = (t: Translate, request: Pick<Request, "number">) =>
  request.number ? t("notif.ref", { number: request.number }) : "";

export const itemLabel = (t: Translate, key: PackagingItemKey) =>
  t(`packBrief.item.${key}` as DictionaryKey);

/** Briefing da solicitação (o vivo; senão o cancelado); nulo sem briefing ou sem a tabela publicada. */
export async function briefForRequest(
  requestId: string,
): Promise<PackagingBrief | null> {
  try {
    const rows = await getStore().list("packaging_briefs", {
      filter: { requestId },
    });
    return rows.find((b) => LIVE.includes(b.status)) ?? rows[0] ?? null;
  } catch (error) {
    if (isSchemaMissing(error)) return null;
    throw error;
  }
}

/** Briefing ligado a um pedido (depois da transferência). */
export async function briefForOrder(
  orderId: string,
): Promise<PackagingBrief | null> {
  try {
    const [row] = await getStore().list("packaging_briefs", {
      filter: { orderId },
      limit: 1,
    });
    return row ?? null;
  } catch (error) {
    if (isSchemaMissing(error)) return null;
    throw error;
  }
}

/** Briefings de várias solicitações (listas), sem derrubar a tela antes do esquema publicado. */
export async function briefsByRequest(
  requestIds: string[],
): Promise<Map<string, PackagingBrief>> {
  const map = new Map<string, PackagingBrief>();
  if (!requestIds.length) return map;
  try {
    const rows = await getStore().list("packaging_briefs", {
      filter: { requestId: requestIds },
    });
    for (const row of rows) {
      const current = map.get(row.requestId);
      if (!current || (!LIVE.includes(current.status) && LIVE.includes(row.status)))
        map.set(row.requestId, row);
    }
  } catch (error) {
    if (!isSchemaMissing(error)) throw error;
  }
  return map;
}

/* ------------------------------------------------------------------------ */
/* Dono                                                                      */
/* ------------------------------------------------------------------------ */

export interface PackagingOwner {
  agencyId: string | null;
  ownerSource: PackagingOwnerSource;
}

/**
 * Quem faz a embalagem: a agência escolhida na RFQ; senão a agência padrão
 * das configurações; senão a única agência ativa; senão o marketing da
 * Wellmix. Com "Arte da embalagem feita pela agência" desligado, sempre a
 * Wellmix. `explicit === null` = a Wellmix escolheu fazer ela mesma.
 */
export async function resolvePackagingOwner(
  settings: Pick<
    Settings,
    "agencyValidationEnabled" | "packagingDefaultAgencyId"
  >,
  explicit?: string | null,
): Promise<PackagingOwner> {
  if (!settings.agencyValidationEnabled)
    return { agencyId: null, ownerSource: "wellmix" };
  const agencies = await getStore().list("parties", {
    filter: { type: "agency", active: true },
  });
  if (explicit !== undefined) {
    if (explicit === null) return { agencyId: null, ownerSource: "chosen" };
    if (!agencies.some((a) => a.id === explicit))
      throw new PackagingBriefError("no_agency");
    return { agencyId: explicit, ownerSource: "chosen" };
  }
  const preset = settings.packagingDefaultAgencyId;
  if (preset && agencies.some((a) => a.id === preset))
    return { agencyId: preset, ownerSource: "settings_default" };
  if (agencies.length === 1)
    return { agencyId: agencies[0].id, ownerSource: "only_active" };
  return { agencyId: null, ownerSource: "wellmix" };
}

/** Agência escolhida no formulário existe e está ativa (antes de abrir a RFQ). */
export async function assertPackagingAgency(agencyId: string) {
  const party = await getStore().get("parties", agencyId);
  if (!party || party.type !== "agency" || !party.active)
    throw new PackagingBriefError("no_agency");
}

/* ------------------------------------------------------------------------ */
/* Abrir, designar, cancelar                                                 */
/* ------------------------------------------------------------------------ */

export interface OpenBriefOptions {
  /** Agência escolhida; `null` = marketing Wellmix; ausente = cadeia padrão. */
  agencyId?: string | null;
  brief?: string | null;
  notify?: boolean;
  /** RFQ do lote: recebe os briefings criados para um aviso agrupado por agência. */
  collect?: PackagingBrief[];
}

/** Abre o briefing da solicitação (idempotente: um vivo por solicitação). */
export async function openPackagingBrief(
  user: User,
  request: Request,
  options: OpenBriefOptions = {},
): Promise<PackagingBrief> {
  assertWellmix(user);
  const store = getStore();
  const existing = await briefForRequest(request.id);
  if (existing && LIVE.includes(existing.status)) return existing;
  const settings = await getSettings();
  const owner = await resolvePackagingOwner(settings, options.agencyId);
  const master = request.productId
    ? await getProductSheet(request.productId)
    : null;
  const dims = packagingDimsFor(master);
  const brief = await store.create("packaging_briefs", {
    requestId: request.id,
    productId: request.productId,
    customerId: request.customerId,
    agencyId: owner.agencyId,
    ownerSource: owner.ownerSource,
    status: "open",
    requiredKeys: normalizeRequiredKeys(settings.packagingBriefRequired),
    dielineDocumentId: null,
    artDocumentId: null,
    printReadyDocumentId: null,
    sampleDocumentId: null,
    dims,
    dimsSource: dims ? "master" : null,
    dimsQuoteId: null,
    dimsProvisional: false,
    dimsChangedAt: null,
    brief: options.brief?.trim() || null,
    agencyNotes: null,
    dueAt: request.deadline ?? addDays(settings.packagingBriefDueDays),
    readyAt: null,
    orderId: null,
    orderArtRequirementId: null,
    transferredAt: null,
    cancelledAt: null,
    cancelReason: null,
    reminderSentAt: null,
    createdByUserId: user.id,
    updatedByUserId: null,
  });
  await audit(
    user,
    "packaging_brief.open",
    "packaging_brief",
    brief.id,
    `Embalagem da solicitação${request.number ? ` nº ${request.number}` : ""}: ${owner.agencyId ? `agência ${owner.agencyId}` : "marketing Wellmix"} (${owner.ownerSource})`,
  );
  options.collect?.push(brief);
  if (options.notify !== false) await notifyBriefsOpened([brief], [request]);
  // Sem medidas da caixa no cadastro: a Wellmix completa a ficha ou aguarda a cotação.
  if (!dims && owner.agencyId)
    await notifyWellmix({
      kind: "info",
      actor: "wellmix",
      link: `/app/packaging/${brief.id}`,
      text: (t) => ({
        subject: t("notif.packBrief.noDims.subject", {
          product: request.productName,
        }),
        body: t("notif.packBrief.noDims.body"),
      }),
    });
  return brief;
}

/**
 * Abertura junto com a RFQ: a RFQ nunca falha por causa do briefing. Só a
 * agência inválida escolhida no formulário (erro de validação) sobe.
 */
export async function openPackagingBriefSafe(
  user: User,
  request: Request,
  options: OpenBriefOptions = {},
): Promise<PackagingBrief | null> {
  try {
    return await openPackagingBrief(user, request, options);
  } catch (error) {
    if (error instanceof PackagingBriefError) throw error;
    if (isSchemaMissing(error))
      console.warn(
        "[packaging-brief] esquema não publicado: RFQ aberta sem briefing",
        request.id,
      );
    else console.error("[packaging-brief] briefing não aberto", error);
    return null;
  }
}

/**
 * Aviso "sua vez" ao dono: um por agência (ou um à Wellmix), com a lista dos
 * produtos quando são vários (RFQ do lote).
 */
export async function notifyBriefsOpened(
  briefs: PackagingBrief[],
  requests: Request[],
) {
  const byOwner = new Map<string, PackagingBrief[]>();
  for (const b of briefs) {
    const key = b.agencyId ?? "";
    byOwner.set(key, [...(byOwner.get(key) ?? []), b]);
  }
  for (const [agencyId, group] of byOwner) {
    const items = group
      .map((b) => ({ brief: b, request: requests.find((r) => r.id === b.requestId) }))
      .filter((x): x is { brief: PackagingBrief; request: Request } => !!x.request);
    if (!items.length) continue;
    const number = items.find((x) => x.request.number)?.request.number;
    await notify(
      agencyId ? { role: "agency", partyId: agencyId } : WELLMIX_TARGET,
      {
        kind: "action",
        link:
          items.length === 1
            ? `/app/packaging/${items[0].brief.id}`
            : "/app/packaging",
        text: (t) => {
          const ref = number ? t("notif.ref", { number }) : "";
          if (items.length === 1) {
            const { brief, request } = items[0];
            const due = brief.dueAt
              ? t("notif.packBrief.due", {
                  date: new Date(brief.dueAt).toLocaleDateString(t.intl),
                })
              : "";
            return agencyId
              ? {
                  subject: t("notif.packBrief.subject", {
                    product: request.productName,
                    ref,
                  }),
                  body: t("notif.packBrief.body", {
                    qty: request.quantity.toLocaleString(t.intl),
                    unit: request.unit,
                    due,
                  }),
                }
              : {
                  subject: t("notif.packBrief.wellmix.subject", {
                    product: request.productName,
                    ref,
                  }),
                  body: t("notif.packBrief.wellmix.body", {
                    qty: request.quantity.toLocaleString(t.intl),
                    unit: request.unit,
                    due,
                  }),
                };
          }
          return {
            subject: t("notif.packBrief.many.subject", {
              count: items.length,
              ref,
            }),
            body: t("notif.packBrief.many.body", {
              items: items
                .map(
                  ({ request }) =>
                    `${request.productName}: ${request.quantity.toLocaleString(t.intl)} ${request.unit}`,
                )
                .join("; "),
            }),
          };
        },
      },
    );
  }
}

/** Wellmix troca o dono (arquivos ficam); os dois lados são avisados. */
export async function assignPackagingBrief(
  user: User,
  briefId: string,
  agencyId: string | null,
): Promise<PackagingBrief> {
  assertWellmix(user);
  const store = getStore();
  const brief = await store.get("packaging_briefs", briefId);
  if (!brief) throw new PackagingBriefError("not_found");
  if (!LIVE.includes(brief.status)) throw new PackagingBriefError("brief_closed");
  if (brief.agencyId === agencyId) return brief;
  const settings = await getSettings();
  const owner = await resolvePackagingOwner(settings, agencyId);
  const request = await store.get("requests", brief.requestId);
  const updated = await store.update("packaging_briefs", briefId, {
    agencyId: owner.agencyId,
    ownerSource: owner.ownerSource,
    updatedByUserId: user.id,
  });
  // Pedido já criado: a agência do pedido acompanha (a arte pendente vai com ela).
  if (brief.orderId) {
    const order = await store.get("orders", brief.orderId);
    if (order && order.agencyId !== owner.agencyId) {
      await store.update("orders", order.id, { agencyId: owner.agencyId });
      const [pack] = await store.list("stages", {
        filter: { orderId: order.id, key: "PACKAGING" },
      });
      if (pack) {
        const { normalizePackagingStage } = await import("./packaging");
        await normalizePackagingStage(pack.id, { reassign: true });
      }
    }
  }
  await audit(
    user,
    "packaging_brief.assign",
    "packaging_brief",
    briefId,
    `Dono: ${brief.agencyId ?? "Wellmix"} → ${owner.agencyId ?? "Wellmix"}`,
  );
  if (request) {
    await notifyBriefsOpened([updated], [request]);
    if (brief.agencyId)
      await notify(
        { role: "agency", partyId: brief.agencyId },
        {
          kind: "alert",
          actor: null,
          link: "/app/packaging",
          text: (t) => ({
            subject: t("notif.packBrief.reassigned.subject", {
              product: request.productName,
            }),
            body: t("notif.packBrief.reassigned.body"),
          }),
        },
      );
  }
  return updated;
}

/** Pedido: a Wellmix trocou a agência no próprio pedido; o briefing acompanha. */
export async function syncBriefAgencyFromOrder(
  orderId: string,
  agencyId: string | null,
) {
  const brief = await briefForOrder(orderId);
  if (!brief || brief.agencyId === agencyId || !LIVE.includes(brief.status))
    return;
  await getStore().update("packaging_briefs", brief.id, {
    agencyId,
    ownerSource: "chosen",
  });
}

/** Solicitação excluída (ou Wellmix cancelou): a agência é avisada para parar. */
export async function cancelPackagingBriefForRequest(
  user: User | null,
  requestId: string,
  reason: "request_deleted" | "wellmix",
): Promise<PackagingBrief | null> {
  const brief = await briefForRequest(requestId);
  if (!brief || !BEFORE_ORDER.includes(brief.status)) return null;
  const store = getStore();
  const updated = await store.update("packaging_briefs", brief.id, {
    status: "cancelled",
    cancelledAt: new Date().toISOString(),
    cancelReason: reason,
    updatedByUserId: user?.id ?? null,
  });
  await audit(
    user,
    "packaging_brief.cancel",
    "packaging_brief",
    brief.id,
    `Embalagem cancelada (${reason})`,
  );
  const request = await store.get("requests", requestId);
  if (brief.agencyId && request)
    await notify(
      { role: "agency", partyId: brief.agencyId },
      {
        kind: "alert",
        actor: null,
        link: `/app/packaging/${brief.id}`,
        text: (t) => ({
          subject: t("notif.packBrief.cancelled.subject", {
            product: request.productName,
          }),
          body: t("notif.packBrief.cancelled.body"),
        }),
      },
    );
  return updated;
}

export async function cancelPackagingBrief(user: User, briefId: string) {
  assertWellmix(user);
  const brief = await getStore().get("packaging_briefs", briefId);
  if (!brief) throw new PackagingBriefError("not_found");
  if (!BEFORE_ORDER.includes(brief.status))
    throw new PackagingBriefError("brief_closed");
  return cancelPackagingBriefForRequest(user, brief.requestId, "wellmix");
}

/* ------------------------------------------------------------------------ */
/* Medidas                                                                   */
/* ------------------------------------------------------------------------ */

const dimsText = (t: Translate, dims: PackagingDims) =>
  t("notif.packBrief.dims.body", {
    l: String(dims.lengthCm ?? "?"),
    w: String(dims.widthCm ?? "?"),
    h: String(dims.heightCm ?? "?"),
    perCarton: dims.masterCartonQty?.toLocaleString(t.intl) ?? "?",
  });

/**
 * Medidas vindas de uma ficha de cotação: a primeira preenche o briefing
 * sem medidas (provisórias); a da cotação escolhida vale como definitiva e,
 * se mudou além da tolerância, a agência é alertada e um briefing pronto
 * volta a "em preparação" (os arquivos ficam).
 */
export async function refreshPackagingDims(
  user: User | null,
  brief: PackagingBrief,
  quoteId: string,
  options: { provisional: boolean },
): Promise<"set" | "changed" | "kept" | "none"> {
  if (!LIVE.includes(brief.status)) return "none";
  const next = packagingDimsFor(await getQuoteSheet(quoteId));
  if (!next) return "none";
  const store = getStore();
  const request = await store.get("requests", brief.requestId);
  const product = request?.productName ?? "";
  if (!brief.dims) {
    await store.update("packaging_briefs", brief.id, {
      dims: next,
      dimsSource: "quote",
      dimsQuoteId: quoteId,
      dimsProvisional: options.provisional,
    });
    if (brief.agencyId)
      await notify(ownerTarget(brief), {
        kind: "info",
        actor: "recipient",
        link: `/app/packaging/${brief.id}`,
        text: (t) => ({
          subject: t(
            options.provisional
              ? "notif.packBrief.dimsProvisional.subject"
              : "notif.packBrief.dimsConfirmed.subject",
            { product },
          ),
          body: dimsText(t, next),
        }),
      });
    return "set";
  }
  if (options.provisional) return "kept";
  const settings = await getSettings();
  const changed = packagingDimsChanged(
    brief.dims,
    next,
    settings.dimensionTolerancePercent,
  );
  const now = new Date().toISOString();
  await store.update("packaging_briefs", brief.id, {
    dims: next,
    dimsSource: "quote",
    dimsQuoteId: quoteId,
    dimsProvisional: false,
    ...(changed
      ? {
          dimsChangedAt: now,
          ...(brief.status === "ready"
            ? { status: "open" as const, readyAt: null }
            : {}),
        }
      : {}),
  });
  if (!changed) return "kept";
  await audit(
    user,
    "packaging_brief.dims_changed",
    "packaging_brief",
    brief.id,
    `Medidas da cotação escolhida diferem das usadas na faca`,
    brief.dims,
    next,
  );
  await notify(ownerTarget(brief), {
    kind: "alert",
    actor: "recipient",
    link: `/app/packaging/${brief.id}`,
    text: (t) => ({
      subject: t("notif.packBrief.dimsChanged.subject", { product }),
      body: dimsText(t, next),
    }),
  });
  return "changed";
}

/** Ficha de cotação salva: um briefing sem medidas ganha as provisórias. */
export async function packagingSheetSaved(
  user: User | null,
  requestId: string,
  quoteId: string,
) {
  const brief = await briefForRequest(requestId);
  if (!brief || brief.dims || !LIVE.includes(brief.status)) return;
  await refreshPackagingDims(user, brief, quoteId, { provisional: true });
}

/**
 * Fornecedor escolhido: as medidas da cotação dele passam a valer e a
 * agência fica sabendo quem fabrica (sem preço).
 */
export async function packagingSupplierSelected(
  user: User,
  request: Request,
  quote: Quote,
) {
  const brief = await briefForRequest(request.id);
  if (!brief || !LIVE.includes(brief.status)) return;
  const result = await refreshPackagingDims(user, brief, quote.id, {
    provisional: false,
  });
  if (!brief.agencyId || result === "changed") return;
  const supplier = await getStore().get("parties", quote.supplierId);
  await notify(ownerTarget(brief), {
    kind: "info",
    actor: "recipient",
    link: `/app/packaging/${brief.id}`,
    text: (t) => ({
      subject: t("notif.packBrief.supplier.subject", {
        product: request.productName,
      }),
      body: t("notif.packBrief.supplier.body", {
        supplier: supplier?.name ?? "—",
      }),
    }),
  });
}

/** Wellmix informa as medidas à mão (sem ficha ou corrigindo). */
export async function savePackagingDims(
  user: User,
  briefId: string,
  input: Pick<
    PackagingDims,
    "lengthCm" | "widthCm" | "heightCm" | "masterCartonQty" | "innerQty"
  >,
) {
  assertWellmix(user);
  const store = getStore();
  const brief = await store.get("packaging_briefs", briefId);
  if (!brief) throw new PackagingBriefError("not_found");
  if (!LIVE.includes(brief.status)) throw new PackagingBriefError("brief_closed");
  if (!(input.lengthCm && input.widthCm && input.heightCm))
    throw new PackagingBriefError("invalid_dims");
  const next: PackagingDims = {
    ...(brief.dims ?? {
      cbmPerCarton: null,
      packageType: null,
      material: null,
      colorPantones: null,
      capacityMl: null,
    }),
    ...input,
  };
  const changed = packagingDimsChanged(brief.dims, next, 0);
  await store.update("packaging_briefs", briefId, {
    dims: next,
    dimsSource: "manual",
    dimsQuoteId: null,
    dimsProvisional: false,
    updatedByUserId: user.id,
    ...(changed && brief.dims ? { dimsChangedAt: new Date().toISOString() } : {}),
  });
  await audit(user, "packaging_brief.dims", "packaging_brief", briefId, "Medidas informadas à mão", brief.dims, next);
  if (changed && brief.agencyId) {
    const request = await store.get("requests", brief.requestId);
    await notify(ownerTarget(brief), {
      kind: "alert",
      actor: "recipient",
      link: `/app/packaging/${briefId}`,
      text: (t) => ({
        subject: t(
          brief.dims
            ? "notif.packBrief.dimsChanged.subject"
            : "notif.packBrief.dimsConfirmed.subject",
          { product: request?.productName ?? "" },
        ),
        body: dimsText(t, next),
      }),
    });
  }
}

/* ------------------------------------------------------------------------ */
/* Textos                                                                    */
/* ------------------------------------------------------------------------ */

export async function savePackagingBriefText(
  user: User,
  briefId: string,
  text: string | null,
) {
  assertWellmix(user);
  const store = getStore();
  const brief = await store.get("packaging_briefs", briefId);
  if (!brief) throw new PackagingBriefError("not_found");
  if (!LIVE.includes(brief.status)) throw new PackagingBriefError("brief_closed");
  const value = text?.trim() || null;
  if (value === brief.brief) return brief;
  const updated = await store.update("packaging_briefs", briefId, {
    brief: value,
    updatedByUserId: user.id,
  });
  if (value && brief.agencyId) {
    const request = await store.get("requests", brief.requestId);
    await notify(ownerTarget(brief), {
      kind: "info",
      actor: "recipient",
      link: `/app/packaging/${briefId}`,
      text: (t) => ({
        subject: t("notif.packBrief.instructions.subject", {
          product: request?.productName ?? "",
        }),
        body: value.slice(0, 300),
      }),
    });
  }
  return updated;
}

export async function saveAgencyNotes(
  user: User,
  briefId: string,
  notes: string | null,
) {
  const store = getStore();
  const brief = await store.get("packaging_briefs", briefId);
  if (!brief) throw new PackagingBriefError("not_found");
  if (!canEditPackagingBrief(user, brief)) throw new ForbiddenError();
  if (!LIVE.includes(brief.status)) throw new PackagingBriefError("brief_closed");
  return store.update("packaging_briefs", briefId, {
    agencyNotes: notes?.trim() || null,
    updatedByUserId: user.id,
  });
}

/* ------------------------------------------------------------------------ */
/* Entregáveis                                                               */
/* ------------------------------------------------------------------------ */

export type PackagingUploadSource =
  | File
  | { fileKey: string; photo?: boolean };

async function packagingStage(orderId: string | null): Promise<Stage | null> {
  if (!orderId) return null;
  const [stage] = await getStore().list("stages", {
    filter: { orderId, key: "PACKAGING" },
  });
  return stage ?? null;
}

const stageOpen = (stage: Stage | null) =>
  !!stage && (stage.status === "active" || stage.status === "blocked");

/**
 * Agência (ou Wellmix) envia um entregável. Cada reenvio vira nova versão.
 * Arte depois do pedido criado: com a etapa Arte e embalagem aberta, segue o
 * caminho do requisito (reabre a aprovação do fornecedor, avisa); com a etapa
 * ainda por vir, o item "Arte" já fica concluído para o fornecedor só aprovar.
 */
export async function uploadPackagingItem(
  user: User,
  briefId: string,
  key: PackagingItemKey,
  source: PackagingUploadSource,
  note: string | null = null,
): Promise<{ brief: PackagingBrief; document: Document }> {
  const store = getStore();
  const brief = await store.get("packaging_briefs", briefId);
  if (!brief) throw new PackagingBriefError("not_found");
  if (!canEditPackagingBrief(user, brief)) throw new ForbiddenError();
  if (!LIVE.includes(brief.status)) throw new PackagingBriefError("brief_closed");
  if (!PACKAGING_ITEM_KEYS.includes(key))
    throw new PackagingBriefError("invalid_kind");
  const stage = key === "art" ? await packagingStage(brief.orderId) : null;
  const artRequirementId =
    key === "art" && brief.orderId ? brief.orderArtRequirementId : null;
  const input = {
    requestId: brief.requestId,
    orderId: brief.orderId,
    packagingBriefId: brief.id,
    requirementId: artRequirementId,
    type: ITEM_DOCUMENT_TYPE[key],
    // Antes do pedido ninguém de fora abre (chave: packagingBriefId); depois, o fornecedor do pedido.
    visibility: "supplier" as const,
  };
  const document =
    source instanceof File
      ? await uploadDocument(user, source, input)
      : source.photo
        ? await registerUploadedPhoto(user, source.fileKey, input)
        : await registerUploadedDocument(user, source.fileKey, input);

  if (artRequirementId) {
    if (stageOpen(stage)) {
      // Etapa aberta: o mesmo caminho do reenvio no pedido (aprovação volta a pendente, fornecedor avisado).
      const { submitRequirement } = await import("@/lib/workflow/engine");
      await submitRequirement(user, artRequirementId, {
        documentId: document.id,
        note,
      });
    } else {
      await store.update("requirements", artRequirementId, {
        status: "done",
        documentId: document.id,
        submittedByUserId: user.id,
        submittedAt: new Date().toISOString(),
        note,
      });
    }
  }
  const patch: Partial<PackagingBrief> = {
    [ITEM_COLUMN[key]]: document.id,
    updatedByUserId: user.id,
  };
  const after = { ...brief, ...patch } as PackagingBrief;
  const missing = missingPackagingItems(after);
  const becameReady = brief.status === "open" && missing.length === 0;
  if (becameReady) {
    patch.status = "ready";
    patch.readyAt = new Date().toISOString();
  }
  const updated = await store.update("packaging_briefs", briefId, patch);
  await audit(
    user,
    "packaging_brief.upload",
    "packaging_brief",
    briefId,
    `${key}: ${document.name} v${document.version}`,
  );
  const request = await store.get("requests", brief.requestId);
  const product = request?.productName ?? "";
  const agency = brief.agencyId
    ? await store.get("parties", brief.agencyId)
    : null;
  const who = agency?.name ?? user.name;
  // A Wellmix fica sabendo quando a agência conclui os obrigatórios (ou envia
  // um item depois disso); o que a própria equipe envia não gera aviso.
  if (brief.agencyId) {
    if (becameReady)
      await notifyWellmix({
        kind: "done",
        actor: "agency",
        link: `/app/requests/${brief.requestId}`,
        text: (t) => ({
          subject: t("notif.packBrief.ready.subject", { product }),
          body: t("notif.packBrief.ready.body", { who }),
        }),
      });
    else if (brief.status !== "open")
      await notifyWellmix({
        kind: "info",
        actor: "agency",
        link: `/app/requests/${brief.requestId}`,
        text: (t) => ({
          subject: t("notif.packBrief.item.subject", {
            item: itemLabel(t, key),
            product,
          }),
          body: t("notif.packBrief.item.body", { who }),
        }),
      });
  }
  return { brief: updated, document };
}

/** Exclui a versão vigente de um entregável (para enviar outro). */
export async function clearPackagingItem(
  user: User,
  briefId: string,
  key: PackagingItemKey,
): Promise<PackagingBrief> {
  const store = getStore();
  const brief = await store.get("packaging_briefs", briefId);
  if (!brief) throw new PackagingBriefError("not_found");
  if (!canEditPackagingBrief(user, brief)) throw new ForbiddenError();
  if (!LIVE.includes(brief.status)) throw new PackagingBriefError("brief_closed");
  if (!PACKAGING_ITEM_KEYS.includes(key))
    throw new PackagingBriefError("invalid_kind");
  const column = ITEM_COLUMN[key];
  const documentId = brief[column];
  if (key === "art" && brief.orderId && brief.orderArtRequirementId) {
    const stage = await packagingStage(brief.orderId);
    if (stageOpen(stage)) {
      // Etapa aberta: a arte é excluída pelo pedido (volta a aprovação do fornecedor).
      const { clearRequirementDocument } = await import("@/lib/workflow/engine");
      await clearRequirementDocument(user, brief.orderArtRequirementId);
    } else {
      await store.update("requirements", brief.orderArtRequirementId, {
        status: "pending",
        value: null,
        documentId: null,
        submittedByUserId: null,
        submittedAt: null,
      });
      if (documentId) await removeDocument(documentId);
    }
  } else if (documentId) await removeDocument(documentId);
  const patch: Partial<PackagingBrief> = {
    [column]: null,
    updatedByUserId: user.id,
  };
  if (brief.status === "ready" && brief.requiredKeys.includes(key)) {
    patch.status = "open";
    patch.readyAt = null;
  }
  await audit(user, "packaging_brief.clear", "packaging_brief", briefId, key);
  return store.update("packaging_briefs", briefId, patch);
}

async function removeDocument(documentId: string) {
  const store = getStore();
  const doc = await store.get("documents", documentId);
  if (!doc) return;
  await store.remove("documents", doc.id);
  await store.removeFile(doc.storageKey).catch((error) => {
    console.error("[packaging-brief] arquivo não apagado", error);
  });
}

/* ------------------------------------------------------------------------ */
/* Pedido criado                                                             */
/* ------------------------------------------------------------------------ */

/**
 * O pedido nasceu (sinal confirmado): os arquivos do briefing passam ao
 * pedido (visíveis ao fornecedor escolhido), a arte já enviada conclui o item
 * "Arte" da etapa Arte e embalagem (todas as versões entram na cadeia do
 * requisito) e o briefing fica "no pedido". Arte ainda por enviar continua
 * sendo pedida à agência: pelo briefing até a etapa abrir, depois pelo pedido.
 */
export async function transferPackagingBrief(
  user: User,
  request: Request,
  order: Order,
): Promise<PackagingBrief | null> {
  const brief = await briefForRequest(request.id);
  if (!brief || !BEFORE_ORDER.includes(brief.status)) return null;
  const store = getStore();
  const now = new Date().toISOString();
  const stage = await packagingStage(order.id);
  const [artReq] = stage
    ? await store.list("requirements", {
        filter: { stageId: stage.id, key: "art" },
      })
    : [];
  const docs = await store.list("documents", {
    filter: { packagingBriefId: brief.id },
  });
  for (const doc of docs)
    await store.update("documents", doc.id, {
      orderId: order.id,
      visibility: "supplier",
      ...(doc.type === "art" && artReq ? { requirementId: artReq.id } : {}),
    });
  if (artReq && brief.artDocumentId) {
    const art =
      docs.find((d) => d.id === brief.artDocumentId) ??
      (await store.get("documents", brief.artDocumentId));
    await store.update("requirements", artReq.id, {
      status: "done",
      documentId: brief.artDocumentId,
      submittedByUserId: art?.uploadedByUserId ?? user.id,
      submittedAt: art?.createdAt ?? now,
      note: `Enviada na solicitação${request.number ? ` nº ${request.number}` : ""}`,
    });
  }
  const updated = await store.update("packaging_briefs", brief.id, {
    status: "transferred",
    orderId: order.id,
    orderArtRequirementId: artReq?.id ?? null,
    transferredAt: now,
    updatedByUserId: user.id,
  });
  await audit(
    user,
    "packaging_brief.transfer",
    "packaging_brief",
    brief.id,
    `Pedido #${order.number}: arte ${brief.artDocumentId ? "já enviada" : "pendente"}`,
  );
  if (brief.agencyId) {
    const agency = await store.get("parties", brief.agencyId);
    if (brief.artDocumentId)
      await notify(ownerTarget(brief), {
        kind: "info",
        actor: "supplier",
        link: `/app/orders/${order.id}`,
        text: (t) => ({
          subject: t("notif.packBrief.transferred.subject", { n: order.number }),
          body: t("notif.packBrief.transferred.body", {
            product: request.productName,
          }),
        }),
      });
    else
      await notify(ownerTarget(brief), {
        kind: "action",
        link: `/app/packaging/${brief.id}`,
        text: (t) => ({
          subject: t("notif.packBrief.transferredOpen.subject", {
            n: order.number,
          }),
          body: t("notif.packBrief.transferredOpen.body", {
            product: request.productName,
          }),
        }),
      });
    if (!agency?.active)
      await notifyWellmix({
        kind: "alert",
        actor: "wellmix",
        link: `/app/orders/${order.id}`,
        text: (t) => ({
          subject: t("notif.packBrief.agencyInactive.subject", {
            n: order.number,
          }),
          body: t("notif.packBrief.agencyInactive.body", {
            agency: agency?.name ?? "—",
          }),
        }),
      });
  }
  return updated;
}

/* ------------------------------------------------------------------------ */
/* Lembretes                                                                 */
/* ------------------------------------------------------------------------ */

/** Um lembrete por briefing a cada 24 h, vencido ou a `soon` do prazo (só antes do pedido). */
export async function remindPackagingBriefs(
  now: number,
  soon: number,
): Promise<number> {
  const store = getStore();
  let briefs: PackagingBrief[];
  try {
    briefs = await store.list("packaging_briefs", { filter: { status: "open" } });
  } catch (error) {
    if (isSchemaMissing(error)) return 0;
    throw error;
  }
  let sent = 0;
  for (const brief of briefs) {
    if (brief.orderId || !brief.dueAt || Date.parse(brief.dueAt) > soon)
      continue;
    if (
      brief.reminderSentAt &&
      now - Date.parse(brief.reminderSentAt) < 86_400_000
    )
      continue;
    const request = await store.get("requests", brief.requestId);
    if (!request || request.status === "CANCELLED") continue;
    const overdue = Date.parse(brief.dueAt) < now;
    const missing = missingPackagingItems(brief);
    await notify(ownerTarget(brief), {
      kind: overdue ? "alert" : "action",
      actor: "recipient",
      link: `/app/packaging/${brief.id}`,
      text: (t) => ({
        subject: t(
          overdue
            ? "notif.packBrief.overdue.subject"
            : "notif.packBrief.due.subject",
          { product: request.productName, ref: refOf(t, request) },
        ),
        body: t("notif.packBrief.missing", {
          items: missing.map((k) => itemLabel(t, k)).join(", "),
        }),
      }),
    });
    await store.update("packaging_briefs", brief.id, {
      reminderSentAt: new Date(now).toISOString(),
    });
    sent++;
  }
  return sent;
}

/* ------------------------------------------------------------------------ */
/* Visões                                                                    */
/* ------------------------------------------------------------------------ */

export interface PackagingItemView {
  key: PackagingItemKey;
  required: boolean;
  document: Document | null;
}

export interface PackagingBriefView {
  brief: PackagingBrief;
  request: Request;
  product: Product | null;
  /** Só a Wellmix (ou com `agencyShowsCustomer`). */
  customerName: string | null;
  /** Só depois de o fornecedor ser escolhido. */
  supplierName: string | null;
  agencyName: string | null;
  photos: ProductPhoto[];
  items: PackagingItemView[];
  missing: PackagingItemKey[];
  canEdit: boolean;
  wellmix: boolean;
  /** Venda ainda não confirmada (sem pedido). */
  presale: boolean;
  order: Order | null;
  /** Estado ao vivo do item "Arte" e da aprovação do fornecedor no pedido. */
  orderArt: {
    art: Requirement | null;
    approval: Requirement | null;
    stageOpen: boolean;
  } | null;
}

/** Tela do briefing: só o que a agência pode ver (nada de preço, cotações ou concorrentes). */
export async function getPackagingBriefView(
  user: User,
  briefId: string,
): Promise<PackagingBriefView | null> {
  const store = getStore();
  let brief: PackagingBrief | null;
  try {
    brief = await store.get("packaging_briefs", briefId);
  } catch (error) {
    if (isSchemaMissing(error)) return null;
    throw error;
  }
  if (!brief || !canViewPackagingBrief(user, brief)) return null;
  const wellmix = isWellmix(user);
  const settings = await getSettings();
  const [request, product, agency, customer] = await Promise.all([
    store.get("requests", brief.requestId),
    brief.productId ? store.get("products", brief.productId) : null,
    brief.agencyId ? store.get("parties", brief.agencyId) : null,
    wellmix || settings.agencyShowsCustomer
      ? store.get("parties", brief.customerId)
      : null,
  ]);
  if (!request) return null;
  const selected = request.selectedQuoteId
    ? await store.get("quotes", request.selectedQuoteId)
    : null;
  const supplier = selected ? await store.get("parties", selected.supplierId) : null;
  const ids = PACKAGING_ITEM_KEYS.map((k) => brief![ITEM_COLUMN[k]]).filter(
    (id): id is string => !!id,
  );
  const docs = ids.length
    ? await store.list("documents", { filter: { id: ids } })
    : [];
  const photos = brief.productId
    ? ((await catalogShowcasePhotos([brief.productId])).get(brief.productId) ??
      [])
    : [];
  const order = brief.orderId ? await store.get("orders", brief.orderId) : null;
  let orderArt: PackagingBriefView["orderArt"] = null;
  if (order) {
    const stage = await packagingStage(order.id);
    const reqs = stage
      ? await store.list("requirements", { filter: { stageId: stage.id } })
      : [];
    orderArt = {
      art: reqs.find((r) => r.key === "art") ?? null,
      approval: reqs.find((r) => r.key === "art_approval") ?? null,
      stageOpen: stageOpen(stage),
    };
  }
  const items = PACKAGING_ITEM_KEYS.map((key) => ({
    key,
    required: brief!.requiredKeys.includes(key),
    document: docs.find((d) => d.id === brief![ITEM_COLUMN[key]]) ?? null,
  }));
  return {
    brief,
    request,
    product,
    customerName: customer?.name ?? null,
    supplierName: supplier?.name ?? null,
    agencyName: agency?.name ?? null,
    photos,
    items,
    missing: missingPackagingItems(brief),
    canEdit: canEditPackagingBrief(user, brief) && LIVE.includes(brief.status),
    wellmix,
    presale: !brief.orderId && brief.status !== "cancelled",
    order,
    orderArt,
  };
}

export interface PackagingBriefRow {
  brief: PackagingBrief;
  request: Request | null;
  agencyName: string | null;
  missing: PackagingItemKey[];
}

const STATUS_ORDER: Record<PackagingBriefStatus, number> = {
  open: 0,
  ready: 1,
  transferred: 2,
  cancelled: 3,
};

/** Briefings da agência (a Wellmix vê todos), abertos primeiro. */
export async function listPackagingBriefsFor(
  user: User,
): Promise<PackagingBriefRow[]> {
  const store = getStore();
  const wellmix = isWellmix(user);
  if (!wellmix && !(user.role === "agency" && user.partyId)) return [];
  let rows: PackagingBrief[];
  try {
    rows = await store.list("packaging_briefs", {
      filter: wellmix ? undefined : { agencyId: user.partyId! },
      orderBy: "createdAt",
      direction: "desc",
    });
  } catch (error) {
    if (isSchemaMissing(error)) return [];
    throw error;
  }
  rows = rows.filter((b) => canViewPackagingBrief(user, b));
  const requestIds = [...new Set(rows.map((b) => b.requestId))];
  const agencyIds = [
    ...new Set(rows.map((b) => b.agencyId).filter((id): id is string => !!id)),
  ];
  const [requests, agencies] = await Promise.all([
    requestIds.length
      ? store.list("requests", { filter: { id: requestIds } })
      : [],
    wellmix && agencyIds.length
      ? store.list("parties", { filter: { id: agencyIds } })
      : [],
  ]);
  return rows
    .map((brief) => ({
      brief,
      request: requests.find((r) => r.id === brief.requestId) ?? null,
      agencyName: agencies.find((a) => a.id === brief.agencyId)?.name ?? null,
      missing: missingPackagingItems(brief),
    }))
    .sort(
      (a, b) =>
        STATUS_ORDER[a.brief.status] - STATUS_ORDER[b.brief.status] ||
        (a.brief.dueAt ?? "9").localeCompare(b.brief.dueAt ?? "9"),
    );
}

/** Dono sugerido para o formulário da RFQ (sem lançar erro). */
export async function suggestedPackagingOwner(): Promise<PackagingOwner> {
  const settings = await getSettings();
  return resolvePackagingOwner(settings);
}
