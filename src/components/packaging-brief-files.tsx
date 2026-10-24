import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { getStore, type User } from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";
import { briefForOrder } from "@/lib/services/packaging-brief";
import { ITEM_COLUMN } from "@/lib/services/packaging-brief-calc";
import { formatDate, linkClass } from "./ui";

/**
 * No pedido, dentro da etapa Arte e embalagem: os arquivos preparados no
 * briefing da solicitação (faca, arquivos para a gráfica, foto da embalagem;
 * a arte aparece no próprio item "Arte"). Fornecedor, agência e Wellmix veem;
 * o cliente não (a etapa toda é só dos parceiros).
 */
export async function PackagingBriefFiles({
  t,
  user,
  orderId,
}: {
  t: Translate;
  user: User;
  orderId: string;
}) {
  if (user.role === "customer") return null;
  const brief = await briefForOrder(orderId);
  if (!brief) return null;
  const store = getStore();
  const ids = (["dieline", "print_ready", "packaging_sample"] as const)
    .map((k) => ({ key: k, id: brief[ITEM_COLUMN[k]] }))
    .filter((x): x is { key: typeof x.key; id: string } => !!x.id);
  // Sem arquivos além da arte (que fica no próprio item), nada a mostrar.
  if (!ids.length) return null;
  const [docs, request, agency] = await Promise.all([
    ids.length
      ? store.list("documents", { filter: { id: ids.map((x) => x.id) } })
      : [],
    store.get("requests", brief.requestId),
    brief.agencyId ? store.get("parties", brief.agencyId) : null,
  ]);
  const who = agency?.name ?? t("packBrief.owner.wellmix");
  return (
    <div
      className="mb-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs"
      data-packaging-files
    >
      <p className="font-semibold text-zinc-700">
        {t("orders.packagingFiles.title")}
        {request?.number ? (
          <span className="ml-1 font-normal text-zinc-500">
            · {t("orders.packagingFiles.fromRequest", { n: request.number, who })}
          </span>
        ) : null}
      </p>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {ids.map(({ key, id }) => {
          const doc = docs.find((d) => d.id === id);
          return (
            <li key={key}>
              <span className="text-zinc-500">
                {t(`packBrief.item.${key}` as DictionaryKey)}:
              </span>{" "}
              {doc ? (
                <a
                  href={`/api/files/${doc.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className={linkClass}
                >
                  {doc.name}
                </a>
              ) : (
                "—"
              )}
              {doc ? (
                <span className="ml-1 text-zinc-500">
                  ({formatDate(doc.createdAt, t)})
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {isWellmix(user) || user.role === "agency" ? (
        <a href={`/app/packaging/${brief.id}`} className={`${linkClass} mt-1 inline-block`}>
          {t("packBrief.card.view")} →
        </a>
      ) : null}
    </div>
  );
}
