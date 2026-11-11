# Série GER · Primeiros passos (todos os papéis)

Vídeos para **qualquer pessoa que entra no portal**: cliente, Wellmix (administrador e operador), fornecedor, agência, despachante, companhia marítima, transportador, jurídico, comex, agente de carga e OCP. A série abre o curso: primeiro a visão do caminho inteiro (GER-00), depois como entrar e se localizar (GER-01) e como não perder nada (GER-02). Os vídeos de cada papel (série CLI para o cliente, depois as séries dos outros papéis) começam onde esta série termina.

Antes de gravar: leia o [GUIA.md](GUIA.md) (formato, ambiente, elementos de tela e lista de qualidade). Os episódios seguem o modelo da seção 5 do guia.

## O que cada papel vê (e não vê)

Fonte: `docs/ACCESS.md`, `docs/SCOPE.md`, `src/lib/nav.ts`. Na gravação, confira cada papel logando de verdade; nomes de menu e grupos abaixo foram conferidos no build atual (`next start`, modo demonstração).

| Papel                           | Primeira tela depois do login      | Menu (grupos e telas)                                                                                           | Não vê                                                              |
| ------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Cliente                         | Explorar (a vitrine)               | **Explorar** e o grupo **Meus pedidos**: Orçamentos, Pedidos, Pendências, Notificações, Mensagens, Histórico, Marketing | Fornecedor, preço FOB, margem, cotações                              |
| Admin Wellmix                   | Control Tower                      | **Início** (Control Tower, Pendências, Painel de SLA, Notificações, Mensagens), **Pedidos**, **Cadastros**, **Gestão** | Nada fica escondido                                                  |
| Operador Wellmix                | Control Tower                      | Os mesmos quatro grupos, só com as telas das funções dele (ex.: comprador e planner); sem Financeiro e Configurações | Financeiro, Contas a pagar, Configurações, Equipe, Superplan         |
| Fornecedor                      | Pendências ("Minhas pendências")   | **Início** (Pendências, Notificações, Mensagens) e **Pedidos** (Cotações, Solicitações ao fornecedor, Pedidos, Conta corrente) | O cliente, o valor de venda, outros fornecedores                     |
| Agência                         | Pendências                         | **Início** e **Pedidos** (Embalagens, Pedidos)                                                                   | Valores, cotações, cliente, etapas dos outros                        |
| Companhia marítima              | Pendências                         | **Início** e **Pedidos** (Fretes, Minha tabela de frete, Pedidos)                                                | Valores comerciais, tabelas das outras companhias                    |
| Despachante, transportador, comex, agente de carga, OCP | Pendências | **Início** (Pendências, Notificações, Mensagens) e o link direto **Pedidos** (grupo com uma tela só vira link)   | Valores comerciais; transportador também não vê o fornecedor         |
| Jurídico                        | Pendências                         | **Início** e **Pedidos** (Pedidos, Multas)                                                                       | Valores comerciais                                                   |

## Contas de gravação e idioma

| Papel                | Conta (senha `wellmix123`)  | Idioma                                          |
| -------------------- | --------------------------- | ----------------------------------------------- |
| Cliente              | `joao@lojista.com`          | pt                                              |
| Admin / Operador     | `admin@wellmix.com` / `operador@wellmix.com` | pt                              |
| Fornecedor           | `supplier.a@china.com` (zh) e `supplier.b@china.com` (en) | zh e en            |
| Agência, despachante, transportador | `agencia@design.com`, `despachante@comex.com`, `transportadora@rodo.com` | pt |
| Companhia marítima   | `armador@maritima.com`      | en (e zh, trocando o idioma no PT / EN / ZH)    |

A série GER vale para todos os papéis, então **cada episódio traz as legendas na tela também em en e zh** (seção "Legendas na tela em EN e ZH"). A narração base é em pt-BR.

## Documentos lidos

`docs/SCOPE.md`, `docs/WORKFLOW.md`, `docs/ACCESS.md`, `docs/ARQUITETURA.md` (seção 5, login por nome de usuário; seção 6, a abertura animada), `docs/BOOKING.md`, `docs/SUPPLIER_REQUESTS.md`, `docs/RFQ_STANDBY.md`, `docs/QUOTE_FLOW.md`, `docs/ORDER_SIGNATURE.md`, `docs/RECEIVING.md`, `docs/CUSTOMERS.md`. Código: `src/lib/nav.ts`, `src/lib/auth/screens.ts`, `src/lib/intro.ts`, `src/app/app/layout.tsx`, `src/components/{app-nav,user-menu,back-button,task-list}.tsx`, `src/app/app/{tasks,notifications,messages}/page.tsx`, `src/lib/services/{tasks,messages}.ts`, `src/app/manifest.ts`. Dicionários: `src/i18n/dictionaries.ts` e `src/i18n/modules/*.ts`. Testes: `tests/e2e/happy-path.spec.ts`, `tests/e2e/intro.spec.ts`.

## Episódios

| ID     | Episódio                                  | Duração-alvo | Situação      |
| ------ | ----------------------------------------- | ------------ | ------------- |
| GER-00 | A Jornada completa do portal              | 4:30         | roteirizado   |
| GER-01 | Entrar no portal e se localizar           | 4:30         | roteirizado   |
| GER-02 | Pendências, notificações e mensagens      | 4:15         | roteirizado   |

---

## GER-00 · A Jornada completa do portal

> **Promessa:** ao final do vídeo você sabe quem faz o quê, do pedido do cliente até a entrega, e onde o seu papel entra na Jornada da Jarra de vidro.

| Ficha                 |                                                                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Série e papel         | GER · todos os papéis (vídeo de apresentação)                                                                                                                                                                |
| Conta de gravação     | Passagens rápidas, uma conta por tomada: `joao@lojista.com` (cliente), `operador@wellmix.com` (Wellmix), `supplier.a@china.com` (fornecedor, tela em zh), `agencia@design.com`, `despachante@comex.com`, `armador@maritima.com` (tela em en), `transportadora@rodo.com` |
| Duração-alvo          | 4:30                                                                                                                                                                                                         |
| Ponto da jornada      | As 9 etapas, da 1 (Produto e Booking) à 9 (Entrega e pós-venda)                                                                                                                                               |
| Telas e rotas         | `/app/explore`, `/app/requests/[id]`, `/app/orders/[id]`, `/app` (Control Tower), `/app/booking`, `/app/booking/selection`, `/app/tasks` (fornecedor), `/app/packaging` (agência), `/app/orders/[id]` nas contas do despachante, da companhia marítima e do transportador |
| Dados antes de gravar | **Grave por último**, com a Jornada da Jarra inteira feita (CLI-02 a CLI-05 e os episódios dos outros papéis): pedido da Jarra encerrado, fotos e preços dos produtos (guia, seção 7.5). Para ver cada tela "viva", use os pontos de salvamento: `antes-CLI-03` (fornecedor com a cotação por responder), `antes-sinal` (cliente com "Aprovar proposta"), `antes-recebimento` (cliente com "Confirmar"). Sem isso, as telas dos parceiros mostram "Pedido encerrado". |
| Depois deste vídeo    | Nenhuma ação no sistema: é só a apresentação. Quem assiste segue para o GER-01 e, depois, para a trilha do seu papel                                                                                          |
| Antes · Próximo       | (abertura da série) · GER-01 · Entrar no portal e se localizar                                                                                                                                               |
| Idiomas               | pt (base); legendas na tela em en e zh (tabela no fim do GER-01 vale também para os rótulos daqui)                                                                                                            |

### Roteiro

Este é o vídeo mais cuidado da série: o **mapa animado** conduz tudo. A Jarra de vidro 1,5 L (UTL-001) é um ícone que percorre uma linha com as 9 marcas do guia (seção 6.1), acendendo cada marca ao chegar. As passagens por tela são curtas (2 a 4 s), com zoom suave e **sem explicar cliques**: o objetivo é reconhecer o papel e a tela.

**Cena 1 · 0:00–0:12 · Gancho · mapa-múndi**

- 🎬 Imagem: fundo grafite, mapa-múndi com o Brasil e a China em vermelho, a rota Santos ↔ Guangzhou se desenha e o ícone da jarra percorre o caminho até a loja do João (no estilo da abertura do portal; arte de apoio, não o arquivo da vinheta).
- 🎙 Narração: "Uma jarra de vidro sai de uma fábrica na China e chega à loja do João, no Brasil. Veja o caminho inteiro que ela faz dentro do portal."
- 🔤 Na tela: `[TÍTULO]` "GER-00 · A Jornada completa do portal"; legenda "Jarra de vidro 1,5 L (UTL-001)".
- ✂️ Edição: vinheta de 6,5 s antes; título de 2 s; música sobe e cai para −28 dB quando a voz entra.

