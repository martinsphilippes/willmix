import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Booking (docs/BOOKING.md), ações da tela: quem pode usar, o endereço de
 * volta (só o do próprio Booking, com os filtros e sem avisos antigos), a
 * recusa com a linha que a causou, a barra de ações (o botão diz qual) e o
 * "Gravar no Booking" do Superplan (o resultado é refeito no servidor).
 */
const h = vi.hoisted(() => ({
  current: null as unknown,
  redirects: [] as string[],
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    h.redirects.push(to);
  },
  notFound: () => {
    throw new Error("not_found");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: async () => h.current,
}));
vi.mock("@/i18n/server", async () => {
  const { translator } = await import("@/i18n");
  return { getT: async () => translator("pt") };
});

withTempStore();

const { getStore, PRODUCT_EXTRA_DEFAULTS } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { ensureBookingForProduct } =
  await import("@/lib/services/booking-intake");
const { saveProductSheet } = await import("@/lib/services/product-sheet");
const { bulkBookingAction, saveBookingRowAction, saveBookingAnalysisAction } =
  await import("@/app/app/actions/booking");
type User = import("@/lib/db").User;
type Booking = import("@/lib/db").Booking;
type BookingStatus = import("@/lib/db").BookingStatus;

let admin: User;
let buyer: User;
let joao: User;
let lineId: string;
let seq = 0;

const last = () => h.redirects.at(-1) ?? "";
const query = (url: string) => new URL(url, "http://x").searchParams;
const fresh = (id: string) =>
  getStore().get("bookings", id) as Promise<Booking>;

async function row(
  status: BookingStatus = "new",
  patch: Partial<Booking> = {},
) {
  seq++;
  const product = await getStore().create("products", {
    ...PRODUCT_EXTRA_DEFAULTS,
    lineId,
    name: `Vaso ${seq}`,
    sku: null,
    specification: null,
    active: true,
    source: "import",
  } as never);
  await saveProductSheet(admin, product.id, {
    price: 4,
    currency: "RMB",
    moq: 120,
    masterCartonQty: 12,
    netWeightPcKg: 0.225,
    cbmPerCarton: 0.0183,
  });
  const { booking } = await ensureBookingForProduct(admin, {
    productId: product.id,
    importBatchId: "lote-1",
    sourceFileName: "feira.xls",
    sourceRows: String(seq),
    sourceOrder: seq,
  });
  return status === "new" && !Object.keys(patch).length
    ? booking
    : getStore().update("bookings", booking.id, { status, ...patch });
}

function bulk(fields: Record<string, string>, ids: string[]) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  for (const id of ids) form.append("ids", id);
  return form;
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  const rest: Partial<User> = { ...admin };
  delete rest.id;
  delete rest.createdAt;
  delete rest.updatedAt;
  buyer = await getStore().create("users", {
    ...(rest as Omit<User, "id" | "createdAt" | "updatedAt">),
    email: "comprador@wellmix.com",
    name: "Comprador",
    role: "operator",
    functions: ["buyer"],
    screens: null,
  });
  lineId = (await getStore().list("product_lines", { limit: 1 }))[0].id;
});

