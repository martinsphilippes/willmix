import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Carteira e atendimento (dono, 18/11/2026; docs/TRADE_COMERCIAL.md):
 * grupo econômico montado à mão, responsável (cliente > grupo > vendedor do
 * Sankhya), atendimento que só vale confirmado pelos dois lados (quem atendeu
 * registra; o cliente confirma pelo link, sem login), prazo único (padrão 30
 * dias) e as pendências só dos clientes acompanhados.
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

withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const svc = await import("@/lib/services/portfolio");
const actions = await import("@/app/app/actions/portfolio");
const publicActions = await import("@/app/app/actions/attendance-public");
const { tasksForFunctions } = await import("@/lib/task-owner");
const { flowStepsOf } = await import("@/lib/flow");
const { brasiliaLocal } =
  await import("@/app/app/portfolio/_components/shared");
type User = import("@/lib/db").User;
type Party = import("@/lib/db").Party;

const DAY = 86_400_000;
const NOW = new Date();
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

let admin: User;
/** Vendas (função "sales": abre a Carteira, sem "Gerir carteira e trade"). */
let sales: User;
/** Comprador e planejamento: não abre a Carteira. */
let buyer: User;
let joao: Party;

async function newCustomer(name: string, extra: Partial<Party> = {}) {
  return getStore().create("parties", {
    type: "customer",
    name,
    country: "BR",
    email: null,
    phone: null,
    taxId: null,
    notes: null,
    active: true,
    ...extra,
  } as never) as Promise<Party>;
}

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const tokenOf = (path: string | null) => path!.replace("/atendimento/", "");

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  sales = users.find((u) => u.email === "vendas@wellmix.com")!;
  buyer = users.find((u) => u.email === "operador@wellmix.com")!;
  joao = (await getStore().get("parties", "cliente-joao"))!;
});

