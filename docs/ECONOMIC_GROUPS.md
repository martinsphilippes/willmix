# Grupos econômicos do Sankhya e o pedido para o grupo

Pedido do dono (18/11/2026): trazer os clientes do Sankhya pela view nova `sankhya.VW_AD_CLIENTE_WELL` (dicionário enviado pelo dono: dados do cliente, grupo econômico, matriz, vendedor, região, endereço, crédito, classificação Wellmix) e fazer **um pedido para um grupo econômico inteiro**: um pedido só para os fornecedores (não se desmembra na compra), com a quantidade de cada empresa do grupo em cada produto; o desmembramento acontece na NF de venda, no Brasil.

## Decisões do dono (18/11/2026)

1. **Quem confirma** o pedido do grupo ("Aguardando cliente"): os logins da empresa que representa o grupo. As outras empresas não veem o pedido.
2. **Carga de clientes:** só pela view. A carga antiga de parceiros (TGFPAR) passa a trazer **só os fornecedores**. O código da TGFPAR fica no portal (`partnerData`, sincronização portal → Sankhya) porque a escrita no Sankhya ainda usa a TGFPAR.
3. **Nível (VIP) da cotação:** o escolhido na tela (formato de venda e nível), um para o pedido todo, como antes. A classificação de cada empresa fica gravada (linha da view), sem uso por enquanto.
4. **Local de entrega** (um ou mais, à escolha em tela) e o **desmembramento da NF de venda por empresa**: segunda etapa.

## Carga de clientes (VW_AD_CLIENTE_WELL)

- Entidade nova `customers` na Carga completa (Configurações → Sankhya → Carga; também na fila do servidor, depois dos fornecedores): `SELECT V.* FROM sankhya.VW_AD_CLIENTE_WELL V` por faixa de `COD_CLIENTE` (src/lib/integrations/sankhya-mapping.ts, `CUSTOMER_VIEW`).
- Cada linha cria ou atualiza o cliente (`parties`, tipo cliente, um por CODPARC; `upsertCustomersFromView` em src/lib/integrations/sankhya-import.ts): nome, razão social, CNPJ/CPF, IE, pessoa física/jurídica, e-mail, telefone, cidade - UF, país, endereço, ativo e o RCA (`COD_VENDEDOR`, que manda, como antes).
- Colunas novas no cliente: `economicGroupCode` (`COD_GRUPO_ECONOMICO`; 0 = fora de grupo, gravado nulo), `economicGroupName` (`GRUPO_ECONOMICO`), `matrixCode` (`COD_MATRIZ`), `sankhyaCustomer` (a linha inteira da view, todas as colunas do dicionário) e `sankhyaCustomerAt`.
- Os códigos que a escrita na TGFPAR usa vão para `sankhyaRefs` com o nome da coluna da TGFPAR (`CODVEND`, `CODEND`, `CODBAI`, `CODCID`, `CODREG`, `CODTAB`, `CODTIPPARC`, `CODPARCMATRIZ`, `CODPARCGRUECONOMICO`, `NUMEND`, `COMPLEMENTO`, `CEP`, `TIPPESSOA`) e **se somam** aos que vieram da TGFPAR (nada é apagado).
- Os grupos econômicos da carteira (`customer_groups`, montados à mão; docs/TRADE_COMERCIAL.md) continuam separados.

## O grupo na Nova solicitação (TS e Venda ao cliente)

O grupo é aberto escolhendo como cliente **a empresa que representa o grupo** (o `COD_GRUPO_ECONOMICO` é o CODPARC dela). Escolher uma loja do grupo continua sendo o pedido de um cliente só.

