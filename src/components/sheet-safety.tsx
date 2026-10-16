import type { Translate } from "@/i18n";
import { MissingFields } from "./missing-fields";
import { missingFieldsView } from "./missing-fields-view";
import { FormDraftGuard } from "./form-draft-guard";

/*
 * Avisos da ficha que impedem perder o que foi digitado:
 * - campos que o servidor não conseguiu ler (?error=invalid_fields&fields=…),
 *   clicáveis como o "faltam" (o resto da ficha foi salvo);
 * - rascunho do navegador devolvido aos campos quando o envio falha.
 */
export function SheetSafety({
  t,
  formId,
  storageKey,
  error,
  fields,
  saved,
  token,
}: {
  t: Translate;
  formId: string;
  storageKey: string;
  error: unknown;
  fields: unknown;
  saved: boolean;
  token: unknown;
}) {
  const failed = typeof error === "string" && error.length > 0;
  const invalid =
    error === "invalid_fields" && typeof fields === "string"
      ? fields
          .split(",")
          .filter((k) => /^[A-Za-z0-9]{1,40}$/.test(k))
          .slice(0, 40)
      : [];
  return (
    <>
      <FormDraftGuard
        formId={formId}
        storageKey={storageKey}
        failed={failed}
        saved={saved}
        token={typeof token === "string" ? token : String(failed)}
        // Campo ilegível: o aviso de baixo já explica; o digitado volta sem outro aviso.
        message={invalid.length ? "" : t("sheet.draftRestored")}
      />
      {invalid.length ? (
        <div data-invalid-fields={invalid.join(" ")}>
          <MissingFields
            key={typeof token === "string" ? token : "invalid"}
            {...missingFieldsView(t, "sheet.invalidFields", invalid)}
            tone="danger"
            autoFocus
          />
        </div>
      ) : null}
    </>
  );
}