**Cena 2 · 0:12–0:30 · O mapa das nove etapas**

- 🎬 Imagem: a rota se transforma na faixa horizontal das 9 marcas, todas apagadas, que acendem uma a uma, da esquerda para a direita: Produto e Booking · Solicitação · Cotação · Sinal e pedido · Preparação · Inspeção · Embarque e mar · Desembaraço e transporte · Entrega e pós-venda. Abaixo, um selo "paralelo" cobrindo as marcas 4 a 9 com o texto "Pagamento ao fornecedor".
- 🎙 Narração: "O portal divide essa viagem em nove etapas. Cada etapa tem requisitos e um responsável. Quando tudo o que é obrigatório termina, a próxima etapa abre sozinha e o próximo responsável é avisado."
- 🔤 Na tela: `[MAPA etapa 1]` com as nove marcas; `[SETA]` "A próxima etapa abre sozinha" entre as marcas 4 e 5; selo "paralelo" (o pagamento ao fornecedor corre fora do fluxo do pedido).
- ✂️ Edição: cada marca acende em 1 s; o selo "paralelo" entra por último.

**Cena 3 · 0:30–0:52 · Etapa 1 · Produto e Booking · Wellmix**

- 🎬 Imagem: `[MAPA etapa 1]`. Passagem pela tela **Booking** (`/app/booking`, botões "Seleção de itens" e "Importar booking") e pela **Seleção de itens**; depois a vitrine do cliente com o produto no ar.
- 🎙 Narração: "Tudo começa na Wellmix. O fornecedor manda a planilha de produtos, o Booking. A equipe compara os itens, pergunta ao fornecedor se ele faz o que precisa e, aprovado, libera o produto na vitrine."
- 🔤 Na tela: `[MAPA etapa 1]` "Produto e Booking"; `[QUEM VÊ]` "Só a Wellmix vê o Booking".
- ✂️ Edição: zoom 130 % no título "Booking"; corte seco para a vitrine.

**Cena 4 · 0:52–1:12 · Etapa 2 · Solicitação · Cliente**

- 🎬 Imagem: `[MAPA etapa 2]`. Conta do João: a vitrine **Explorar** com o cartão da jarra, a página do produto e a tela **Orçamentos** com a solicitação criada ("Solicitado").
- 🎙 Narração: "João, o cliente, abre a vitrine, escolhe a jarra, informa a quantidade e pede o orçamento. Ele só vê o que é dele: nunca o fornecedor, o custo ou a margem."
- 🔤 Na tela: `[MAPA etapa 2]` "Solicitação"; `[QUEM VÊ]` "O cliente não vê fornecedor, FOB nem margem".
- ✂️ Edição: passagem de 4 s em cada tela; sem mostrar cliques.

**Cena 5 · 1:12–1:34 · Etapa 3 · Cotação · Fornecedor e Wellmix**

- 🎬 Imagem: `[MAPA etapa 3]`. Conta do fornecedor (tela em zh): **Pendências** com os sete cartões de etapa e a cotação a responder. Corte para a Wellmix: a solicitação com a escolha do fornecedor e o preço ao cliente; depois a tela de Notificações do cliente com "Proposta pronta".
- 🎙 Narração: "O pedido vai ao fornecedor, que confirma preço, prazo e pedido mínimo. A Wellmix compara, define o preço ao cliente e, depois da aprovação interna, envia a proposta."
- 🔤 Na tela: `[MAPA etapa 3]` "Cotação"; `[QUEM VÊ]` "O fornecedor não vê o cliente"; legenda em zh ao lado da tela do fornecedor.
- ✂️ Edição: manter 3 s na tela de Pendências do fornecedor (os sete cartões coloridos).

**Cena 6 · 1:34–1:56 · Etapa 4 · Sinal e pedido · Cliente e Wellmix**

- 🎬 Imagem: `[MAPA etapa 4]`. Cliente: cartão **Proposta** com "Valor ao cliente" e "Sinal" e o botão "Aprovar proposta"; depois "Pague com Pix" (ou o campo do comprovante); Wellmix: "Confirmar sinal recebido"; por fim a tela **Pedido #1** com a situação "Pedido pré-aprovado".
- 🎙 Narração: "João aprova a proposta e paga o sinal, a entrada. A Wellmix confirma o recebimento e o pedido nasce, já com todas as etapas, responsáveis e prazos."
- 🔤 Na tela: `[MAPA etapa 4]` "Sinal e pedido"; selo "paralelo" aceso nas marcas 4 a 9.
- ✂️ Edição: o selo "paralelo" acende aqui, quando o pedido nasce.

**Cena 7 · 1:56–2:24 · Etapa 5 · Preparação · Fornecedor, agência e Wellmix**

- 🎬 Imagem: `[MAPA etapa 5]`. Fornecedor: a ficha de compra; agência (`/app/packaging`, "Embalagens (faca e arte)"): a lista de briefings; fornecedor: botão de aprovar a arte; tela do **documento do pedido** com as duas assinaturas.
- 🎙 Narração: "Com o pedido criado, o fornecedor preenche a ficha de compra. A agência cria a arte da embalagem, e o fornecedor a aprova. Por fim, o documento do pedido recebe as duas assinaturas."
- 🔤 Na tela: `[MAPA etapa 5]` "Preparação"; `[QUEM VÊ]` "A agência não vê valores".
- ✂️ Edição: três passagens de 5 s (fornecedor, agência, documento).

**Cena 8 · 2:24–2:44 · Etapa 6 · Inspeção · Fornecedor e Wellmix**

- 🎬 Imagem: `[MAPA etapa 6]`. Passagem pela etapa **Inspeção** do pedido (fotos, peso e medidas enviados) e, em seguida, o cartão de revisão da Wellmix quando há divergência.
- 🎙 Narração: "Antes de embarcar, o fornecedor envia fotos, peso e medidas. O portal compara com o que foi comprado. Se algo diverge, a Wellmix decide antes de seguir."
- 🔤 Na tela: `[MAPA etapa 6]` "Inspeção"; `[SETA]` "Divergência acima da tolerância: a etapa espera a Wellmix".
- ✂️ Edição: zoom 150 % na linha da etapa "Inspeção".

**Cena 9 · 2:44–3:06 · Etapa 7 · Embarque e mar · Companhia marítima**

- 🎬 Imagem: `[MAPA etapa 7]`. Conta da companhia marítima (tela em en): o pedido na etapa **Shipping** com data, navio e BL; a carga no mar sobre o mapa.
- 🎙 Narração: "A companhia marítima confirma o embarque, com data, navio e o BL, o conhecimento de embarque. A carga está no mar e todos acompanham pelo portal."
- 🔤 Na tela: `[MAPA etapa 7]` "Embarque e mar"; `[QUEM VÊ]` "A companhia marítima só vê o próprio frete"; legenda em en.
- ✂️ Edição: a jarra atravessa o mapa-múndi enquanto a tela do embarque fica no canto.

**Cena 10 · 3:06–3:32 · Etapa 8 · Desembaraço e transporte · Despachante e transportador**

- 🎬 Imagem: `[MAPA etapa 8]`. Conta do despachante: a etapa **Desembaraço** do pedido; conta do transportador: o cartão **Carga e entrega** (mercadoria, caixas, volume, peso, chegada do navio, onde entregar) e a etapa **Transporte**.
- 🎙 Narração: "No Brasil, o despachante cuida da alfândega, dos documentos e da liberação. Depois, o transportador informa a placa e a previsão, e entrega no endereço do cliente."
- 🔤 Na tela: `[MAPA etapa 8]` "Desembaraço e transporte"; `[QUEM VÊ]` "O transportador não vê o fornecedor".
- ✂️ Edição: duas passagens de 8 s, uma por papel.

**Cena 11 · 3:32–3:50 · Etapa 9 · Entrega e pós-venda · Cliente**

- 🎬 Imagem: `[MAPA etapa 9]`. Cliente: botão "Confirmar" na etapa Entrega, faixa "Pedido encerrado", cartão **Pós-venda** com as notas de 1 a 5 e o cartão **Comprar de novo / Nova proposta**.
- 🎙 Narração: "O cliente confirma o recebimento e avalia a compra. Gostou? Pode comprar de novo, ou pedir uma nova proposta, com poucos cliques."
- 🔤 Na tela: `[MAPA etapa 9]` "Entrega e pós-venda"; `[SETA]` "O ciclo recomeça".
- ✂️ Edição: uma seta curva leva da marca 9 de volta à marca 2.

**Cena 12 · 3:50–4:08 · O que corre junto**

