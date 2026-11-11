# Tipos de parceiro administráveis

Pedido do dono (11/11/2026): quatro tipos novos em Outros parceiros (**Trading, Factory, Supplier e GP**), criar outros tipos pelo painel sem mexer no código, usuários com login em cada um e a Gestão de telas (docs/PARTNER_ACCESS.md). Decisão do dono: esses tipos são **parceiros à parte**: não entram em cotação, booking nem pedido como fornecedor.

## O que mudou

| Onde                                     | O que                                                                                                                                                                                                                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cadastros → Outros parceiros             | Os filtros vêm do catálogo: os tipos ativos e os inativos que ainda têm cadastro (com "(inativo)"). Botão **Tipos de parceiro** (administrador).                                                                                                                  |
| Novo parceiro (`/app/parties/new`)       | Aberto por Outros parceiros: só os tipos de lá, **nenhum marcado** (antes vinha "Fornecedor", padrão do formulário compartilhado com Clientes e Fornecedores). Aberto por `?type=customer` ou `?type=supplier`: só esse tipo, já marcado.                         |
| Atalho **+ Novo tipo** no formulário     | Só o administrador. Cria o tipo, volta ao formulário com ele selecionado e com o que já estava digitado (rascunho num cookie do servidor por 5 minutos; e-mail e telefone não vão para o endereço).                                                               |
| Tipos de parceiro (`/app/parties/types`) | Lista os de fábrica e os criados, com identificador, situação e quantos parceiros usam. O administrador cria, renomeia (pt/en/zh), descreve e inativa. Quem abre Cadastros vê a lista.                                                                            |
| Cadastro do parceiro                     | O tipo mostrado e o do formulário saem do catálogo. O tipo inativo continua no cadastro que já o tinha.                                                                                                                                                           |
| Importar CSV                             | A coluna do tipo aceita a chave legada (`customer`, `supplier`, `agency`…) e o nome em qualquer idioma. Tipo desconhecido, ambíguo (dois tipos com o mesmo nome) ou inativo: a linha fica com o erro e não entra. A importação só cadastra; **nunca cria login**. |

## Regras

1. **Catálogo** (`partnerTypeCatalog`): os quatro em destaque (Trading, Factory, Supplier, GP; vêm primeiro nos filtros e no formulário), os oito de sempre (agência, despachante, companhia marítima, transportador, jurídico, comex, agente de carga, OCP) e os criados no painel. "Supplier" tem a chave `supplier_partner`, porque `supplier` é a do Fornecedor (no CSV, `supplier` continua sendo o Fornecedor). Nada é gravado para os de fábrica até alguém renomear ou inativar um deles: a migração é a própria leitura, pode rodar quantas vezes for.
2. **Identificador estável** (`key`): nos de fábrica é o próprio tipo; nos criados sai do nome na criação (`empresa_de_inspecao`) e não muda ao renomear.
3. **Tipo criado no painel**: o cadastro fica com `parties.type = "partner"` e `parties.partnerTypeId` apontando para a linha. No formulário e no filtro o valor é `custom:<id>`.
4. **Renomear um tipo de fábrica** muda o nome nas telas de parceiros (lista, formulário, cadastro, tela de tipos). As outras telas que citam o papel (ex.: "Despachante" no pedido) continuam com o nome de fábrica.
5. **Inativar**: o tipo some das novas atribuições (`partner_type_inactive`) e continua legível nos cadastros que já o usam.
6. **Nomes únicos**: dois tipos não têm o mesmo nome em nenhum idioma, sem contar acento e caixa (`partner_type_name_taken`).
7. **Quem**: ler, a Wellmix com a tela Cadastros; criar e alterar, só o administrador (o serviço confere). Auditoria: `partner_type.create` e `partner_type.update`, com antes e depois.
8. **Login** (`loginRoleOfParty`): os tipos de sempre entram com o papel de sempre. Trading, Factory, Supplier e GP entram **como o Fornecedor entra** (papel `supplier`, com o perfil de telas do próprio tipo: `type:trading`…). O tipo criado no painel tem a caixa "Os usuários deste tipo podem ter login" (marcada na criação pela tela de tipos; o atalho do formulário cria sem login): com ela, entra como os quatro; sem ela, o cadastro mostra o aviso em vez do formulário de acesso e o servidor recusa (`user_role_mismatch`).
9. **Dados**: o login vê só os registros da própria empresa (`partyId`). Como esses tipos não são escolhidos como fornecedor em nenhuma operação, **as telas abrem vazias** até existir um vínculo deles com pedidos (decisão pendente: como uma Trading ou um GP é ligado a um pedido).
10. **Gerar login de acesso** (pedido do dono, 11/11/2026): o login nasce no quadro "Logins de acesso ao portal" do cadastro do parceiro (nome, login, senha sugerida, idioma). Para ficar à vista: botão **Gerar login de acesso** no topo do cadastro, coluna "Login de acesso" na lista de Outros parceiros (quantos logins tem, ou o link para gerar) e, depois de cadastrar um parceiro novo, a tela já abre nesse quadro.
11. **Novo parceiro a partir de um filtro**: com um tipo filtrado na lista, o botão já abre o formulário com ele marcado.

