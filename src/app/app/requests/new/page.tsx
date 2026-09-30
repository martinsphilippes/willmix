import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
  Card,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Textarea,
  TextLink,
  cx,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { PhotoInput } from "@/components/photo-input";
import { SuggestField } from "@/components/suggest-field";
import { getSettings } from "@/lib/settings";
import { getAiAdapter } from "@/lib/integrations/ai";
import { getLookup } from "@/lib/services/product-lookup";
import type { LookupField } from "@/lib/db";
import { createRequestAction } from "../../actions";
import { lookupProductAction } from "../../actions/lookup";

export default async function NewRequestPage({
  searchParams,
}: PageProps<"/app/requests/new">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(isWellmix(user) || user.role === "customer")) redirect("/app");
  const { error, productId, quantity, scheduleId, customerId, lookup } =
    await searchParams;
  const t = await getT();
  const store = getStore();
  // Pré-preenchimento vindo da ficha do produto ou de uma programação de compra.
  const schedule =
    typeof scheduleId === "string"
      ? await store.get("purchase_schedules", scheduleId)
      : null;
  const presetProductId =
    schedule?.productId ?? (typeof productId === "string" ? productId : "");
  const presetQuantity =
    schedule?.quantity ?? (typeof quantity === "string" ? quantity : "");
  const presetCustomerId =
    schedule?.customerId ?? (typeof customerId === "string" ? customerId : "");
  const [products, customers] = await Promise.all([
    store.list("products", { filter: { active: true }, orderBy: "name" }),
    isWellmix(user)
      ? store.list("parties", {
          filter: { type: "customer", active: true },
          orderBy: "name",
        })
      : Promise.resolve([]),
  ]);

  /* Busca por foto ou link: resultado guardado em product_lookups (só de quem buscou ou Wellmix). */
  const found =
    typeof lookup === "string" ? await getLookup(user, lookup) : null;
  const aiMode = found ? getAiAdapter(await getSettings()).mode : null;
  const matched = (found?.matches ?? [])
    .map((m) => ({ m, p: products.find((p) => p.id === m.productId) }))
    .filter((x) => !!x.p);
  const optionsFor = (field: LookupField) => found?.suggestions[field] ?? [];
  const hasSuggestions =
    !!found &&
    (["productName", "description", "specification"] as const).some(
      (f) => optionsFor(f).length > 0,
    );
  const sourceLabels = {
    link: t("lookup.source.link"),
    catalog: t("lookup.source.catalog"),
    ai: t("lookup.source.ai"),
    mock: t("lookup.source.mock"),
  };
  const pickHref = (pid: string) => {
    const params = new URLSearchParams({ lookup: found!.id, productId: pid });
    if (presetCustomerId) params.set("customerId", presetCustomerId);
    return `/app/requests/new?${params.toString()}`;
  };
  const errorKey = `lookup.error.${typeof error === "string" ? error : ""}`;
  const errorText =
    typeof error === "string" && t(errorKey as DictionaryKey) !== errorKey
      ? t(errorKey as DictionaryKey)
      : t("common.error");
  const referenceNote = found?.url
    ? `${t("lookup.referenceNote")} ${found.url}`
    : "";

  return (
    <>
      <PageHeader
        help={{
          body: "help.requests.new.body",
          steps: "help.requests.new.steps",
        }}
        t={t}
        title={t("requests.new")}
      />
      {error ? <Alert tone="danger">{errorText}</Alert> : null}

      {/* Busca do produto por foto ou link: procura no catálogo e sugere os campos. */}
      <Card title={t("lookup.title")} className="mt-4 max-w-2xl">
        <div id="lookup" className="scroll-mt-4" />
        <p className="mb-3 text-sm text-zinc-600">{t("lookup.intro")}</p>
        <form action={lookupProductAction} className="space-y-3">
          {isWellmix(user) && presetCustomerId ? (
            <input type="hidden" name="customerId" value={presetCustomerId} />
          ) : null}
          <PhotoInput
            name="photo"
            multiple={false}
            capture={false}
            autoSubmit
            label={t("lookup.photo")}
            hint={t("lookup.photoHint")}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Field label={t("lookup.url")}>
                <Input
                  name="url"
                  type="url"
                  inputMode="url"
                  placeholder={t("lookup.urlPlaceholder")}
                />
              </Field>
            </div>
            <SubmitButton
              variant="secondary"
              pendingText={t("lookup.searching")}
            >
              {t("lookup.search")}
            </SubmitButton>
          </div>
        </form>

        {found ? (
          <div className="mt-5 space-y-4 border-t border-zinc-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-900">
                {t("lookup.result")}
              </h3>
              {found.aiSource === "api" ? (
                <Badge tone="success">{t("lookup.ai.api")}</Badge>
              ) : found.aiSource === "mock" ? (
                <Badge tone="warning">{t("lookup.ai.mock")}</Badge>
              ) : null}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              {found.imageDocumentId ? (
                <a
                  href={`/api/files/${found.imageDocumentId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
                  <img
                    src={`/api/files/${found.imageDocumentId}`}
                    alt={t("lookup.yourPhoto")}
                    className="h-24 w-24 rounded-xl border border-zinc-200 bg-zinc-50 object-cover"
                  />
                </a>
              ) : null}
              {found.url ? (
                <div className="min-w-0 space-y-1 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {t("lookup.link")}
                    {found.linkSiteName ? ` · ${found.linkSiteName}` : ""}
                  </p>
                  {found.linkTitle ? (
                    <p className="font-medium text-zinc-900">
                      {found.linkTitle}
                    </p>
                  ) : null}
                  <a
                    href={found.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block break-all text-xs text-brand-700 underline"
                  >
                    {found.url}
                  </a>
                  {found.linkPrice ? (
                    <p className="text-xs text-zinc-500">
                      {t("lookup.linkPrice")}: {found.linkPrice}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            {found.linkStatus && found.linkStatus !== "ok" ? (
              <Alert tone="warning">
                {t(`lookup.linkStatus.${found.linkStatus}` as DictionaryKey)}
              </Alert>
            ) : null}
            {aiMode === "api" && !found.aiSource && isWellmix(user) ? (
              <Alert tone="warning">{t("lookup.ai.failed")}</Alert>
            ) : null}
            {aiMode === "manual" ? (
              isWellmix(user) ? (
                <Alert tone="warning">{t("lookup.ai.manual")}</Alert>
              ) : matched.length === 0 && found.imageDocumentId ? (
                <p className="text-xs leading-relaxed text-zinc-500">
                  {t("lookup.ai.customerManual")}
                </p>
              ) : null
            ) : null}

            {matched.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-800">
                  {t("lookup.matches")}
                </p>
                <p className="text-xs text-zinc-500">
                  {t("lookup.matchesHint")}
                </p>
                <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
                  {matched.map(({ m, p }) => {
                    const selected = presetProductId === p!.id;
                    return (
                      <li
                        key={m.productId}
                        className={cx(
                          "flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between",
                          selected && "bg-brand-50/60",
                        )}
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-zinc-900">
                            {p!.name}
                            {p!.sku ? (
                              <span className="text-zinc-500"> ({p!.sku})</span>
                            ) : null}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {m.reasons.map((r) => (
                              <Badge key={r} tone="info">
                                {t(`lookup.reason.${r}` as DictionaryKey)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        {selected ? (
                          <Badge tone="success">{t("lookup.using")}</Badge>
                        ) : (
                          <LinkButton
                            href={pickHref(p!.id)}
                            variant="secondary"
                          >
                            {t("lookup.use")}
                          </LinkButton>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {presetProductId ? (
                  <TextLink
                    href={`/app/requests/new?${new URLSearchParams({ lookup: found.id, ...(presetCustomerId ? { customerId: presetCustomerId } : {}) }).toString()}`}
                    className="text-xs"
                  >
                    {t("lookup.none")}
                  </TextLink>
                ) : null}
              </div>
            ) : (
              <Alert tone="info">{t("lookup.noMatch")}</Alert>
            )}
            <TextLink
              href={`/app/requests/new${presetCustomerId ? `?customerId=${encodeURIComponent(presetCustomerId)}` : ""}`}
              className="text-xs"
            >
              {t("lookup.new")}
            </TextLink>
          </div>
        ) : null}
      </Card>

      <Card className="mt-4 max-w-2xl">
        {/* key: ao escolher um produto da busca (mesma rota, outro ?productId) o formulário
            é recriado, senão o navegador mantém o valor anterior dos campos. */}
        <form
          key={`${found?.id ?? "none"}-${presetProductId}-${presetCustomerId}`}
          action={createRequestAction}
          className="space-y-4"
        >
          {found ? (
            <input type="hidden" name="lookupId" value={found.id} />
          ) : null}
          {schedule ? (
            <input type="hidden" name="scheduleId" value={schedule.id} />
          ) : null}
          {isWellmix(user) ? (
            <Field label={t("common.customer")}>
              <Select
                name="customerId"
                required
                defaultValue={presetCustomerId}
              >
                <option value="" disabled>
                  {t("common.select")}
                </option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label={t("common.product")} hint={t("requests.specification")}>
            <Select name="productId" defaultValue={presetProductId}>
              <option value="">{t("common.select")}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.sku ? ` (${p.sku})` : ""}
                </option>
              ))}
            </Select>
          </Field>
          {/* Sourcing sob demanda: produto fora do catálogo (só faz sentido sem produto selecionado). */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3">
            <input
              type="checkbox"
              name="sourcingDemand"
              defaultChecked={
                !!found && matched.length === 0 && !presetProductId
              }
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-zinc-800">
                {t("requests.sourcingDemand.label")}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">
                {t("requests.sourcingDemand.hint")}
              </span>
            </span>
          </label>
          {hasSuggestions ? (
            <>
              {/* Sugestões da busca: nada vem preenchido; "Nenhuma dessas" é o padrão. */}
              <SuggestField
                name="productName"
                label={`${t("common.product")} (${t("common.name")})`}
                options={optionsFor("productName")}
                placeholder="Ex.: Jarra de vidro 1,5 L"
                noneLabel={t("lookup.noneOption")}
                hint={t("lookup.suggestionsHint")}
                sourceLabels={sourceLabels}
              />
              <SuggestField
                name="description"
                label={t("requests.description")}
                options={optionsFor("description")}
                multiline
                required
                minLength={2}
                noneLabel={t("lookup.noneOption")}
                hint={t("lookup.suggestionsHint")}
                sourceLabels={sourceLabels}
              />
              <SuggestField
                name="specification"
                label={t("requests.specification")}
                options={optionsFor("specification")}
                multiline
                noneLabel={t("lookup.noneOption")}
                hint={t("lookup.suggestionsHint")}
                sourceLabels={sourceLabels}
              />
            </>
          ) : (
            <>
              <Field label={`${t("common.product")} (${t("common.name")})`}>
                <Input
                  name="productName"
                  placeholder="Ex.: Jarra de vidro 1,5 L"
                />
              </Field>
              <Field label={t("requests.description")}>
                <Textarea name="description" required minLength={2} />
              </Field>
              <Field label={t("requests.specification")}>
                <Textarea name="specification" />
              </Field>
            </>
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label={t("common.quantity")}>
              <Input
                name="quantity"
                type="number"
                min="0.01"
                step="any"
                required
                defaultValue={presetQuantity}
              />
            </Field>
            <Field label={t("requests.unit")}>
              <Input name="unit" defaultValue="un" required />
            </Field>
            <div className="col-span-2 sm:col-span-1">
              <Field label={t("requests.deadline")}>
                <Input name="deadline" type="date" />
              </Field>
            </div>
          </div>
          <Field label={t("requests.attachments")}>
            <Input name="attachments" type="file" multiple />
          </Field>
          <Field label={t("common.note")}>
            <Textarea name="notes" defaultValue={referenceNote} />
          </Field>
          <div className="border-t border-zinc-100 pt-4">
            <SubmitButton pendingText="...">{t("common.send")}</SubmitButton>
          </div>
        </form>
      </Card>
    </>
  );
}
