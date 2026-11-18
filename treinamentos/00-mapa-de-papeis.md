# Mapa de papéis do treinamento · Portal Wellmix

Reconhecimento feito em 14/11/2026, no código do branch `wellmix` daquele dia. Fonte do escopo: `docs/` do repositório. O código confirmou o que existe e deu os textos da tela. O menu de cada conta foi lido na tela, no portal compilado em modo demonstração (`_demo/menus-por-papel.mjs`).

Os inventários completos, tarefa por tarefa, com os rótulos exatos e a chave de cada texto, estão em `_recon/`:

- `_recon/equipe-wellmix.md`: 67 tarefas da equipe interna (T01 a T67).
- `_recon/fornecedor.md`: 20 tarefas do fornecedor.
- `_recon/parceiros-externos.md`: os outros dez papéis de fora.

As durações são estimativas pela complexidade (tarefas, telas, regras e exceções). Só viram número real depois do roteiro de cada módulo.

## 1. Quem usa o portal

O portal tem 13 papéis de login e, dentro do papel "Operador Wellmix", 9 funções que mudam o menu.

| Grupo | Papel de login | Conta de demonstração | Idioma da conta |
| --- | --- | --- | --- |
| Equipe Wellmix | Administrador | `admin@wellmix.com` | pt |
| Equipe Wellmix | Operador, por função: Comprador, Planner, Gerente de produto, Cadastro, Designer, Financeiro, Comex interno, Diretoria de compras, Diretoria executiva | `operador@wellmix.com` (Comprador + Planner). As outras sete funções não têm conta: crio em Equipe e acessos | pt |
| Fora | Fornecedor | `supplier.a@china.com`, `supplier.b@china.com`, `supplier.c@china.com` | zh, en, zh |
| Fora | Agência de arte | `agencia@design.com` | pt |
| Fora | Certificadora (OCP) | `ocp@certifica.com` | pt |
| Fora | Despachante | `despachante@comex.com` | pt |
| Fora | Comex (assessoria) | `comex@assessoria.com` | pt |
| Fora | Agente de carga | `agente@cargo.com` | pt |
| Fora | Companhia marítima | `armador@maritima.com` | en |
| Fora | Transportador | `transportadora@rodo.com` | pt |
| Fora | Agência de marketing (China) | `agencia@marketing.cn` | zh |
| Fora | Jurídico | `juridico@wellmix.com` | pt |
| Fora | Cliente | `joao@lojista.com` | pt |

O fluxo que existe hoje: **Book** (planilha do fornecedor) → **Seleção de itens** → **solicitação ao fornecedor** → **negociação** → **amostragem** → **pedido de compra** → **contrato com as duas assinaturas** → **produção e inspeção** → **container na origem e documentos de carga** → **desembaraço, transporte e entrega** → **recebimento, estoque e ofertas**. A RFQ, a cotação, a proposta e o sinal do cliente saíram em 11/11/2026.

## 2. Equipe Wellmix

### 2.1 Menu por função (padrão do código; o administrador pode ter mudado em produção)

| Função | Menu lateral |
| --- | --- |
| Administrador | Control Tower, Pendências, Produto novo, Pedido, Produção, Entrega, Vendas, Financeiro, Painéis, Cadastros; rodapé: Configurações, Equipe e acessos, Auditoria |
| Comprador | Control Tower, Pendências, Produto novo, Pedido, Produção, Entrega, Vendas, Painel de SLA, Cadastros (Parceiros, Produtos) |
| Planner | Control Tower, Pendências, Produto novo, Pedido (sem Revisão), Produção, Entrega, Painéis (por área e SLA) |
| Gerente de produto | Control Tower, Pendências, Produto novo, Pedido, Vendas, Painel de SLA, Cadastros (Produtos, Linhas) |
| Cadastro | Control Tower, Pendências, Produto novo (sem Cotações e Negociações), Pedido, Vendas, Painel de SLA, Cadastros (Parceiros, Produtos, Linhas) |
| Designer | Control Tower, Pendências, Pedido (sem Revisão), Vendas, Painel de SLA, Produtos |
| Financeiro | Control Tower, Pendências, Pedido (sem Revisão), Painel de SLA |
| Comex interno | Control Tower, Pendências, Pedido (sem Revisão), Entrega (sem Tarifário de frete), Painel de SLA |
| Diretorias (as duas são idênticas) | Control Tower, Pendências, os cinco blocos do processo, Multas, Painéis (por área e SLA), Cadastros; rodapé: Auditoria |