- 🎬 Imagem: o mapa inteiro aceso. Em cima dele, as três janelas rápidas: Pendências (cliente), o sino com número e a tela Notificações, o ícone de balão de Mensagens com o número.
- 🎙 Narração: "Em paralelo, a Wellmix paga o fornecedor pela condição combinada, sem segurar o pedido. E cada pessoa vê, em Pendências e no sino, só o que depende dela."
- 🔤 Na tela: selo "paralelo" "Pagamento ao fornecedor"; `[SETA]` "Sino: seus avisos"; `[SETA]` "Pendências: o que você precisa fazer".
- ✂️ Edição: as três janelas entram em cascata, 1 s cada.

**Cena 13 · 4:08–4:30 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho `#BF2026` com a lista; no fim, a miniatura do GER-01 e a vinheta de encerramento.
- 🎙 Narração: "Uma jornada, vários papéis, e cada um vê só o seu. Agora aprenda o seu papel. Comece pelo próximo vídeo: entrar no portal e se localizar."
- 🔤 Na tela: `[RESUMO]` "9 etapas, cada uma com responsável · A próxima abre sozinha · Cada papel vê só o seu · Avisos no sino e em Pendências"; chamada "Próximo: GER-01 · Entrar no portal e se localizar".
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Erros comuns

Este episódio é uma apresentação: não há clique a corrigir. Os três mal-entendidos mais frequentes de quem o assiste, para o texto de apoio:

- **Engano:** achar que as 9 etapas do mapa são as "9 etapas" da tela de login. **Esclarecimento:** o mapa deste vídeo agrupa a jornada inteira (do Booking ao pós-venda); a tela de login lista os passos do pedido em outra divisão (ver "Pontos a confirmar").
- **Engano:** achar que a RFQ (o pedido de cotação) escolhe entre vários fornecedores. **Esclarecimento:** hoje a solicitação vai a **um fornecedor por produto**; a disputa entre vários está em espera (docs/RFQ_STANDBY.md).
- **Engano:** achar que e-mail e WhatsApp avisam. **Esclarecimento:** só o sino e a lista de Notificações do portal avisam de verdade; e-mail e WhatsApp ainda são simulados (guia, seção 7.5).

### Passo a passo em texto

1. **Produto e Booking (Wellmix):** o fornecedor manda a planilha de produtos (Booking); a Wellmix compara os itens na **Seleção de itens**, abre a solicitação ao fornecedor e, aprovada, libera o produto na vitrine.
2. **Solicitação (cliente):** o cliente escolhe o produto na vitrine (**Explorar**) ou faz uma **Nova solicitação** e envia.
3. **Cotação (fornecedor e Wellmix):** o fornecedor responde com preço, prazo e pedido mínimo; a Wellmix define o preço ao cliente e, depois da aprovação interna, envia a proposta.
4. **Sinal e pedido (cliente e Wellmix):** o cliente aprova a proposta e paga o sinal; a Wellmix confirma o recebimento e o pedido nasce ("Pedido pré-aprovado").
5. **Preparação (fornecedor, agência, Wellmix):** ficha de compra, arte e embalagem e documento do pedido com as duas assinaturas.
6. **Inspeção (fornecedor e Wellmix):** fotos, peso e medidas comparados com o que foi comprado; divergência espera a decisão da Wellmix.
7. **Embarque e mar (companhia marítima):** embarque confirmado, com data, navio e BL (o conhecimento de embarque).
8. **Desembaraço e transporte (despachante e transportador):** liberação na alfândega, depois placa, previsão e entrega.
9. **Entrega e pós-venda (cliente):** **Confirmar** o recebimento, avaliar a compra e, se quiser, **Comprar de novo** ou **Quero nova proposta**.
10. **Em paralelo:** o pagamento ao fornecedor segue a condição do cadastro dele e não segura o pedido. Em todas as etapas, o que depende de você aparece em **Pendências** e no sino.

### Legendas na tela em EN e ZH

| Marca                    | EN                                                              | ZH                                          |
| ------------------------ | --------------------------------------------------------------- | ------------------------------------------- |
| TÍTULO                   | GER-00 · The full journey of the portal                         | GER-00 · 门户全流程                          |
| Mapa, marca 1            | Product and Booking                                             | 产品与 Booking                               |
| Mapa, marca 2            | Request                                                         | 需求                                         |
| Mapa, marca 3            | Quotation                                                       | 报价                                         |
| Mapa, marca 4            | Down payment and order                                          | 定金与订单                                   |
| Mapa, marca 5            | Preparation                                                     | 备货准备                                     |
| Mapa, marca 6            | Inspection                                                      | 验货                                         |
| Mapa, marca 7            | Shipping and sea                                                | 装运与海运                                   |
| Mapa, marca 8            | Customs and transport                                           | 清关与运输                                   |
| Mapa, marca 9            | Delivery and after-sales                                        | 交付与售后                                   |
| Selo "paralelo"          | Parallel: supplier payment                                      | 并行：供应商付款                              |
| SETA da cena 2           | The next stage opens by itself                                  | 下一阶段自动开启                              |
| RESUMO                   | 9 stages, each with an owner · The next one opens by itself · Each role sees only its own · Alerts on the bell and in My tasks | 9 个阶段，各有负责人 · 下一阶段自动开启 · 各角色只看到自己的内容 · 提醒在铃铛和“我的待办” |

Rótulos de tela citados (copiados do dicionário, mesma chave em en e zh): "Control Tower" (en "Control Tower", zh "控制塔"), "Pendências" (en "My tasks", zh "我的待办"), "Notificações" (en "Notifications", zh "通知"), "Mensagens" (en "Messages", zh "消息"), "Pedido pré-aprovado" (en "Order pre-approved", zh "订单预批准"), "Embarque" (en "Shipping", zh "装运"). ⚠ As legendas "Mapa" e "RESUMO" são traduções do roteirista (não existem como texto de tela): revisar com quem fala o idioma.

### Notas de gravação

- **Ordem de gravação:** este vídeo é o primeiro da lista, mas se grava por último. Guarde um ponto de salvamento antes de cada episódio da Jornada (guia, seção 7.2) e use-os para ter, em cada papel, uma tela com algo para fazer.
- **Mapa e ícone da jarra:** arte própria no estilo da abertura (fundo grafite, vermelho `#BF2026`, Montserrat). A abertura oficial (`wellmix-intro-desktop.mp4`) só abre o vídeo; o mapa-múndi animado do portal é peça do dono e aparece inteiro no GER-01.
- **Control Tower:** grave com `operador@wellmix.com`. A conta do administrador mostra a faixa **Financeiro** (vendido, recebido, a receber, comprado, pago) no alto da tela, e a apresentação vai a todos os papéis. Se usar a conta do administrador, corte a faixa.
- **Passagens curtas, sem clique:** nada de cursor em destaque; só zoom suave de 130 % a 150 %. Esconda a faixa âmbar de demonstração e o seletor **DEMO** (guia, seção 7.3).
- **Idiomas por tomada:** fornecedor em zh, companhia marítima em en (as demais em pt); troque o idioma antes de gravar cada passagem e confira que o botão do idioma ativo está marcado.
- **Dados de cena:** fotos e preços dos produtos (guia, seção 7.5) para a vitrine ficar bonita. Sem isso, os cartões mostram "Sem foto" e "Preço sob consulta".
- **Duração:** 4:30; as cenas 5 a 10 são as mais cheias. Se passar de 5:00, corte as passagens da cena 7 para 4 s cada.

### Pontos a confirmar

- ⚠ **Divergência de contagem na tela de login:** a tela de login (`/login`) lista 12 passos do fluxo ("Solicitação", "RFQ", "Seleção", "Sinal", "Preparação", …) e, embaixo, "{n} etapas · Português · English · 中文", onde n é o número de etapas do pedido (9, sem o pagamento ao fornecedor). O mapa deste vídeo tem 9 marcas de outra divisão (guia, seção 6.1). Convém ancorar a narração no mapa do guia e **não mostrar** o bloco de 12 passos do login como se fosse o mesmo mapa; o texto "RFQ: a Wellmix escolhe fornecedores; cada um recebe um link e responde" também está desatualizado frente à RFQ em espera.
- ⚠ Em que momento exato um item do Booking chega à vitrine no fluxo novo (Seleção de itens → solicitação ao fornecedor → produto criado → "Liberar na vitrine", docs/SUPPLIER_REQUESTS.md). A narração da cena 3 diz "aprovado, libera o produto na vitrine"; conferir com o dono se a etapa "produto criado/associado" já está ativa na versão gravada.
- ⚠ Os papéis jurídico, comex, agente de carga e OCP não aparecem nas passagens (o pedido foi: cliente, Wellmix, fornecedor, agência, despachante, companhia marítima e transportador). Se o dono quiser, acrescentar uma frase "e outros parceiros, como jurídico e certificadora" na cena 12.
- ⚠ O ícone da jarra e o mapa animado são arte nova (não existe peça no repositório): aprovar o estilo com o dono antes da edição final.