describe("regras puras", () => {
  it("situação pelo último atendimento confirmado: nunca, em dia, vence em breve, atrasado", () => {
    const now = new Date("2026-11-18T15:00:00Z");
    expect(svc.standingOf(null, 30, now)).toEqual({
      status: "never",
      days: null,
      dueDay: null,
    });
    expect(svc.standingOf("2026-11-18T12:00:00Z", 30, now).status).toBe("ok");
    // 23 dias: ainda em dia; 24 a 30: vence em até 7 dias; 31: atrasado.
    expect(svc.standingOf("2026-10-26T15:00:00Z", 30, now)).toMatchObject({
      status: "ok",
      days: 23,
    });
    expect(svc.standingOf("2026-10-25T15:00:00Z", 30, now).status).toBe(
      "due_soon",
    );
    expect(svc.standingOf("2026-10-19T15:00:00Z", 30, now)).toMatchObject({
      status: "due_soon",
      days: 30,
      dueDay: "2026-11-18",
    });
    expect(svc.standingOf("2026-10-18T15:00:00Z", 30, now).status).toBe(
      "overdue",
    );
    // Dia de Brasília: 01h UTC do dia 18 ainda é dia 17 em Brasília.
    expect(
      svc.standingOf(
        "2026-11-17T12:00:00Z",
        1,
        new Date("2026-11-18T01:00:00Z"),
      ).days,
    ).toBe(0);
    // Prazo curto: a janela de "vence em breve" nunca engole o prazo todo.
    expect(svc.standingOf("2026-11-18T12:00:00Z", 1, now).status).toBe("ok");
  });

  it("responsável: o do cliente; senão o do grupo; senão o vendedor (RCA); quem saiu não conta", () => {
    const sellers = new Map([["101", "seller"]]);
    const active = new Set(["chosen", "groupOwner", "seller"]);
    const base = {
      type: "customer" as const,
      ownerUserId: null,
      rcaCode: "101",
      sankhyaRefs: null,
      customerGroupId: "g",
    };
    const group = { ownerUserId: "groupOwner", archivedAt: null };
    expect(
      svc.ownerOf({ ...base, ownerUserId: "chosen" }, group, sellers, active),
    ).toEqual({ userId: "chosen", source: "customer" });
    expect(svc.ownerOf(base, group, sellers, active)).toEqual({
      userId: "groupOwner",
      source: "group",
    });
    expect(
      svc.ownerOf(
        base,
        { ...group, archivedAt: "2026-11-01" },
        sellers,
        active,
      ),
    ).toEqual({ userId: "seller", source: "seller" });
    expect(
      svc.ownerOf({ ...base, ownerUserId: "gone" }, null, sellers, active),
    ).toEqual({ userId: "seller", source: "seller" });
    expect(
      svc.ownerOf({ ...base, rcaCode: null }, null, sellers, active),
    ).toEqual({ userId: null, source: null });
  });

  it("acompanhado: num grupo ativo ou com responsável escolhido", () => {
    const groups = new Map([
      ["a", { archivedAt: null }],
      ["b", { archivedAt: "2026-11-01" }],
    ]);
    expect(
      svc.isFollowed({ ownerUserId: null, customerGroupId: "a" }, groups),
    ).toBe(true);
    expect(
      svc.isFollowed({ ownerUserId: null, customerGroupId: "b" }, groups),
    ).toBe(false);
    expect(
      svc.isFollowed({ ownerUserId: "x", customerGroupId: null }, groups),
    ).toBe(true);
    expect(
      svc.isFollowed({ ownerUserId: null, customerGroupId: null }, groups),
    ).toBe(false);
  });

  it("só o atendimento confirmado zera os dias", () => {
    expect(
      svc.attendanceSummary([
        { status: "pending_customer", occurredAt: "2026-11-10T10:00:00Z" },
        { status: "disputed", occurredAt: "2026-11-12T10:00:00Z" },
        { status: "confirmed", occurredAt: "2026-11-01T10:00:00Z" },
        { status: "cancelled", occurredAt: "2026-11-15T10:00:00Z" },
      ]),
    ).toEqual({ lastConfirmedAt: "2026-11-01T10:00:00Z", pending: 1 });
  });
});

