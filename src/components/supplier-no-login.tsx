import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { Alert, TextLink } from "@/components/ui";

/*
 * Aviso de fornecedor sem acesso ao portal (docs/SUPPLIER_REQUESTS.md): o que
 * a Wellmix envia a ele (solicitação, cotação) fica parado até alguém criar o
 * login no cadastro. Com a tela Cadastros, cada nome leva ao quadro de acesso
 * do cadastro; sem ela, o texto pede a quem cuida de Cadastros.
 */
export function SupplierNoLoginAlert({
  suppliers,
  canParties,
  t,
  title = "portalAccess.booking.title",
  hint,
}: {
  suppliers: Array<{ id: string; name: string }>;
  canParties: boolean;
  t: Translate;
  title?: DictionaryKey;
  /** Texto embaixo (padrão: como criar o acesso). */
  hint?: DictionaryKey;
}) {
  if (!suppliers.length) return null;
  return (
    <Alert tone="warning">
      <span data-supplier-no-login>
        <span className="font-semibold">{t(title)}</span>{" "}
        <span className="inline-flex flex-wrap gap-x-3 gap-y-1">
          {suppliers.map((s) =>
            canParties ? (
              <TextLink
                key={s.id}
                href={`/app/parties/${s.id}#access`}
                data-supplier-no-login-party={s.id}
              >
                {s.name} · {t("portalAccess.create")} →
              </TextLink>
            ) : (
              <span key={s.id} data-supplier-no-login-party={s.id}>
                {s.name}
              </span>
            ),
          )}
        </span>
        <span className="mt-1 block text-xs">
          {t(
            hint ??
              (canParties
                ? "portalAccess.booking.hint"
                : "portalAccess.booking.noScreen"),
          )}
        </span>
      </span>
    </Alert>
  );
}