---

## GER-01 · Entrar no portal e se localizar

> **Promessa:** ao final do vídeo você entra no portal, escolhe o idioma, acha o menu do seu papel, volta de qualquer tela, sai com segurança e sabe o que fazer quando uma tela diz que você não tem acesso.

| Ficha                 |                                                                                                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | GER · todos os papéis                                                                                                                                                                         |
| Conta de gravação     | `joao@lojista.com` (cliente, pt) como conta principal; cortes com `operador@wellmix.com` (pt), `supplier.a@china.com` (zh) e `despachante@comex.com` (pt). Celular: Chrome emulando iPhone (390 × 844) |
| Duração-alvo          | 4:30                                                                                                                                                                                         |
| Ponto da jornada      | Antes da jornada: todo papel começa aqui. `[MAPA]` inteiro apagado                                                                                                                            |
| Telas e rotas         | `/login`, `/app` (que leva cada papel ao seu início), `/app/explore`, `/app/tasks`, `/app?denied=booking` (aviso de acesso), menu e menu da conta (`UserMenu`), painel do celular, `/manifest.webmanifest` |
| Dados antes de gravar | Navegador **sem** a marca do dia da abertura: apague o item `wellmix-intro-day` do armazenamento local (ou use `/login?intro=always`). Um login por **nome de usuário** criado pela Wellmix em Cadastros → empresa → quadro de acesso (ex.: `fabrica.nova.yiwu`); a carga de demonstração não traz nenhum |
| Depois deste vídeo    | Nada muda no sistema; a pessoa sabe se mover e já pode seguir para o vídeo do seu papel                                                                                                        |
| Antes · Próximo       | GER-00 · GER-02 (Pendências, notificações e mensagens)                                                                                                                                        |
| Idiomas               | pt (base); legendas na tela em en e zh (tabela no fim)                                                                                                                                         |

### Roteiro

**Cena 1 · 0:00–0:12 · Gancho · `/login`**

- 🎬 Imagem: a abertura animada começa em tela cheia: mapa-múndi escuro, o Brasil em verde e a China em vermelho, as rotas que saem do Brasil se desenham pelo mundo e a legenda "IMPORTAÇÃO DIRETA · DESDE 2010" aparece.
- 🎙 Narração: "Em segundos você entra no portal e vê só o que é seu. Vamos entrar, escolher o idioma e conhecer o menu do seu papel."
- 🔤 Na tela: `[TÍTULO]` "GER-01 · Entrar no portal e se localizar".
- ✂️ Edição: a vinheta do vídeo (6,5 s) e o título (2 s) vêm antes; aqui já é a abertura **do portal**, gravada de verdade (única do curso).

**Cena 2 · 0:12–0:20 · Onde estou na jornada**

- 🎬 Imagem: a abertura termina e a tela de login aparece. O mapa da jornada surge por cima, com as nove marcas todas apagadas.
- 🎙 Narração: "Todo papel começa aqui, antes de qualquer etapa da jornada. Depois você segue a trilha do seu papel."
- 🔤 Na tela: `[MAPA]` com as nove marcas apagadas (este vídeo vem antes da etapa 1).
- ✂️ Edição: o mapa sai em 6 s, deslizando para cima.

**Cena 3 · 0:20–0:50 · A abertura animada · `/login`**

- 🎬 Imagem: refaça a abertura em câmera lenta com o cursor parado: o mapa, as rotas saindo do Brasil, o vermelho tomando o mundo e a marca Wellmix se abrindo em letras até revelar a página. Em seguida, no canto inferior direito, o botão "Pular".
- 🎙 Narração: "Na primeira abertura do dia, o portal toca uma animação de uns seis segundos: o mapa, a rota entre o Brasil e a China e a marca Wellmix. Ela só aparece no computador. Quem tem pressa clica em Pular."
- 🔤 Na tela: `[SETA]` "Só no computador, na primeira abertura do dia" apontando a animação; `[BOTÃO] "Pular"`; `[DICA]` "Esc, Enter ou espaço também encerram a animação."
- ✂️ Edição: `[ZOOM 150 %]` no botão "Pular" por 2 s; a animação toca inteira na primeira vez e é cortada em "Pular" na segunda.

**Cena 4 · 0:50–1:25 · Entrar · `/login`**

- 🎬 Imagem: o formulário branco à direita: "Login ou e-mail", "Senha" e o botão vermelho "Entrar". Digitar `joao@lojista.com` e uma senha errada; aparece em vermelho "Credenciais inválidas". Corrigir a senha e clicar em "Entrar".
- 🎙 Narração: "Digite o seu e-mail ou o nome de usuário que a Wellmix criou para você. Quem não tem e-mail entra só com o nome de usuário. Depois digite a senha e clique em Entrar. Se aparecer Credenciais inválidas, confira os dois campos e tente de novo."
- 🔤 Na tela: `[PASSO 1/7] Digite o login e a senha`; `[BOTÃO] "Entrar"`; `[SETA]` "E-mail ou nome de usuário" no campo "Login ou e-mail"; `[ERRO COMUM]` "Credenciais inválidas" e a correção.
- ✂️ Edição: digitação em tempo real, com a senha em pontos; `[CORTE]` na entrada; a barra vermelha de progresso corre no topo.

**Cena 5 · 1:25–1:50 · A primeira tela de cada papel · `/app`**

- 🎬 Imagem: três cortes de 6 s, cada um com o nome da pessoa no canto do cabeçalho: cliente na vitrine **Explorar**; Wellmix na **Control Tower**; fornecedor (tela em zh) em **Minhas pendências**.
- 🎙 Narração: "Cada papel cai na sua primeira tela. O cliente vê a vitrine. A Wellmix vê a Control Tower. Fornecedores e parceiros começam nas Pendências."
- 🔤 Na tela: `[SETA]` "Cliente: Explorar", "Wellmix: Control Tower", "Fornecedor e parceiros: Pendências"; `[QUEM VÊ]` "Cada login vê só o seu".
- ✂️ Edição: transições de 200 ms (`[CORTE]`); o fornecedor aparece em zh com legenda.

**Cena 6 · 1:50–2:30 · O menu e os grupos · cabeçalho**

- 🎬 Imagem: na conta do cliente, o cursor abre o grupo **Meus pedidos** e mostra Orçamentos, Pedidos, Pendências, Notificações, Mensagens, Histórico e Marketing. Corte para a Wellmix: os quatro grupos **Início**, **Pedidos**, **Cadastros** e **Gestão**. Corte para o fornecedor: **Início** (Pendências, Notificações, Mensagens) e **Pedidos** (Cotações, Solicitações ao fornecedor, Pedidos, Conta corrente). Por fim, o despachante: **Início** e o link direto **Pedidos**.
- 🎙 Narração: "Cada papel tem o seu menu. O cliente vê Explorar e o grupo Meus pedidos. A Wellmix tem quatro grupos: Início, Pedidos, Cadastros e Gestão, e o operador vê só as telas das suas funções. Fornecedores e parceiros têm Início e Pedidos, só com as telas do papel. Grupo com uma tela só vira link direto."
- 🔤 Na tela: `[PASSO 2/7] Abra o grupo do menu`; `[SETA]` "Grupo com uma tela só vira link direto" no "Pedidos" do despachante; `[QUEM VÊ]` "O operador da Wellmix vê só as telas das suas funções".
- ✂️ Edição: a lista de cada grupo fica 3 s na tela; contador "1 de 4" no canto.

**Cena 7 · 2:30–2:55 · Idioma · cabeçalho**

- 🎬 Imagem: no alto, o seletor **PT EN ZH** com o idioma ativo marcado. Clicar em EN: o menu vira "Explore / My orders"; clicar em ZH: "浏览 / 我的订单"; voltar a PT. Mostrar de novo a tela de login: ela abre no último idioma usado neste navegador.
- 🎙 Narração: "No alto, PT, EN e ZH trocam o idioma na hora, e o portal lembra a sua escolha. A tela de entrada usa o último idioma escolhido neste navegador."
- 🔤 Na tela: `[PASSO 3/7] Escolha o idioma`; `[BOTÃO] "EN"`, `[BOTÃO] "ZH"`, `[BOTÃO] "PT"`; `[ATENÇÃO]` "Na tela de login não há seletor de idioma: troque depois de entrar."
- ✂️ Edição: `[ZOOM 150 %]` no seletor; pausa de 1 s em cada idioma.