describe("carteira", () => {
  let groupId: string;

  it("quem abre e quem gere: Vendas abre; comprador não; só o administrador gere", async () => {
    expect(svc.canUsePortfolio(admin)).toBe(true);
    expect(svc.canUsePortfolio(sales)).toBe(true);
    expect(svc.canUsePortfolio(buyer)).toBe(false);
    expect(svc.canManagePortfolio(admin)).toBe(true);
    expect(svc.canManagePortfolio(sales)).toBe(false);
    await expect(svc.loadPortfolio(buyer)).rejects.toThrow("forbidden");
    await expect(
      svc.createCustomerGroup(sales, {
        name: "Grupo Vendas",
        notes: null,
        ownerUserId: null,
      }),
    ).rejects.toThrow("forbidden");
  });

  it("grupo montado à mão: o cliente entra na carteira com o responsável do grupo", async () => {
    const group = await svc.createCustomerGroup(admin, {
      name: "Grupo Campineira",
      notes: "Projeto Campineira",
      ownerUserId: sales.id,
    });
    groupId = group.id;
    await expect(
      svc.createCustomerGroup(admin, {
        name: " grupo campineira ",
        notes: null,
        ownerUserId: null,
      }),
    ).rejects.toThrow("group_name_taken");
    await svc.setCustomerGroup(admin, joao.id, groupId);
    const view = await svc.loadPortfolio(admin, {}, NOW);
    const row = view.rows.find((r) => r.customerId === joao.id)!;
    expect(row).toMatchObject({
      groupName: "Grupo Campineira",
      ownerId: sales.id,
      ownerSource: "group",
      status: "never",
      pending: 0,
    });
    // Quem não gere vê a própria carteira (e a da equipe abaixo).
    const mine = await svc.loadPortfolio(sales, {}, NOW);
    expect(mine.rows.map((r) => r.customerId)).toContain(joao.id);
    expect(mine.canManage).toBe(false);
  });

  it("cliente fora de grupo e sem responsável não entra na carteira nem gera pendência", async () => {
    const loose = await newCustomer("Cliente Solto");
    const view = await svc.loadPortfolio(admin, {}, NOW);
    expect(view.rows.map((r) => r.customerId)).not.toContain(loose.id);
    const drafts = await svc.portfolioTaskDrafts(NOW);
    expect(drafts.map((d) => d.customerId)).not.toContain(loose.id);
    // Mas a ficha abre e o atendimento pode ser registrado.
    const page = await svc.loadPortfolioCustomer(sales, loose.id, NOW);
    expect(page?.followed).toBe(false);
  });

  it('nunca atendido: pendência "Atender" para o responsável, no passo da carteira', async () => {
    const drafts = await svc.portfolioTaskDrafts(NOW);
    const attend = drafts.find(
      (d) => d.kind === "customer_attendance" && d.customerId === joao.id,
    )!;
    expect(attend).toMatchObject({
      title: `Atender ${joao.name}`,
      ownerUserId: sales.id,
      link: `/app/portfolio/${joao.id}`,
    });
    expect(
      flowStepsOf({ kind: "customer_attendance" }).map((s) => s.key),
    ).toEqual(["portfolio"]);
    const asTask = [{ ...attend, overdue: false, group: attend.kind }];
    expect(tasksForFunctions(sales, asTask)).toHaveLength(1);
    expect(tasksForFunctions(buyer, asTask)).toHaveLength(0);
    expect(tasksForFunctions(admin, asTask)).toHaveLength(1);
    // Sem responsável: fica com quem gere a carteira (não com qualquer um de Vendas).
    const unowned = [{ ...asTask[0], ownerUserId: null }];
    expect(tasksForFunctions(sales, unowned)).toHaveLength(0);
  });

  it("registrar: quem atendeu confere data, resumo e canal", async () => {
    const base = {
      customerId: joao.id,
      channel: "visit" as const,
      summary: "Visita na loja, mostrei o catálogo",
      nextStep: null,
    };
    await expect(
      svc.registerAttendance(
        sales,
        {
          ...base,
          occurredAt: new Date(NOW.getTime() + 2 * 3_600_000).toISOString(),
        },
        NOW,
      ),
    ).rejects.toThrow("occurred_future");
    await expect(
      svc.registerAttendance(
        sales,
        { ...base, occurredAt: ago(61 * DAY) },
        NOW,
      ),
    ).rejects.toThrow("occurred_too_old");
    await expect(
      svc.registerAttendance(
        sales,
        { ...base, summary: " ", occurredAt: ago(DAY) },
        NOW,
      ),
    ).rejects.toThrow("summary_required");
    await expect(
      svc.registerAttendance(buyer, { ...base, occurredAt: ago(DAY) }, NOW),
    ).rejects.toThrow("forbidden");
  });

  it("confirmado pelos dois lados: quem atendeu registra, o cliente confirma pelo link e os dias zeram", async () => {
    const a = await svc.registerAttendance(
      sales,
      {
        customerId: joao.id,
        channel: "visit",
        occurredAt: ago(2 * DAY),
        summary: "Visita na loja, mostrei o catálogo",
        nextStep: "Mandar a proposta",
      },
      NOW,
    );
    expect(a.status).toBe("pending_customer");
    // Ainda não vale: só o confirmado conta.
    let row = (await svc.loadPortfolio(admin, {}, NOW)).rows.find(
      (r) => r.customerId === joao.id,
    )!;
    expect(row).toMatchObject({ status: "never", pending: 1 });

    const path = svc.attendancePath(a);
    expect(path).toMatch(/^\/atendimento\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{32}$/);
    const token = tokenOf(path);
    expect((await svc.attendanceByToken(token, NOW)).state).toBe("open");
    // Adulterado: não vale.
    const forged = `${token.slice(0, -2)}${token.endsWith("AA") ? "BB" : "AA"}`;
    expect((await svc.attendanceByToken(forged, NOW)).state).toBe("invalid");
    expect((await svc.attendanceByToken("qualquer.coisa", NOW)).state).toBe(
      "invalid",
    );
    // A página pública mostra só o necessário.
    const shown = await svc.publicAttendanceView(token, NOW);
    expect(shown).toMatchObject({
      state: "open",
      customerName: joao.name,
      attendantName: sales.name.split(" ")[0],
      channel: "visit",
    });
    expect(JSON.stringify(shown)).not.toContain("Mandar a proposta");

    await expect(
      svc.answerAttendance(
        token,
        { answer: "confirm", name: " ", note: null },
        NOW,
      ),
    ).rejects.toThrow("name_required");
    const confirmed = await svc.answerAttendance(
      token,
      { answer: "confirm", name: "João da Loja", note: null },
      NOW,
    );
    expect(confirmed).toMatchObject({
      status: "confirmed",
      customerName: "João da Loja",
    });
    // Uso único.
    await expect(
      svc.answerAttendance(
        token,
        { answer: "confirm", name: "João", note: null },
        NOW,
      ),
    ).rejects.toThrow("link_confirmed");
    expect((await svc.publicAttendanceView(token, NOW)).summary).toBeNull();

    row = (await svc.loadPortfolio(admin, {}, NOW)).rows.find(
      (r) => r.customerId === joao.id,
    )!;
    expect(row).toMatchObject({ status: "ok", days: 2, pending: 0 });
    const drafts = await svc.portfolioTaskDrafts(NOW);
    expect(
      drafts.some(
        (d) => d.kind === "customer_attendance" && d.customerId === joao.id,
      ),
    ).toBe(false);
    // Passou do prazo (30 dias por padrão): atrasado de novo.
    const later = new Date(NOW.getTime() + 30 * DAY);
    row = (await svc.loadPortfolio(admin, {}, later)).rows.find(
      (r) => r.customerId === joao.id,
    )!;
    expect(row.status).toBe("overdue");
  });

  it("outro link invalida o anterior; vencido não confirma; sem resposta há 3 dias vira cobrança", async () => {
    const a = await svc.registerAttendance(
      sales,
      {
        customerId: joao.id,
        channel: "call",
        occurredAt: ago(3_600_000),
        summary: "Ligação sobre a reposição",
        nextStep: null,
      },
      NOW,
    );
    const first = tokenOf(svc.attendancePath(a));
    const renewed = await svc.renewAttendanceLink(sales, a.id, NOW);
    const second = tokenOf(svc.attendancePath(renewed));
    expect(second).not.toBe(first);
    expect((await svc.attendanceByToken(first, NOW)).state).toBe("invalid");
    expect((await svc.attendanceByToken(second, NOW)).state).toBe("open");
    const expired = new Date(NOW.getTime() + 15 * DAY);
    await expect(
      svc.answerAttendance(
        second,
        { answer: "confirm", name: "João", note: null },
        expired,
      ),
    ).rejects.toThrow("link_expired");
    // O comprador não mexe no atendimento dos outros.
    await expect(svc.renewAttendanceLink(buyer, a.id, NOW)).rejects.toThrow(
      "forbidden",
    );

    const remind = (
      await svc.portfolioTaskDrafts(new Date(NOW.getTime() + 4 * DAY))
    ).find((d) => d.kind === "attendance_confirm" && d.link.endsWith(joao.id));
    expect(remind?.ownerUserId).toBe(sales.id);
    expect(
      (await svc.portfolioTaskDrafts(NOW)).some(
        (d) => d.kind === "attendance_confirm",
      ),
    ).toBe(false);

    // Cancelado: não conta e o link só mostra a situação.
    await svc.cancelAttendance(sales, a.id, NOW);
    expect((await svc.attendanceByToken(second, NOW)).state).toBe("cancelled");
  });

  it("o cliente diz que não aconteceu: precisa do motivo e avisa quem atendeu", async () => {
    const a = await svc.registerAttendance(
      sales,
      {
        customerId: joao.id,
        channel: "whatsapp",
        occurredAt: ago(3_600_000),
        summary: "Conversa pelo WhatsApp",
        nextStep: null,
      },
      NOW,
    );
    const token = tokenOf(svc.attendancePath(a));
    await expect(
      svc.answerAttendance(
        token,
        { answer: "dispute", name: "Maria", note: "" },
        NOW,
      ),
    ).rejects.toThrow("note_required");
    await svc.answerAttendance(
      token,
      { answer: "dispute", name: "Maria", note: "Ninguém falou comigo hoje" },
      NOW,
    );
    const notes = await getStore().list("notifications", {
      filter: { userId: sales.id },
    });
    expect(notes.some((n) => n.link === `/app/portfolio/${joao.id}`)).toBe(
      true,
    );
    const page = (await svc.loadPortfolioCustomer(sales, joao.id, NOW))!;
    const disputed = page.attendances.find((x) => x.id === a.id)!;
    expect(disputed).toMatchObject({
      status: "disputed",
      customerNote: "Ninguém falou comigo hoje",
      linkPath: null,
    });
    // Confirmado só o administrador (ou quem gere) cancela.
    const ok = page.attendances.find((x) => x.status === "confirmed")!;
    await expect(svc.cancelAttendance(sales, ok.id, NOW)).rejects.toThrow(
      "forbidden",
    );
  });

  it("código do vendedor no login (só o administrador) liga os clientes do RCA", async () => {
    const group = await svc.createCustomerGroup(admin, {
      name: "Grupo sem responsável",
      notes: null,
      ownerUserId: null,
    });
    const rca = await newCustomer("Cliente do RCA 101", { rcaCode: "101" });
    await svc.setCustomerGroup(admin, rca.id, group.id);
    await expect(svc.setUserSellerCode(sales, sales.id, "101")).rejects.toThrow(
      "forbidden",
    );
    await expect(svc.setUserSellerCode(admin, sales.id, "10a")).rejects.toThrow(
      "seller_code_invalid",
    );
    await svc.setUserSellerCode(admin, sales.id, "0101");
    expect((await getStore().get("users", sales.id))!.sellerCode).toBe("101");
    await expect(svc.setUserSellerCode(admin, admin.id, "101")).rejects.toThrow(
      "seller_code_taken",
    );
    const row = (await svc.loadPortfolio(admin, {}, NOW)).rows.find(
      (r) => r.customerId === rca.id,
    )!;
    expect(row).toMatchObject({ ownerId: sales.id, ownerSource: "seller" });
    // Responsável escolhido no cliente passa na frente.
    await svc.setCustomerOwner(admin, rca.id, admin.id);
    const chosen = (await svc.loadPortfolio(admin, {}, NOW)).rows.find(
      (r) => r.customerId === rca.id,
    )!;
    expect(chosen).toMatchObject({
      ownerId: admin.id,
      ownerSource: "customer",
    });
    // Filtros: por responsável e "Sem responsável".
    const byOwner = await svc.loadPortfolio(admin, { ownerId: admin.id }, NOW);
    expect(byOwner.rows.map((r) => r.customerId)).toEqual([rca.id]);
  });

  it("o responsável escolhido saiu da equipe: o cliente fica na carteira, sem responsável", async () => {
    const left = await newCustomer("Cliente de quem saiu");
    await svc.setCustomerOwner(admin, left.id, buyer.id);
    await getStore().update("users", buyer.id, { active: false });
    try {
      const row = (await svc.loadPortfolio(admin, {}, NOW)).rows.find(
        (r) => r.customerId === left.id,
      )!;
      expect(row).toMatchObject({ ownerId: null, ownerName: null });
      const attend = (await svc.portfolioTaskDrafts(NOW)).find(
        (d) => d.customerId === left.id,
      )!;
      expect(attend.ownerUserId).toBeUndefined();
      // Quem sai não pode ser escolhido de novo.
      await expect(
        svc.setCustomerOwner(admin, left.id, buyer.id),
      ).resolves.toBeUndefined();
      const other = await newCustomer("Outro cliente");
      await expect(
        svc.setCustomerOwner(admin, other.id, buyer.id),
      ).rejects.toThrow("owner_invalid");
    } finally {
      await getStore().update("users", buyer.id, { active: true });
    }
  });

  it("grupo arquivado: os clientes saem da carteira (o escolhido no cliente fica)", async () => {
    await svc.setCustomerGroupArchived(admin, groupId, true);
    const view = await svc.loadPortfolio(admin, {}, NOW);
    expect(view.rows.map((r) => r.customerId)).not.toContain(joao.id);
    await svc.setCustomerGroupArchived(admin, groupId, false);
    const back = await svc.loadPortfolio(admin, {}, NOW);
    expect(back.rows.map((r) => r.customerId)).toContain(joao.id);
    const groups = await svc.loadCustomerGroups(admin);
    expect(groups.active.find((g) => g.id === groupId)?.customers).toBe(1);
  });
});

