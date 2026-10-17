import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { PACKAGE_TYPES, packageTypeKey, type PackageType } from "@/lib/carton";
import type {
  CartonSizeTexts,
  InnerQtyTexts,
  PackageTypeTexts,
} from "./carton-hints";

/*
 * Textos dos atalhos e avisos da caixa (carton-hints), montados no servidor:
 * o componente do navegador recebe só as frases, com os {marcadores}.
 */

export const innerQtyTexts = (t: Translate): InnerQtyTexts => ({
  none: t("carton.inner.none"),
  noneTitle: t("carton.inner.noneTitle"),
  options: t("carton.inner.options"),
  optionTitle: t("carton.inner.optionTitle", {
    boxes: "{boxes}",
    inner: "{inner}",
  }),
  isNone: t("carton.inner.isNone"),
  fits: t("carton.inner.fits", {
    boxes: "{boxes}",
    inner: "{inner}",
    master: "{master}",
  }),
  same: t("carton.inner.same"),
  bigger: t("carton.inner.bigger", { inner: "{inner}", master: "{master}" }),
  rest: t("carton.inner.rest", {
    master: "{master}",
    inner: "{inner}",
    rest: "{rest}",
  }),
});

export const cartonSizeTexts = (t: Translate): CartonSizeTexts => ({
  size: t("carton.size.size", { size: "{size}", cbm: "{cbm}" }),
  side: t("carton.size.side", { side: "{side}" }),
  cbm: t("carton.size.cbm", { cbm: "{cbm}" }),
  fit: t("carton.size.fit", {
    type: "{type}",
    capacity: "{capacity}",
    n: "{n}",
  }),
  fitOne: t("carton.size.fitOne", { type: "{type}", capacity: "{capacity}" }),
  noFit: t("carton.size.noFit", { type: "{type}", capacity: "{capacity}" }),
});

export const packageTypeTexts = (t: Translate): PackageTypeTexts => ({
  options: t("carton.package.options"),
  colorLike: t("carton.package.colorLike", { value: "{value}" }),
  names: Object.fromEntries(
    PACKAGE_TYPES.map((type) => [
      type,
      t(`carton.package.${packageTypeKey(type)}` as DictionaryKey),
    ]),
  ) as Record<PackageType, string>,
});