describe("barra de ações", () => {
  it("cliente não usa: volta com 'forbidden' e nada muda", async () => {
    const b = await row();
    h.current = joao;
    await bulkBookingAction(bulk({ op: "move", status: "analysis" }, [b.id]));
    expect(query(last()).get("error")).toBe("forbidden");
    expect((await fresh(b.id)).status).toBe("new");
    const form = new FormData();
    form.set("id", b.id);
    form.set("status", "analysis");
    form.set("customerId", "-");
    form.set("note", "x");
    await saveBookingRowAction(form);
    expect(query(last()).get("error")).toBe("forbidden");
    expect((await fresh(b.id)).note).toBeNull();
  });

  it("volta para a lista com os filtros; endereço de fora e avisos antigos não passam", async () => {
    const b = await row();
    h.current = buyer;
    await bulkBookingAction(
      bulk(
        {
          op: "move",
          status: "analysis",
          back: "/app/booking?status=new&price_min=3&error=x&row=y&moved=9",
        },
        [b.id],
      ),
    );
    const url = new URL(last(), "http://x");
    expect(url.pathname).toBe("/app/booking");
    expect(url.searchParams.get("status")).toBe("new");
    expect(url.searchParams.get("price_min")).toBe("3");
    expect(url.searchParams.get("moved")).toBe("1");
    expect(url.searchParams.get("error")).toBeNull();
    expect(url.searchParams.get("row")).toBeNull();
    for (const back of [
      "https://exemplo.com/app/booking",
      "//exemplo.com",
      "/app/requests",
      "/app/booking/../settings",
    ]) {
      await bulkBookingAction(bulk({ op: "assign", back }, [b.id]));
      expect(new URL(last(), "http://x").pathname).toBe("/app/booking");
      expect(last().startsWith("/app/booking")).toBe(true);
    }
  });

  it("recusa aponta a linha; faltou marcar, escolher etapa ou responsável", async () => {
    const a = await row("approved");
    const b = await row("approved");
    h.current = buyer;
    await bulkBookingAction(bulk({ op: "move", status: "analysis" }, []));
    expect(query(last()).get("error")).toBe("booking_none_selected");
    await bulkBookingAction(bulk({ op: "move" }, [a.id]));
    expect(query(last()).get("error")).toBe("booking_status_required");
    await bulkBookingAction(bulk({ op: "owner" }, [a.id]));
    expect(query(last()).get("error")).toBe("booking_owner_required");
    // Quantidade que não é número: aponta a linha e nada é gravado.
    await bulkBookingAction(
      bulk(
        {
          op: "assign",
          customer: joao.partyId!,
          [`qty_${a.id}`]: "240",
          [`qty_${b.id}`]: "doze",
        },
        [a.id, b.id],
      ),
    );
    expect(query(last()).get("error")).toBe("booking_qty_required");
    expect(query(last()).get("row")).toBe(b.id);
    expect((await fresh(a.id)).reservedQty).toBeNull();
    // Abaixo do pedido mínimo: a regra do serviço, com a linha.
    await bulkBookingAction(
      bulk(
        {
          op: "move",
          status: "reserved",
          customer: joao.partyId!,
          [`qty_${a.id}`]: "60",
        },
        [a.id],
      ),
    );
    expect(query(last()).get("error")).toBe("booking_qty_below_moq");
    expect(query(last()).get("row")).toBe(a.id);
    // Comprador não aprova (mexe na vitrine).
    const novo = await row("analysis");
    await bulkBookingAction(
      bulk({ op: "move", status: "approved" }, [novo.id]),
    );
    expect(query(last()).get("error")).toBe("booking_approver_required");
    expect(query(last()).get("row")).toBe(novo.id);
    expect((await fresh(novo.id)).status).toBe("analysis");
  });

  it("cliente e quantidades das linhas marcadas; a quantidade de linha não marcada não conta", async () => {
    const a = await row("approved");
    const b = await row("approved");
    h.current = buyer;
    await bulkBookingAction(
      bulk(
        {
          op: "move",
          status: "reserved",
          customer: joao.partyId!,
          [`qty_${a.id}`]: "1.200",
          [`qty_${b.id}`]: "360",
        },
        [a.id],
      ),
    );
    expect(query(last()).get("moved")).toBe("1");
    const first = await fresh(a.id);
    expect([first.status, first.customerId, first.reservedQty]).toEqual([
      "reserved",
      joao.partyId,
      1200,
    ]);
    const second = await fresh(b.id);
    expect([second.status, second.reservedQty]).toEqual(["approved", null]);
    // Responsável em lote ("-" tira).
    await bulkBookingAction(
      bulk({ op: "owner", ownerUserId: buyer.id }, [a.id, b.id]),
    );
    expect(query(last()).get("owners")).toBe("2");
    await bulkBookingAction(bulk({ op: "owner", ownerUserId: "-" }, [b.id]));
    expect((await fresh(b.id)).ownerUserId).toBeNull();
  });

  it("gerar solicitação leva para a solicitação criada", async () => {
    const a = await row("approved");
    const b = await row("approved");
    h.current = buyer;
    await bulkBookingAction(
      bulk({ op: "request", customer: joao.partyId! }, [a.id, b.id]),
    );
    expect(last()).toMatch(/^\/app\/requests\/batch\/.+\?created=2$/);
    expect((await fresh(a.id)).status).toBe("requested");
    const c = await row("approved");
    await bulkBookingAction(
      bulk({ op: "request", customer: joao.partyId! }, [c.id]),
    );
    expect(last()).toMatch(/^\/app\/requests\/[^/]+\?created=1$/);
  });

  it("analisar no Superplan: só quem abre o Superplan", async () => {
    const a = await row();
    h.current = buyer;
    await bulkBookingAction(bulk({ op: "analyze" }, [a.id]));
    expect(query(last()).get("error")).toBe("booking_analysis_forbidden");
    expect((await fresh(a.id)).analysis ?? null).toBeNull();
    h.current = admin;
    await bulkBookingAction(bulk({ op: "analyze" }, [a.id]));
    expect(query(last()).get("analyzed")).toBe("1");
    const saved = await fresh(a.id);
    expect(saved.status).toBe("analysis");
    expect(saved.analysis?.byUserId).toBe(admin.id);
  });
});

