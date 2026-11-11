# Livro de perguntas · Wellmix · Solicitação, cotação e proposta

> Gerado por `node scripts/treinamento-livro.mjs` a partir de `docs/treinamento/modulos/WSO/`. **Não edite aqui:** edite o YAML do módulo e gere de novo. A letra marcada com ✔ é a resposta certa.

- [WSO-01 · Receber a solicitação do cliente e enviar ao fornecedor](#wso-01-receber-a-solicitacao-do-cliente-e-enviar-ao-fornecedor)
- [WSO-02 · Comparar a cotação e fechar o preço ao cliente](#wso-02-comparar-a-cotacao-e-fechar-o-preco-ao-cliente)
- [WSO-03 · Proposta, sinal e nascimento do pedido](#wso-03-proposta-sinal-e-nascimento-do-pedido)
- [WSO-04 · RFQ em espera: o interruptor](#wso-04-rfq-em-espera-o-interruptor)
- [WSO-05 · Superplan: a viabilidade do produto](#wso-05-superplan-a-viabilidade-do-produto)

---

## WSO-01 · Receber a solicitação do cliente e enviar ao fornecedor

**Duração** 4:00 · **Capítulos** 3 · **Perguntas** 8 · **Idiomas** pt

**Quem assiste:** Operador · Comprador; Operador · Gerente de produto; Operador · Planner; Administrador

### Capítulos (mini vídeos)

1. `0:00–1:15` · **Achar a solicitação do cliente** (cenas 1 a 4): O aviso no sino, a pendência "Enviar ao fornecedor" e a lista Pedidos → Solicitações levam à solicitação que acabou de chegar.
2. `1:15–2:25` · **Conferir o pedido e a situação da RFQ** (cenas 5 a 6): Confira quantidade, prazo e observação do cliente e entenda por que, com a RFQ em espera, cada produto vai a um fornecedor só.
3. `2:25–4:00` · **Escolher o fornecedor e enviar** (cenas 7 a 10): Escolha o fornecedor, clique em **Enviar ao fornecedor** e veja nascer a cotação e o briefing de embalagem.

### Perguntas

**Q1** · nível 1 (lembrar) · uma resposta · capítulo 1, cena 3

O cliente acabou de enviar a solicitação da jarra. Onde aparece a sua pendência para mandá-la ao fornecedor?

- A) Gestão → Histórico, na linha da solicitação do cliente
- B) Cadastros → Produtos, abrindo o produto que o cliente pediu
- ✔ C) Início → Pendências, na linha **Enviar ao fornecedor** (tipo "Abrir RFQ")
- D) Pedidos → Embalagens, no briefing da solicitação

> O aviso chega no sino e a pendência aparece em Início → Pendências como "Enviar ao fornecedor: {produto}", com o botão **Abrir** que leva direto à solicitação.

**Q2** · nível 1 (lembrar) · uma resposta · capítulo 1, cena 4

Em Pedidos → Solicitações, a solicitação do cliente acabou de chegar e ninguém mexeu nela. Qual Situação aparece na tabela?

- ✔ A) Solicitado
- B) RFQ aberta
- C) Aguardando sinal
- D) Cotações recebidas

> Uma solicitação recém-chegada está em **Solicitado**, e o próximo passo é abrir a cotação com fornecedores. As outras situações vêm depois, conforme o fornecedor responde e o cliente avança.

**Q3** · nível 2 (aplicar) · verdadeiro ou falso · capítulo 2, cena 5

O cliente também vê as "Etapas da solicitação" (Solicitação nova, RFQ aberta, Cotações recebidas, e assim por diante) na tela dele.

- A) Verdadeiro
- ✔ B) Falso

> Só a Wellmix vê as Etapas da solicitação. O cliente vê a mesma solicitação em Orçamentos, sem fornecedor, cotações nem próximo passo.

**Q4** · nível 2 (aplicar) · colocar na ordem · capítulo 3, cena 7

Ponha em ordem o caminho para enviar a solicitação ao fornecedor, a partir da tela da solicitação.

