/*
 * Previsão de preço ao cliente final (Nova solicitação, dono, 15/11/2026):
 * cada produto tem a previsão do preço de venda ao cliente final, dada por
 * uma API externa ("anexo 2"). O operador vê o preço previsto ou informa o
 * preço de venda desejado para encontrar o preço.
 *
 * EXTERNAL DEPENDENCY PENDING: a documentação da API (anexo 2) não chegou.
 * Até lá o adaptador fica em modo MANUAL: não calcula nem inventa preço; a
 * tela diz que a integração não está ligada. Quando a documentação chegar,
 * uma classe `ApiPriceForecastAdapter` implementa a mesma interface e
 * `getPriceForecastAdapter` passa a devolvê-la com as credenciais
 * configuradas (nada muda na tela nem na rota).
 */

export interface PriceForecastQuery {
  /** Produto do catálogo do portal e o código dele no Sankhya (CODPROD). */
  productId: string;
  sankhyaCode: string | null;
  sku: string | null;
  /** Quantidade em peças da linha (nula sem quantidade). */
  quantity: number | null;
  /** Cliente do portal e o código dele no Sankhya, quando escolhido. */
  customerId: string | null;
  customerSankhyaCode: string | null;
}

export type PriceForecastAnswer =
  | {
      mode: "api";
      /** Preço previsto ao cliente final, por peça, em R$. */
      finalPriceBrl: number;
      /** O preço encontrado para o preço de venda desejado (modo "target"). */
      priceBrl: number | null;
    }
  | { mode: "manual" };

export interface PriceForecastAdapter {
  readonly mode: "api" | "manual";
  /** O preço previsto ao cliente final. */
  forecast(query: PriceForecastQuery): Promise<PriceForecastAnswer>;
  /** O preço que leva ao preço de venda desejado ao cliente final. */
  solve(
    query: PriceForecastQuery & { targetFinalPriceBrl: number },
  ): Promise<PriceForecastAnswer>;
}

/** Sem a API: nada é calculado (nunca um preço estimado apresentado como real). */
export class ManualPriceForecastAdapter implements PriceForecastAdapter {
  readonly mode = "manual" as const;
  async forecast(): Promise<PriceForecastAnswer> {
    return { mode: "manual" };
  }
  async solve(): Promise<PriceForecastAnswer> {
    return { mode: "manual" };
  }
}

export function getPriceForecastAdapter(): PriceForecastAdapter {
  return new ManualPriceForecastAdapter();
}
