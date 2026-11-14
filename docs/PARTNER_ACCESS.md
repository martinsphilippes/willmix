# Gestão de telas dos logins externos

Pedido do dono (11/11/2026): administrar, em Cadastros → Outros parceiros, que telas cada tipo de login externo abre; começar Trading, Factory, Supplier e GP com as telas do Fornecedor; copiar o acesso a uma tela de um tipo para outro em qualquer direção. Tipos e logins em docs/PARTNER_TYPES.md; as telas da equipe Wellmix continuam em Gestão → Equipe → Funções e acessos (docs/ACCESS.md).

## Onde

`/app/parties/access`: desde 14/11/2026 é a aba **Acessos externos** de Cadastros → Parceiros (ao lado de Cadastros e Tipos de parceiro; antes era o botão **Gestão de telas** em Outros parceiros). "Configurar telas" em cada tipo e no quadro de acesso do parceiro abre a aba já no perfil. Só o administrador (a aba nem aparece para os outros logins).

### Como a aba está organizada (dono, 14/11/2026)

- **Duas visões no mesmo quadro**: "Por tipo ou perfil" e "Por tela" (`?view=screen`). Nas listas, os perfis vêm separados em **Tipos de parceiro** (Trading, Factory, Supplier, GP e os criados no painel) e **Papéis de login** (Fornecedor, Cliente, Agência…): "Supplier" é um tipo; "Fornecedor" é um papel; cada um tem as suas telas.
- **Por tipo ou perfil**: uma busca só (nome ou endereço da tela), o filtro de situação (Liberada, Fora do menu, Bloqueada, Interna da Wellmix) e as telas em **módulos recolhíveis** (Início, Pedidos, Cadastros, Gestão; abre o primeiro, o da tela em destaque e, com filtro, todos). Cada linha: Tela, Situação, Abre, No menu e Origem; o detalhe da linha (seta) traz "Feita para", os endereços e os avisos (abre sem dados, fora do menu, bloqueada, interna). As internas, as bloqueadas e a sempre aberta continuam no catálogo, cada uma só com o controle que permite (interna: nenhum; sempre aberta: travada).
- **"No menu" só com a tela aberta**: desmarcar "Abre" desmarca e trava "No menu"; marcar "Abre" volta a pôr no menu. O servidor ignora "No menu" de tela que não abre (`resolveProfile`).
- **Salvar**: a barra de baixo mostra o perfil afetado (nome, tipo ou papel, logins ativos) e "Alterações não salvas"; a confirmação repete o perfil e quantos logins; o aviso de sucesso só aparece depois da gravação no servidor ("Acessos de … salvos no servidor"). A volta mantém a busca e o filtro.
- **Origem da configuração** (só leitura, não concede nada): Padrão; Liberada à mão; Cópia de …; Tirada do menu à mão; Bloqueada fora do padrão (o padrão do perfil abre a tela e ela foi tirada). Tirar ou devolver uma tela ao menu conta como mudança à mão.
- **Por tela**: quem abre, se aparece no menu, a origem e os logins ativos de cada perfil; **Editar** abre a visão por tipo ou perfil já no perfil, com a tela em destaque (`?profile=…&focus=…`).
- **Painéis laterais** (`?panel=compare` e `?panel=copy`, por cima da visão): fechar volta ao mesmo endereço sem o painel, com a visão e os filtros. No celular, o painel ocupa a largura inteira. Os endereços antigos `?view=compare` e `?view=copy` abrem o painel.
  - **Comparar acessos**: dois tipos ou perfis; "Abre" e "No menu" comparados separadamente ("No menu" só quando os dois abrem); só as diferenças, ou todas as telas. Só consulta.
  - **Copiar acesso**: origem, destino, telas e modo (adicionar ou substituir). A prévia, tela a tela, mostra o valor atual do destino e o que será gravado em "Abre" e "No menu", calculada no servidor com a mesma conta da aplicação (`copyPreview`). "Aplicar cópia" pede confirmação, mexe só no destino e nas telas escolhidas e fica desligado quando nada muda. Se os acessos do destino mudarem entre a prévia e o clique, nada é gravado (`partner_access_stale`) e a prévia é refeita.

