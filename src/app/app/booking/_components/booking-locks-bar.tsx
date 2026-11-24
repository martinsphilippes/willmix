import type { Translate } from "@/i18n";
import { Card, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  lockBookingTypeAction,
  unlockBookingAction,
} from "../../actions/booking-lots";

/*
 * Travar books (dono, 23/11/2026; docs/BOOKING.md, "Travar books"): a faixa
 * acima da lista. O analista trava todos os books de um tipo de item (um a
 * um é na linha do book) e vê o que está com ele, com "Liberar". Enquanto
 * tem algo travado, a lista mostra só os books dele; os outros analistas
 * deixam de vê-los.
 */
export function BookingLocksBar({
  t,
  supervisor,
  slaHours,
  freeTypes,
  mine,
}: {
  t: Translate;
  /** Vê todos os books e com quem está cada um. */
  supervisor: boolean;
  slaHours: number;
  /** Tipos de item dos books livres à vista. */
  freeTypes: string[];
  mine: Array<{
    id: string;
    scope: "lot" | "type";
    itemType: string | null;
    lotNumber: number | null;
    /** Há quanto tempo. */
    time: string;
    /** Quem travou não libera; só se também supervisiona os books. */
    canRelease: boolean;
  }>;
}) {
  return (
    <div className="mb-3" data-booking-locks-bar>
      <Card dense title={t("bookWork.bar.title")}>
        <p className="mb-2 text-sm text-zinc-600">
          {t(supervisor ? "bookWork.bar.supervisor" : "bookWork.bar.body", {
            h: slaHours,
          })}
        </p>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          {freeTypes.length ? (
            <form
              action={lockBookingTypeAction}
              className="flex flex-wrap items-end gap-2"
              data-booking-lock-type-form
            >
              <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                {t("bookWork.lock.typeLabel")}
                <Select name="itemType" required defaultValue="">
                  <option value="" disabled>
                    {t("common.select")}
                  </option>
                  {freeTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </label>
              <SubmitButton variant="secondary" data-booking-lock-type>
                {t("bookWork.lock.type")}
              </SubmitButton>
            </form>
          ) : null}
          {mine.length ? (
            <ul className="flex flex-wrap gap-2" data-booking-my-locks>
              {mine.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm"
                  data-booking-my-lock={m.scope}
                >
                  <span>
                    {m.scope === "type"
                      ? t("bookWork.bar.mineType", { type: m.itemType ?? "" })
                      : t("bookWork.bar.mineLot", { n: m.lotNumber ?? "—" })}
                    <span className="text-zinc-500"> · {m.time}</span>
                  </span>
                  {m.canRelease ? (
                    <form action={unlockBookingAction}>
                      <input type="hidden" name="lockId" value={m.id} />
                      <SubmitButton variant="secondary" data-booking-unlock>
                        {t("bookWork.unlock")}
                      </SubmitButton>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