- A) Abrir a lista **Escolha o fornecedor** e escolher um
- B) Conferir o briefing em Pedidos → Embalagens
- C) Clicar em **Enviar ao fornecedor** na frase em destaque, que leva a Pedidos → RFQ
- D) Clicar em **Enviar ao fornecedor** na linha do produto

Ordem certa: C → A → D → B

> O link da frase leva à tela RFQ; ali você escolhe o fornecedor, clica no botão da linha e só então confere o briefing de embalagem que nasceu junto.

**Q5** · nível 2 (aplicar) · várias respostas · capítulo 3, cena 9

Depois do clique em **Enviar ao fornecedor**, o que passa a valer? Marque todas as certas.

- ✔ A) A solicitação vira **RFQ aberta**
- B) O cliente recebe a proposta com o preço
- ✔ C) O fornecedor recebe o aviso "Cotação pedida" e a pendência de responder
- ✔ D) A coluna **Responderam** mostra 0 / 1
- E) O pedido nasce com as nove etapas

> O envio abre a RFQ para um fornecedor e deixa a cotação esperando resposta (0 de 1). Proposta ao cliente e pedido só vêm bem depois, com a aprovação e o sinal.

**Q6** · nível 3 (decidir) · uma resposta · capítulo 3, cena 7

Você enviou a jarra ao fornecedor A e agora quer mandar o mesmo produto também ao fornecedor B. A tela responde: "Este produto já foi enviado a outro fornecedor. A RFQ para vários fornecedores está em espera." O que você faz?

- A) Marca os dois fornecedores na lista e clica de novo
- ✔ B) Fala com o administrador, que é quem pode ativar a RFQ para vários fornecedores
- C) Exclui a solicitação e pede ao cliente que envie outra
- D) Espera a cotação do fornecedor A expirar para enviar ao B

> Com a RFQ em espera, cada produto vai a um fornecedor só, e quem liga a RFQ é o administrador. Excluir a solicitação ou marcar dois fornecedores não contorna a regra.

**Q7** · nível 3 (decidir) · uma resposta · capítulo 3, cena 8

O cliente liga perguntando se pode ver o briefing de embalagem (faca e arte) que nasceu quando você enviou a solicitação. O que você responde?

- A) Pode, ele aparece em Orçamentos junto com a solicitação
- B) Pode, mas só depois que ele pagar o sinal
- ✔ C) Não, o cliente nunca vê o briefing de embalagem
- D) Pode, se a agência liberar a arte para ele

> O briefing de embalagem é interno: a agência trabalha a faca e a arte em paralelo com a cotação, e o cliente nunca o vê. A agência, por sua vez, não vê o nome do cliente.

**Q8** · nível 3 (decidir) · uma resposta · capítulo 3, cena 9

Meia hora depois do envio, a solicitação mostra o selo **RFQ aberta** e "0 de 1 responderam". O que isso quer dizer e o que você faz?

- A) Deu erro no envio; é preciso enviar de novo ao fornecedor
- B) O cliente ainda precisa aprovar a solicitação antes de o fornecedor ver
- C) É preciso escolher outro fornecedor, porque o primeiro não respondeu
- ✔ D) Está certo: o fornecedor foi avisado e você será avisado quando a cotação chegar

> 0 de 1 é o estado normal logo após o envio: o fornecedor recebeu o aviso e a pendência, e a Wellmix é avisada quando ele responde. Não há nada a reenviar.

---

## WSO-02 · Comparar a cotação e fechar o preço ao cliente

**Duração** 5:00 · **Capítulos** 4 · **Perguntas** 8 · **Idiomas** pt

**Quem assiste:** Operador · Comprador; Operador · Gerente de produto; Operador · Planner; Administrador

### Capítulos (mini vídeos)

