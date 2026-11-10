# Superplan: viabilidade do produto e preço de venda

Tela **Pedidos → Superplan** (`/app/superplan`), só do administrador. Substitui a planilha SuperPlan: a partir do preço do fornecedor, da caixa, do container, dos fretes, do câmbio e das despesas, mostra quanto custa cada peça posta no depósito, o preço mínimo de venda, os preços sugeridos e se o lucro bate a meta do tipo de negócio.

Conta pura em `src/lib/superplan.ts` (a tela e os testes usam a mesma); peso bruto estimado em `src/lib/weights.ts`. Simulação padrão, retrato da conta e conferência de uma conta vinda do navegador em `src/lib/superplan-defaults.ts` (puro). Dados do sistema e do produto e análise em lote em `src/lib/services/superplan-analysis.ts` (servidor, só leitura). Tela em `src/app/app/superplan/page.tsx` e `src/components/superplan-calculator.tsx`; parâmetros em `src/app/app/superplan/_components/params-form.tsx` e `src/app/app/actions/superplan.ts`; textos em `src/i18n/modules/superplan.ts`.

## 1. Problema

A planilha era a única forma de saber se um produto vale a pena e por quanto vender. Ela tinha erros que mudam a decisão:

- impostos da importação calculados sobre um valor por quilo, e não sobre o valor pago ao fornecedor;
- AFRMM, THC, taxa do CE e frete rodoviário somados duas vezes no custo;
- container com caixa quebrada (978,26 caixas);
- impostos da venda calculados sobre uma fração do preço (coluna "VIP");
- markup, comissão e despesas digitados à mão, sem ligação com a tabela de tipos de negócio;
- nada ligado ao cadastro do produto, ao câmbio do dia nem à tabela fiscal.

## 2. Objetivo

Em segundos, para qualquer produto: custo por peça, preço mínimo, lucro e um sinal claro (verde, amarelo ou vermelho), com o preço necessário para bater a meta. Tudo explicado na própria tela e com os percentuais editáveis.

## 3. Decisões do dono (perguntas de 9/11/2026)

1. Impostos sobre o valor real da compra e da venda, com a explicação do cálculo na tela e neste documento, para ajustar depois.
2. Corrigir as contas em dobro.
3. O tipo de negócio preenche sozinho markup, comissão, despesas e meta (tabela editável).
4. Verde: lucro igual ou acima da meta. Amarelo: lucro positivo abaixo da meta. Vermelho: prejuízo. Mostrar o markup necessário para a meta.
5. Só o administrador.
6. Percentuais dos impostos da venda editáveis (ICMS, PIS, COFINS, IR, CSLL), para acertar com o contador.

## 4. De onde vêm os números

| Dado                                                                                                             | Origem                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Preço por peça e moeda (RMB ou US$)                                                                              | Cadastro do produto (`price`, `currency`; CNY = RMB); cadastro sem preço: ficha mestre do produto                                         |
| Peças por caixa e volume da caixa                                                                                | Cadastro (`masterBoxQty`, `cbm` ou medidas da caixa); coluna vazia: ficha mestre                                                          |
| Peso líquido e peso bruto por peça                                                                               | Ficha mestre do produto (N.W e G.W, cada um no seu campo), completada pelas colunas do cadastro                                           |
| Média do despachante (US$)                                                                                       | Ficha mestre (`averagePrice`): **só informação na tela**, não entra na conta (seção 5.1)                                                  |
| NCM                                                                                                              | Cadastro; sem ele, o da ficha mestre                                                                                                      |
| II e IPI                                                                                                         | O que a Wellmix digitou na ficha mestre (`importTaxPercent`, `ipiPercent`); sem isso, a tabela fiscal (TEC/TIPI) pelo NCM (IPI "NT" = 0%) |
| PIS/COFINS-importação, ICMS da importação, seguro                                                                | Configurações → Tributos da importação (os mesmos da proposta)                                                                            |
| Container (capacidade e peso máximo)                                                                             | Configurações → Tipos de container (padrão 40HC)                                                                                          |
| Dólar oficial e RMB por dólar                                                                                    | Câmbio do dia (PTAX do Banco Central; reservas: AwesomeAPI e BCE)                                                                         |
| Dólar futuro                                                                                                     | Oficial + diferença dos parâmetros (R$ 0,25)                                                                                              |
| Tipos de negócio, despesas por container, fretes, AFRMM, folga da embalagem no peso, fatores e impostos da venda | Parâmetros do Superplan (setting `superplan`)                                                                                             |