| Visão                | O que mostra                                                                                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Por tipo ou perfil   | Todas as telas do portal (31), com módulo, endereços, para quem a tela foi feita, situação no perfil, caixas "Abre" e "No menu" e a origem da configuração. Busca e filtro por situação. |
| Por tela             | Quais perfis abrem a tela, se aparece no menu, a origem e quantos logins ativos tem cada perfil.                                                                                         |
| Copiar acesso à tela | Painel lateral: origem, destino, telas e modo (adicionar ou substituir); **prévia** tela a tela (atual → depois) e quantos logins afeta; aplicar com confirmação.                        |
| Comparar acessos     | Painel lateral: dois perfis, "Abre" e "No menu" separados, só as diferenças (ou todas as telas).                                                                                         |

## Perfis

- `role:<papel>`: cliente, fornecedor e os parceiros de sempre (agência, despachante…).
- `type:<tipo>`: Trading, Factory, Supplier, GP e os tipos criados no painel com login.
- **Padrão de fábrica**: o do papel (`ROLE_SCREENS`); nos tipos novos, **o do Fornecedor**: Início, Pendências, Notificações, Mensagens, Pedidos, Cotações (com Solicitações ao fornecedor) e Conta corrente, incluindo as páginas de detalhe desses endereços. A **Trading**, a **Factory**, o **Supplier** e o **GP** recebem também o **Booking** (decisões do dono, 11 e 12/11/2026; `PROFILE_EXTRA`): lançam e veem só os bookings da própria empresa (docs/BOOKING.md, "Booking do Trading").
- O que o administrador muda fica gravado **por perfil**, independente dos outros (mudar o Fornecedor não muda a Trading, e vice-versa). "Voltar ao padrão" apaga o gravado.

## Regras

1. **Bloqueio por padrão**: o login abre só as telas do perfil; o resto recusa na página, no endereço direto e nas ações do servidor (`requireScreen`, `assertScreen`, as mesmas guardas de sempre). Pendências, Mensagens e Notificações passaram a conferir a tela (antes abriam para qualquer login, mesmo tirada do perfil), na página e nas ações: sem Mensagens, o chat do painel lateral recusa e os ícones e os botões de conversa, a faixa da mensagem nova e o painel somem; sem Notificações, o sino some e as ações dos avisos recusam; sem Pendências, o início mostra só a saudação (o item do menu vira "Início"), a classificação de NCM do despachante não abre e os blocos de pendências somem dos Orçamentos do cliente e do documento do pedido do fornecedor; sem Pedidos, somem os pedidos em andamento dos Orçamentos do cliente; sem Solicitações, o cliente não vê o "Comprar de novo" do pedido entregue. O aviso de mensagem nova no sino só vai para quem tem Mensagens no perfil. O carrinho confere a Vitrine; o zip das artes e a classificação fiscal do produto (despachante) conferem Pedidos.
2. **Abrir e mostrar no menu são separados**: a tela fora do menu continua abrindo por link.
3. **O início fica sempre aberto** (sem ele o login não entra em lugar nenhum).
4. **Telas internas da Wellmix** (Financeiro, Cadastros, Configurações…) aparecem no catálogo como internas e **não podem ser liberadas** a um login externo: elas mostram dados de todos. Uma tela interna só passa a poder ser liberada depois de **adaptada** (`ADAPTED` em `src/lib/partner-access.ts`): ganha uma visão própria para o login externo, com os dados só da empresa dele. Hoje, só o **Booking** ("Equipe Wellmix, Fornecedor" na coluna de origem): o externo lança os bookings da empresa dele (sobe a planilha) e lê aqueles pelos quais ela responde, sem a análise; nos papéis que nunca respondem por booking a tela abre vazia, sem o lançamento, e a Gestão de telas avisa.
5. **Tela de outra classe de login** (decisão do dono, 11/11/2026: tem de dar para liberar): qualquer tela de login externo pode ir para qualquer perfil. Antes de destravar, cada tela foi conferida aberta por outro papel: nenhuma mostra dados de outra empresa. O que acontece em cada uma:
   - **Funcionam inteiras**, com os dados da empresa de quem abre: Início, Pendências, Notificações, Mensagens, Pedidos e **Multas** (a Wellmix e o jurídico veem todas e mudam a situação; qualquer outro login vê só as multas da própria empresa, sem os botões de situação nem o arquivo de evidência, que é interno; fica vazia para quem nunca é o responsável por uma multa).
   - **Abrem sem dados** (ou voltam ao início) em outro perfil, até serem adaptadas: Vitrine, Solicitações, Histórico e Marketing (do cliente); Solicitações ao fornecedor e Conta corrente (do fornecedor); Fretes e Tarifário (da companhia marítima). O serviço de cada uma só entrega registros ao papel de origem. A Gestão de telas avisa na linha ("Feita para …: neste perfil abre sem dados"). Em Solicitações, só o cliente e a Wellmix criam: para outro perfil a lista vem vazia, sem o botão de nova solicitação, e o formulário (que traz o catálogo de produtos) não abre. No Tarifário, quem não é companhia marítima vê a tela vazia, sem o envio de planilha.