describe("página da linha", () => {
  it("salva etapa, cliente, quantidade, responsável e observação", async () => {
    const b = await row("approved");
    h.current = buyer;
    const form = new FormData();
    form.set("id", b.id);
    form.set("status", "reserved");
    form.set("customerId", joao.partyId!);
    form.set("reservedQty", "240");
    form.set("ownerUserId", buyer.id);
    form.set("note", "cliente pediu amostra");
    await saveBookingRowAction(form);
    expect(last()).toBe(`/app/booking/${b.id}?saved=1`);
    const saved = await fresh(b.id);
    expect([
      saved.status,
      saved.customerId,
      saved.reservedQty,
      saved.ownerUserId,
      saved.note,
    ]).toEqual([
      "reserved",
      joao.partyId,
      240,
      buyer.id,
      "cliente pediu amostra",
    ]);
    // Etapa que não existe e quantidade quebrada: nada é gravado.
    form.set("status", "vendido");
    await saveBookingRowAction(form);
    expect(query(last()).get("error")).toBe("invalid_input");
    form.set("status", "reserved");
    form.set("reservedQty", "12,5");
    await saveBookingRowAction(form);
    expect(query(last()).get("error")).toBe("invalid_input");
    expect((await fresh(b.id)).reservedQty).toBe(240);
  });
});

describe("gravar no Booking pelo Superplan", () => {
  it("o resultado é refeito no servidor; só quem abre o Superplan grava", async () => {
    const b = await row();
    const { loadSuperplanContext, superplanPrefillsFor } =
      await import("@/lib/services/superplan-analysis");
    const { defaultSuperplanInput } = await import("@/lib/superplan-defaults");
    const { computeSuperplan } = await import("@/lib/superplan");
    const ctx = await loadSuperplanContext();
    const prefill = (await superplanPrefillsFor([b.productId])).get(
      b.productId,
    )!;
    const built = defaultSuperplanInput(prefill, ctx);
    const form = new FormData();
    form.set("bookingId", b.id);
    form.set("input", JSON.stringify(built.input));
    form.set("businessType", built.businessType);
    form.set("container", built.container ?? "");
    form.set("ncmFound", "0");
    // Valores "do navegador" que não existem na ação: são ignorados.
    form.set("verdict", "viable");
    form.set("salePriceBrl", "0,01");

    h.current = buyer;
    await saveBookingAnalysisAction(form);
    expect(query(last()).get("error")).toBe("forbidden");
    expect((await fresh(b.id)).analysis ?? null).toBeNull();

    h.current = admin;
    await saveBookingAnalysisAction(form);
    expect(last()).toBe(`/app/booking/${b.id}?analysis=1`);
    const saved = await fresh(b.id);
    const expected = computeSuperplan(built.input);
    expect(saved.status).toBe("analysis");
    expect(saved.analysis?.businessType).toBe(built.businessType);
    expect(saved.analysis?.verdict ?? null).toBe(expected.verdict);
    expect(saved.analysis?.missing).toEqual(expected.missing);
    expect(saved.analysis?.byUserId).toBe(admin.id);

    // Simulação estragada: recusa sem gravar.
    for (const bad of ["não é json", JSON.stringify({ unitPrice: -1 })]) {
      form.set("input", bad);
      await saveBookingAnalysisAction(form);
      expect(query(last()).get("error")).toBe("invalid_input");
    }
    expect((await fresh(b.id)).analysis?.at).toBe(saved.analysis?.at);
  });
});