Tudo continua editável na tela para a simulação. A simulação não grava nada (o botão opcional de gravar a simulação está na seção 5.3).

## 5. Como calcula

1. **Container**: caixas inteiras que cabem pelo volume (capacidade ÷ volume da caixa) ou pelo peso (peso máximo ÷ peso bruto da caixa), o que acabar primeiro. Peças = caixas × peças por caixa. O peso é o bruto; sem ele, o bruto estimado pelo líquido (seção 5.1). Sem peso nenhum, conta só o volume.
2. **Compra**: preço por peça × peças, em dólar (RMB ÷ RMB por dólar). Paga ao fornecedor no dólar futuro.
3. **Frete marítimo** em R$: frete em US$ × dólar oficial × (1 + 3,02%). **Seguro**: % do FOB, quando configurado.
4. **Impostos da importação sobre o valor real**:
   - valor aduaneiro = (compra + frete + seguro) em US$ × dólar oficial + THC + taxa do CE (despesas marcadas "no valor aduaneiro");
   - II = valor aduaneiro × II; IPI = (valor aduaneiro + II) × IPI;
   - PIS = valor aduaneiro × 2,1%; COFINS = valor aduaneiro × 9,65%;
   - AFRMM = frete em R$ × 8% + R$ 700;
   - ICMS da importação "por dentro", quando configurado: (valor aduaneiro + II + IPI + PIS + COFINS + AFRMM) ÷ (1 − alíquota) × alíquota.
5. **Despesas no Brasil** (cada uma uma vez), **frete rodoviário** e **despesas na China** (comissão da trading em % da compra e outras em RMB, no dólar futuro).
6. **Custo por peça** = custo do container ÷ peças. **Preço mínimo** = custo por peça × markup do tipo. Tabela = mínimo × 1,25; atacado × 1,6; loja × 1,8; WD = mínimo + 12%; com entrega = mínimo + entrega ÷ peças.
7. **Venda, por peça, a um preço P** (o mínimo, ou o preço digitado para testar):
   - base = P × (1 − IPI%) (o preço inclui o IPI);
   - IPI a pagar = base × IPI% − IPI pago na importação por peça;
   - ICMS a pagar = base × ICMS efetivo (1,5%) − ICMS da importação por peça;
   - PIS = (base − ICMS − IPI) × 1,65% − PIS-importação por peça; COFINS idem com 7,6%;
   - IR = base × 2,6%; CSLL = base × 1,08%;
   - comissão e despesas administrativas = P × % do tipo;
   - lucro = P − custo por peça − tudo acima. Lucro % = lucro ÷ P.
8. **Preço para a meta**: o lucro é uma reta no preço; o preço que dá exatamente a meta % sai dela (arredondado para cima no centavo). Markup necessário = esse preço ÷ custo por peça. Sem solução (impostos e despesas maiores que a margem): a tela avisa.
9. **Sinal**: verde com lucro ≥ meta; amarelo com lucro positivo abaixo da meta; vermelho com prejuízo.

### 5.1 Os três "pesos": líquido, bruto e média

A ficha técnica traz o **peso líquido** (N.W PC) e o **peso bruto** (G.W PC) por peça; a maioria das planilhas só preenche o líquido. A tela tem os dois campos, lado a lado, e cada um lê só a sua coluna: **o líquido nunca é lido como bruto**.

- **Peso bruto informado**: é ele que limita o container, como sempre.
- **Peso bruto vazio e líquido informado**: a conta usa um **peso bruto estimado** = líquido × (1 + folga da embalagem). A folga é o parâmetro "Folga da embalagem no peso (%)" (`grossEstimatePct`, padrão 8, de 0 a 100). O campo do peso bruto **continua vazio** e a tela mostra, logo abaixo, "Peso bruto estimado: 0,243 kg (líquido + 8%)"; o resultado do container também diz que o peso é estimado (`container.weightEstimated`). Digitar o peso bruto troca a estimativa pelo valor real.
- **Os dois vazios**: só o volume limita o container, com o aviso de sempre (`container.weightUnknown`).
- A estimativa é só da conta: **nunca é gravada** no produto nem na ficha mestre. A regra está em `estimatedGrossKg` (`src/lib/weights.ts`), a mesma que o Booking usa na coluna "peso estimado".

