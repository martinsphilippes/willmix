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
    ["purchase_sheets", "averageWeightPcKg"],
    ["parties", "ownerUserId"],
    ["parties", "rcaCode"],
    ["parties", "customerGroupId"],
    ["users", "sellerCode"],
    ["products", "minStock"],
    ["orders", "sankhyaChain"],
    ["orders", "sankhyaChangedAt"],
    ["orders", "sankhyaQuality"],
    ["orders", "sankhyaInspectedAt"],
    ["orders", "sankhyaReceipt"],
    ["orders", "sankhyaReceivedAt"],
    ["orders", "customsChannel"],
    ["orders", "sankhyaImportProcesses"],
    ["orders", "shipmentState"],
    ["orders", "sankhyaSituation"],
    ["orders", "sankhyaTrackId"],
    ["order_items", "shippedQty"],
    ["order_items", "receivedQty"],
    ["order_items", "pendingQty"],
    ["containers", "sankhyaCode"],
    ["containers", "sankhyaChain"],
    ["containers", "supplierId"],
  ] as const)("%s.%s", (table, column) => {
    expect(TABLES[table].columns[column].required ?? false).toBe(false);
  });
});
