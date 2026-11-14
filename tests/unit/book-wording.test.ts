import { describe, expect, it } from "vitest";
import { dictionaries, type DictionaryKey } from "@/i18n/dictionaries";

/*
 * Etapa "Book" (dono, 13/11/2026; docs/BOOKING.md, "Nome na tela"): a etapa
 * que nasce da planilha do fornecedor chama-se Book em todas as telas e nos
 * três idiomas (antes "Booking"; no chinês havia também 订舱 e 预订).
 * "Booking" fica só para a reserva de praça no navio, no embarque. As chaves,
 * as rotas e as tabelas continuam `booking`: é o nome interno, não aparece.
 */

/** Textos do embarque: aqui "booking" é a reserva no navio, não esta etapa. */
const SHIP_BOOKING: string[] = [
  "containers.codeHint",
  "importFlow.step.booking",
  "importFlow.ph.booking",
  "board.card.ordBooking",
  // Passo Booking do bloco Produção do menu (R8, reserva com a marítima).
  "flow.step.production.booking",
  "flow.help.production.booking",
  // Marco 11 "Booking e logística" (R8, reserva com a marítima; docs/MILESTONES.md).
  "milestone.booking",
];

const LOCALES = ["pt", "en", "zh"] as const;

/** A palavra solta (não pega "Workbook" nem "e-book"). */
const BOOKING = /(^|[^\w-])bookings?\b/i;
const BOOK = /(^|[^\w-])books?\b/i;

describe("etapa Book: o nome na tela", () => {
  it("nenhum texto chama a etapa de Booking (só a reserva no navio)", () => {
    for (const locale of LOCALES) {
      const wrong = Object.entries(dictionaries[locale])
        .filter(([key]) => !SHIP_BOOKING.includes(key))
        .filter(([, text]) => BOOKING.test(text))
        .map(([key]) => key);
      expect(
        wrong,
        `${locale}: escreva Book; Booking é só a reserva no navio`,
      ).toEqual([]);
    }
  });

  it("os três idiomas usam a mesma palavra", () => {
    const keys = Object.keys(dictionaries.pt) as DictionaryKey[];
    const staged = keys.filter(
      (key) =>
        BOOK.test(dictionaries.pt[key]) || BOOK.test(dictionaries.en[key]),
    );
    // A etapa inteira: menu, telas, convites, NCM, seleção, solicitação.
    expect(staged.length).toBeGreaterThan(100);
    for (const locale of ["en", "zh"] as const) {
      const missing = staged.filter(
        (key) => !BOOK.test(dictionaries[locale][key]),
      );
      expect(missing, `${locale} sem a palavra Book`).toEqual([]);
    }
  });

  it("o chinês não chama esta etapa de reserva de navio (订舱) nem de 预订", () => {
    const keys = Object.keys(dictionaries.pt) as DictionaryKey[];
    const wrong = keys
      .filter((key) => !SHIP_BOOKING.includes(key))
      .filter((key) => BOOK.test(dictionaries.zh[key]))
      .filter((key) => /订舱|预订/.test(dictionaries.zh[key]));
    expect(wrong).toEqual([]);
  });

  it("os nomes principais", () => {
    const { pt, en, zh } = dictionaries;
    expect(pt["nav.booking"]).toBe("Book");
    expect(en["nav.booking"]).toBe("Book");
    expect(zh["nav.booking"]).toBe("Book");
    expect(pt["tower.stage.booking"]).toBe("Book");
    expect(zh["tower.stage.booking"]).toBe("Book");
    expect(pt["bookingLots.detail.title"]).toBe("Book nº {n}");
    expect(pt["bookingLots.detail.header"]).toBe("Dados do book");
    expect(pt["bookingLots.detail.close.title"]).toBe("Fechar o book");
    expect(pt["bookingLots.import"]).toBe("Importar book");
    expect(pt["bookingLots.partner.launch"]).toBe("Lançar book");
    expect(zh["bookingLots.partner.launch"]).toBe("提交 Book");
    expect(pt["nav.group.myBookings"]).toBe("Meus books");
    expect(zh["nav.group.myBookings"]).toBe("我的 Book");
    expect(pt["nav.bookingInvites"]).toBe("Convites de book");
    expect(en["nav.bookingInvites"]).toBe("Book invitations");
    expect(pt["nav.ncmItems"]).toBe("NCM dos books");
    expect(pt["supplierRequests.table.col.bookingPrice"]).toBe("Preço do book");
  });

  it("a reserva no navio (embarque) continua booking", () => {
    const { pt, en, zh } = dictionaries;
    expect(pt["importFlow.step.booking"]).toBe("Booking");
    expect(pt["importFlow.ph.booking"]).toBe("Nº do booking");
    expect(en["importFlow.ph.booking"]).toBe("Booking no.");
    expect(zh["importFlow.step.booking"]).toBe("订舱");
    expect(zh["importFlow.ph.booking"]).toBe("订舱号");
    expect(pt["containers.codeHint"]).toContain("número do booking");
    expect(en["board.card.ordBooking"]).toBe("Waiting for ship booking");
    expect(zh["board.card.ordBooking"]).toBe("等待订舱");
  });
});
