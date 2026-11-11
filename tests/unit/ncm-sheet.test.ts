import { describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* NCM na ficha: as sugestões aparecem no campo. */
withTempStore();

const { ncmSuggestionsFor } = await import("@/lib/services/ncm-suggestions");

describe("NCM na ficha", () => {
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