**Cena 8 · 2:55–3:15 · Botão Voltar · qualquer tela**

- 🎬 Imagem: do cliente em Explorar, abrir a página de um produto, depois um pedido; clicar em "Voltar" duas vezes e mostrar que a busca e os filtros reaparecem como estavam. Em seguida, abrir um endereço direto (sem tela anterior): o "Voltar" leva à tela mãe do menu.
- 🎙 Narração: "Em toda tela, o botão Voltar leva à tela anterior, com os filtros que você tinha. Se você abriu um link direto, ele leva à tela mãe do menu."
- 🔤 Na tela: `[PASSO 4/7] Use o Voltar`; `[BOTÃO] "Voltar"`; `[DICA]` "O Voltar do portal guarda os filtros; o do navegador também funciona."
- ✂️ Edição: realce de 1 s no botão no canto superior esquerdo do conteúdo.

**Cena 9 · 3:15–3:35 · Menu da conta e Sair · cabeçalho**

- 🎬 Imagem: o cursor clica no círculo com a inicial e o primeiro nome, no canto direito: abre o cartão com o nome, o papel e o login (e-mail ou nome de usuário). Clicar em "Sair": volta ao login.
- 🎙 Narração: "Clique no seu nome para ver quem você é no portal: o nome, o papel e o login. Para terminar, clique em Sair. É importante em computador compartilhado."
- 🔤 Na tela: `[PASSO 5/7] Abra o menu da conta`; `[BOTÃO] "Sair"`; `[SETA]` "Nome, papel e login".
- ✂️ Edição: `[ZOOM 150 %]` no cartão; o clique em "Sair" volta ao login com `[CORTE]`.

**Cena 10 · 3:35–3:55 · Quando falta acesso · `/app?denied=…`**

- 🎬 Imagem: do cliente, digitar o endereço `/app/booking` (tela da Wellmix). O portal volta ao início com a faixa âmbar: "Você não tem acesso a Booking. Peça ao administrador em Gestão → Equipe e divisões."
- 🎙 Narração: "Se uma tela não é do seu papel, o portal avisa: Você não tem acesso. Não é erro: é a regra de quem vê o quê. Se precisar dela, fale com a Wellmix."
- 🔤 Na tela: `[PASSO 6/7] Leia o aviso de acesso`; `[ERRO COMUM]` "Você não tem acesso a Booking. Peça ao administrador em Gestão → Equipe e divisões." e a correção; `[QUEM VÊ]` "Cada papel só abre as suas telas".
- ✂️ Edição: `[ZOOM 150 %]` na faixa âmbar; manter 3 s.

**Cena 11 · 3:55–4:20 · Celular e instalar como app · 390 × 844**

- 🎬 Imagem: Chrome emulando iPhone (sem o zoom do navegador). A tela de login em coluna (a faixa vermelha em cima, o formulário embaixo). Já logado, o botão "Menu" no cabeçalho abre o painel: grupos como títulos, o seletor PT EN ZH e o botão "Sair". Mostrar o menu de instalação do navegador ("Adicionar à tela de início") e o ícone Wellmix na tela do celular; abrir o ícone: o portal abre sem barra do navegador.
- 🎙 Narração: "No celular, o menu vira um painel, com idioma e Sair no fim. Para abrir mais rápido, use a opção Adicionar à tela de início do navegador: o ícone da Wellmix abre o portal em tela cheia."
- 🔤 Na tela: `[PASSO 7/7] Use no celular`; `[BOTÃO] "Menu"`; `[SETA]` "Ícone Wellmix na tela do celular"; `[ATENÇÃO]` "A abertura animada nunca toca no celular."
- ✂️ Edição: moldura de celular em volta da gravação; a instalação é gravada no aparelho (ou emulada) em duas tomadas curtas.

**Cena 12 · 4:20–4:30 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do GER-02.
- 🎙 Narração: "Resumindo: entre, escolha o idioma, use o menu e o Voltar. No próximo vídeo, veja como o portal avisa o que espera por você."
- 🔤 Na tela: `[RESUMO]` "1 Entre com e-mail ou nome de usuário · 2 Escolha PT, EN ou ZH · 3 Use o menu do seu papel e o Voltar · 4 Saia pelo seu nome"; chamada "Próximo: GER-02 · Pendências, notificações e mensagens".
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Erros comuns

- **Erro:** login ou senha errados. A tela mostra "Credenciais inválidas" → **Correção:** confira o e-mail (ou o nome de usuário) e a senha; o campo aceita os dois.
- **Erro:** o banco de dados do portal não responde. A tela mostra "Não foi possível entrar agora: o banco de dados do portal não está respondendo. Sua senha não é o problema. Tente de novo em alguns minutos." → **Correção:** esperar e tentar de novo; se continuar, avisar a Wellmix.
- **Erro:** abrir uma tela de outro papel. O portal volta ao início com "Você não tem acesso a {tela}. Peça ao administrador em Gestão → Equipe e divisões." → **Correção:** a tela não é do seu papel; fale com a Wellmix (ver "Pontos a confirmar").
- **Erro:** operador da Wellmix sem função nem tela liberada. Aparece "Seu login ainda não tem função nem tela liberada. Por enquanto você vê só o básico: Pendências, Painel de SLA, Notificações e Mensagens. Peça ao administrador para liberar seus acessos em Gestão → Equipe e divisões." → **Correção:** o administrador marca as funções em Gestão → Equipe e divisões.

### Passo a passo em texto

1. Abra o endereço do portal. No computador, na primeira vez do dia, toca a abertura animada; clique em **Pular** (ou use Esc, Enter ou espaço) se tiver pressa.
2. Em **Login ou e-mail**, digite o seu e-mail ou o nome de usuário que a Wellmix criou para você. Em **Senha**, digite a senha. Clique em **Entrar**.
3. Veja a sua primeira tela: o cliente vê **Explorar**; a Wellmix, a **Control Tower**; fornecedores e parceiros, **Pendências**.
4. Use o menu do alto: o cliente tem **Explorar** e **Meus pedidos**; a Wellmix tem **Início**, **Pedidos**, **Cadastros** e **Gestão**; fornecedores e parceiros têm **Início** e **Pedidos**. Um grupo com uma tela só vira link.
5. Troque o idioma em **PT**, **EN** ou **ZH** (no alto, ao lado do sino). O portal lembra a escolha.
6. Em qualquer tela, clique em **Voltar** para ir à tela anterior (com os filtros). Na tela inicial da Wellmix e dos parceiros (`/app`) não há para onde voltar, e o botão não aparece.
7. Clique no seu nome (canto direito) para ver nome, papel e login. Clique em **Sair** para terminar.
8. Se aparecer "Você não tem acesso a …", essa tela não é do seu papel. Peça a liberação à Wellmix.
9. No celular, toque em **Menu**: o painel traz os grupos, o idioma e **Sair**. Para instalar como app, use **Adicionar à tela de início** do navegador (ícone Wellmix; abre em `/app`, em tela cheia).

### Legendas na tela em EN e ZH

| Rótulo na tela                                  | EN                                                                              | ZH                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Login ou e-mail                                 | Login or email                                                                  | 登录名或邮箱                                                |
| Senha                                           | Password                                                                        | 密码                                                        |
| Entrar                                          | Sign in                                                                         | 登录                                                        |
| Credenciais inválidas                           | Invalid credentials                                                             | 账号或密码错误                                              |
| Pular                                           | Skip                                                                            | 跳过                                                        |
| Voltar                                          | Back                                                                            | 返回                                                        |
| Sair                                            | Sign out                                                                        | 退出                                                        |
| Menu (celular)                                  | Menu                                                                            | 菜单                                                        |
| Minha conta                                     | My account                                                                      | 我的账号                                                    |
| Idioma                                          | Language                                                                        | 语言                                                        |
| Explorar                                        | Explore                                                                         | 浏览                                                        |
| Meus pedidos                                    | My orders                                                                       | 我的订单                                                    |
| Início (grupo)                                  | Home                                                                            | 首页                                                        |
| Pedidos (grupo)                                 | Orders                                                                          | 订单                                                        |
| Cadastros                                       | Master data                                                                     | 档案                                                        |
| Gestão                                          | Management                                                                      | 管理                                                        |
| Control Tower                                   | Control Tower                                                                   | 控制塔                                                      |
| Pendências (menu)                               | My tasks                                                                        | 我的待办                                                    |
| Cotações                                        | Quotations                                                                      | 报价                                                        |
| Solicitações ao fornecedor                      | Supplier requests                                                               | 供应商询单                                                  |
| Conta corrente                                  | Account statement                                                               | 往来账                                                      |
| Aviso de acesso                                 | You do not have access to {screen}. Ask the admin in Management → Team and divisions. | 您无权访问{screen}。请联系管理员：管理 → 团队与事业部。 |
| Abertura: legenda do mapa                       | BRAZIL ↔ CHINA · SINCE 2010                                                     | 巴西 ↔ 中国 · 始于 2010 年                                   |
| PASSO 1/7                                       | Type your login and password                                                    | 输入登录名和密码                                            |
| PASSO 2/7                                       | Open the menu group                                                             | 打开菜单分组                                                |
| PASSO 3/7                                       | Choose the language                                                             | 选择语言                                                    |
| PASSO 4/7                                       | Use Back                                                                        | 使用“返回”                                                  |
| PASSO 5/7                                       | Open the account menu                                                           | 打开账号菜单                                                |
| PASSO 6/7                                       | Read the access notice                                                          | 阅读无权限提示                                              |
| PASSO 7/7                                       | Use it on your phone                                                            | 在手机上使用                                                |