## Banco

- Tabela nova `partner_types`: `key` (único), `builtin` (tipo de fábrica a que a linha se refere; nulo nos criados), `name`, `nameEn`, `nameZh`, `description`, `active`, `loginClass` ("supplier" = com login), `createdByUserId`, `updatedByUserId`.
- `parties.partnerTypeId` (novo, opcional; só é enviado quando há o que gravar) e os valores `trading`, `factory`, `supplier_partner`, `gp` e `partner` em `parties.type`. Os quatro novos não precisam de linha no banco: existem no código, como os oito de sempre (a migração é a leitura; pode rodar quantas vezes for).
- Antes de publicar o esquema, o portal lê só os tipos de fábrica e os cadastros continuam salvando.

## Onde está

| Parte        | Arquivo                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| Regras puras | `src/lib/partner-types.ts`, `src/lib/party-types.ts`, `src/lib/party-draft.ts`                          |
| Serviço      | `src/lib/services/partner-types.ts`                                                                     |
| Ações        | `src/app/app/actions/partner-types.ts`; `savePartyAction` em `src/app/app/actions.ts`                   |
| Telas        | `src/app/app/parties/` (lista, `new`, `types`, `[id]`), `src/components/party-form.tsx`                 |
| Importação   | `src/lib/services/import.ts`, `src/lib/services/import-batches.ts`                                      |
| Textos       | `src/i18n/modules/partner-types.ts`                                                                     |
| Testes       | `tests/unit/partner-types.test.ts`, `tests/unit/party-types.test.ts`, `tests/e2e/partner-types.spec.ts` |

## Seletor DEMO

O seletor **DEMO** do cabeçalho não é simulação: faz um **login de verdade** na conta escolhida com a senha de demonstração, que ia na página para o navegador de qualquer usuário logado. Decisão do dono (11/11/2026): **desligado em produção** com banco de verdade (`demoAccountsEnabled`), mesmo com `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=1`. Continua no modo memória (desenvolvimento, testes e demonstração).

## O que ficou para as próximas etapas

- **Vínculo com a operação**: como Trading, Factory, Supplier e GP são ligados a um pedido (hoje nenhum fluxo os escolhe; as telas deles abrem vazias).
- **Acesso** (docs/PARTNER_ACCESS.md, "Ainda não"): ações por tela, escopo por registro, campos protegidos, exceções por empresa e por usuário, herança, vigência, vínculo de um login com mais de uma empresa, delegação, simulação.
- **Acordos comerciais e comissões**: não construído. Levantamento do que existe para base e gatilho:
  - Valores do pedido: custo (`fobTotal`) e venda (`sellPrice`), com moeda e câmbio; item com quantidade e preço unitário. A linha de produto está no pedido; por item, só pelo produto.
  - Eventos com data (`emitProcessEvent`): pedido criado, sinal confirmado, contrato assinado, início e fim de cada etapa, pedido encerrado, faturado e cancelado. A inspeção por item, o fechamento do recebimento e as confirmações de pagamento têm data, mas não disparam evento.
  - Pagamentos: recebimentos do cliente e pagamentos ao fornecedor, parciais, com confirmação; telas Financeiro e Contas a pagar. O Sankhya não devolve a baixa de forma contínua (liquidação seria registrada à mão).
  - Não existe comissão, devolução por item nem nota de crédito. O Superplan tem percentuais de comissão só na simulação.
  - Decisões do dono antes de construir: sobre que base cada percentual incide (venda, custo, recebido, margem); quem são os primeiros beneficiários e em que evento a comissão nasce e é liberada; se a liquidação vai para Contas a pagar.
