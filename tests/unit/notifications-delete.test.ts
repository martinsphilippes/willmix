import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Excluir avisos da lista de notificações: cada um só exclui os próprios
 * (in-app); os registros de e-mail e WhatsApp do mesmo aviso ficam.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { notify, deleteInAppNotifications } =
  await import("@/lib/services/notifications");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
});

const inapp = (userId: string) =>
  getStore().list("notifications", { filter: { userId, channel: "inapp" } });

describe("excluir notificações", () => {
  it("exclui uma: só a própria, e não a de outra pessoa", async () => {
    await notify({ userIds: [admin.id, joao.id] }, { subject: "A", body: "a" });
    const [mineOne] = await inapp(admin.id);
    const [joaoOne] = await inapp(joao.id);
    const before = (await inapp(admin.id)).length;

    // Id de outra pessoa: não é encontrado, nada some.
    expect(await deleteInAppNotifications(admin, [joaoOne.id])).toBe(0);
    expect((await inapp(joao.id)).some((n) => n.id === joaoOne.id)).toBe(true);

    expect(await deleteInAppNotifications(admin, [mineOne.id])).toBe(1);
    const after = await inapp(admin.id);
    expect(after.length).toBe(before - 1);
    expect(after.some((n) => n.id === mineOne.id)).toBe(false);
  });

  it("exclui todas as do usuário; e-mail/WhatsApp e avisos dos outros ficam", async () => {
    await notify({ userIds: [admin.id, joao.id] }, { subject: "B", body: "b" });
    const joaoBefore = (await inapp(joao.id)).length;
    const otherChannels = await getStore().list("notifications", {
      filter: { userId: admin.id, channel: ["email", "whatsapp"] },
    });
    const removed = await deleteInAppNotifications(admin);
    expect(removed).toBeGreaterThan(0);
    expect(await inapp(admin.id)).toHaveLength(0);
    expect((await inapp(joao.id)).length).toBe(joaoBefore);
    const stillThere = await getStore().list("notifications", {
      filter: { userId: admin.id, channel: ["email", "whatsapp"] },
    });
    expect(stillThere.length).toBe(otherChannels.length);
    const log = await getStore().list("audit_log", {
      filter: { action: "notification.delete" },
    });
    expect(log.length).toBeGreaterThan(0);
  });

  it("lista vazia de ids não exclui nada", async () => {
    await notify({ userIds: [admin.id] }, { subject: "C", body: "c" });
    expect(await deleteInAppNotifications(admin, [])).toBe(0);
    expect((await inapp(admin.id)).length).toBe(1);
  });
});