Blocos completos: **Produto novo** (Overview, Books, Seleção de itens, Cotações, Negociações) · **Pedido** (Overview, Pedidos, Certificação, Material de arte, Arte, Revisão, Contrato) · **Produção** (Overview, Pré-produção, Inspeção, Amostra, Produção, Booking, Logística, Carregamento, Documentos de carga, Embarque) · **Entrega** (Overview, LPCO, Presença de carga, Canal cinza ou vermelho, Logística, Nota fiscal, Entrega, Retorno, Armazenagem, Containers, Fretes, Tarifário de frete) · **Vendas** (Estoque, Amostras, Ofertas, Venda) · **Financeiro** (Financeiro, Contas a pagar, Fluxo de caixa, Acordos e comissões, Multas) · **Painéis** (Painel do dono, Painéis por área, Painel de SLA) · **Cadastros** (Parceiros, Produtos, Linhas).

### 2.2 Módulos gravados uma vez e reaproveitados

O processo é o mesmo para várias funções (mesma tela, mesmo fluxo). Gravo uma vez e monto a trilha de cada função com o que ela abre. Onde o menu muda por permissão, regravo o trecho com a conta da função.

**Trilha comum (toda a equipe)**

| Módulo | Tarefas | Telas | Complexidade | Duração |
| --- | --- | --- | --- | --- |
| COM-1 · Entrar e se localizar | Login, idioma, primeiro acesso, trocar senha, menu por blocos e contadores | `/login`, `/app`, `/app/password` | baixa | 10 min |
| COM-2 · O dia começa aqui | Control Tower, Pendências, Mesa de trabalho, Painel de SLA | `/app`, `/app/tasks`, `/app/tasks/desk`, `/app/sla` | média | 13 min |
| COM-3 · Falar com parceiros | Mensagens, Controladoria, Notificações | `/app/messages`, `/app/notifications` | baixa | 8 min |
| COM-4 · Do bloco ao pedido | Overview do bloco, tela do passo ("Pendências", "Todos no passo", "Resolver"), achar o pedido e ler as etapas | `/app/flow/*`, `/app/orders/[id]` | média | 12 min |

**Processo**

| Módulo | Tarefas | Telas | Complexidade | Duração | Quem assiste |
| --- | --- | --- | --- | --- | --- |
| PN-1 · Importar e fechar o book | Subir a planilha, conferir, fechar | Produto novo → Books | média | 15 min | Comprador, GP, Planner, Cadastro, Diretorias, Admin |
| PN-2 · Seleção de itens | Agrupar itens parecidos e escolher | Seleção de itens | alta | 15 min | os mesmos |
| PN-3 · Abrir a solicitação e o convite de book | Solicitação ao fornecedor; convite a concorrente | Negociações, Cotações | média | 10 min | os mesmos, menos Cadastro |
| PN-4 · Negociar e decidir | Contraproposta, conversa, aprovar ou recusar | Negociações | alta | 15 min | os mesmos, menos Cadastro |
| PN-5 · Amostragem | Avaliar fotos e vídeos da amostra | Negociações | média | 8 min | os mesmos, menos Cadastro |
| PN-6 · Produto e código no ERP | Criar o produto vencedor, CODPROD | Negociações, Produtos | média | 12 min | Comprador, GP, Diretorias, Admin |
| PN-7 · Gerar o pedido de compra | Gerar o pedido e designar os parceiros | Negociações, Pedido | média | 12 min | Comprador, GP, Planner, Diretorias, Admin |
| PE-1 · Cadastro e fiscal | NCM e ficha mestre do produto | Produtos, Pendências | alta | 15 min | Cadastro, GP, Diretorias, Admin |
| PE-2 · A Preparação pela Wellmix | Acompanhar faca, arte, certificado; validar a arte | Pedido → Material de arte, Arte, Certificação | alta | 14 min | Comprador, GP, Planner, Cadastro, Diretorias, Admin |
| PE-3 · Pedido de amostras | Gerar e acompanhar | Pedido | média | 8 min | Comprador, GP, Planner, Diretorias, Admin |
| PR-1 · Pré-produção, follow e inspeção | ETD, follow 5/15/25, agendar e aprovar por SKU | Produção | alta | 15 min | Comprador, Planner, Diretorias, Admin |
| PR-2 · Embarque | Booking, container na origem, frete marítimo | Produção | alta | 14 min | os mesmos |
| PR-3 · Documentos de carga | Conferir check list, packing list, invoice, BL | Produção → Documentos de carga | média | 8 min | os mesmos |
| EN-1 · Desembaraço e entrega | Acompanhar e validar os passos | Entrega | média | 12 min | os mesmos + Comex interno |
| EN-2 · Recebimento no CD | Descarga, lacre, contagem, retorno do container | Entrega → Armazenagem, Retorno | alta | 12 min | Comprador, Planner, Diretorias, Admin |
| EN-3 · Containers, fretes e tarifário | Consultar, cotar, importar a tabela | Entrega | média | 14 min | os mesmos + Comex interno (sem tarifário) |
| VE-1 · Estoque, reservas e ofertas | Consultar, reservar, registrar oferta | Vendas | média | 13 min | Comprador, GP, Cadastro, Designer, Diretorias, Admin |
| CA-1 · Parceiros e acesso ao portal | Cadastro e login do parceiro | Cadastros → Parceiros | média | 12 min | Comprador, Cadastro, Diretorias, Admin |
| CA-2 · Produtos e a ficha | Ficha, fotos, variações | Cadastros → Produtos | média | 12 min | Comprador, GP, Cadastro, Designer, Diretorias, Admin |
| CA-3 · Linhas de produto | Linha, checklist, agência da linha | Cadastros → Linhas | baixa | 10 min | GP, Cadastro, Diretorias, Admin |