⚠ As linhas "PASSO n/7" e o `[RESUMO]` são traduções do roteirista; os demais rótulos são o valor da mesma chave em en e zh. Revisar com quem fala o idioma e conferir o nome dos botões na tela do próprio idioma.

### Notas de gravação

- **A abertura:** só este episódio a mostra de propósito. No Chrome comum (sem automação) ela toca na primeira abertura do dia e ao dar F5 em `/app` ou `/login`; só com a janela de 1024 px ou mais. Para repetir a tomada: apague `wellmix-intro-day` do armazenamento local, ou abra `/login?intro=always` (força; não marca o dia). Em navegador automatizado (Playwright, `navigator.webdriver`) ela **não** toca. Para a cena 3 em câmera lenta use `?intro=manual` (deixa parado; `WellmixIntro.seek(ms)`). Nas demais gravações do curso, entre por `/login?intro=off`.
- **Tirar o que denuncia "demonstração":** além do CSS do guia (seção 7.3), a tela de login mostra o quadro **"Contas de demonstração"** logo abaixo do botão Entrar. Esconda com o mesmo método: `main form + div.border-dashed { display: none !important; }` (testado no build atual).
- **Bloco de 12 passos do login:** a faixa vermelha à esquerda lista o fluxo antigo (inclui "RFQ: a Wellmix escolhe fornecedores; cada um recebe um link…"). Enquadre só o formulário (zoom de 130 % à direita) nas cenas 4 e 7.
- **Nome de usuário:** crie antes um login sem e-mail em Cadastros (3 a 40 caracteres: minúsculas, números, ponto, hífen e sublinhado). Ele aparece no cartão da conta como o nome digitado, nunca como endereço interno.
- **Celular:** use o emulador do Chrome (iPhone, 390 × 844) **sem** o zoom do navegador. A instalação ("Adicionar à tela de início") grave no aparelho real, ou em tomada separada do menu do navegador; o `manifest` do portal dá o nome "Wellmix", abre em `/app`, em tela cheia, com a cor `#bf2026`.
- **Idioma:** o cookie do idioma vale por um ano e vence sobre a preferência do login. Antes de cada tomada, deixe o navegador no idioma certo (pt na conta do cliente; zh no fornecedor).
- **Operador:** use `operador@wellmix.com` (funções comprador e planner) para o menu da Wellmix: ele não mostra Financeiro nem Configurações, o que evita expor valores a todos os papéis.

### Pontos a confirmar

- ⚠ **Texto do aviso de acesso:** "Peça ao administrador em Gestão → Equipe e divisões" indica um caminho do menu da Wellmix. Para cliente, fornecedor e parceiros esse menu não existe, então a frase confunde. Confirmar se o dono quer um texto diferente para quem é de fora (por exemplo, "fale com a Wellmix").
- ⚠ **Idioma na tela de login:** não há seletor PT / EN / ZH no login; o idioma segue o cookie do navegador (ou pt). Confirmar com o dono se um seletor no login está planejado, porque fornecedores em zh entram primeiro em pt.
- ⚠ **Instalar como app:** o `manifest` e o ícone estão no portal, mas o texto exato do menu de instalação muda por navegador e sistema (Chrome no Android, Safari no iPhone); não foi possível conferir no ambiente de teste. Gravar no aparelho e ajustar a narração ao nome real da opção.
- ⚠ **Login por nome de usuário:** a carga de demonstração não traz conta assim. A regra (3 a 40 caracteres: minúsculas, números, ponto, hífen e sublinhado; criada só pela Wellmix) vem de `docs/ARQUITETURA.md`; confirmar na gravação o formulário de criação.
- ⚠ **Primeira abertura do dia em qualquer endereço:** o script decide no `<head>` de todas as páginas, então a abertura também toca ao abrir diretamente uma tela interna na primeira vez do dia (visto no teste), não só em `/app` e `/login`. O texto de `docs/ARQUITETURA.md` cita só a página inicial; a narração diz "primeira abertura do dia".

---

## GER-02 · Pendências, notificações e mensagens

> **Promessa:** ao final do vídeo você sabe onde ver o que espera por você (Pendências e o sino), resolver um aviso com um clique e falar com a Wellmix pelas Mensagens, com anexos.

| Ficha                 |                                                                                                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | GER · todos os papéis                                                                                                                                                                         |
| Conta de gravação     | `joao@lojista.com` (cliente, pt) como principal; cortes com `supplier.a@china.com` (fornecedor, zh) e `operador@wellmix.com` (Wellmix, pt)                                                    |
| Duração-alvo          | 4:15                                                                                                                                                                                         |
| Ponto da jornada      | Todas as etapas: os avisos acompanham a jornada inteira. `[MAPA]` com as nove marcas acesas                                                                                                    |
| Telas e rotas         | `/app/tasks` (Minhas pendências), `/app/notifications` (Notificações), `/app/messages` (Mensagens), sino e balão do cabeçalho, faixa de mensagem nova, painel de chat dos botões "Conversar com a Wellmix" |
| Dados antes de gravar | Cliente com **uma pendência** ("Aprovar proposta: Jarra de vidro 1,5 L", ponto de salvamento `antes-sinal`), **três avisos** (um "Sua vez", um "Atenção" de cancelamento e um "Novidades" como "Pedido #1 criado") e **uma mensagem não lida** da Wellmix; fornecedor com a cotação da Jarra por responder |
| Depois deste vídeo    | Nada muda no sistema. A pessoa sabe resolver um aviso e conversar com a Wellmix                                                                                                                |
| Antes · Próximo       | GER-01 · o primeiro vídeo do seu papel (cliente: CLI-01)                                                                                                                                       |
| Idiomas               | pt (base); legendas na tela em en e zh (tabela no fim)                                                                                                                                         |

### Roteiro

**Cena 1 · 0:00–0:12 · Gancho · cabeçalho**

- 🎬 Imagem: o cabeçalho do cliente com o balão de mensagens (número amarelo) e o sino (número branco). O cursor passa por cima dos dois e termina no item "Pendências" do menu.
- 🎙 Narração: "Perdeu um prazo? Aqui ninguém precisa cobrar você. O portal avisa em três lugares: Pendências, o sino e as Mensagens."
- 🔤 Na tela: `[TÍTULO]` "GER-02 · Pendências, notificações e mensagens"; `[SETA]` "Mensagens", "Notificações" e "Pendências".
- ✂️ Edição: vinheta de 6,5 s e título de 2 s antes; `[ZOOM 150 %]` nos dois números do cabeçalho.

**Cena 2 · 0:12–0:22 · Onde estou na jornada**

- 🎬 Imagem: o mapa da jornada com as nove marcas acesas; pequenos sinos aparecem sobre as marcas.
- 🎙 Narração: "Os avisos acompanham a jornada inteira, da solicitação à entrega. Veja como funcionam."
- 🔤 Na tela: `[MAPA etapa 1]` com todas as marcas acesas (aviso em cada etapa).
- ✂️ Edição: o mapa sai em 6 s, deslizando para cima.

**Cena 3 · 0:22–1:05 · Pendências · `/app/tasks`**

