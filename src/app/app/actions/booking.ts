"use server";

import { z } from "zod";
import { assertWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import { BOOKING_BULK_MAX, BOOKING_EMPTY } from "@/lib/booking";
import { BOOKING_STATUSES } from "@/lib/db/schema";
import { parseNumberInput } from "@/lib/number-input";
import { requireUser, run, str } from "./helpers";

/*
 * Booking (docs/BOOKING.md): as ações da tela. Só a Wellmix com a tela
 * Booking; aprovar e analisar pedem também a tela Superplan, e gerar
 * solicitação a tela Solicitações (conferido no serviço, regra por regra).
 * A recusa volta para a tela com o código e, quando há, a linha que a causou
 * (`row`), para a tela destacá-la.
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
/** Cliente da barra: vazio (não mexe), "-" (tira), "__stock" ou o id. */
const CUSTOMER = z.union([
  z.literal(""),
  z.literal(BOOKING_EMPTY),
  z.literal("__stock"),
  ID,
]);

/** Avisos de uma ida anterior não voltam grudados no endereço. */
const FLASH = [
  "error",
  "fields",
  "at",
  "row",
  "moved",
  "saved",
  "owners",
  "analyzed",
  "skipped",
];

/** Volta para a lista mantendo os filtros (só endereço do próprio Booking). */
function listBack(form: FormData) {
  const back = str(form, "back");
  // Conferido pela leitura do endereço (e não por lista de caracteres): só
  // a própria lista do Booking, com os filtros que ela mesma montou.
  if (!back.startsWith("/app/booking") || back.length > 4000)
    return "/app/booking";
  let url: URL;
  try {
    url = new URL(back, "http://x");
  } catch {
    return "/app/booking";
  }
  if (url.origin !== "http://x" || url.pathname !== "/app/booking")
    return "/app/booking";
  for (const key of FLASH) url.searchParams.delete(key);
  return url.pathname + url.search;
}

const withParams = (back: string, params: Record<string, string | number>) => {
  const url = new URL(back, "http://x");
  for (const [k, v] of Object.entries(params))
    url.searchParams.set(k, String(v));
  return url.pathname + url.search;
};

/** A recusa de uma linha leva o id dela: a tela destaca a linha. */
async function guarded(
  back: string,
  fn: () => Promise<string>,
): Promise<string> {
  const { BookingRefusal } = await import("@/lib/services/booking");
  try {
    return await fn();
  } catch (error) {
    if (error instanceof BookingRefusal && error.bookingId)
      return withParams(back, { error: error.message, row: error.bookingId });
    throw error;
  }
}

/** Quantidades digitadas nas linhas marcadas (`qty_<id>`); vazio não conta. */
function typedQuantities(form: FormData, ids: string[]) {
  const out: Record<string, number> = {};
  for (const id of ids) {
    const raw = str(form, `qty_${id}`);
    if (!raw) continue;
    const n = parseNumberInput(raw, { int: true });
    out[id] = n === null || Number.isNaN(n) ? Number.NaN : n;
  }
  return out;
}

/**
 * Ações em várias linhas (a barra acima da tabela): mover de etapa, gravar
 * cliente e quantidades, trocar o responsável, analisar no Superplan e gerar
 * solicitação. O botão apertado diz qual (`op`).
 */
export async function bulkBookingAction(form: FormData) {
  const user = await requireUser();
  const back = listBack(form);
  await run(back, () =>
    guarded(back, async () => {
      assertWellmix(user);
      assertScreen(user, "booking");
      const input = z
        .object({
          op: z.enum(["move", "assign", "owner", "analyze", "request"]),
          ids: z.array(ID).max(BOOKING_BULK_MAX),
          status: z.enum(BOOKING_STATUSES).or(z.literal("")),
          customer: CUSTOMER,
          ownerUserId: ID.or(z.literal("")).or(z.literal(BOOKING_EMPTY)),
        })
        .parse({
          op: str(form, "op"),
          ids: form
            .getAll("ids")
            .filter((v): v is string => typeof v === "string"),
          status: str(form, "status"),
          customer: str(form, "customer"),
          ownerUserId: str(form, "ownerUserId"),
        });
      const service = await import("@/lib/services/booking");
      if (!input.ids.length)
        throw new service.BookingRefusal("booking_none_selected");
      const quantities = typedQuantities(form, input.ids);
      // Quantidade que não é número inteiro: recusa apontando a linha.
      for (const [id, n] of Object.entries(quantities))
        if (!Number.isInteger(n) || n <= 0)
          throw new service.BookingRefusal("booking_qty_required", id);
      const bulk = { ids: input.ids, customer: input.customer, quantities };

      if (input.op === "move") {
        if (!input.status)
          throw new service.BookingRefusal("booking_status_required");
        const moved = await service.moveBookings(user, {
          ...bulk,
          status: input.status,
        });
        return withParams(back, { moved });
      }
      if (input.op === "assign") {
        const saved = await service.assignBookings(user, bulk);
        return withParams(back, { saved });
      }
      if (input.op === "owner") {
        if (!input.ownerUserId)
          throw new service.BookingRefusal("booking_owner_required");
        const owners = await service.setBookingsOwner(
          user,
          input.ids,
          input.ownerUserId === BOOKING_EMPTY ? null : input.ownerUserId,
        );
        return withParams(back, { owners });
      }
      if (input.op === "analyze") {
        const result = await service.analyzeBookings(user, input.ids);
        return withParams(back, {
          analyzed: result.analyzed,
          ...(result.skipped ? { skipped: result.skipped } : {}),
        });
      }
      const { getT } = await import("@/i18n/server");
      const created = await service.generateRequestFromBooking(
        user,
        bulk,
        await getT(),
      );
      const first = created[0];
      return created.length === 1
        ? `/app/requests/${first.id}?created=1`
        : `/app/requests/batch/${encodeURIComponent(first.groupId ?? "")}?created=${created.length}`;
    }),
  );
}

/** Salvar uma linha (página da linha): etapa, cliente, quantidade, responsável e observação. */
export async function saveBookingRowAction(form: FormData) {
  const user = await requireUser();
  const id = ID.safeParse(str(form, "id"));
  const back = id.success ? `/app/booking/${id.data}` : "/app/booking";
  await run(back, () =>
    guarded(back, async () => {
      assertWellmix(user);
      assertScreen(user, "booking");
      const qtyRaw = str(form, "reservedQty");
      const qty = qtyRaw ? parseNumberInput(qtyRaw, { int: true }) : null;
      const input = z
        .object({
          id: ID,
          status: z.enum(BOOKING_STATUSES),
          customerId: CUSTOMER,
          reservedQty: z.number().int().positive().max(100_000_000).nullable(),
          ownerUserId: ID.or(z.literal("")),
          note: z.string().max(500),
        })
        .parse({
          id: str(form, "id"),
          status: str(form, "status"),
          customerId: str(form, "customerId"),
          reservedQty: qty,
          ownerUserId: str(form, "ownerUserId"),
          note: str(form, "note"),
        });
      /*
       * Só o que a pessoa mudou é gravado: a página manda junto como cada
       * campo estava quando abriu (`was.<campo>`). Assim, salvar uma
       * observação numa página aberta há tempo não desfaz a etapa, o cliente
       * ou a reserva que alguém mudou nesse meio-tempo.
       */
      const lines = (v: string) => v.replace(/\r\n/g, "\n");
      const changed = (key: string) =>
        !form.has(`was.${key}`) ||
        lines(str(form, `was.${key}`)) !== lines(str(form, key));
      const { saveBookingRow } = await import("@/lib/services/booking");
      await saveBookingRow(user, input.id, {
        ...(changed("status") ? { status: input.status } : {}),
        ...(changed("customerId")
          ? {
              customerId:
                input.customerId && input.customerId !== BOOKING_EMPTY
                  ? input.customerId
                  : null,
            }
          : {}),
        ...(changed("reservedQty") ? { reservedQty: input.reservedQty } : {}),
        ...(changed("ownerUserId")
          ? { ownerUserId: input.ownerUserId || null }
          : {}),
        ...(changed("note") ? { note: input.note || null } : {}),
      });
      return withParams(back, { saved: 1 });
    }),
  );
}

/**
 * "Gravar no Booking" a partir do Superplan: a simulação que está na tela é
 * refeita no servidor (o resultado nunca vem do navegador) e o retrato fica
 * na linha. Só quem abre o Superplan.
 */
export async function saveBookingAnalysisAction(form: FormData) {
  const user = await requireUser();
  const id = ID.safeParse(str(form, "bookingId"));
  const back = id.success
    ? `/app/superplan?booking=${id.data}`
    : "/app/superplan";
  await run(back, async () => {
    assertWellmix(user);
    assertScreen(user, "booking");
    assertScreen(user, "superplan");
    const bookingId = ID.parse(str(form, "bookingId"));
    let raw: unknown;
    try {
      raw = JSON.parse(str(form, "input"));
    } catch {
      throw new Error("invalid_input");
    }
    const { superplanInputSchema, snapshotOf } =
      await import("@/lib/superplan-defaults");
    const { computeSuperplan } = await import("@/lib/superplan");
    const input = superplanInputSchema.parse(raw);
    const meta = z
      .object({
        businessType: z.string().trim().min(1).max(120),
        container: z.string().trim().max(40),
        ncmFound: z.enum(["0", "1"]),
      })
      .parse({
        businessType: str(form, "businessType"),
        container: str(form, "container"),
        ncmFound: str(form, "ncmFound") || "0",
      });
    const snapshot = snapshotOf(input, computeSuperplan(input), {
      businessType: meta.businessType,
      container: meta.container || null,
      ncmFound: meta.ncmFound === "1",
    });
    const { saveBookingAnalysis } = await import("@/lib/services/booking");
    await saveBookingAnalysis(user, bookingId, snapshot);
    return `/app/booking/${bookingId}?analysis=1`;
  });
}