### 2.3 Trilha de cada função

| Papel de treinamento | Módulos próprios | Reaproveita | Duração total | Próprio a gravar |
| --- | --- | --- | --- | --- |
| **Comprador** (trilha de referência) | nenhum | COM-1 a 4, PN-1 a 7, PE-2, PE-3, PR-1 a 3, EN-1 a 3, VE-1, CA-1, CA-2 | 4 h 25 | tudo (é a base) |
| **Planner** | Programação de compra, pedido pai e filhos (15 min); Painéis por área (8 min) | COM, PN-1 a 5, PN-7, PE-2, PE-3, PR, EN | 4 h | 23 min |
| **Gerente de produto** | Mesa do GP: amostras a avaliar e certificados (10 min) | COM, PN, PE-1 a 3, VE-1, CA-2, CA-3 | 3 h 30 | 10 min |
| **Cadastro** | Mesa "Cadastro e fiscal" (10 min); Revisão (8 min) | COM, PN-1, PN-2, PE-1, PE-2, VE-1, CA | 2 h 50 | 18 min |
| **Designer** | Fazer a arte e a arte final com o selo (14 min); fotos e vídeos reais (10 min); Mesa "Marketing" (8 min) | COM, CA-2, VE-1 | 1 h 40 | 32 min |
| **Financeiro** | Numerário e faturamento dentro do pedido (12 min) | COM | 55 min | 12 min |
| **Comex interno** | Rastreio diário do container (8 min) | COM, EN-1, EN-3 | 1 h 20 | 8 min |
| **Diretorias** (uma trilha para as duas) | Assinar o contrato pela Wellmix (10 min); Painéis, SLA da equipe e Auditoria (14 min); resumo do processo (15 min) | COM, PN-4, PN-5, PE-3 | 1 h 55 | 39 min |
| **Administrador** | Logins e acessos (15), Funções e acessos (15), Divisões (8), Configurações do dia a dia (15), Pagar o fornecedor (12), Financeiro e painéis (12), cadastro do fornecedor (10) | toda a trilha do Comprador | 1 h 30 próprios + a base | 87 min |

**Avançado (raro, opcional):** programação de compra com cores; referências por IA; status do book; não conformidade da arte; Revisão e "Liberar etapa"; SKU reprovado e cancelamento; compra EXW; inventário às cegas; importar ficha técnica e CSV; Multas; tipos de parceiro e acessos externos; acordos e comissões; Superplan; Sankhya; resumos e dados de teste. Cerca de 15 módulos de uns 10 min.

## 3. Fornecedor

Menu: Pendências · Pedido (Pedidos, Material de arte, Contrato) · Produção (Inspeção, Amostra, Logística, Carregamento, Documentos de carga, Embarque) · Meus books (Convites de book, Solicitações ao fornecedor, Pedidos, Conta corrente).

