import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* NCM na ficha: vem da solicitação (confirmado com a IA) e as sugestões aparecem no campo. */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const qs = await import("@/lib/services/quote-sheet");
const { ncmSuggestionsFor } = await import("@/lib/services/ncm-suggestions");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
});

describe("NCM na ficha da cotação", () => {
  it("ficha nova pega o NCM confirmado na solicitação, formatado", async () => {
    const store = getStore();
    const request = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productName: "Boneca nova",
      description: "Boneca de vinil 30 cm",
      quantity: 100,
      unit: "un",
    });
    await store.update("requests", request.id, {
      ncm: "95030021",
      ncmSource: "ai",
    });
    await r.openRfq(admin, request.id, ["fornecedor-a"]);
    const [quote] = await store.list("quotes", {
      filter: { requestId: request.id },
    });
    const view = await qs.getQuoteSheetForUser(admin, quote.id);
    expect(view?.sheet.ncm).toBe("9503.00.21");
  });

  it("sem produto do catálogo: as sugestões vêm da solicitação (confirmado e IA)", async () => {
    const chips = await ncmSuggestionsFor(null, {
      ncm: null,
      ncmSuggestions: [
        {
          ncm: "95030021",
          description: "Bonecos",
          reason: "boneca",
          source: "ai",
          model: "x",
        },
        {
          ncm: "95030099",
          description: "Outros",
          reason: null,
          source: "table",
          model: null,
        },
      ],
    });
    expect(chips.map((c) => [c.ncm, c.source])).toEqual([
      ["95030021", "ai"],
      ["95030099", "table"],
    ]);
    const confirmed = await ncmSuggestionsFor(null, {
      ncm: "95030021",
      ncmSuggestions: null,
    });
    expect(confirmed.map((c) => c.source)).toEqual(["request"]);
  });
});
