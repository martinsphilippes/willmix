import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Avisos com tipo (o que pedem), com quem está o assunto e texto no idioma
 * de quem recebe; avisos antigos classificados pelo assunto; abrir marca
 * como lido só o próprio.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { notify, openNotification } =
  await import("@/lib/services/notifications");
const { translator } = await import("@/i18n");
const { displaySubject, notificationActor, notificationGroup, notificationKind } =
  await import("@/lib/notification-view");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierA: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
});

const find = async (userId: string, subject: string, channel = "inapp") => {
  const rows = await getStore().list("notifications", {
    filter: { userId, channel },
  });
  return rows.find((n) => n.subject === subject)!;
};

describe("tipo e com quem está", () => {
  it("ação: quem recebe é quem age, por padrão", async () => {
    await notify({ userIds: [joao.id] }, { kind: "action", subject: "Faça X", body: "x" });
    expect(await find(joao.id, "Faça X")).toMatchObject({
      kind: "action",
      actor: "recipient",
    });
  });

  it("novidade: ninguém age, ou o papel informado; e-mail e WhatsApp iguais", async () => {
    await notify({ userIds: [joao.id] }, { subject: "Só aviso", body: "y" });
    expect(await find(joao.id, "Só aviso")).toMatchObject({
      kind: "info",
      actor: null,
    });
    await notify(
      { userIds: [joao.id] },
      { kind: "info", actor: "supplier", subject: "Com o fornecedor", body: "z" },
    );
    expect(await find(joao.id, "Com o fornecedor")).toMatchObject({
      kind: "info",
      actor: "supplier",
    });
    expect(await find(joao.id, "Com o fornecedor", "email")).toMatchObject({
      kind: "info",
      actor: "supplier",
    });
  });
});

describe("texto no idioma de quem recebe", () => {
  it("fornecedor em chinês e cliente em português recebem o mesmo aviso, cada um na sua língua", async () => {
    await notify(
      { userIds: [joao.id, supplierA.id] },
      {
        kind: "action",
        text: (t) => ({
          subject: t("notif.stage.subject", {
            n: 7,
            stage: t("stage.PREPARATION"),
          }),
          body: t("notif.stage.body", { items: "A" }),
        }),
      },
    );
    const pt = translator("pt");
    const zh = translator("zh");
    const ptSubject = pt("notif.stage.subject", {
      n: 7,
      stage: pt("stage.PREPARATION"),
    });
    const zhSubject = zh("notif.stage.subject", {
      n: 7,
      stage: zh("stage.PREPARATION"),
    });
    expect(ptSubject).not.toBe(zhSubject);
    expect(ptSubject).not.toContain("PREPARATION");
    expect(await find(joao.id, ptSubject)).toBeTruthy();
    expect(await find(supplierA.id, zhSubject)).toBeTruthy();
    expect(await find(supplierA.id, zhSubject, "whatsapp")).toBeTruthy();
  });
});

describe("avisos antigos (sem tipo gravado)", () => {
  it("classifica pelo assunto: cobrança é ação de quem recebeu; atraso é atenção", () => {
    const stage = {
      subject: "Pedido #1: etapa DELIVERED aguarda sua ação",
      kind: null,
      actor: null,
    };
    expect(notificationKind(stage)).toBe("action");
    expect(notificationActor(stage)).toBe("recipient");
    expect(
      notificationKind({ subject: "ATRASADO: pedido #1, etapa SHIPPING", kind: null }),
    ).toBe("alert");
    const created = { subject: "Pedido #2 criado", kind: null, actor: null };
    expect(notificationKind(created)).toBe("info");
    expect(notificationActor(created)).toBeNull();
    // Com tipo gravado, o que está gravado vale (atenção sem ninguém a agir).
    expect(
      notificationActor({ subject: "x", kind: "alert", actor: null }),
    ).toBeNull();
    expect(notificationGroup("done")).toBe("news");
    expect(notificationGroup("alert")).toBe("alert");
  });

  it("assunto antigo com a chave da etapa sai com o nome traduzido", () => {
    const pt = translator("pt");
    expect(
      displaySubject(
        { subject: "Pedido #1: etapa DELIVERED aguarda sua ação", kind: null },
        pt,
      ),
    ).toBe(pt("notif.stage.subject", { n: 1, stage: pt("stage.DELIVERED") }));
    expect(
      displaySubject(
        { subject: "ATRASADO: pedido #3, etapa SHIPPING", kind: null },
        translator("en"),
      ),
    ).toBe("Overdue: order #3, Shipping");
    // Chave desconhecida ou aviso novo: como está.
    expect(
      displaySubject({ subject: "Pedido #1: etapa FOO aguarda sua ação", kind: null }, pt),
    ).toBe("Pedido #1: etapa FOO aguarda sua ação");
    expect(
      displaySubject({ subject: "Pedido #1: etapa DELIVERED aguarda sua ação", kind: "action" }, pt),
    ).toBe("Pedido #1: etapa DELIVERED aguarda sua ação");
  });

  it("banco sem as colunas novas: grava sem elas em vez de derrubar a operação", async () => {
    const store = getStore();
    const original = store.create.bind(store);
    let refused = 0;
    const spy = vi
      .spyOn(store, "create")
      .mockImplementation(async (table, data) => {
        if (
          table === "notifications" &&
          (data as { kind?: unknown }).kind !== undefined
        ) {
          refused++;
          throw new Error('Invalid document structure: Unknown attribute: "kind"');
        }
        return original(table, data as never);
      });
    try {
      await notify(
        { userIds: [joao.id] },
        { kind: "action", subject: "Sem coluna", body: "b" },
      );
    } finally {
      spy.mockRestore();
    }
    const row = await find(joao.id, "Sem coluna");
    expect(row).toBeTruthy();
    expect(row.kind ?? null).toBeNull();
    expect(refused).toBe(3);
    // Outros erros continuam subindo.
    const boom = vi
      .spyOn(store, "create")
      .mockRejectedValueOnce(new Error("network down"));
    try {
      await expect(
        notify({ userIds: [joao.id] }, { subject: "Falha", body: "b" }),
      ).rejects.toThrow("network down");
    } finally {
      boom.mockRestore();
    }
  });
});

describe("abrir um aviso", () => {
  it("marca como lido e devolve o link; aviso de outra pessoa não abre", async () => {
    await notify(
      { userIds: [joao.id] },
      { kind: "action", subject: "Abrir", body: "b", link: "/app/orders/x" },
    );
    const n = await find(joao.id, "Abrir");
    expect(await openNotification(admin, n.id)).toBeNull();
    expect((await getStore().get("notifications", n.id))!.readAt).toBeNull();
    expect(await openNotification(joao, n.id)).toBe("/app/orders/x");
    expect(
      (await getStore().get("notifications", n.id))!.readAt,
    ).not.toBeNull();
    // Registro de e-mail do mesmo aviso não é "abrível".
    const email = await find(joao.id, "Abrir", "email");
    expect(await openNotification(joao, email.id)).toBeNull();
  });

  it("link fora do portal não é seguido", async () => {
    await notify(
      { userIds: [joao.id] },
      { subject: "Externo", body: "b", link: "https://evil.example/app" },
    );
    const n = await find(joao.id, "Externo");
    expect(await openNotification(joao, n.id)).toBeNull();
  });
});