- 🎬 Imagem: clique em "Pendências" (cliente: grupo **Meus pedidos**). A tela "Minhas pendências": "Olá, João Cliente", os filtros de **Prazo** ("Todas", "Atrasadas", "Vencem hoje", "Até 7 dias", "Mais adiante", "Sem prazo") e a tabela com **Pendência**, **Detalhe**, **Tipo**, **Prazo**. A linha "Aprovar proposta: Jarra de vidro 1,5 L"; clicar em "Abrir". Corte para o fornecedor (zh): os sete cartões de etapa, do Booking ao embarque, coloridos. Corte rápido para a Wellmix: pendências "Responder {empresa}" e "Enviar ao fornecedor". Por fim, a lista vazia: "Nenhuma pendência. Bom trabalho."
- 🎙 Narração: "Em Pendências fica tudo o que depende de você agora, ordenado pelo prazo. Clique em Abrir para ir direto ao pedido ou à solicitação. O fornecedor ainda vê as suas sete etapas em cartões. Lista vazia quer dizer que você está em dia."
- 🔤 Na tela: `[PASSO 1/5] Abra Pendências`; `[BOTÃO] "Abrir"`; `[SETA]` "Ordenadas pelo prazo: as mais urgentes primeiro"; `[SETA]` "Cartões vermelhos: atrasado; amarelos: a fazer; verdes: em dia" (fornecedor); `[QUEM VÊ]` "Cada papel vê só as suas pendências".
- ✂️ Edição: `[ZOOM 150 %]` na coluna **Prazo** com "vence em N dias"; os cartões do fornecedor ficam 3 s na tela.

**Cena 4 · 1:05–1:20 · Pendência ou aviso?**

- 🎬 Imagem: tela dividida: à esquerda Pendências (uma lista do que fazer), à direita Notificações (uma caixa de avisos).
- 🎙 Narração: "Pendência é o que você precisa fazer. Notificação é o aviso de que algo aconteceu ou de que chegou a sua vez."
- 🔤 Na tela: legenda "Pendências = o que fazer · Notificações = o que aconteceu"; `[SETA]` em cada metade.
- ✂️ Edição: a tela dividida fica 4 s.

**Cena 5 · 1:20–2:20 · Notificações · `/app/notifications`**

- 🎬 Imagem: o cursor clica no sino (número branco). A tela "Notificações" mostra três blocos: **Precisa de você** (selo "Sua vez" e "Agora é com você"), **Atenção** e **Novidades** ("Agora é com: Fornecedor"). Clicar em "Resolver" numa linha: o portal leva ao lugar e marca o aviso como lido. Voltar: o aviso saiu da lista; mostrar o link "Mostrar as lidas (N)". Passar pelos botões "Excluir", "✓ N" (marcar todas como lidas) e "Excluir todas".
- 🎙 Narração: "O sino leva às Notificações, em três blocos. Precisa de você: é a sua vez de agir. Atenção: atraso, problema ou cancelamento. Novidades: o que andou no seu pedido. Na coluna Com quem, você vê com quem está o assunto agora: com você, com a Wellmix ou com um parceiro. Clique em Resolver: o portal leva ao lugar certo e marca o aviso como lido. Aviso lido sai da lista, mas Mostrar as lidas traz de volta. E lembre: e-mail e WhatsApp ainda não avisam, só o sino."
- 🔤 Na tela: `[PASSO 2/5] Abra o sino`; `[BOTÃO] "Resolver"`; `[SETA]` "Com quem está o assunto agora" na coluna **Com quem**; `[SETA]` "Aviso resolvido (lido) sai da lista"; `[ATENÇÃO]` "Excluir todas apaga os avisos para sempre: pede confirmação."; `[ATENÇÃO]` "E-mail e WhatsApp ainda não avisam: só o sino do portal."
- ✂️ Edição: `[ZOOM 150 %]` na linha do aviso; para os "Atenção" e "Novidades", cortes de 4 s por bloco.

**Cena 6 · 2:20–3:30 · Mensagens · `/app/messages`**

- 🎬 Imagem: o cursor clica no balão ou em **Mensagens** (grupo **Meus pedidos**). A tela "Mensagens": "Fale com a equipe Wellmix. Todos os logins da sua empresa veem esta conversa."; à esquerda a lista **Assuntos** ("Geral", "Pedido #…"), à direita o campo **Mensagem** e os botões "Foto ou vídeo", "Arquivo" e "Enviar". Digitar "Olá! Posso aumentar a quantidade para 400 un?", clicar em "Arquivo" e escolher um PDF: ele vai junto, na hora. Mostrar "Conversar com a Wellmix" dentro de um pedido: abre o assunto daquele pedido. Corte para a Wellmix: o cartão **Nova conversa** com **Empresa** e "Abrir conversa" (só a Wellmix escolhe a empresa).
- 🎙 Narração: "Em Mensagens você fala com a Wellmix, organizado por assunto: Geral, um pedido ou um item. Todos os logins da sua empresa veem a mesma conversa. Para começar, use o botão Conversar com a Wellmix dentro do pedido ou da solicitação. Escreva no campo Mensagem e clique em Enviar. Para anexar, use Foto ou vídeo ou Arquivo, até cinquenta megas: ao escolher o arquivo, ele já vai com o texto. A Wellmix começa uma conversa com uma empresa pelo botão Nova conversa."
- 🔤 Na tela: `[PASSO 3/5] Abra Mensagens`; `[PASSO 4/5] Escreva e anexe`; `[BOTÃO] "Conversar com a Wellmix"`; `[BOTÃO] "Arquivo"`; `[BOTÃO] "Enviar"`; `[DICA]` "Foto, vídeo e arquivo até 50 MB; no computador, arraste para cá ou cole uma imagem (Ctrl+V)."; `[DICA]` "Para responder a uma mensagem, arraste-a para a direita."; `[QUEM VÊ]` "Todos os logins da sua empresa veem esta conversa".
- ✂️ Edição: digitação em tempo real; `[ZOOM 150 %]` no anexo que aparece dentro da bolha; pausa de 2 s com a mensagem enviada.

**Cena 7 · 3:30–4:00 · O contador de não lidas · cabeçalho**

- 🎬 Imagem: a Wellmix responde; no cliente, o balão do cabeçalho ganha o número amarelo "1", o item **Mensagens** do menu e o grupo **Meus pedidos** ganham o número, e uma faixa amarela aparece no alto: "Nova mensagem da Wellmix" com o assunto e o botão "Abrir e responder". Clicar: a conversa abre no assunto da novidade e os números somem. Corte para a Wellmix: a pendência "Responder {empresa}" (tipo "Responder mensagem") com prazo de um dia útil.
- 🎙 Narração: "Mensagem nova aparece no balão, em Mensagens e numa faixa amarela, com o botão Abrir e responder. Ao abrir, ela é marcada como lida. Do lado da Wellmix, responder vira uma pendência com prazo de um dia útil."
- 🔤 Na tela: `[PASSO 5/5] Responda pela faixa`; `[BOTÃO] "Abrir e responder"`; `[SETA]` "Mensagens não lidas" no balão; `[DEPOIS]` "A Wellmix vê a sua mensagem em Pendências e responde em até um dia útil."
- ✂️ Edição: `[ZOOM 150 %]` na faixa; o número do balão pisca uma vez só ao sumir (nada pisca mais de três vezes por segundo).

**Cena 8 · 4:00–4:15 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do primeiro vídeo do papel (cliente: CLI-01).
- 🎙 Narração: "Resumindo: Pendências é o que fazer, o sino é o que aconteceu, Mensagens é a conversa. Agora comece o vídeo do seu papel."
- 🔤 Na tela: `[RESUMO]` "1 Pendências: o que fazer · 2 Sino: Resolver leva ao lugar · 3 Mensagens: texto, foto e arquivo · 4 Número = não lidas"; chamada "Próximo: o primeiro vídeo do seu papel (cliente: CLI-01)".
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Erros comuns

- **Erro:** clicar em **Enviar** com o texto vazio e sem anexo. A tela mostra "Confira o valor de: Mensagem." e "Toque em um item para ir até ele." → **Correção:** escreva a mensagem (ou anexe um arquivo; com anexo o texto pode ficar vazio) e envie de novo. Atenção: ao escolher um arquivo, ele **já é enviado na hora**, junto com o texto digitado; depois disso não clique em Enviar com o campo vazio.
- **Erro:** mensagem com mais de 4.000 caracteres. A tela mostra "A mensagem passa de 4.000 caracteres. Divida em duas." → **Correção:** divida em duas mensagens.
- **Erro:** arquivo grande demais. A tela mostra "Arquivo grande demais (máximo 50 MB)." → **Correção:** reduza o arquivo; vídeos maiores são reduzidos no aparelho antes de enviar.
- **Erro:** formato não aceito. A tela mostra "Tipo de arquivo não aceito. Envie foto, PDF, planilha, Word, vídeo ou arte." → **Correção:** converta para um desses formatos.
- **Erro:** esperar um e-mail ou WhatsApp. Não chegam: **Correção:** olhe o sino e as Notificações (o texto de ajuda da tela diz: "E-mail e WhatsApp ainda estão em modo simulado; a lista aqui é a fonte confiável.").