describe("achados da revisão", () => {
  it("filtro com asterisco (medida 10*15) volta com os filtros depois da ação", async () => {
    const b = await row();
    h.current = buyer;
    await bulkBookingAction(
      bulk(
        {
          op: "move",
          status: "analysis",
          back: "/app/booking?name=vaso+10*15&status=new",
        },
        [b.id],
      ),
    );
    const url = new URL(last(), "http://x");
    expect(url.pathname).toBe("/app/booking");
    expect(url.searchParams.get("name")).toBe("vaso 10*15");
    expect(url.searchParams.get("status")).toBe("new");
    expect(url.searchParams.get("moved")).toBe("1");
  });

  it("mais de 30 linhas no 'Gerar solicitação': recusa com o código que diz o limite", async () => {
    h.current = buyer;
    await bulkBookingAction(
      bulk(
        { op: "request", customer: joao.partyId! },
        Array.from({ length: 31 }, (_, i) => `linha-${i}`),
      ),
    );
    expect(query(last()).get("error")).toBe("booking_request_too_many");
    const { translator } = await import("@/i18n");
    for (const locale of ["pt", "en", "zh"] as const) {
      const text = translator(locale)(
        "booking.error.booking_request_too_many",
        { max: 30 },
      );
      expect(text).toContain("30");
      expect(text).not.toContain("{max}");
    }
  });

  it("página aberta há tempo: salvar a observação não desfaz a etapa, o cliente nem a reserva", async () => {
    const b = await row();
    // A página foi aberta quando a linha estava em Novo, sem cliente.
    const form = new FormData();
    form.set("id", b.id);
    for (const [k, v] of Object.entries({
      status: "new",
      customerId: "-",
      reservedQty: "",
      ownerUserId: admin.id,
      note: "",
    })) {
      form.set(k, v);
      form.set(`was.${k}`, v);
    }
    // Enquanto isso, a linha foi aprovada e reservada por outra pessoa.
    await getStore().update("bookings", b.id, {
      status: "reserved",
      customerId: joao.partyId,
      reservedQty: 240,
    });
    form.set("note", "ligar amanhã");
    h.current = admin;
    await saveBookingRowAction(form);
    expect(last()).toBe(`/app/booking/${b.id}?saved=1`);
    const saved = await fresh(b.id);
    expect([
      saved.status,
      saved.customerId,
      saved.reservedQty,
      saved.note,
    ]).toEqual(["reserved", joao.partyId, 240, "ligar amanhã"]);
    // O que a pessoa mudou de propósito continua valendo.
    form.set("was.note", "ligar amanhã");
    form.set("was.status", "reserved");
    form.set("was.customerId", joao.partyId!);
    form.set("was.reservedQty", "240");
    form.set("status", "reserved");
    form.set("customerId", joao.partyId!);
    form.set("reservedQty", "360");
    await saveBookingRowAction(form);
    expect((await fresh(b.id)).reservedQty).toBe(360);
  });
});

