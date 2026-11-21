import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/function-access";
import { getT } from "@/i18n/server";
import { productNameText } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { getStore } from "@/lib/db";
import { materialKey } from "@/lib/materials";
import {
  listMaterials,
  sheetsToReviewMaterial,
} from "@/lib/services/materials";
import {
  Alert,
  Badge,
  Card,
  OpenLink,
  PageHeader,
  Table,
  Td,
  Th,
  cx,
  inputClass,
  linkClass,
  rowClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ActionError } from "@/components/action-error";
import {
  createMaterialAction,
  toggleMaterialAction,
  updateMaterialAction,
} from "../actions/materials";

/*
 * Cadastros → Materiais (dono, 21/11/2026; docs/PURCHASE_DEMAND.md, "Inner
 * do cliente, material do catálogo e Sem peso"): a lista que o fornecedor
 * escolhe na ficha técnica da cotação, sem texto livre. Nasceu da
 * Composição dos produtos do Sankhya; quem tem "Manter o catálogo de
 * materiais" (o Cadastro, por padrão) inclui, renomeia, desativa e reativa.
 * Embaixo, as fichas com material fora do catálogo, para revisar.
 */
export default async function MaterialsPage({
  searchParams,
}: PageProps<"/app/materials">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "products");
  if (!isWellmix(user)) notFound();
  const sp = await searchParams;
  const t = await getT();
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const showAll = sp.show === "all";
  const editId = typeof sp.edit === "string" ? sp.edit : "";
  const canManage = can(user, "materials.manage");
  const errorCode = typeof sp.error === "string" ? sp.error : "";
  const errorKey = `materials.error.${errorCode}` as DictionaryKey;
  const errorText = errorCode && t(errorKey) !== errorKey ? t(errorKey) : null;
  const notice = (["created", "updated", "toggled"] as const).find(
    (k) => typeof sp[k] === "string",
  );

  const [all, review] = await Promise.all([
    listMaterials({ includeInactive: true }),
    sheetsToReviewMaterial(),
  ]);
  const words = materialKey(q).split(" ").filter(Boolean);
  const rows = all
    .filter((m) => showAll || m.active)
    .filter((m) => {
      const hay = materialKey(`${m.namePt} ${m.nameEn} ${m.nameZh}`);
      return words.every((w) => hay.includes(w));
    });
  const activeCount = all.filter((m) => m.active).length;
  // Nomes do produto e do fornecedor de cada ficha a revisar.
  const store = getStore();
  const [products, parties] = review.length
    ? await Promise.all([
        store.list("products", {
          filter: { id: [...new Set(review.map((r) => r.productId))] },
        }),
        store.list("parties", {
          filter: { id: [...new Set(review.map((r) => r.supplierId))] },
        }),
      ])
    : [[], []];
  const keep = (extra: Record<string, string> = {}) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (showAll) params.set("show", "all");
    for (const [k, v] of Object.entries(extra)) params.set(k, v);
    const query = params.toString();
    return query ? `/app/materials?${query}` : "/app/materials";
  };
  const hidden = (
    <>
      <input type="hidden" name="q" value={q} />
      <input type="hidden" name="show" value={showAll ? "all" : ""} />
    </>
  );
  const nameInputs = (m?: {
    namePt: string;
    nameEn: string;
    nameZh: string;
  }) =>
    (["namePt", "nameEn", "nameZh"] as const).map((key) => (
      <label key={key} className="block min-w-0">
        <span className="mb-1 block text-xs font-medium text-zinc-700">
          {t(
            key === "namePt"
              ? "materials.col.pt"
              : key === "nameEn"
                ? "materials.col.en"
                : "materials.col.zh",
          )}
        </span>
        <input
          name={key}
          required
          maxLength={80}
          defaultValue={m?.[key] ?? ""}
          className={cx(inputClass, "h-9")}
          data-material-input={key}
        />
      </label>
    ));

  return (
    <div data-materials>
      <PageHeader
        t={t}
        title={t("materials.title")}
        subtitle={t("materials.subtitle")}
      />
      <ActionError t={t} code={errorCode} text={errorText} fields={null} />
      {notice ? (
        <div className="mb-3" role="status" data-materials-notice={notice}>
          <Alert tone="success">{t(`materials.${notice}`)}</Alert>
        </div>
      ) : null}

      {canManage ? (
        <Card title={t("materials.add")}>
          <form
            action={createMaterialAction}
            className="grid gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] sm:items-end"
            data-material-create
          >
            {hidden}
            {nameInputs()}
            <SubmitButton data-material-create-submit>
              {t("materials.add")}
            </SubmitButton>
          </form>
        </Card>
      ) : (
        <p className="mb-3 text-xs text-zinc-600">{t("materials.readOnly")}</p>
      )}

      <Card>
        <form
          method="get"
          className="mb-3 flex flex-wrap items-center gap-2"
          role="search"
        >
          <input
            name="q"
            defaultValue={q}
            placeholder={t("materials.search")}
            aria-label={t("materials.search")}
            className={cx(inputClass, "h-9 w-64")}
            data-materials-search
          />
          {showAll ? <input type="hidden" name="show" value="all" /> : null}
          <SubmitButton variant="secondary">{t("materials.search")}</SubmitButton>
          <Link
            href={(() => {
              const params = new URLSearchParams();
              if (q) params.set("q", q);
              if (!showAll) params.set("show", "all");
              const query = params.toString();
              return query ? `/app/materials?${query}` : "/app/materials";
            })()}
            className={cx(linkClass, "text-xs")}
            data-materials-show={showAll ? "active" : "all"}
          >
            {showAll
              ? t("materials.showActive")
              : t("materials.showAll", { n: all.length - activeCount })}
          </Link>
          <span className="text-xs text-zinc-500">
            {t("materials.count", { n: all.length, active: activeCount })}
          </span>
        </form>
        <Table tools={false}>
          <thead>
            <tr>
              <Th>{t("materials.col.pt")}</Th>
              <Th>{t("materials.col.en")}</Th>
              <Th>{t("materials.col.zh")}</Th>
              <Th>{t("materials.col.status")}</Th>
              {canManage ? (
                <Th>
                  <span className="sr-only">{t("materials.edit")}</span>
                </Th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) =>
              canManage && editId === m.id ? (
                <tr key={m.id} className={rowClass} data-material-row={m.id}>
                  <Td colSpan={5}>
                    <form
                      action={updateMaterialAction}
                      className="grid gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto_auto] sm:items-end"
                      data-material-edit={m.id}
                    >
                      {hidden}
                      <input type="hidden" name="id" value={m.id} />
                      {nameInputs(m)}
                      <SubmitButton data-material-save={m.id}>
                        {t("materials.save")}
                      </SubmitButton>
                      <Link href={keep()} className={cx(linkClass, "text-sm")}>
                        {t("materials.cancel")}
                      </Link>
                    </form>
                  </Td>
                </tr>
              ) : (
                <tr
                  key={m.id}
                  className={cx(rowClass, !m.active && "text-zinc-400")}
                  data-material-row={m.id}
                  data-material-active={m.active ? "1" : "0"}
                >
                  <Td className="font-medium">{m.namePt}</Td>
                  <Td>{m.nameEn}</Td>
                  <Td>{m.nameZh}</Td>
                  <Td>
                    <Badge tone={m.active ? "success" : "neutral"}>
                      {m.active
                        ? t("materials.active")
                        : t("materials.inactive")}
                    </Badge>
                  </Td>
                  {canManage ? (
                    <Td className="whitespace-nowrap text-right">
                      <Link
                        href={keep({ edit: m.id })}
                        className={cx(linkClass, "mr-3 text-xs")}
                        data-material-edit-link={m.id}
                      >
                        {t("materials.edit")}
                      </Link>
                      <form action={toggleMaterialAction} className="inline">
                        {hidden}
                        <input type="hidden" name="id" value={m.id} />
                        <input
                          type="hidden"
                          name="active"
                          value={m.active ? "0" : "1"}
                        />
                        <SubmitButton
                          variant="secondary"
                          data-material-toggle={m.id}
                        >
                          {m.active
                            ? t("materials.deactivate")
                            : t("materials.activate")}
                        </SubmitButton>
                      </form>
                    </Td>
                  ) : null}
                </tr>
              ),
            )}
          </tbody>
        </Table>
      </Card>

      <Card title={t("materials.review.title")}>
        <p className="mb-2 text-xs text-zinc-600">
          {t("materials.review.hint")}
        </p>
        {review.length ? (
          <Table tools={false}>
            <thead>
              <tr>
                <Th>{t("materials.review.col.product")}</Th>
                <Th>{t("materials.review.col.supplier")}</Th>
                <Th>{t("materials.review.col.material")}</Th>
                <Th>
                  <span className="sr-only">{t("materials.edit")}</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {review.map((r) => {
                const product = products.find((p) => p.id === r.productId);
                return (
                  <tr
                    key={r.sheetId}
                    className={rowClass}
                    data-material-review={r.sheetId}
                  >
                    <Td>
                      {product
                        ? productNameText(t, product.name)
                        : r.productId}
                    </Td>
                    <Td>
                      {parties.find((p) => p.id === r.supplierId)?.name ??
                        r.supplierId}
                    </Td>
                    <Td>{r.material || "—"}</Td>
                    <Td>
                      <OpenLink
                        href={`/app/supplier-sheets/${r.sheetId}`}
                        label={t("materials.edit")}
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <p className="text-sm text-zinc-600" data-material-review-empty>
            {t("materials.review.empty")}
          </p>
        )}
      </Card>
    </div>
  );
}