A **média** é o valor em US$ que o despachante informa na ficha mestre do produto (`purchase_sheets.averagePrice`, campo "Média (US$)"). No Superplan ela aparece **só como informação**, ao lado dos pesos: "Média do despachante: US$ 3,20"; vazia, "ainda não informada". Ela **não entra em conta nenhuma**: não faz parte de `SuperplanInput`, de `computeSuperplan` nem de imposto ou custo algum. Os impostos da importação continuam sobre o **valor real da compra** (passo 4). Não existe, e não deve ser criado, cálculo, campo ou dica de "valor declarado = peso líquido × média": declarar valor diferente do pago é subfaturamento (seção 10). Os testes `tests/unit/superplan-weights.test.ts` travam isso (a conta não tem campo de média; duas contas iguais, uma com média "a mais", dão o mesmo resultado).

### 5.2 Simulação padrão e análise em lote

A simulação que a tela mostra ao abrir um produto, antes de qualquer edição, sai de um lugar só: `src/lib/superplan-defaults.ts`.

- `defaultSuperplanForm(prefill, ctx, overrides?, decimal?)`: os campos da tela (tipo de negócio padrão, container padrão, frete padrão, câmbio do dia com dólar futuro = oficial + diferença, despesas e fatores dos parâmetros, preço de venda vazio = o preço mínimo).
- `superplanInputOf(form, ctx)`: os campos da tela viram a conta (`SuperplanInput`). É a função que a calculadora usa a cada tecla.
- `defaultSuperplanInput(prefill, ctx, overrides?)`: as duas juntas; devolve a conta, o tipo de negócio e o container. `overrides` troca só o tipo de negócio e o preço de venda.
- `snapshotOf(input, result, meta)`: o retrato de uma conta (tipo, preço analisado, custo, mínimo, lucro, meta, sinal, preço para a meta, o que faltou e os pressupostos). Dinheiro em centavos, percentuais com 2 casas; o preço da meta é arredondado para cima no centavo, como na tela.
- `superplanInputSchema`: confere uma conta vinda do navegador (todo número finito e dentro de uma faixa, listas e textos com tamanho máximo, campo desconhecido descartado).

No servidor, `src/lib/services/superplan-analysis.ts` (só leitura; quem chama confere a permissão):

- `loadSuperplanContext()`: parâmetros, containers, câmbio do dia e tributos da importação;
- `superplanPrefillsFor(ids)`: os dados de vários produtos de uma vez (uma consulta de produtos, uma de fichas mestre e uma busca na tabela fiscal por NCM distinto). Produto desativado ou que não existe fica fora; a tela do Superplan pede `includeInactive` para continuar abrindo um produto desativado pelo endereço;
- `analyzeProductsWithDefaults(ids)`: para cada produto, o retrato da simulação padrão. É o "Analisar no Superplan" em várias linhas do Booking (`docs/BOOKING.md`).

A página do Superplan usa as mesmas duas primeiras funções: um caminho só, os números da tela e os da análise em lote batem (teste em `tests/unit/superplan-analysis.test.ts`). `ncmFound` no retrato quer dizer "II e IPI conhecidos" (ficha mestre ou tabela fiscal); sem eles a conta usa 0 e o sinal sai otimista.

### 5.3 Gravar a simulação (opcional)

A calculadora aceita a propriedade opcional `save` (`action`, `hidden`, `title`, `hint`, `submit`). Com ela, aparece junto do sinal um formulário com um botão que envia à Server Action indicada: os campos escondidos de quem pediu (`hidden`), mais `input` (a conta que está na tela, em JSON), `businessType` (o tipo escolhido), `container` (o código do container, ou vazio) e `ncmFound` ("1" quando II e IPI estão preenchidos, "0" quando contam 0). O resultado não vai junto: a ação confere a conta com `superplanInputSchema` e refaz o cálculo no servidor. A calculadora não sabe para que a simulação será gravada (hoje, o "Gravar no Booking"); sem `save`, nada muda e nada é gravado.

**Aberto pelo Booking** (`/app/superplan?booking=<id>`, só para quem abre as duas telas): a tela vem com o produto da linha (o do endereço não conta), mostra a faixa "Analisando para o Booking" com o link de volta e passa `save` para `saveBookingAnalysisAction` (`src/app/app/actions/booking.ts`), que confere a conta, refaz o cálculo e grava o retrato na linha (`bookings.analysis`). Linha que não existe mais ou produto fora do cadastro: aviso e nenhum botão. Escolher outro produto no seletor sai do modo Booking. Ver `docs/BOOKING.md`.

### Exemplo (o da planilha)

Jarra a 24,90 RMB, 12 peças por caixa, 1,13 kg por peça, 0,069 m³ por caixa, II 20%, IPI 5%, container de 67,5 m³ e 28 t, frete US$ 3.492, dólar 5,15 (futuro 5,40), 6,75 RMB por dólar, despesas padrão:

- 978 caixas, 11.736 peças; custo do container R$ 359.940; **R$ 30,67 por peça** (a planilha dava R$ 26,16).
- Tipo WELLMIX - UD - CHINA - MERCADO (markup 1,8; comissão 5%; despesas 12%; meta 22%): preço mínimo **R$ 55,21**, lucro **16,0%**: amarelo. Para 22%: **R$ 62,89** (markup 2,05).
- Com os números digitados na planilha (markup 1,25; comissão 2%; despesas 5%): preço R$ 38,34, lucro 4,4%.

## 6. Casos especiais

- Produto sem NCM na tabela fiscal: II e IPI ficam vazios, com aviso para conferir à mão. NCM "NT" no IPI: 0%.
- Preço do cadastro em EUR ou BRL: o preço fica vazio, com aviso para informar em RMB ou US$.
- Sem câmbio automático: os campos ficam vazios e a tela pede o valor.
- ICMS da importação não configurado: conta 0%, com aviso.
- Caixa maior que o container: "falta preencher: volume da caixa".
- Só o peso líquido na ficha: peso bruto estimado (líquido + folga), marcado como estimado; o campo do bruto fica vazio.
- Sem peso líquido e sem peso bruto: só o volume limita o container.
- Média do despachante vazia: a tela diz "ainda não informada" (é só informação).
- Cadastro sem preço, caixa ou volume: vêm da ficha mestre do produto, quando ela tem.
- Frete zero vale (produto já posto no Brasil).
- Falta dado: a tela diz o quê e não mostra conta pela metade.

## 7. Papéis e permissões

- **Tela**: só o administrador (`ADMIN_ONLY` em `src/lib/auth/screens.ts`); nenhuma função libera. Como as telas financeiras, o administrador pode marcá-la para um login em Equipe → Editar acessos.
- **Parâmetros**: só o administrador grava (`assertRole(["admin"])`), mesmo que outro login tenha a tela.
- Quem não abre a tela volta ao início com o aviso de acesso.

## 8. Dados

Sem tabela nova e sem coluna nova: os parâmetros ficam na tabela `settings`, chave `superplan` (JSON, até 64 KB), lidos sempre com `superplanParams()`, que completa o que faltar com os valores da planilha. Um valor estragado nunca quebra a tela. A folga da embalagem no peso (`grossEstimatePct`) entrou depois: parâmetros gravados antes dela ficam com o padrão (8%) até alguém salvar.

## 9. Auditoria e segurança

- Salvar os parâmetros grava na auditoria `settings.superplan` com o **antes e o depois** completos: nenhuma versão se perde.
- O servidor confere tudo antes de gravar (números e faixas, nomes repetidos, tabela vazia); a recusa aponta o campo e nada fica pela metade.
- A simulação roda no navegador com os dados que a página já mostra ao administrador; nada é gravado por ela. Com o botão opcional de gravar (seção 5.3), quem grava é a Server Action de quem pediu o botão, que confere a permissão, valida a conta e refaz o cálculo no servidor.

## 10. Como mudar depois (com o contador)

- **Percentuais** (ICMS efetivo da venda, PIS, COFINS, IR, CSLL, AFRMM, câmbio do frete, dólar futuro, folga da embalagem no peso, fatores de preço) e **tipos de negócio**: em Parâmetros do Superplan, embaixo da tela.
- **PIS/COFINS-importação, ICMS da importação e seguro**: em Configurações → Tributos (valem também para a proposta ao cliente).
- **Regime ou forma de cálculo** (ex.: lucro presumido em vez de real, benefício fiscal do estado, crédito diferente): mudança na função `saleAt` de `src/lib/superplan.ts`, com teste novo em `tests/unit/superplan.test.ts` e o contador validando os números. A base dos impostos continua sendo o valor real da compra e da venda: declarar valor menor que o pago é subfaturamento, por isso não existe chave para isso.

## 11. Melhorias futuras

- Puxar o frete do Tarifário de frete vigente (40HC, destino escolhido) em vez do padrão.
- Salvar simulações por produto (histórico de custo e preço) e comparar cotações de fornecedores lado a lado.
- Aviso quando câmbio ou frete fazem um produto passar de verde para amarelo ou vermelho.
- Usar as variações do produto (tamanho, acabamento) e levar o preço do Superplan para a proposta ao cliente.
- Exportar a simulação em PDF ou planilha.
