import type { Translate } from "@/i18n";
import { Alert } from "./ui";
import { FieldErrors } from "./field-errors";

/** Nomes de campos da volta de um envio recusado (?fields=a,b), validados. */
export function fieldNamesParam(raw: unknown): string[] {
  return typeof raw === "string"
    ? raw
        .split(",")
        .filter((k) => /^[A-Za-z][A-Za-z0-9_.]{0,59}$/.test(k))
        .slice(0, 20)
    : [];
}

/**
 * Aviso de erro de um envio. Valor recusado com o nome do campo conhecido
 * (`invalid_input` + ?fields=): a lista diz qual campo e leva até ele; senão,
 * o texto do erro.
 */
export function ActionError({
  t,
  code,
  text,
  fields,
  token,
}: {
  t: Translate;
  code: unknown;
  text: string | null;
  fields: unknown;
  token?: unknown;
}) {
  if (!text) return null;
  const names = code === "invalid_input" ? fieldNamesParam(fields) : [];
  if (!names.length) return <Alert tone="danger">{text}</Alert>;
  return (
    <FieldErrors
      names={names}
      before={t("form.invalid.before")}
      fallback={text}
      hint={t("sheet.missingHint")}
      token={typeof token === "string" ? token : undefined}
    />
  );
}
