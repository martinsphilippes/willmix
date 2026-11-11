import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* Sinal por Pix copia e cola (BR Code). */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { setSetting } = await import("@/lib/settings");
const { crc16, normalizePixKey, buildPixPayload } =
  await import("@/lib/services/pix");
const { pixForRequest } = await import("@/lib/services/down-payment");
const r = await import("@/lib/services/requests");
type User = import("@/lib/db").User;

let joao: User;

/** Solicitação do João "aguardando sinal" (gravada direto: a proposta saiu com a cotação). */
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
  return store.update("requests", request.id, {
    status: "WAITING_DOWN_PAYMENT",
    sellPrice: 1000,
    sellCurrency: currency,
    downPaymentAmount: 300,
  });
}

beforeAll(async () => {
  const { users } = await seedDemo();
  joao = users.find((u) => u.email === "joao@lojista.com")!;
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
    // Só a chave basta: recebedor e cidade vêm da importadora e "BRASIL".
    await setSetting("pixKey", "financeiro@wellmix.com.br");
    const onlyKey = await pixForRequest(request);
    expect("payload" in onlyKey && onlyKey.payload).toContain(
      "5907WELLMIX6006BRASIL",
    );
    // Nome e cidade já salvos continuam valendo.
    await setSetting("pixReceiverName", "Wellmix");
    await setSetting("pixReceiverCity", "Sao Paulo");
    const pix = await pixForRequest(request);
    expect("payload" in pix && pix.payload).toContain("6009SAO PAULO");
    expect("payload" in pix && pix.payload).toContain("5406300.00");
    expect("qrDataUrl" in pix && pix.qrDataUrl).toMatch(
      /^data:image\/svg\+xml;base64,/,
    );
    const usd = await waitingRequest("USD");
    expect(await pixForRequest(usd)).toEqual({ unavailable: "not_brl" });
  });
});