1. **Busca do cliente:** a empresa que representa um grupo diz "Grupo econômico · N empresas" ao lado do nome (`/api/parties/search`, `groupSize`). Na linha de baixo do cliente escolhido, depois do nome: **"+ x empresas do grupo"** e o ícone da **distribuição padrão do grupo**.
2. **Distribuição padrão** (modal do ícone ao lado do cliente): o percentual de cada empresa (nome e CNPJ), "Dividir igual" e o total, que precisa ser 100%. Gravada na tabela nova `economic_group_shares` (um registro por empresa; gravar troca a anterior inteira), pela action `saveGroupSharesAction`.
3. **Em cada produto**, no alto do quadro "Programação de entregas ao cliente", à direita do texto (que ficou mais curto): o seletor da empresa do grupo ("Todas as empresas (soma)" e cada empresa, com ✓ em quem já tem quantidade), "Completo" quando todas têm (senão "N sem quantidade") e o ícone do **preenchimento em massa**.
4. **Preenchimento em massa** (modal):
   - **Por percentual:** os percentuais do produto (vêm da distribuição padrão, ou iguais sem ela; "Usar a distribuição padrão do grupo" volta a eles), e então **a partir do total** (o total dividido pelos percentuais, em inteiros, o resto nas maiores frações) ou **a partir de uma empresa** (as caixas dela e as outras na mesma proporção).
   - **Uma a uma:** a lista de todas as empresas (nome e CNPJ) com a quantidade de cada uma e "Salvar".
   - A quantidade é em **caixas master** quando o produto tem a caixa (senão em peças). As caixas de cada empresa se repartem nas entregas do pedido em partes iguais (o resto nas primeiras).
5. **Tela principal sem empresa escolhida:** a soma de todas ("Soma das empresas: N caixas (P peças)"). Com uma empresa: a quantidade dela (editável) e as peças por entrega.
6. A **programação do produto** passa a ser a soma das empresas em cada entrega (o campo de quantidade recebe o evento `selection:rounds`), então a **Composição de containers** sempre soma todas as empresas de todos os produtos. Mexer à mão nas entregas do produto depois mostra o aviso de que a soma não bate.

## Distribuição entre entregas e matriz Empresas × Entregas (dono, 19/11/2026)

Decisões: vale para qualquer pedido (também de um cliente só); o padrão fica por cliente e por número de entregas; com uma empresa escolhida, uma caixa por entrega; a matriz fica na aba "Uma a uma" (sem aba nova).

1. **Distribuição entre entregas** (bloco "Programação de entregas ao cliente", ao lado de "# Entregas", com 2 entregas ou mais): o resumo ("60% / 40%" ou "partes iguais") e o ícone que abre o modal com o % de cada entrega (com a data), "Dividir igual", o total (100%), "Usar o padrão deste cliente" e "Salvar como padrão deste cliente para N entregas". Aplicar:
   - o gerador de cada produto ("Gerar as entregas programadas pela quantidade" e o "+ Programação") passa a repartir as caixas nessa proporção (`FixedSchedulePlan.weights`; sem ela, partes iguais como antes);
   - os produtos já preenchidos são repartidos de novo (evento `selection:rounds`); os do grupo se repartem pela matriz (o total de cada empresa nas entregas).
   - O padrão fica na tabela nova `delivery_round_shares` (cliente, número de entregas, percentuais; gravar troca só o do mesmo número), lido por `/api/customers/round-shares` e gravado por `saveRoundSharesAction`. No pedido de um grupo, o cliente é a empresa que representa o grupo. Trocar o número de entregas ou o cliente busca o padrão daquele número.
2. **Matriz Empresas × Entregas** (aba "Uma a uma" do preenchimento em massa): linhas = empresas (nome e CNPJ), colunas = entregas (com a data), células em caixas; total de cada empresa, total de cada entrega e os containers de cada entrega (pelo container escolhido no produto). "Repartir os totais pelos % das entregas" refaz as células com o total de cada empresa.
3. **"% entre as entregas deste produto"** (no alto do modal, recolhido): começa com o do pedido; mudado aqui, vale só para este produto (também na aba "Por percentual", onde o total de cada empresa vai para as entregas nessa proporção, e não mais em partes iguais).
4. **Empresa escolhida na tela principal:** uma caixa por entrega e o total da empresa.
5. **Sincronização com a programação do produto:**
   - matriz → programação: a soma de cada entrega vai para a programação e a quantidade do produto;
   - programação → matriz: mudar o gerador ou uma "Programação X" à mão reparte o novo total de cada entrega entre as empresas na proporção que elas já tinham nela (entrega vazia: a proporção do total de cada empresa; sem nada, a distribuição padrão do grupo) (`rescaleMatrix`, src/lib/economic-group.ts);
   - abrir o modal de novo, refazer e aplicar muda outra vez a programação e o total.
