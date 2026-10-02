import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* SLA de resposta da cotação: prazo da solicitação definido pela Wellmix. */
withTempStore();

const { seedDemo } = await import("@/lib/seed");
const { setSetting } = await import("@/lib/settings");
const { createRequest } = await import("@/lib/services/requests");
const { addBusinessDays, quoteSlaDeadline } = await import("@/lib/sla");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
});

const input = (deadline: string | null) => ({
  customerId: "cliente-joao",
  productId: null,
  productName: "Jarra",
  description: "Teste SLA",
  specification: null,
  quantity: 10,
  unit: "un",
  deadline,
});

describe("SLA de resposta da cotação", () => {
  it("conta só dias úteis", () => {
    // 2026-10-02 é sexta: 1 dia útil → segunda 05/10; 5 → sexta 09/10.
    expect(addBusinessDays("2026-10-02", 1)).toBe("2026-10-05");
    expect(addBusinessDays("2026-10-02", 5)).toBe("2026-10-09");
    // sábado conta a partir da segunda
    expect(addBusinessDays("2026-10-03", 1)).toBe("2026-10-05");
    // horário de Brasília: 01:00 UTC do dia 3 ainda é dia 2 no Brasil
    expect(quoteSlaDeadline(1, new Date("2026-10-03T01:00:00Z"))).toBe(
      "2026-10-05",
    );
  });

  it("cliente recebe o prazo do SLA, mesmo enviando outra data", async () => {
    await setSetting("quoteSlaBusinessDays", 3);
    const request = await createRequest(joao, input("2030-01-01"));
    expect(request.deadline?.slice(0, 10)).toBe(quoteSlaDeadline(3));
  });

  it("Wellmix usa o SLA por padrão e pode ajustar", async () => {
    await setSetting("quoteSlaBusinessDays", 7);
    const standard = await createRequest(admin, input(null));
    expect(standard.deadline?.slice(0, 10)).toBe(quoteSlaDeadline(7));
    const adjusted = await createRequest(admin, input("2030-01-01"));
    expect(adjusted.deadline?.slice(0, 10)).toBe("2030-01-01");
  });
});
