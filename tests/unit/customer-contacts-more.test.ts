import { describe, expect, it } from "vitest";
import {
  cleanContacts,
  contactIssues,
  contactsFromEntries,
  readContacts,
} from "@/lib/order-terms";

const base = {
  "contact.partner.phone": "(47) 99999-0001",
  "contact.partner.email": "socio@cliente.com",
  "contact.buyer.phone": "(47) 99999-0002",
  "contact.buyer.email": "compras@cliente.com",
  "contact.finance.phone": "(47) 99999-0003",
  "contact.finance.email": "fin@cliente.com",
  "contact.logistics.phone": "(47) 99999-0004",
  "contact.logistics.email": "log@cliente.com",
};

describe("mais de um contato por área (dono, 17/11/2026)", () => {
  it("lê os extras na ordem do número e ignora linhas vazias", () => {
    const values: Record<string, string> = {
      ...base,
      "contact.buyer.7.phone": "(47) 98888-0007",
      "contact.buyer.7.email": "b7@cliente.com",
      "contact.buyer.3.phone": "(47) 98888-0003",
      "contact.buyer.3.email": "b3@cliente.com",
      "contact.finance.2.phone": "",
      "contact.finance.2.email": "",
    };
    const c = contactsFromEntries((k) => values[k] ?? "", Object.keys(values));
    expect(c.buyer.email).toBe("compras@cliente.com");
    expect(c.more?.buyer?.map((e) => e.email)).toEqual([
      "b3@cliente.com",
      "b7@cliente.com",
    ]);
    expect(c.more?.finance).toBeUndefined();
    expect(contactIssues(c, [])).toEqual([]);
  });

  it("confere os extras como o primeiro e guarda no JSON", () => {
    const values: Record<string, string> = {
      ...base,
      "contact.partner.1.phone": "123",
      "contact.partner.1.email": "vendedor@wellmix.com",
    };
    const c = contactsFromEntries((k) => values[k] ?? "", Object.keys(values));
    const issues = contactIssues(c, [{ email: "vendedor@wellmix.com" }]);
    expect(issues.map((i) => [i.role, i.code, i.index])).toEqual([
      ["partner", "invalid_phone", 0],
      ["partner", "same_as_seller", 0],
    ]);
    const back = readContacts(JSON.parse(JSON.stringify(cleanContacts(c))));
    expect(back?.more?.partner?.[0].email).toBe("vendedor@wellmix.com");
  });

  it("o JSON antigo (sem more) segue valendo", () => {
    const c = contactsFromEntries(
      (k) => base[k as keyof typeof base] ?? "",
      Object.keys(base),
    );
    expect(c.more).toBeUndefined();
    expect(readContacts(cleanContacts(c))?.more).toBeUndefined();
  });
});