6. O que é gravado continua em `requests.companyAllocations` (peças de cada empresa por entrega), conferido pelo servidor.

## Ajustes do modal e da previsão de preço (dono, 19/11/2026)

1. **Peças ao lado das caixas** no "Por percentual" ("Total de caixas" ou "Caixas da empresa base") e em cada célula do "Uma a uma" (com o total de peças de cada empresa): digitar peças muda as caixas, arredondadas para cima até a caixa inteira; ao sair do campo, as peças viram as das caixas inteiras.
2. **Modal mais largo** (até 64rem).
3. **A simulação do "Por percentual" já preenche o "Uma a uma"** assim que há quantidade (sem precisar aplicar).
4. **Programação mudada à mão** (gerador ou "Programação X"): a matriz só acompanha depois que a digitação para (0,7 s) e arredonda para cima em caixas inteiras. Antes, cada tecla reescrevia a matriz no meio da digitação (apagar e digitar "45" zerava a entrega na matriz e deixava as contas erradas).
5. **Previsão de preço uma vez por produto:** a chamada não leva mais a quantidade (o preço por peça não depende dela; o valor total é preço × peças na tela), então mexer nas quantidades não chama o Sankhya de novo; as chamadas da tela vão uma de cada vez; e o servidor tenta de novo (até 3 vezes) quando o Sankhya responde "situação de concorrência… a mesma sessão HTTP fez a requisição duas vezes simultaneamente" (`isConcurrencyError`, src/lib/integrations/sankhya-client.ts). O "Containers/Entrega" também saiu da chamada (dono, 19/11/2026: o preço não muda com o número de containers): o preço é buscado uma vez por produto (e de novo só se mudarem o produto, o cliente ou as condições do pedido).

## Nome das empresas (dono, 19/11/2026)

Nas telas do pedido do grupo (distribuição padrão, seletor de empresa, preenchimento em massa, matriz e a tabela "Empresas do grupo econômico" da solicitação), a empresa aparece pela **razão social** (`parties.legalName`, a `RAZAO_SOCIAL` da view); sem ela, pelo nome (`companyName` em src/lib/services/economic-groups.ts).

## O que é gravado

- `requests.companyAllocations` (JSON): por produto, `[{ customerId, quantities: [peças por entrega] }]`. A soma por entrega é a `schedule` do produto. O cliente da solicitação é a empresa que representa o grupo.
- O servidor (`createRequest`, src/app/app/actions.ts) confere: só empresas do grupo (`groupCompanyIds`), uma vez cada, o mesmo número de entregas e a soma igual à da programação (`allocationsMatch`, src/lib/economic-group.ts). Fora disso: "As quantidades das empresas do grupo econômico não batem…" (`reqBatch.error.allocations`). Fora das telas TS e Venda ao cliente, nada é gravado.
- O rascunho guarda o campo como os outros e o devolve ao reabrir.
- Na página da solicitação, "Empresas do grupo econômico": peças por entrega e o total de cada empresa.

## Demonstração (modo memória)

`cliente-grupo` (Rede Exemplo Matriz, CODPARC 9100, representa o grupo) com `cliente-grupo-loja2` (9101) e `cliente-grupo-loja3` (9102). Só no seed da demonstração; nada disso vai para a produção. E2E: tests/e2e/request-screens.spec.ts, "TS: pedido para um grupo econômico…".

## Segunda etapa (em aberto)

- Local de entrega: um ou mais endereços das empresas do grupo, à escolha em tela.
- NF de venda por empresa (ordem de venda e Sankhya por empresa, com as peças de `companyAllocations`).
- Pedido (depois da confirmação), produção e entrega mostrando as empresas.
- Preço por empresa pela classificação dela (decisão 3: por enquanto, o nível da tela).