1. `0:00–1:25` · **Abrir a cotação e escolher o fornecedor** (cenas 1 a 4): Quando o fornecedor responde, a pendência "Escolher fornecedor" leva à Comparação de cotações, onde você escolhe o fornecedor e confere o NCM.
2. `1:25–2:40` · **Conferir a conta e definir valor e sinal** (cenas 5 a 6): Leia a memória de cálculo do valor ao cliente, digite o valor final e confira o sinal em porcentagem.
3. `2:40–3:55` · **Enviar para aprovação e acompanhar os níveis** (cenas 7 a 8): Clique em **Enviar para aprovação** e veja como Planner, Diretoria de compras e Diretoria executiva aprovam nível a nível.
4. `3:55–5:00` · **Reprovar com motivo e ver o que vem depois** (cenas 9 a 11): Reprovar exige motivo e devolve a pendência ao comprador; aprovada no último nível, a proposta segue ao cliente.

### Perguntas

**Q1** · nível 1 (lembrar) · uma resposta · capítulo 1, cena 3

O fornecedor respondeu à cotação da jarra. Qual pendência aparece para você em Início → Pendências?

- A) Enviar ao fornecedor: Jarra de vidro 1,5 L
- B) Aprovar pré-custo (planner): Jarra de vidro 1,5 L
- C) Abrir RFQ: Jarra de vidro 1,5 L
- ✔ D) Escolher fornecedor: Jarra de vidro 1,5 L

> Com a cotação respondida, o sino avisa "Cotação recebida" e a pendência vira **Escolher fornecedor**, com a solicitação em "Cotações recebidas". As outras pendências são de etapas anteriores ou posteriores.

**Q2** · nível 2 (aplicar) · uma resposta · capítulo 1, cena 4

No cartão "Classificação fiscal (NCM)" o NCM do produto ainda não foi confirmado. O que acontece com a conta do valor ao cliente?

- A) A conta não aparece até o NCM ser confirmado
- ✔ B) O imposto de importação e o IPI ficam em 0% no valor ao cliente
- C) A tela usa o NCM da cotação anterior do mesmo fornecedor
- D) O botão **Enviar para aprovação** fica bloqueado

> Sem NCM confirmado, II e IPI ficam em 0% e o valor ao cliente sai menor do que deveria. Por isso confirme o NCM no quadro de classificação fiscal antes de fechar o preço.

**Q3** · nível 1 (lembrar) · uma resposta · capítulo 2, cena 6

O campo "Sinal (% do valor ao cliente)" é uma porcentagem de quê?

- ✔ A) Do valor ao cliente, de 0 a 100 (o padrão é 30%)
- B) Do custo importado calculado
- C) Do valor FOB pago ao fornecedor

> O sinal é uma porcentagem do valor ao cliente. A tela mostra logo abaixo o valor do sinal e o restante, e corrige sozinha qualquer número acima de 100.

**Q4** · nível 3 (decidir) · uma resposta · capítulo 2, cena 6

Você digitou 28000 em "Valor ao cliente", mas mudou de ideia e quer voltar ao valor que o sistema calculou. O que você faz?

- A) Troca a lista **Moeda** e volta ao Real
- ✔ B) Clica em **Usar valor calculado**
- C) Recarrega a página com F5
- D) Zera o campo **Sinal** para o cálculo recomeçar

> Ao digitar um valor, a conta calculada deixa de atualizar e surge o botão **Usar valor calculado (R$ …)**, que devolve o campo ao resultado da memória de cálculo.

**Q5** · nível 2 (aplicar) · colocar na ordem · capítulo 3, cena 7

Ponha em ordem o trabalho do comprador na tela da solicitação em "Cotações recebidas".

- A) Digitar o **Valor ao cliente** e conferir o **Sinal**
- B) Escolher o **Fornecedor** em Comparação de cotações
- C) Clicar em **Enviar para aprovação**
- D) Conferir o quadro **Valor ao cliente calculado** e seus avisos

Ordem certa: B → D → A → C

> Primeiro se escolhe o fornecedor, depois se confere a memória de cálculo e os avisos, então se fecha o valor e o sinal e só no fim se envia para aprovação.

**Q6** · nível 3 (decidir) · uma resposta · capítulo 3, cena 7

