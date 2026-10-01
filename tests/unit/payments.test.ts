import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* Sinal por Pix copia e cola (BR Code) e comprovante enviado pelo cliente. */
withTempStore();

const { getStore, USER_EXTRA_DEFAULTS } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { setSetting } = await import("@/lib/settings");
const { crc16, normalizePixKey, buildPixPayload } =
  await import("@/lib/services/pix");
const { pixForRequest, submitDownPaymentProof } =
  await import("@/lib/services/down-payment");
const { canAccessDocument } = await import("@/lib/services/documents");
const { pendingTasksFor } = await import("@/lib/services/tasks");
const r = await import("@/lib/services/requests");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let maria: User;
let supplier: User;

const proofFile = () =>
  new File([new Uint8Array([37, 80, 68, 70, 45, 49])], "comprovante.pdf", {
    type: "application/pdf",
  });

/** Solicitação do João até "aguardando sinal". */
async function waitingRequest(currency = "BRL") {
  const store = getStore();
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: "prod-jarra",
    productName: "Jarra",
    description: "Teste do sinal",
    specification: null,
    quantity: 100,
    unit: "un",
    deadline: null,
    notes: null,
  });
  await r.openRfq(admin, request.id, ["fornecedor-a"]);
  const [quote] = await store.list("quotes", {
    filter: { requestId: request.id },
  });
  await r.answerQuote(supplier, quote.id, {
    price: 2,
    currency: "USD",
    leadTimeDays: 10,
    conditions: null,
  });
  await r.selectQuote(admin, quote.id, {
    sellPrice: 1000,
    sellCurrency: currency,
    downPaymentAmount: 300,
  });
  return (await store.get("requests", request.id))!;
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplier = users.find((u) => u.email === "supplier.a@china.com")!;
  maria = await getStore().create("users", {
    ...USER_EXTRA_DEFAULTS,
    email: "maria@lojista.com",
    name: "Maria (Loja do João)",
    role: "customer",
    partyId: "cliente-joao",
    locale: "pt",
    passwordHash: null,
    active: true,
  });
});

describe("Pix copia e cola (BR Code)", () => {
  it("CRC16 confere com o exemplo do manual do Banco Central", () => {
    expect(
      crc16(
        "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304",
      ),
    ).toBe("1D3D");
  });

  it("valida e normaliza a chave", () => {
    expect(normalizePixKey("529.982.247-25")).toEqual({
      key: "52998224725",
      type: "cpf",
    });
    expect(normalizePixKey("11.222.333/0001-81").type).toBe("cnpj");
    expect(normalizePixKey("Financeiro@Wellmix.com.br")).toEqual({
      key: "financeiro@wellmix.com.br",
      type: "email",
    });
    expect(normalizePixKey("+55 (11) 99999-8888")).toEqual({
      key: "+5511999998888",
      type: "phone",
    });
    expect(normalizePixKey("123E4567-E12B-12D1-A456-426655440000").type).toBe(
      "random",
    );
    for (const bad of ["", "123.456.789-00", "abc", "11.111.111/1111-11"])
      expect(() => normalizePixKey(bad)).toThrow();
  });

  it("monta o código com valor, recebedor sem acento e CRC válido", () => {
    const code = buildPixPayload({
      key: "financeiro@wellmix.com.br",
      receiverName: "Wellmix Importação e Comércio Ltda",
      receiverCity: "São José dos Campos",
      amount: 300,
      reference: "WMX-abc_123",
    });
    expect(code.startsWith("000201")).toBe(true);
    expect(code).toContain("0014br.gov.bcb.pix0125financeiro@wellmix.com.br");
    expect(code).toContain("5406300.00");
    expect(code).toContain("5802BR");
    expect(code).toContain("5925WELLMIX IMPORTACAO E COM");
    expect(code).toContain("6015SAO JOSE DOS CA");
    expect(code).toContain("62130509WMXabc123");
    expect(code.slice(-4)).toBe(crc16(code.slice(0, -4)));
  });
});

describe("sinal da solicitação", () => {
  it("sem chave configurada, não há Pix; com chave e BRL, há código e QR", async () => {
    const request = await waitingRequest();
    expect(await pixForRequest(request)).toEqual({
      unavailable: "not_configured",
    });
    await setSetting("pixKey", "financeiro@wellmix.com.br");
    await setSetting("pixReceiverName", "Wellmix");
    await setSetting("pixReceiverCity", "Sao Paulo");
    const pix = await pixForRequest(request);
    expect("payload" in pix && pix.payload).toContain("5406300.00");
    expect("qrDataUrl" in pix && pix.qrDataUrl).toMatch(
      /^data:image\/svg\+xml;base64,/,
    );
    const usd = await waitingRequest("USD");
    expect(await pixForRequest(usd)).toEqual({ unavailable: "not_brl" });
  });

  it("cliente anexa o comprovante; outro login e fornecedor não; Wellmix confirma", async () => {
    const request = await waitingRequest();
    const store = getStore();

    expect((await pendingTasksFor(joao)).some((t) => t.kind === "pay")).toBe(
      true,
    );
    await expect(
      submitDownPaymentProof(maria, request.id, proofFile()),
    ).rejects.toThrow("not_found");
    await expect(
      submitDownPaymentProof(supplier, request.id, proofFile()),
    ).rejects.toThrow("forbidden");
    await expect(
      submitDownPaymentProof(admin, request.id, proofFile()),
    ).rejects.toThrow("forbidden");

    const payment = await submitDownPaymentProof(joao, request.id, proofFile());
    expect(payment.status).toBe("pending");
    const doc = (await store.get("documents", payment.proofDocumentId!))!;
    expect(doc.requestId).toBe(request.id);
    expect(await canAccessDocument(joao, doc)).toBe(true);
    expect(await canAccessDocument(admin, doc)).toBe(true);
    expect(await canAccessDocument(maria, doc)).toBe(false);
    expect(await canAccessDocument(supplier, doc)).toBe(false);

    // Pendências: sai do cliente; a Wellmix vê que o comprovante chegou.
    expect(
      (await pendingTasksFor(joao)).some(
        (t) => t.kind === "pay" && t.link.includes(request.id),
      ),
    ).toBe(false);
    const wellmixTask = (await pendingTasksFor(admin)).find(
      (t) => t.kind === "confirm_payment" && t.link.includes(request.id),
    );
    expect(wellmixTask?.detail).toMatch(/Comprovante enviado/);

    // A Wellmix confirma usando o comprovante do cliente; depois não aceita mais envio.
    await r.confirmDownPayment(admin, request.id);
    const confirmed = (await store.get("payments", payment.id))!;
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.proofDocumentId).toBe(doc.id);
    await expect(
      submitDownPaymentProof(joao, request.id, proofFile()),
    ).rejects.toThrow("invalid_status");
  });
});
