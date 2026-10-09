import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertWellmix } from "@/lib/auth/permissions";
import {
  getStore,
  MEASUREMENT_KINDS,
  PHOTO_KINDS,
  type ProductPhoto,
} from "@/lib/db";
import { loadSourcingItem } from "@/lib/services/sourcing";
import { formatPriceTiers, sortTiers } from "@/lib/services/opportunities";
import { divergencePercent } from "@/lib/logistics/cbm";
import { getSettings } from "@/lib/settings";
import { getAiAdapter } from "@/lib/integrations/ai";
import { listSuggestions } from "@/lib/services/ai-suggestions";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
  Card,
  DescriptionList,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  TextLink,
  Textarea,
  cx,
  formatDate,
  formatMoney,
} from "@/components/ui";
import { PhotoInput } from "@/components/photo-input";
import { SubmitButton, SubmitTextButton } from "@/components/submit-button";
import {
  linkSourcingItemRequestAction,
  saveSourcingPriceTiersAction,
} from "../../../actions/catalog";
import {
  addSourcingMeasurementAction,
  addSourcingPhotosAction,
  discardSourcingItemAction,
  promoteSourcingItemAction,
  setPrimaryPhotoAction,
} from "../../../actions/sourcing";
import { catalogError } from "../../../products/_components/shared";
import {
  AiSection,
  collectAiPhotos,
  visionError,
} from "../../../products/_components/ai-section";
import { ItemForm } from "../../_components/item-form";
import {
  bigField,
  errorMessage,
  formatNumber,
  sourcingTone,
} from "../../_components/shared";

