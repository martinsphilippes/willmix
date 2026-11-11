/** Tabela ou coluna ainda não publicada no banco (Appwrite ou Supabase): o fluxo segue sem o briefing. */
export function isSchemaMissing(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    /unknown attribute/i.test(error.message) ||
    /attribute not found|not found in schema/i.test(error.message) ||
    /^(table|collection) with the requested id\b.*could not be found/i.test(
      error.message,
    ) ||
    [
      "table_not_found",
      "collection_not_found",
      "attribute_not_found",
      "column_not_found",
    ].includes(String((error as { type?: unknown }).type ?? ""))
  );
}