| Módulo | Tarefas | Telas | Complexidade | Duração |
| --- | --- | --- | --- | --- |
| 1 · Primeiros passos | Entrar, idioma, Pendências e as nove etapas, sino, mensagens, acompanhar pedidos | `/app`, `/app/orders` | baixa | 10 min |
| 2 · Solicitação: responder e negociar | Aprovar, renegociar ou recusar; contraproposta; conversa | `/app/supplier-requests` | alta | 15 min |
| 3 · Amostragem | Fotos e vídeos da amostra, nova rodada | `/app/supplier-requests/[id]` | média | 8 min |
| 4 · Pedido de compra | Die Cut (faca e foto em alta), pedido de amostras, contrato assinado, confirmar pagamento | Pedido, Conta corrente | alta | 15 min |
| 5 · Produção e inspeção | Fotos, peso, vídeo, declaração; ETD; SKU reprovado | Produção → Inspeção | alta | 12 min |
| 6 · Amostras e container na origem | Retirada e envios; container vazio, carregamento, lacre, porto | Produção | alta | 12 min |
| 7 · Documentos de carga | Check list, packing list, invoice | Produção → Documentos de carga | média | 10 min |
| Avançado | Convite de book, lançar book, compra EXW, certificações, programação | várias | média | 12 a 15 min |

Total: cerca de 95 min. A carga de demonstração não traz book, solicitação nem pedido: os dados nascem pelo fluxo, na ordem do teste E2E.

## 4. Demais papéis de fora

| Papel | Tarefas que ele executa hoje | Telas | Complexidade | Módulos | Duração |
| --- | --- | --- | --- | --- | --- |
| **Agência de arte** | Enviar a arte por produto; reenviar a devolvida; arte final com o selo; selo aplicado na arte; correção; baixar as artes; Mesa de trabalho | Pedido → Arte, Certificação | média | Arte do pedido (10–12) · Selo e arte final (10–12) · Avançado (8–10) | 30–35 min |
| **Certificadora (OCP)** | Certificado por produto; memorial e selo; substituir arquivo; ler o pedido; Mesa de trabalho | Pedido → Certificação | média | Certificado por produto (10–12) · Memorial e selo (10–12) | 20–25 min |
| **Despachante** | Desembaraço do pedido; NCM dos itens de book; classificação fiscal do produto | Presença de carga, NCM dos books | média | Desembaraço (10–12) · NCM (10–12) · Avançado (5–8) | 20–25 min |
| **Comex (assessoria)** | Numerário, presença de carga, canal, DI, CE Mercante, CI, LPCO; o resto do menu é leitura | Entrega | média | Numerário, presença e canal (10–12) · DI, CE, CI e LPCO (8–10) | 20 min |
| **Companhia marítima** | BL; confirmar o embarque; valor do frete; tabela de frete | Embarque, Fretes, Minha tabela de frete | média | BL e embarque (12–15) · Cotação de frete (6–8) · Avançado: tabela (10–12) | 30–35 min |
| **Agência de marketing (China)** | Receber as amostras; fotos e vídeos reais; refazer; devolver a amostra | Produção → Amostra | média | Amostras e fotos reais (12–15) | 12–15 min |
| **Agente de carga** | Informar o booking (reserva no navio); o resto é leitura | Produção → Booking | baixa | Booking e acompanhamento (8–10) | 8–10 min |
| **Transportador** | Registrar o transporte e a entrega | Entrega → Logística, Entrega | baixa | Transporte e entrega (8–10) | 8–10 min |
| **Jurídico** | Acompanhar multas e mudar a situação; consultar pedidos | Multas, Pedidos | baixa | Multas e consulta (6–8) | 6–8 min |
| **Cliente** | Hoje: entrar, Pendências, Pedidos e Mensagens, com as listas vazias (ver 6.1) | Pendências, Pedidos | baixa | 1 módulo curto | 5–7 min |

Há um bloco comum aos parceiros (entrar, Pendências, tela do passo, detalhe do pedido, enviar e reenviar um item, mensagens): 10 a 12 min, gravado uma vez.

## 5. Volume total e ordem sugerida

Vídeo único a produzir (sem contar o que é reaproveitado): equipe Wellmix cerca de 8 h (trilha comum 43 min, processo 4 h 06, próprios de cada função 3 h 49, menos sobreposições) mais uns 2 h 30 de avançado; fornecedor 1 h 35; demais papéis de fora cerca de 3 h. **Total na casa de 15 a 16 horas de vídeo**, em mais de 80 módulos.