### Passo a passo em texto

1. Clique em **Pendências** no menu (cliente: grupo **Meus pedidos**). Veja a lista ordenada pelo prazo e clique em **Abrir** na linha que quer resolver. Use os filtros de **Prazo** e **Tipo** se a lista for grande; **Limpar filtros** volta a todas.
2. Clique no sino, no alto. Em **Notificações**, os avisos ficam em **Precisa de você**, **Atenção** e **Novidades**. A coluna **Com quem** diz com quem está o assunto ("Agora é com você", "Agora é com a Wellmix", "Agora é com: Fornecedor").
3. Clique em **Resolver** (aviso que pede a sua ação) ou **Abrir** (aviso informativo): o portal leva ao lugar e marca o aviso como lido. Aviso lido sai da lista; **Mostrar as lidas (N)** traz de volta.
4. Para limpar, use **Excluir** (um aviso), o botão com ✓ (**Marcar todas como lidas**) ou **Excluir todas** (pede confirmação e não volta).
5. Para conversar, abra **Mensagens**. Escolha o assunto (**Geral**, um pedido ou um item). Cliente e parceiros também começam pelo botão **Conversar com a Wellmix**, dentro da solicitação ou do pedido.
6. Escreva no campo **Mensagem** e clique em **Enviar**. Para anexar, use **Foto ou vídeo** ou **Arquivo** (até 50 MB cada; escolher o arquivo já envia). No computador, arraste o arquivo para a conversa ou cole uma imagem com Ctrl+V. Para responder a uma mensagem específica, arraste-a para a direita.
7. Mensagem nova aparece como número no balão do cabeçalho, em **Mensagens** e numa faixa amarela com **Abrir e responder** (para quem é de fora da Wellmix). Ao abrir, ela é marcada como lida.
8. Wellmix: para abrir uma conversa com uma empresa, use **Nova conversa**: escolha a **Empresa** e clique em **Abrir conversa**.

### Legendas na tela em EN e ZH

| Rótulo na tela                          | EN                                       | ZH                           |
| --------------------------------------- | ---------------------------------------- | ---------------------------- |
| Minhas pendências                       | My tasks                                 | 我的待办                      |
| Abrir                                   | Open                                     | 打开                          |
| Todas                                   | All                                      | 全部                          |
| Atrasadas                               | Overdue                                  | 已逾期                        |
| Vencem hoje                             | Due today                                | 今天到期                      |
| Até 7 dias                              | Within 7 days                            | 7 天内                        |
| Sem prazo                               | No due date                              | 无期限                        |
| Limpar filtros                          | Clear filters                            | 清除筛选                      |
| Nenhuma pendência. Bom trabalho.        | No pending tasks. Good job.              | 没有待办事项。                |
| Notificações                            | Notifications                            | 通知                          |
| Precisa de você                         | Needs you                                | 需要您处理                    |
| Atenção                                 | Attention                                | 注意                          |
| Novidades                               | Updates                                  | 动态                          |
| Sua vez                                 | Your turn                                | 轮到您                        |
| Agora é com você                        | It's with you now                        | 现在由您处理                  |
| Resolver                                | Resolve                                  | 去处理                        |
| Excluir                                 | Delete                                   | 删除                          |
| Excluir todas                           | Delete all                               | 全部删除                      |
| Marcar todas como lidas                 | Mark all as read                         | 全部标为已读                  |
| Mostrar as lidas ({n})                  | Show read ({n})                          | 显示已读（{n}）               |
| Mensagens                               | Messages                                 | 消息                          |
| Conversar com a Wellmix                 | Chat with Wellmix                        | 联系 Wellmix                  |
| Geral                                   | General                                  | 综合                          |
| Mensagem                                | Message                                  | 消息                          |
| Foto ou vídeo                           | Photo or video                           | 照片或视频                    |
| Arquivo                                 | File                                     | 文件                          |
| Enviar                                  | Send                                     | 发送                          |
| Nova conversa                           | New conversation                         | 新对话                        |
| Abrir conversa                          | Open conversation                        | 打开对话                      |
| {n} não lida(s)                         | {n} unread                               | {n} 条未读                    |
| Nova mensagem da Wellmix                | New message from Wellmix                 | Wellmix 发来新消息            |
| Abrir e responder                       | Open and reply                           | 打开并回复                    |
| Responder mensagem (tipo da pendência)  | Reply to message                         | 回复消息                      |
| PASSO 1/5                               | Open My tasks                            | 打开“我的待办”                |
| PASSO 2/5                               | Open the bell                            | 点击铃铛                      |
| PASSO 3/5                               | Open Messages                            | 打开“消息”                    |
| PASSO 4/5                               | Write and attach                         | 输入并添加附件                |
| PASSO 5/5                               | Reply from the banner                    | 从提示条回复                  |

⚠ As linhas "PASSO n/5" são traduções do roteirista; os demais rótulos vêm da mesma chave do dicionário em en e zh. Revisar com quem fala o idioma.

### Notas de gravação

- **Cliente:** prepare o ponto de salvamento `antes-sinal` (CLI-03): proposta aprovada pela Wellmix, ainda sem "Aprovar proposta". O sino mostra "Proposta pronta: Jarra de vidro 1,5 L" (tipo "Sua vez", "Agora é com você"). Para o bloco **Atenção**, peça à Wellmix um cancelamento antes de gravar (ex.: "Pedido #2 cancelado"). **Novidades**: "Pedido #1 criado".
- **Mensagem não lida:** com a Wellmix logada em outro perfil, responda ao cliente no assunto de um pedido (ex.: "Oi, João! Podemos sim…"); volte ao perfil do cliente para a cena 7. A faixa amarela só aparece para quem é de fora da Wellmix; a Wellmix vê o número no balão e a pendência "Responder mensagem".
- **Anexo:** use um PDF pequeno (ex.: `layout-embalagem.pdf`); a bolha mostra o nome, o tipo e o tamanho com um link.
- **Fornecedor (zh):** a lista de sete cartões (审核 Booking, 刀模 (Die Cut), 采购表, 确认设计稿, 签署订单, 生产与验货, 装运) precisa de pelo menos uma pendência para o primeiro cartão ficar amarelo. O ponto de salvamento é o `antes-CLI-03`, com a RFQ já enviada ao fornecedor.
- **Pendência da Wellmix:** "Responder {empresa}" (tipo "Responder mensagem") aparece quando há mensagem do cliente sem resposta; o prazo é de um dia útil ("vence amanhã").
- **Sem som de e-mail ou WhatsApp:** não mencione nem mostre canais que não existem (guia, seção 7.5).

### Pontos a confirmar

- ⚠ **Aviso que continua como "Sua vez" depois da ação:** no teste, o aviso "Proposta pronta: Jarra de vidro 1,5 L" e "Pedido #1: Entrega precisa de você" continuaram em **Precisa de você** (e no número do sino) mesmo depois de o cliente aprovar a proposta e confirmar a entrega, até ele clicar em **Resolver** ou excluir. A narração diz "clique em Resolver: o portal marca o aviso como lido"; confirmar com o dono se o aviso deveria sair sozinho quando a ação é feita.
- ⚠ **Valores sem formatação em Pendências:** a pendência do cliente "Aprovar proposta" mostra "BRL 28000.00 · depois de aprovar, o sinal de BRL 11200.00", enquanto a notificação mostra "R$ 28.000,00". Na gravação, escolha o enquadramento com cuidado; avisar o dono da diferença.
- ⚠ **Pendências da Wellmix com título repetido:** duas linhas iguais "Enviar ao fornecedor: Jarra de vidro 1,5 L" (sem o número da solicitação) e o tipo "Abrir RFQ", embora a RFQ esteja em espera. Na gravação, evite mostrar essa tela ou use uma solicitação só.
- ⚠ **Como o cliente começa uma conversa:** a tela Mensagens do cliente não tem "Nova conversa" (só a Wellmix tem). O cliente chega ao chat pelo botão "Conversar com a Wellmix" e pelo ícone de balão nas linhas (painel lateral). Confirmar com o dono que é este o caminho a ensinar.
- ⚠ **Tradução automática das mensagens:** quando ligada, o campo mostra "Escreva no seu idioma: a mensagem é traduzida automaticamente para quem recebe." e o roteiro não depende dela. Confirmar se a tradução já está ligada em produção (no modo demonstração, o texto aparece como "tradução de exemplo (modo de teste)").
- ⚠ **Botão ✓ N:** o botão "Marcar todas como lidas" só mostra "✓ N" (o texto fica no tooltip). Mostrar o nome por legenda.