describe("ações", () => {
  it("registrar pela tela: a data e hora digitadas valem como horário de Brasília", async () => {
    h.current = sales;
    h.redirects.length = 0;
    const when = new Date(Date.now() - 2 * 3_600_000);
    const local = brasiliaLocal(when);
    await actions.registerAttendanceAction(
      form({
        customerId: joao.id,
        channel: "visit",
        occurredAt: local,
        summary: "Visita pela tela",
        nextStep: "",
      }),
    );
    const target = h.redirects.at(-1)!;
    expect(target).toMatch(
      new RegExp(`^/app/portfolio/${joao.id}\\?registered=`),
    );
    const id = new URL(target, "http://x").searchParams.get("registered")!;
    const saved = (await getStore().get("customer_attendances", id))!;
    expect(saved.occurredAt).toBe(new Date(`${local}:00-03:00`).toISOString());
    expect(saved.attendedByUserId).toBe(sales.id);

    // O cliente responde sem login.
    h.current = null;
    const token = tokenOf(svc.attendancePath(saved));
    await publicActions.answerAttendanceAction(
      form({ token, answer: "confirm", name: "João", note: "" }),
    );
    expect(h.redirects.at(-1)).toBe(`/atendimento/${token}?done=confirmed`);
    expect((await getStore().get("customer_attendances", id))!.status).toBe(
      "confirmed",
    );
    // Link adulterado volta com o erro, sem gravar nada.
    await publicActions.answerAttendanceAction(
      form({ token: "x", answer: "confirm", name: "João", note: "" }),
    );
    expect(h.redirects.at(-1)).toMatch(/\?error=link_invalid$/);
  });

  it("canal fora da lista e data inválida voltam com o erro", async () => {
    h.current = sales;
    await actions.registerAttendanceAction(
      form({
        customerId: joao.id,
        channel: "fax",
        occurredAt: brasiliaLocal(new Date()),
        summary: "Teste",
      }),
    );
    expect(h.redirects.at(-1)).toContain("error=channel_invalid");
    await actions.registerAttendanceAction(
      form({
        customerId: joao.id,
        channel: "visit",
        occurredAt: "ontem",
        summary: "Teste",
      }),
    );
    expect(h.redirects.at(-1)).toContain("error=occurred_invalid");
  });
});