Você já enviou uma escolha para aprovação e, ao revisar, quer mudar o valor. A tela avisa: "Há uma escolha aguardando aprovação. Enviar outra substitui a atual." O que acontece se você enviar?

- A) O envio é recusado até o primeiro nível decidir
- B) As duas escolhas seguem para aprovação, lado a lado
- ✔ C) A nova escolha substitui a anterior, que é cancelada
- D) A escolha anterior continua valendo e a nova vai para o histórico

> É só um aviso: enviar outra escolha substitui a atual, e a anterior é cancelada. Não existem duas aprovações abertas ao mesmo tempo.

**Q7** · nível 2 (aplicar) · várias respostas · capítulo 3, cena 8

Sobre quem aprova o pré-custo, quais afirmações estão certas? Marque todas as certas.

- ✔ A) Quem enviou a escolha não aprova a própria escolha
- ✔ B) A Diretoria executiva só entra quando o valor chega ao limite (padrão R$ 100.000)
- C) A mesma pessoa pode decidir o Planner e a Diretoria de compras
- ✔ D) O administrador decide todos os níveis
- E) O cliente aprova o pré-custo antes de ver a proposta

> A aprovação sobe nível a nível: Planner, Diretoria de compras e, acima do limite, Diretoria executiva. Ninguém decide dois níveis, quem enviou não aprova a própria escolha e o cliente nem vê essa etapa.

**Q8** · nível 3 (decidir) · uma resposta · capítulo 4, cena 9

O administrador reprovou sua escolha, com o motivo "Valor acima do que o cliente aceita". A pendência Escolher fornecedor voltou para você. O que você faz?

- A) Espera o administrador reenviar a escolha com o valor menor
- B) Cancela a solicitação e pede ao cliente que envie outra
- C) Pede ao cliente que aprove a proposta mesmo assim
- ✔ D) Ajusta o valor e envia outra escolha para aprovação

> Reprovar não trava o comprador: o motivo chega no aviso "Pré-custo reprovado", a aprovação anterior fica em "Aprovações anteriores" e a nova escolha substitui a antiga.

---

## WSO-03 · Proposta, sinal e nascimento do pedido

**Duração** 4:30 · **Capítulos** 3 · **Perguntas** 8 · **Idiomas** pt

**Quem assiste:** Operador · Comprador; Administrador

### Capítulos (mini vídeos)

1. `0:00–1:25` · **Acompanhar a proposta e a aprovação do cliente** (cenas 1 a 4): Depois da aprovação do pré-custo a proposta vai ao cliente; se ele aprovar por fora do portal, a Wellmix registra a aprovação.
2. `1:25–2:40` · **Conferir o comprovante e confirmar o sinal** (cenas 5 a 6): O cliente paga e envia o comprovante; a Wellmix confere o recebimento e o administrador confirma o sinal.
3. `2:40–4:30` · **Conferir o pedido que nasceu** (cenas 7 a 9): Veja as nove etapas, quem enxerga os cartões financeiros, a primeira etapa a confirmar e quem recebe cada aviso.

### Perguntas

**Q1** · nível 1 (lembrar) · uma resposta · capítulo 1, cena 3

No cartão "Proposta" da solicitação em Aguardando sinal, qual informação só a Wellmix vê e o cliente não?

- A) O valor ao cliente
- B) O valor do sinal
- ✔ C) O fornecedor
- D) A situação da proposta

> O cliente vê valor, sinal e situação. Fornecedor, custo e margem são só da Wellmix.

**Q2** · nível 3 (decidir) · uma resposta · capítulo 1, cena 4

O cliente avisou por WhatsApp que aprova a proposta, mas não entrou no portal. Como a Wellmix deixa isso registrado?

- A) Clica em **Aprovar proposta** na conta do operador
- ✔ B) Clica em **Registrar aprovação do cliente**
- C) Clica em **Confirmar sinal recebido**
- D) Não precisa registrar: o pedido nasce quando o sinal chegar