describe("achados da revisão (segunda leva)", () => {
  it("a quantidade digitada vale em toda ação: trocar responsável e analisar também a gravam", async () => {
    const a = await row("approved");
    const b = await row("approved");
    h.current = buyer;
    await bulkBookingAction(
      bulk(
        {
          op: "owner",
          ownerUserId: buyer.id,
          customer: joao.partyId!,
          [`qty_${a.id}`]: "480",
        },
        [a.id],
      ),
    );
    expect(query(last()).get("owners")).toBe("1");
    const first = await fresh(a.id);
    // O cliente escolhido na barra também vale ao trocar o responsável.
    expect([first.ownerUserId, first.customerId, first.reservedQty]).toEqual([
      buyer.id,
      joao.partyId,
      480,
    ]);
    h.current = admin;
    await bulkBookingAction(
      bulk({ op: "analyze", [`qty_${b.id}`]: "1.200" }, [b.id]),
    );
    expect(query(last()).get("analyzed")).toBe("1");
    const second = await fresh(b.id);
    expect(second.reservedQty).toBe(1200);
    expect(second.analysis?.byUserId).toBe(admin.id);
    // Quantidade que não é número inteiro: recusa na linha, sem analisar.
    const c = await row();
    await bulkBookingAction(
      bulk({ op: "analyze", [`qty_${c.id}`]: "doze" }, [c.id]),
    );
    expect(query(last()).get("error")).toBe("booking_qty_required");
    expect(query(last()).get("row")).toBe(c.id);
    expect((await fresh(c.id)).analysis ?? null).toBeNull();
  });

  it("analisar várias linhas: a simulação gravada à mão fica e a tela é avisada (mantidas e sem II/IPI)", async () => {
    const manual = await row();
    const plain = await row();
    const { loadSuperplanContext, superplanPrefillsFor } =
      await import("@/lib/services/superplan-analysis");
    const { defaultSuperplanInput } = await import("@/lib/superplan-defaults");
    const ctx = await loadSuperplanContext();
    const prefill = (await superplanPrefillsFor([manual.productId])).get(
      manual.productId,
    )!;
    const built = defaultSuperplanInput(prefill, ctx);
    const form = new FormData();
    form.set("bookingId", manual.id);
    form.set("input", JSON.stringify({ ...built.input, salePrice: 19.9 }));
    form.set("businessType", built.businessType);
    form.set("container", built.container ?? "");
    form.set("ncmFound", "1");
    h.current = admin;
    await saveBookingAnalysisAction(form);
    const saved = await fresh(manual.id);
    expect(saved.analysis?.manual).toBe(true);
    expect(saved.analysis?.salePriceBrl).toBe(19.9);

    await bulkBookingAction(bulk({ op: "analyze" }, [manual.id, plain.id]));
    const q = query(last());
    expect([q.get("analyzed"), q.get("kept")]).toEqual(["1", "1"]);
    // Sem câmbio no teste não houve custo: nada a avisar sobre II e IPI.
    expect(q.get("norates")).toBeNull();
    expect((await fresh(manual.id)).analysis).toEqual(saved.analysis);
    expect((await fresh(plain.id)).analysis?.manual ?? false).toBe(false);
    // Avisos de uma ida anterior não voltam grudados no endereço.
    await bulkBookingAction(
      bulk(
        {
          op: "owner",
          ownerUserId: buyer.id,
          back: "/app/booking?status=analysis&kept=1&norates=1&analyzed=1",
        },
        [plain.id],
      ),
    );
    expect(last()).toBe("/app/booking?status=analysis&owners=1");
  });

  it("gerar solicitação sem cliente responde com o texto próprio, na linha", async () => {
    const a = await row("approved");
    h.current = buyer;
    await bulkBookingAction(bulk({ op: "request" }, [a.id]));
    const q = query(last());
    expect([q.get("error"), q.get("row")]).toEqual([
      "booking_request_customer",
      a.id,
    ]);
    const { translator } = await import("@/i18n");
    for (const lang of ["pt", "en", "zh"] as const) {
      const text = translator(lang)("booking.error.booking_request_customer");
      expect(text).not.toBe("booking.error.booking_request_customer");
      expect(text.length).toBeGreaterThan(10);
    }
    expect((await fresh(a.id)).status).toBe("approved");
  });
});
