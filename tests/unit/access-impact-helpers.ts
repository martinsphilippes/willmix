import { WELLMIX_BASE } from "@/lib/auth/screens";
import type { FunctionDef } from "@/lib/auth/function-access";

/** As telas marcadas no editor de uma função (Início que ela deixa e as outras). */
export const functionScreenMarksOf = (def: FunctionDef): string[] => [
  ...WELLMIX_BASE.filter((s) => !def.baseOff.includes(s)),
  ...def.screens,
];