> Só o cliente da solicitação aprova a proposta pelo portal. Quando ele aprova por telefone, e-mail ou WhatsApp, a Wellmix usa **Registrar aprovação do cliente**, e a tela mostra "Aprovação do cliente registrada."

**Q3** · nível 2 (aplicar) · verdadeiro ou falso · capítulo 2, cena 5

O pedido nasce automaticamente assim que o cliente envia o comprovante do sinal.

- A) Verdadeiro
- ✔ B) Falso

> O pagamento do sinal é manual, sem gateway: o cliente anexa o comprovante, a Wellmix confere o recebimento na conta e só quando o sinal é confirmado o pedido nasce.

**Q4** · nível 1 (lembrar) · uma resposta · capítulo 2, cena 6

Qual botão o administrador usa para dizer que o sinal foi recebido na conta?

- A) **Enviar comprovante**
- B) **Registrar aprovação do cliente**
- C) **Aprovar proposta**
- ✔ D) **Confirmar sinal recebido**

> **Confirmar sinal recebido** está no cartão Proposta e é do administrador, porque o financeiro é só dele. **Enviar comprovante** e **Aprovar proposta** são do cliente.

**Q5** · nível 3 (decidir) · uma resposta · capítulo 2, cena 6

O cliente enviou o comprovante. Você, operador, abre o cartão Proposta, lê que é preciso conferir o recebimento, mas não vê o botão **Confirmar sinal recebido**. O que fazer?

- ✔ A) Pedir ao administrador, que é quem vê o botão e confirma o sinal
- B) Clicar em **Registrar aprovação do cliente** para liberar o botão
- C) Recarregar a página até o botão aparecer
- D) Reenviar a proposta ao cliente

> Confirmar o sinal é só do administrador (ou de quem ele liberar). O operador vê o texto sobre o comprovante, mas não o botão, e não há atalho para contornar isso.

**Q6** · nível 2 (aplicar) · colocar na ordem · capítulo 3, cena 7

Ponha na ordem o caminho da proposta até o nascimento do pedido.

- A) O administrador clica em **Confirmar sinal recebido**
- B) O cliente clica em **Aprovar proposta**
- C) O Pedido #N nasce com as nove etapas
- D) O cliente anexa o comprovante em **Enviar comprovante**

Ordem certa: B → D → A → C

> O cliente aprova, paga e anexa o comprovante; a Wellmix confere e o administrador confirma; só então o pedido nasce, já com as etapas até a entrega.

**Q7** · nível 2 (aplicar) · várias respostas · capítulo 3, cena 7

Na página do pedido recém-nascido, quais destes cartões são só do administrador? Marque todos os certos.

- ✔ A) Recebido do cliente
- B) Etapas do pedido
- ✔ C) Margem
- D) Resumo do pedido
- ✔ E) A receber do cliente

> Os cartões de valor de venda, recebido, a receber e margem são só do administrador. O operador vê o pedido, o resumo e as nove Etapas do pedido.

**Q8** · nível 3 (decidir) · uma resposta · capítulo 3, cena 8

O Pedido #1 acabou de nascer e em Pendências aparece "Pedido pré-aprovado" para você. Qual é o seu primeiro passo?

- A) Esperar o fornecedor, que é o responsável pela primeira etapa
- B) Confirmar o sinal de novo, para o pedido ficar liberado
- ✔ C) Abrir o pedido e clicar em **Confirmar** em "Pedido conferido e liberado ao fornecedor"
- D) Clicar em **Registrar aprovação do cliente** na solicitação

> Na primeira etapa a Wellmix confere o pedido e o libera ao fornecedor com **Confirmar**; o número no Sankhya é opcional.

---

## WSO-04 · RFQ em espera: o interruptor

**Duração** 3:30 · **Capítulos** 3 · **Perguntas** 8 · **Idiomas** pt

**Quem assiste:** Administrador

### Capítulos (mini vídeos)

