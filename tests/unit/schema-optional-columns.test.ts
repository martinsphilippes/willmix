import { describe, expect, it } from "vitest";
import { TABLES } from "@/lib/db/schema";

/*
 * Coluna acrescentada a uma tabela que já existia em produção tem de ser
 * opcional: obrigatória, o Appwrite recusa toda linha nova sem ela ("Missing
 * required attribute") e toda gravação nas linhas antigas, que ficaram vazias.
 * Foi o que impediu os logins novos de demonstração (users.jobLevel).
 */
describe("colunas acrescentadas depois são opcionais", () => {
  it.each([
    ["users", "jobLevel"],
    ["users", "managerUserId"],
    ["users", "division"],
    ["users", "functions"],
    ["product_lines", "division"],
    ["orders", "erpSyncStatus"],
    ["purchase_sheets", "dumping"],
    ["purchase_sheets", "certificationRequired"],
    ["parties", "ownerUserId"],
  ] as const)("%s.%s", (table, column) => {
    expect(TABLES[table].columns[column].required ?? false).toBe(false);
  });
});