export default async function SourcingItemPage({
  params,
  searchParams,
}: PageProps<"/app/sourcing/items/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertWellmix(user);
  const { id } = await params;
  const { error } = await searchParams;
  const data = await loadSourcingItem(id);
  if (!data) notFound();
  const { item, photos, measurements, visit, supplier, documents } = data;
  const t = await getT();
  const store = getStore();
  const [
    suppliers,
    lines,
    users,
    customers,
    openRequests,
    settings,
    suggestions,
  ] = await Promise.all([
    store.list("parties", { filter: { type: "supplier" }, orderBy: "name" }),
    store.list("product_lines", { orderBy: "name" }),
    store.list("users"),
    store.list("parties", { filter: { type: "customer" }, orderBy: "name" }),
    // Demanda de cliente: solicitações em aberto sem produto do catálogo (ou a já vinculada).
    store.list("requests", {
      filter: { status: ["REQUESTED", "RFQ_OPEN", "QUOTATION_RECEIVED"] },
      orderBy: "createdAt",
      direction: "desc",
    }),
    // Visão de Produto: sugestão de campos pela foto (humano confirma).
    getSettings(),
    listSuggestions("sourcing_item", id),
  ]);
  const aiAdapter = getAiAdapter(settings);
  const aiPhotos = collectAiPhotos(
    photos,
    documents,
    item.primaryPhotoDocumentId,
    (kind) => t(`sourcing.photo.${kind}` as DictionaryKey),
  );
  const userName = (uid: string | null) =>
    users.find((u) => u.id === uid)?.name ?? "—";
  const customerName = (pid: string) =>
    customers.find((c) => c.id === pid)?.name ?? "—";
  const linkableRequests = openRequests.filter(
    (r) => !r.productId || r.id === item.requestId,
  );
  const tiers = sortTiers(item.priceTiers);
  // Erros deste módulo (faixas, vínculo) e da IA têm texto próprio; os demais seguem o padrão do sourcing.
  const errorText =
    visionError(t, error) ??
    (typeof error === "string" &&
    t(`catalog.error.${error}` as DictionaryKey) !== `catalog.error.${error}`
      ? catalogError(t, error)
      : errorMessage(t, error));
  const supplierLabel = item.supplierName ?? supplier?.name ?? "—";
  const originals = photos.filter((p) => p.kind === "original");
  const photoLabel = (p: ProductPhoto) =>
    p.caption ??
    `${t(`sourcing.photo.${p.kind}`)} · ${formatDate(p.takenAt, t)}`;
  const groups = PHOTO_KINDS.map((kind) => ({
    kind,
    photos: photos.filter((p) => p.kind === kind),
  })).filter((g) => g.photos.length > 0);
  const canDiscard = item.status !== "discarded" && item.status !== "promoted";
  const canPromote = !item.productId && item.status !== "discarded";

  return (
    <>
      <PageHeader
        help={{
          body: "help.sourcing.item.body",
          steps: "help.sourcing.item.steps",
        }}
        t={t}
        title={item.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={sourcingTone(item.status)}>
              {t(`sourcing.status.${item.status}`)}
            </Badge>
            {item.requestId ? (
              <>
                <Badge tone="brand">{t("catalog.sourcing.demand")}</Badge>
                <TextLink href={`/app/requests/${item.requestId}`}>
                  {t("catalog.sourcing.demand.open")}
                </TextLink>
              </>
            ) : null}
            <span>{supplierLabel}</span>
            {visit ? (
              <TextLink href={`/app/sourcing/visits/${visit.id}`}>
                {t("sourcing.item.visit")} · {formatDate(visit.visitedAt, t)}
              </TextLink>
            ) : null}
          </span>
        }
        actions={
          <>
            <LinkButton href="/app/sourcing">{t("common.back")}</LinkButton>
            {item.productId ? (
              <LinkButton
                href={`/app/products/${item.productId}`}
                variant="primary"
              >
                {t("sourcing.item.viewProduct")}
              </LinkButton>
            ) : null}
          </>
        }
      />
      {errorText ? (
        <div className="mb-4">
          <Alert tone="danger">{errorText}</Alert>
        </div>
      ) : null}

      {/* Ordem no celular = ordem do DOM: fotos → ficha → medições → negociação → ações.
          No desktop, a ficha ocupa duas colunas e o resto fica à direita. */}
      <div className="grid gap-6 lg:grid-cols-3 lg:grid-rows-[auto_auto_auto_auto_1fr] lg:items-start">
        <Card
          title={t("sourcing.photo.gallery")}
          className="scroll-mt-4 lg:col-start-3 lg:row-start-1"
        >
          <div id="photos" />
          {groups.length === 0 ? (
            <p className="mb-4 text-sm text-zinc-500">
              {t("sourcing.photo.none")}
            </p>
          ) : (
            <div className="mb-4 space-y-4">
              {groups.map((group) => (
                <div key={group.kind}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {t(`sourcing.photo.${group.kind}`)}{" "}
                    <span className="font-normal">({group.photos.length})</span>
                  </h3>
                  <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
                    {group.photos.map((p) => (
                      <li key={p.id} className="min-w-0">
                        <a
                          href={`/api/files/${p.documentId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="relative block overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
                          <img
                            src={`/api/files/${p.documentId}`}
                            alt={photoLabel(p)}
                            loading="lazy"
                            className="aspect-square w-full object-cover"
                          />
                          {p.isPrimary ? (
                            <span className="absolute left-1 top-1">
                              <Badge tone="brand">
                                {t("sourcing.photo.primary")}
                              </Badge>
                            </span>
                          ) : null}
                        </a>
                        <p className="mt-1 truncate text-xs text-zinc-600">
                          {p.caption ?? formatDate(p.takenAt, t)}
                        </p>
                        {p.derivedFromPhotoId ? (
                          <p className="truncate text-[11px] text-zinc-500">
                            ← {t("sourcing.photo.original")}
                          </p>
                        ) : null}
                        {!p.isPrimary &&
                        (p.kind === "original" || p.kind === "commercial") ? (
                          <form action={setPrimaryPhotoAction}>
                            <input
                              type="hidden"
                              name="itemId"
                              value={item.id}
                            />
                            <input type="hidden" name="photoId" value={p.id} />
                            <SubmitTextButton className="w-full justify-center py-1.5 text-xs">
                              {t("sourcing.photo.setPrimary")}
                            </SubmitTextButton>
                          </form>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <form
            action={addSourcingPhotosAction}
            className="space-y-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3"
          >
            <input type="hidden" name="itemId" value={item.id} />
            <PhotoInput
              name="photos"
              label={t("sourcing.photo.add")}
              direct
              uploadingLabel={t("photo.uploading")}
              failedLabel={t("photo.failed")}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("sourcing.photo.kind")}>
                <Select
                  name="kind"
                  defaultValue="original"
                  className={bigField}
                >
                  {PHOTO_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t(`sourcing.photo.${k}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("sourcing.photo.caption")}>
                <Input name="caption" maxLength={200} className={bigField} />
              </Field>
            </div>
            <Field
              label={t("sourcing.photo.derivedFrom")}
              hint={t("sourcing.photo.derivedHint")}
            >
              <Select
                name="derivedFromPhotoId"
                defaultValue=""
                className={bigField}
              >
                <option value="">—</option>
                {originals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {photoLabel(p)}
                  </option>
                ))}
              </Select>
            </Field>
            <SubmitButton
              variant="secondary"
              pendingText="…"
              className="w-full sm:w-auto"
            >
              + {t("sourcing.photo.add")}
            </SubmitButton>
          </form>
        </Card>

        <div className="min-w-0 lg:col-span-2 lg:col-start-1 lg:row-start-1 lg:row-span-5">
          <ItemForm t={t} item={item} suppliers={suppliers} lines={lines} />
        </div>

        <Card
          title={t("sourcing.measure.title")}
          className="lg:col-start-3 lg:row-start-2"
        >
          {measurements.length === 0 ? (
            <p className="mb-4 text-sm text-zinc-500">
              {t("sourcing.measure.none")}
            </p>
          ) : (
            <ul className="mb-4 divide-y divide-zinc-100 text-sm">
              {measurements.map((m) => {
                const diff =
                  m.declaredValue !== null
                    ? m.measuredValue - m.declaredValue
                    : null;
                const pct = divergencePercent(m.declaredValue, m.measuredValue);
                return (
                  <li key={m.id} className="flex items-start gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-zinc-900">
                        {t(`sourcing.measure.${m.kind}`)}:{" "}
                        <span className="font-semibold">
                          {formatNumber(m.measuredValue, t.intl)} {m.unit}
                        </span>
                        {m.declaredValue !== null ? (
                          <span className="text-zinc-500">
                            {" "}
                            ({t("sourcing.measure.declaredShort")}:{" "}
                            {formatNumber(m.declaredValue, t.intl)} {m.unit})
                          </span>
                        ) : null}
                      </p>
                      {diff !== null ? (
                        <p
                          className={
                            diff === 0 ? "text-zinc-500" : "text-amber-800"
                          }
                        >
                          {t("sourcing.measure.diff")}: {diff > 0 ? "+" : ""}
                          {formatNumber(diff, t.intl)} {m.unit}
                          {pct !== null
                            ? ` (${formatNumber(pct, t.intl)}%)`
                            : ""}
                        </p>
                      ) : null}
                      <p className="text-xs text-zinc-500">
                        {t("sourcing.measure.by")}{" "}
                        {userName(m.measuredByUserId)} ·{" "}
                        {formatDate(m.measuredAt, t)}
                        {m.note ? ` · ${m.note}` : ""}
                      </p>
                    </div>
                    {m.photoDocumentId ? (
                      <a
                        href={`/api/files/${m.photoDocumentId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
                        <img
                          src={`/api/files/${m.photoDocumentId}`}
                          alt={t("sourcing.measure.photo")}
                          loading="lazy"
                          className="h-14 w-14 rounded-lg border border-zinc-200 object-cover"
                        />
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          <form
            action={addSourcingMeasurementAction}
            className="space-y-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3"
          >
            <input type="hidden" name="itemId" value={item.id} />
            <Field label={t("sourcing.measure.kind")}>
              <Select
                name="kind"
                defaultValue="weight_net"
                className={bigField}
              >
                {MEASUREMENT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`sourcing.measure.${k}`)}
                  </option>
                ))}
              </Select>
            </Field>
            {/* items-end: os rótulos têm alturas diferentes; os campos ficam alinhados. */}
            <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-3">
              <Field label={t("sourcing.measure.declared")}>
                <Input
                  name="declaredValue"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  className={bigField}
                />
              </Field>
              <Field label={t("sourcing.measure.measured")}>
                <Input
                  name="measuredValue"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  required
                  className={bigField}
                />
              </Field>
              <div className="col-span-2 sm:col-span-1">
                <Field label={t("sourcing.measure.unit")}>
                  <Input
                    name="unit"
                    defaultValue="kg"
                    required
                    maxLength={10}
                    className={bigField}
                  />
                </Field>
              </div>
            </div>
            <PhotoInput
              name="photo"
              multiple={false}
              label={t("sourcing.measure.photo")}
            />
            <Field label={t("common.note")}>
              <Input name="note" className={bigField} />
            </Field>
            <SubmitButton
              variant="secondary"
              pendingText="…"
              className="w-full sm:w-auto"
            >
              + {t("sourcing.measure.add")}
            </SubmitButton>
          </form>
        </Card>

        <Card
          title={t("sourcing.negotiation.title")}
          className="lg:col-start-3 lg:row-start-3"
        >
          <DescriptionList
            items={[
              [t("common.price"), formatMoney(item.price, item.currency, t)],
              [t("sourcing.moq"), formatNumber(item.moq, t.intl)],
              [t("common.conditions"), item.conditions ?? "—"],
              [
                t("sourcing.item.masterBoxQty"),
                formatNumber(item.masterBoxQty, t.intl),
              ],
              [
                t("sourcing.item.cbm"),
                item.cbm ? `${formatNumber(item.cbm, t.intl)} m³` : "—",
              ],
              [
                t("common.supplier"),
                supplier ? (
                  <TextLink href={`/app/parties/${supplier.id}`}>
                    {supplierLabel}
                  </TextLink>
                ) : (
                  supplierLabel
                ),
              ],
              [t("sourcing.foundAt"), formatDate(item.foundAt, t)],
            ]}
          />
          <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
            {t("sourcing.negotiation.hint")}
          </p>
        </Card>

        {/* Segunda Onda: faixas de preço negociadas e demanda de cliente. */}
        <Card
          title={t("catalog.opp.tiers")}
          className="lg:col-start-3 lg:row-start-4"
        >
          <div id="tiers" className="scroll-mt-4" />
          {item.requestId ? (
            <div className="mb-4">
              <Alert tone="brand">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span>{t("catalog.sourcing.demand.hint")}</span>
                  <TextLink href={`/app/requests/${item.requestId}`}>
                    {t("catalog.sourcing.demand.open")}
                  </TextLink>
                </span>
              </Alert>
            </div>
          ) : null}
          {tiers.length === 0 ? (
            <p className="mb-3 text-sm text-zinc-500">
              {t("catalog.opp.tiers.empty")}
            </p>
          ) : (
            <ul className="mb-3 divide-y divide-zinc-100 rounded-xl border border-zinc-200/80 text-sm">
              {tiers.map((tier) => (
                <li
                  key={tier.minQty}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="text-zinc-700">
                    {t("catalog.opp.from")}{" "}
                    <span className="font-semibold tabular-nums text-zinc-900">
                      {formatNumber(tier.minQty, t.intl)}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums text-zinc-900">
                    {formatMoney(tier.price, item.currency, t)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <form
            action={saveSourcingPriceTiersAction}
            className="space-y-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3"
          >
            <input type="hidden" name="itemId" value={item.id} />
            <Field
              label={t("catalog.opp.tiers")}
              hint={t("catalog.opp.tiersHint")}
            >
              <Textarea
                name="tiers"
                rows={3}
                placeholder={"500;4.10\n1000;3.80"}
                defaultValue={formatPriceTiers(tiers)}
                className={cx(bigField, "min-h-0 font-mono")}
              />
            </Field>
            <p className="text-xs text-zinc-500">
              {t("catalog.sourcing.tiersHint")}
            </p>
            <SubmitButton
              variant="secondary"
              pendingText="…"
              className="w-full sm:w-auto"
            >
              {t("catalog.opp.saveTiers")}
            </SubmitButton>
          </form>
          <form
            action={linkSourcingItemRequestAction}
            className="mt-4 space-y-3 border-t border-zinc-100 pt-4"
          >
            <input type="hidden" name="itemId" value={item.id} />
            <Field
              label={t("catalog.sourcing.demand.link")}
              hint={t("catalog.sourcing.demand.linkHint")}
            >
              <Select
                name="requestId"
                defaultValue={item.requestId ?? ""}
                className={bigField}
              >
                <option value="">—</option>
                {linkableRequests.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.productName} · {customerName(r.customerId)} ·{" "}
                    {formatNumber(r.quantity, t.intl)} {r.unit}
                  </option>
                ))}
              </Select>
            </Field>
            <SubmitButton
              variant="secondary"
              pendingText="…"
              className="w-full sm:w-auto"
            >
              {t("common.save")}
            </SubmitButton>
          </form>
        </Card>

        <Card
          title={t("sourcing.item.actions")}
          className="lg:col-start-3 lg:row-start-5"
        >
          <div className="space-y-4">
            {item.productId ? (
              <Alert tone="success">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span>{t("sourcing.item.promoted")}</span>
                  <TextLink href={`/app/products/${item.productId}`}>
                    {t("sourcing.item.viewProduct")}
                  </TextLink>
                </span>
              </Alert>
            ) : null}
            {canPromote ? (
              <form action={promoteSourcingItemAction} className="space-y-3">
                <input type="hidden" name="itemId" value={item.id} />
                <Field label={t("sourcing.item.line")}>
                  <Select
                    name="lineId"
                    required
                    defaultValue={item.lineId ?? ""}
                    className={bigField}
                  >
                    <option value="" disabled>
                      {t("common.select")}
                    </option>
                    {lines.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("sourcing.item.sku")}>
                  <Input name="sku" maxLength={60} className={bigField} />
                </Field>
                <SubmitButton pendingText="…" className="w-full sm:w-auto">
                  {t("sourcing.item.promote")}
                </SubmitButton>
                <p className="text-xs text-zinc-500">
                  {t("sourcing.item.promoteHint")}
                </p>
              </form>
            ) : null}
            {item.status === "discarded" ? (
              <Alert tone="neutral">{t("sourcing.item.discarded")}</Alert>
            ) : null}
            {canDiscard ? (
              <form
                action={discardSourcingItemAction}
                className="border-t border-zinc-100 pt-4"
              >
                <input type="hidden" name="itemId" value={item.id} />
                <SubmitButton
                  type="submit"
                  variant="danger"
                  className="w-full sm:w-auto"
                >
                  {t("sourcing.item.discard")}
                </SubmitButton>
                <p className="mt-2 text-xs text-zinc-500">
                  {t("sourcing.item.discardHint")}
                </p>
              </form>
            ) : null}
          </div>
        </Card>
      </div>

      {/* Visão de Produto: sugestão de campos pela foto (IA); humano confirma campo a campo. */}
      <Card title={t("vision.ai.title")} className="mt-6">
        <AiSection
          entity="sourcing_item"
          entityId={item.id}
          photos={aiPhotos}
          suggestions={suggestions}
          mode={aiAdapter.mode}
          model={aiAdapter.model}
          user={user}
          users={users}
          current={{
            category: item.category,
            description: item.description,
            material: item.material,
            color: item.color,
          }}
          t={t}
          back={`/app/sourcing/items/${item.id}`}
        />
      </Card>
    </>
  );
}