É muito. A ordem abaixo entrega primeiro o que mais gente usa todo dia, e cada item aproveita o anterior:

| Ordem | Papel | Por quê | Vídeo novo |
| --- | --- | --- | --- |
| 1 | **Comprador** (com a trilha comum da equipe) | É quem conduz o processo e a base de cinco outras trilhas. O primeiro módulo (COM-1) serve de piloto da PARADA B | 4 h 25 |
| 2 | **Fornecedor** | O parceiro que mais age no portal; o pedido não anda sem ele | 1 h 35 |
| 3 | **Planner** | Reaproveita quase tudo do Comprador | 23 min |
| 4 | **Cadastro** e **Gerente de produto** | Fecham o Produto novo e o fiscal | 28 min + PE-1 e CA-3 |
| 5 | **Administrador** | Logins, acessos, configurações, pagamentos | 1 h 27 |
| 6 | **Designer**, **Financeiro**, **Comex interno**, **Diretorias** | Trilhas curtas | 1 h 31 |
| 7 | **Agência de arte**, **OCP**, **Despachante**, **Comex (assessoria)** | Parceiros da preparação e do desembaraço | 1 h 35 |
| 8 | **Companhia marítima**, **Agente de carga**, **Transportador**, **Agência de marketing**, **Jurídico** | Parceiros com poucas tarefas | 1 h 15 |
| 9 | **Cliente** | Sem tarefa real hoje; esperar a vitrine abrir | 5 min agora |
| — | Avançado de cada papel | Depois do essencial de todos | 2 h 30 |

## 6. Divergências entre a documentação e o código

Nada do que está aqui entra no treinamento sem a sua decisão.

### 6.1 Mudam o que dá para ensinar

1. **Cliente sem trabalho real.** O único pedido que nasce hoje é o pedido de compra, em que o cliente é a própria Wellmix, sem login. Confirmar recebimento, avaliar, recomprar e cancelar existem no código, mas não há pedido para o login do cliente.
2. **O início do cliente não bate com o menu.** O menu mostra só Pendências e Pedidos, mas ao entrar ele cai na vitrine (`/app/explore`), que está fora do menu ("a vitrine ainda não abriu"). Vi isso na tela.
3. **Despachante sem tarefa de certificação.** A documentação diz que laudo e registro são dele; a tela não mostra mais esses passos. Sobram o desembaraço e o NCM.
4. **Fornecedor: as nove etapas das Pendências ainda têm duas do fluxo antigo** ("Ficha de compra" e "Aprovar a arte"). Pela leitura do código, o aceite do pedido de amostras aparece dentro de "Aprovar a arte", com texto de arte. A confirmar na tela.
5. **Contrato do fornecedor:** no pedido de compra só existe enviar o arquivo assinado, mas o formulário se chama "Opção 2: enviar o documento assinado" e a ajuda fala em "assinar no portal". O PDF do contrato omite caracteres chineses.
6. **Agência com dois envios da arte com selo** ("Arte final com o selo" por produto e "Selo aplicado na arte" por pedido). A tela "Embalagem", citada em `docs/ACCESS.md`, não existe mais.
7. **Compra para estoque e solicitação do cliente param no meio.** Os botões do Estoque abrem a tela escondida de solicitação, que fica em "Solicitada" sem continuação. Vendas → Venda só conta pendências dessas telas.
8. **Idioma:** várias pendências do fornecedor saem só em português para quem usa chinês ou inglês.
9. **Dois caminhos para o mesmo documento:** o BL aparece nos Documentos de carga e como item opcional da etapa Embarque.

### 6.2 Telas prontas e fora do menu (não ensino)

Vitrine do cliente, Orçamentos, Histórico, Marketing (kits e tabela de preços), Pós-venda, Sourcing (em espera), Solicitações do cliente. Continuam abrindo pelo endereço.

### 6.3 Documentos e textos que ficaram no fluxo antigo