1. `0:00–1:10` · **Ligar a RFQ** (cenas 1 a 4): O interruptor da RFQ vale para todas as solicitações; o operador vê a situação e só o administrador clica em **Ativar a RFQ**.
2. `1:10–2:25` · **Usar a RFQ ativa e ler a disputa** (cenas 5 a 6): Com a RFQ ativa a solicitação abre para vários fornecedores, e com duas ou mais cotações respondidas aparece a Disputa de fornecedores.
3. `2:25–3:30` · **Voltar à espera, o Sourcing e a auditoria** (cenas 7 a 9): Colocar a RFQ em espera não derruba o que já está aberto; o Sourcing tem o mesmo interruptor e cada mudança fica na Auditoria.

### Perguntas

**Q1** · nível 1 (lembrar) · uma resposta · capítulo 1, cena 3

Um operador com a tela RFQ abre Pedidos → RFQ para ligar a RFQ e não encontra nenhum botão. Quem liga ou coloca a RFQ em espera?

- A) Qualquer operador que abra a tela RFQ
- B) Só quem tem a função de comprador
- ✔ C) Só o administrador
- D) O fornecedor, ao responder a primeira cotação

> O cartão "Ligar ou deixar em espera" mostra ao operador apenas o aviso "Só o administrador liga ou coloca a RFQ em espera." O operador vê a situação, mas o interruptor é do administrador.

**Q2** · nível 1 (lembrar) · uma resposta · capítulo 1, cena 4

A RFQ está em espera e você, administrador, quer que as solicitações possam ir a vários fornecedores. Qual botão você clica na tela RFQ?

- ✔ A) **Ativar a RFQ**
- B) **Abrir RFQ**
- C) **Colocar a RFQ em espera**
- D) **Enviar ao fornecedor**

> **Ativar a RFQ** muda o selo para "Ativa" e mostra "RFQ ativada." **Abrir RFQ** é o botão da solicitação, já com a RFQ ativa, e **Colocar a RFQ em espera** faz o caminho contrário.

**Q3** · nível 2 (aplicar) · colocar na ordem · capítulo 2, cena 5

Ponha na ordem o caminho para abrir uma solicitação ainda em "Solicitado" a dois fornecedores.

- A) Abrir a solicitação e marcar os fornecedores no cartão **Abrir RFQ**
- B) Abrir Pedidos → RFQ
- C) Clicar em **Abrir RFQ**
- D) Clicar em **Ativar a RFQ**

Ordem certa: B → D → A → C

> O cartão **Abrir RFQ** só existe na solicitação depois que a RFQ está ativa. Os fornecedores que já vendem o produto aparecem primeiro, com o selo "já fornece".

**Q4** · nível 2 (aplicar) · várias respostas · capítulo 2, cena 6

A Disputa de fornecedores dá nota a cada cotação. Quais critérios entram na nota? Marque todos os certos.

- ✔ A) Preço
- ✔ B) Entrega
- ✔ C) Produção
- D) Margem do cliente
- ✔ E) Pedido mínimo (MOQ)

> A nota combina preço, entrega, produção e MOQ, com os pesos das Configurações. A margem é do cliente e não entra na disputa, que é só da Wellmix: um fornecedor nunca vê o outro.

**Q5** · nível 3 (decidir) · uma resposta · capítulo 2, cena 6

A RFQ está ativa, mas na solicitação que você abriu não aparece o quadro "Disputa de fornecedores". Só um fornecedor respondeu. Por quê?

- A) A disputa só aparece quando a solicitação é de compra para estoque
- B) A disputa só aparece depois que o cliente aprova a proposta
- C) O quadro fica escondido até o administrador atualizar a página
- ✔ D) A disputa só existe com duas ou mais cotações respondidas

> Com uma cotação só não há o que comparar. A Disputa de fornecedores aparece dentro de "Comparação de cotações" quando duas ou mais cotações foram respondidas.

**Q6** · nível 3 (decidir) · uma resposta · capítulo 3, cena 7

Uma solicitação já tem a RFQ aberta para dois fornecedores. Você clica em **Colocar a RFQ em espera**. O que acontece com ela?