6. **Copiar**: leva o estado das telas escolhidas (abre ou não; no menu ou não). "Adicionar" só acrescenta; "Substituir" iguala cada tela à origem (pode tirar). A origem não muda; o destino fica editável. A prévia usa o mesmo cálculo da aplicação, e a aplicação leva a prévia junto (`expect`): se a configuração mudou no meio, recusa (`partner_access_stale`).
7. **Dados**: liberar uma tela não muda o escopo. Cada login vê só os registros da própria empresa (`partyId`), como o Fornecedor.
8. **Revogação**: a sessão lê o perfil a cada requisição (`externalAccessFor` em `getCurrentUser`); o que foi tirado deixa de abrir na operação seguinte.
9. **Quem**: só o administrador (o serviço confere). Auditoria: `partner_access.set`, `partner_access.copy` (com origem e destino) e `partner_access.reset`, com antes, depois e as mudanças.

## Em aberto (decisão do dono)

- **Multas dentro do pedido**: na página do pedido, o cliente e o fornecedor ainda veem todas as multas daquele pedido, com o valor, o motivo e o nome do responsável (o cliente lê o nome do fornecedor; o fornecedor, as multas dos outros parceiros). Só os parceiros (agência, despachante, companhia, transportador…) já veem apenas as próprias. A revisão de 11/11/2026 apontou; a tela Multas já segue a regra "cada login vê só as da própria empresa". Mudar a página do pedido altera o que o cliente e o fornecedor veem hoje, por isso espera a decisão.

## Banco

Sem tabela nova: a configuração fica em `settings` (chave `partnerAccess`), um perfil por chave: `{ screens, menuHidden, sources, extrasDecided }`. Sem nada gravado, vale o padrão de fábrica.

`extrasDecided` (gravado a cada alteração do perfil): o administrador já decidiu sobre as telas que o perfil ganhou de fábrica depois (o Booking da Trading). Perfil gravado **antes** disso não tem a marca e ganha a tela; a partir da gravação seguinte vale exatamente o que foi marcado, inclusive sem ela. Limite conhecido: a marca é uma só por perfil. Um perfil que já foi gravado (tem a marca) não ganha sozinho uma tela que entre em `PROFILE_EXTRA` depois; o administrador marca a tela na Gestão de telas.

## Onde está

| Parte        | Arquivo                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------- |
| Regras puras | `src/lib/partner-access.ts`, `src/lib/partner-access-view.ts` (endereço e painéis)        |
| Serviço      | `src/lib/services/partner-access.ts`                                                      |
| Sessão, menu | `src/lib/auth/session.ts`, `src/lib/auth/screens.ts` (`menuScreensFor`), `src/lib/nav.ts` |
| Ações        | `src/app/app/actions/partner-access.ts`                                                   |
| Tela         | `src/app/app/parties/access/page.tsx` e `_components/` (visões e painéis)                 |
| Textos       | `src/i18n/modules/partner-access.ts`                                                      |
| Testes       | `tests/unit/partner-access*.test.ts`, `tests/e2e/partner-access*.spec.ts`                 |

## Ainda não

- **Ações por tela** para logins externos (consultar, anexar, aprovar…): hoje as ações de cada papel externo são as da tela, fixas no código. O catálogo de ações configuráveis existe só para a equipe.
- **Escopo por registro configurável** (pedidos atribuídos, unidades) e **campos, documentos e seções protegidos** por perfil.
- **Exceções por empresa e por usuário**, herança entre perfis, vigência e bloqueio explícito.
- **Adaptar o conteúdo** das telas que abrem sem dados em outro perfil (item 5): decidir, tela a tela, que registros cada tipo de login vê.
- Vínculo de um login com mais de uma empresa, delegação a gestores do parceiro e simulação somente leitura.