- `docs/SCOPE.md`, `OPEN_DECISIONS.md`, `PURCHASE_FLOW.md`, `WORKFLOW.md`, `DASHBOARDS.md`, `SUPERPLAN.md` (seção 11) e partes de `CERTIFICATION.md` ainda descrevem RFQ, cotação, proposta, sinal do cliente, dumping e pré-custo.
- `docs/videos/` (74 roteiros de antes): não valem os episódios de cotação, proposta e sinal, ficha de compra, briefing de embalagem, aprovação da arte pelo fornecedor e laudo e registro. Uso só como pista.
- Na tela: a descrição das funções em Equipe e acessos cita RFQ, pré-custo e dumping; o aviso de acesso negado manda para "Gestão → Equipe e divisões", que não existe com esse nome no menu; textos do cliente falam de proposta e sinal; ajudas das etapas do fornecedor e da agência descrevem o fluxo antigo.
- `docs/ACCESS.md`: a matriz não tem as colunas Financeiro e Comex interno; diz que pagamentos pedem a tela Financeiro, mas o código exige o papel de administrador; diz que assinar o contrato é de "quem abre Pedidos", mas só as Diretorias têm a ação.
- `docs/FLOW_MENU.md` se contradiz: uma parte diz que "Todos no passo" é só da Wellmix; outra parte e o código dão as duas abas aos parceiros.

### 6.4 Manual, simulado ou em espera (mostro como é, sem prometer)

E-mail e WhatsApp são simulados (só o sino avisa). Pagamento é registro manual do administrador. Sankhya fica em modo manual sem credencial. IA depende de chave. Booking no navio, aduana e rastreio do container são digitados. A assinatura do contrato é arquivo assinado e carimbado, não certificado digital.

## 7. Dúvidas de permissão (não adivinhei)

1. **Operador vê valores.** FOB e valor de venda aparecem no Resumo e nos Itens do pedido para qualquer login da Wellmix; preço, custo, preço mínimo e lucro aparecem na Seleção e na Negociação. `docs/ACCESS.md` diz que financeiro é só do administrador. Vale também para Cadastro e Designer?
2. **Cadastro abre a solicitação e não consegue vê-la** (abre com a tela Books; a solicitação pede Cotações, que ele não tem).
3. **Planner aprova e não cria o produto** (não tem Produtos nem Parceiros).
4. **Comex interno sem o bloco Produção:** o rastreio diário é do passo Embarque, que o menu dele não mostra; chega só por Pendências.
5. **"Validar a arte" é de todas as funções** que abrem Pedidos, inclusive Financeiro e Comex interno.
6. **Ações do pedido conferem só a tela Pedidos:** salvar ETD, agendar inspeção, aprovar SKU, parceiros, recebimento. O servidor aceita de qualquer login da Wellmix que abra o pedido.
7. **Painel do dono e Fluxo de caixa** aparecem com a tela Financeiro, mas a página pede também "Painéis por área".
8. **Só o administrador é lembrado** do sinal e do pagamento ao fornecedor e do certificado sem certificadora.
9. **Despachante com a visão da certificadora:** vê cliente, FOB, ficha com preço e o documento do pedido. Ainda faz sentido?
10. **NCM por qualquer despachante:** todo login de despachante vê todos os itens de book sem NCM, sem vínculo com pedido.
11. **Jurídico vê todos os pedidos**, com cliente, fornecedor, valores das etapas e documentos.
12. **Parceiros veem a tabela "Documentos" do pedido** (arte, faca, arquivos da gráfica, BL). Fornecedor e cliente veem todas as multas do pedido, com o nome do responsável.
13. **Fornecedor e a tela Book:** só Trading, Factory, Supplier (tipo) e GP nascem com "Lançar book". As contas de demonstração não têm.
14. **A Wellmix faz a parte do parceiro** em quase todos os passos, mesmo com ele designado. No vídeo, trato como exceção?
15. **Padrão × produção:** o menu por função acima é o padrão do código. Se o administrador mudou as funções em produção, o menu real é outro.

## 8. Termos de pronúncia a confirmar

A marca está decidida: **Wellmix = UÉLMIX**. Os demais estão em `_config/pronuncias.json` como "proposto". Os que mais pesam: BL ("bi-éle"), FOB ("fóbi"), EXW ("éks-uôrks"), ETD e ETA ("é-tê-dê", "é-tê-á"), SKU ("ésse-cá-u"), NCM, DI, LPCO, CE Mercante, OCP, Sankhya ("Sânquia"), Superplan, Control Tower, Book e Booking ("buque", "búquin"), Die Cut ("dai-cât"), CBM (leio "metros cúbicos"), MOQ (leio "pedido mínimo"), NF-e ("ene-efe-é").