- A) É cancelada, e as cotações recebidas são descartadas
- B) Volta para "Solicitado", sem a disputa
- C) Fica parada até alguém ativar a RFQ de novo
- ✔ D) Continua valendo, com a disputa e tudo, até ser concluída

> Colocar em espera só muda o caminho das solicitações novas: cada produto volta a ir a um fornecedor só. As RFQs já abertas continuam valendo até serem concluídas.

**Q7** · nível 2 (aplicar) · uma resposta · capítulo 3, cena 8

Com o Sourcing ativo, o que acontece quando chega um pedido de produto fora do catálogo?

- A) Vira só uma solicitação, como acontece com o Sourcing em espera
- B) O pedido é recusado automaticamente
- ✔ C) Abre um item de Sourcing e uma pendência para a equipe
- D) O produto entra direto na vitrine do cliente

> O Sourcing é a busca de produtos na China e tem o mesmo interruptor da RFQ. Em espera, o pedido fora do catálogo vira apenas uma solicitação; ativo, abre um item de Sourcing e uma pendência.

**Q8** · nível 3 (decidir) · uma resposta · capítulo 3, cena 9

Um colega pergunta quem ativou a RFQ ontem e quando. Onde você confere?

- ✔ A) Em Gestão → Auditoria, filtrando o módulo "Configurações"
- B) Em Início → Notificações, onde todos foram avisados
- C) Em Pedidos → RFQ, no histórico do cartão "Como está funcionando agora"
- D) Em Início → Painel de SLA, na tabela Equipe

> Cada mudança do interruptor ("RFQ ativada", "RFQ colocada em espera") fica registrada na Auditoria, módulo Configurações. Ninguém recebe aviso quando o administrador muda o interruptor, por isso as Notificações não ajudam.

---

## WSO-05 · Superplan: a viabilidade do produto

**Duração** 5:00 · **Capítulos** 4 · **Perguntas** 8 · **Idiomas** pt

**Quem assiste:** Administrador

### Capítulos (mini vídeos)

1. `0:00–1:10` · **Abrir o Superplan e carregar o produto** (cenas 1 a 4): O Superplan é só do administrador; escolha o produto do cadastro e clique em **Carregar** para preencher a simulação.
2. `1:10–2:20` · **Conferir compra, container e tipo de negócio** (cenas 5 a 6): Confira preço, caixa e impostos da compra, depois container, câmbio e o tipo de negócio que preenche markup, comissão, despesas e meta de lucro.
3. `2:20–3:40` · **Ler o preço mínimo e o sinal do lucro** (cenas 7 a 8): Leia o custo por peça e o preço mínimo e use o aviso verde, amarelo ou vermelho para saber se o lucro bate a meta.
4. `3:40–5:00` · **Abrir a faca e a RFQ** (cenas 9 a 11): Se for viável, **Abrir faca e RFQ** cria a solicitação e a cotação só com o fornecedor ganho.

### Perguntas

**Q1** · nível 1 (lembrar) · uma resposta · capítulo 1, cena 3

Um operador digita o endereço do Superplan e volta ao início com o aviso "Você não tem acesso a Superplan". Quem abre essa tela?

- A) Qualquer operador com as funções de comprador e planner
- B) Só o gerente de produto
- ✔ C) Só o administrador, ou quem ele liberar em Gestão → Equipe e divisões
- D) Também o fornecedor, para ver o custo do container

> O Superplan é só do administrador, que pode liberar a tela a um login em Equipe e divisões. O resultado de cada item aparece dentro do Booking para quem abre o Booking.

**Q2** · nível 1 (lembrar) · uma resposta · capítulo 1, cena 4

Você escolheu "UTL-001 · Jarra de vidro 1,5 L" em "Produto do cadastro". Qual botão preenche preço, caixa, peso, volume e os impostos do NCM?

- ✔ A) **Carregar**
- B) **Testar esse preço**
- C) **Abrir faca e RFQ**
- D) **Usar valor calculado**

