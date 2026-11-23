import { describe, expect, it } from "vitest";
import { countryKey, portsOfCountry } from "@/lib/ports";

/*
 * Portos de embarque do país do fornecedor (dono, 23/11/2026): a lista da
 * cotação vem dos portos do vínculo produto × fornecedor do Sankhya.
 */
const port = (name: string, country: string) =>
  ({ port: name, country }) as never;

describe("portos por país", () => {
  const rows = [
    { sankhyaPorts: [port("NINGBO", "CHINA"), port("SHENZHEN", "CHINA")] },
    { sankhyaPorts: [port("NINGBO", "CHINA")] },
    { sankhyaPorts: [port("NHAVA SHEVA", "ÍNDIA")] },
    { sankhyaPorts: null },
    {},
  ];

  it("só os portos do país, sem repetir, do mais usado para o menos usado", () => {
    expect(portsOfCountry(rows, "CHINA")).toEqual(["NINGBO", "SHENZHEN"]);
    expect(portsOfCountry(rows, "ÍNDIA")).toEqual(["NHAVA SHEVA"]);
  });

  it("o país do cadastro em outra grafia ou sigla acha os mesmos portos", () => {
    expect(portsOfCountry(rows, "China")).toEqual(["NINGBO", "SHENZHEN"]);
    expect(portsOfCountry(rows, "CN")).toEqual(["NINGBO", "SHENZHEN"]);
    expect(portsOfCountry(rows, "India")).toEqual(["NHAVA SHEVA"]);
    expect(countryKey("  índia ")).toBe("INDIA");
  });

  it("país vazio ou sem porto cadastrado: lista vazia (o campo fica livre)", () => {
    expect(portsOfCountry(rows, null)).toEqual([]);
    expect(portsOfCountry(rows, "")).toEqual([]);
    expect(portsOfCountry(rows, "TURQUIA")).toEqual([]);
  });
});