> **Carregar** recarrega a página com os dados do produto, e tudo continua editável. Sem produto, dá para preencher os campos à mão e simular do mesmo jeito.

**Q3** · nível 3 (decidir) · uma resposta · capítulo 2, cena 5

Ao carregar o produto, os campos "II (%)" e "IPI (%)" ficam vazios, com o aviso "Produto sem NCM na tabela fiscal: confira II e IPI à mão." O que você faz?

- A) Deixa vazio: o sistema completa com a média dos produtos parecidos
- ✔ B) Digita o II e o IPI do NCM do produto
- C) Apaga o produto e começa a simulação à mão
- D) Deixa vazio, porque o custo do container não leva impostos

> Com II e IPI vazios a conta usa 0% e o custo sai menor do que o real, o que faz o produto parecer mais viável do que é. Digite os percentuais do NCM.

**Q4** · nível 2 (aplicar) · várias respostas · capítulo 2, cena 6

Ao escolher o Tipo de negócio, o Superplan preenche sozinho alguns campos. Quais? Marque todos os certos.

- ✔ A) Markup
- ✔ B) Comissão (%)
- ✔ C) Despesas administrativas (%)
- ✔ D) Meta de lucro (%)
- E) Preço por peça

> O tipo de negócio traz markup, comissão, despesas administrativas e a meta de lucro. O preço por peça vem do produto carregado, não do tipo de negócio.

**Q5** · nível 2 (aplicar) · uma resposta · capítulo 3, cena 7

Como o Superplan calcula o "Preço mínimo" por peça?

- A) Preço do fornecedor mais o frete marítimo
- B) Custo do container dividido pelas peças que cabem nele
- ✔ C) Custo por peça vezes o markup do tipo de negócio
- D) Meta de lucro somada ao custo por peça

> O preço mínimo é o custo vezes o markup do tipo de negócio. A alternativa do custo do container dividido pelas peças é o Custo por peça, a base dessa conta.

**Q6** · nível 3 (decidir) · uma resposta · capítulo 3, cena 8

O aviso no alto está amarelo: o lucro é positivo, mas abaixo da meta, e a tela sugere o preço que daria a meta. Como você vê o lucro nesse preço?

- A) Troca o Tipo de negócio até o aviso ficar verde
- B) Aumenta o Markup à mão até a meta aparecer
- C) Clica em **Abrir faca e RFQ** e confere na solicitação
- ✔ D) Clica em **Testar esse preço**

> **Testar esse preço** simula o preço sugerido, e o aviso vira verde ("Viável") quando o lucro alcança a meta. Para outro valor, digite em "Preço de venda a testar"; vazio, a conta usa o preço mínimo.

**Q7** · nível 3 (decidir) · uma resposta · capítulo 4, cena 9

O aviso do alto está vermelho (Prejuízo). Você tenta clicar em **Abrir faca e RFQ**. O que acontece?

- A) Abre normalmente, só marcando a solicitação com um aviso
- ✔ B) Não abre: "Com prejuízo não dá para abrir: ajuste o preço ou os números."
- C) Abre, mas só para compra com cliente, nunca para estoque
- D) Abre a RFQ para todos os fornecedores do produto

> Com prejuízo o botão não abre a RFQ: ajuste o preço de venda ou os números e simule de novo. Também é preciso ter um produto do cadastro carregado.

**Q8** · nível 2 (aplicar) · uma resposta · capítulo 4, cena 10

Depois de **Abrir faca e RFQ** com o fornecedor ganho, o que nasce?

- A) Um pedido já assinado, pronto para o fornecedor produzir
- ✔ B) Uma solicitação com origem Superplan e a RFQ só para o fornecedor ganho
- C) Uma proposta enviada ao cliente com o preço mínimo
- D) Uma RFQ aberta para todos os fornecedores cadastrados

> Nasce a solicitação com origem Superplan e a RFQ vai só ao fornecedor ganho, que envia faca (die-cut), MOQ, prazo e foto em alta. A proposta espera esses quatro itens.

