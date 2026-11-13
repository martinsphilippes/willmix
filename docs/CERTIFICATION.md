# Certificação com o OCP (Fase F)

- **OCP (organismo de certificação)**: login próprio (papel `ocp`, empresa do tipo OCP), designado no pedido em "Parceiros" (`orders.ocpId`). Com uma só certificadora ativa, ela é designada sozinha quando o pedido nasce. Vê só os pedidos em que está: o cartão Certificação e o pedido completo para ler (seção 6), inclusive cliente e preço de compra (decisão do dono, 10/11/2026).
- **Todo pedido precisa do selo de certificação** (decisão do dono, 10/11/2026): as duas linhas do selo aparecem no cartão **Certificação** de todo pedido, desde que ele nasce (não esperam a Preparação).
- Memorial, laudo e registro aparecem no cartão quando há OCP designado, quando a ficha da cotação/pedido marca "Precisa de certificação" ou quando algum deles já começou.

| Passo | Faz | Valida | Vê (além da Wellmix) | Depois de |
|---|---|---|---|---|
| Memorial descritivo (arquivo) | Wellmix | OCP | OCP | — |
| Ensaio em laboratório (laboratório/nº do laudo + arquivo) | OCP | — | OCP | memorial |
| Número de registro (nº + certificado) | OCP | Wellmix | OCP, comex | laudo |
| **Selo de certificação** (arquivo + nº opcional) | OCP | — | OCP, agência | — |
| **Selo aplicado na arte** (arte com o selo) | agência (sem agência, a Wellmix) | Wellmix | agência, OCP | selo |

Usa o mesmo mecanismo dos passos de embarque (docs/IMPORT_FLOW.md):
- recusar exige motivo;
- quem enviou não valida (exceto o administrador);
- o arquivo só abre para quem vê o passo;
- as pendências vão para quem faz e para quem valida.

## Selo de certificação: do pedido à arte

### 1. Problema
O pedido nascia e a certificadora não tinha o que fazer: o primeiro passo (memorial) é da Wellmix e a certificação só virava pendência depois da etapa de conferência. O selo era combinado por fora (e-mail, WhatsApp) e a agência podia fechar a arte da embalagem sem ele.

### 2. Objetivo
O pedido, assim que é gerado, cai no login da certificadora para ela gerar o selo. O selo fica anexado ao pedido e vai sozinho para quem faz a arte da embalagem, que o aplica na arte que já está sendo criada em paralelo. A Wellmix acompanha e confere.

### 3. Como funciona
1. **Pedido gerado** (sinal confirmado da solicitação cujo fornecedor ganhou a RFQ; ver "Booking e Superplan" abaixo): a certificadora do pedido recebe o aviso "gerar o selo de certificação" e a pendência em Minhas pendências, com o pedido ainda em "Conferência".
2. **Certificadora** abre o pedido, vê o cartão Certificação e envia o **arquivo do selo** (o número do selo ou do registro é opcional).
3. **Quem faz a arte** (a agência do pedido) recebe o aviso e a pendência "aplicar o selo de certificação na arte". Baixa o selo no cartão Certificação (ou no zip "Baixar todas as artes"), aplica na arte e envia a **arte com o selo**.
4. **Wellmix** recebe a pendência "validar o selo aplicado na arte": confere e valida, ou recusa com o motivo (a pendência volta para quem fez).
5. Concluído: o pedido sai de "Certificação pendente" na Control Tower quando o selo foi enviado e a arte com o selo conferida (e, com certificação pedida, quando memorial, laudo e registro também estão concluídos).

A arte não espera o selo: o briefing de embalagem continua nascendo na RFQ. Na tela do briefing (onde a agência trabalha) e no cartão do pedido a agência vê desde cedo que haverá um selo e em que pé ele está.

### 4. Regras de negócio
- **Todo pedido precisa de selo**: a pendência do selo existe em todo pedido aberto e nunca fica sem dono. Com certificadora no pedido, é dela; sem certificadora, é da Wellmix ("designar a certificadora do selo", que abre em Parceiros do pedido).
- **Sem trava por enquanto** (decisão do dono): a arte pode ser enviada e aprovada pelo fornecedor sem o selo; o que avisa é a pendência e o quadro "Certificação pendente". Travas ficam para depois.
- **Quem recebe o selo**: quem faz a arte (seção 13): o designer do pedido; sem ele, a agência do pedido quando é ela quem faz a arte (`artRole`); sem agência, ou com "Arte da embalagem feita pela agência" desligado, a Wellmix (quem tem a função Designer; sem ninguém nela, o analista).
- **Pedido recém-criado**: só o selo já nasce como pendência. Memorial, laudo e registro viram pendência a partir da Preparação; se alguém começar o memorial antes, pelo cartão, o que vem depois (validar, laudo) segue normalmente. O memorial é pendência do responsável interno (dono, 13/11/2026; até então não virava pendência de começar); laudo e registro continuam sem pendência de começar.
- **Selo trocado**: a certificadora pode reenviar o selo. Se a arte com o selo já tinha sido enviada ou validada, o passo da arte **reabre** (a arte leva o selo antigo), o reenvio pede um arquivo novo e quem faz a arte é avisado. Reenviar sem mudar arquivo nem número não reabre nem avisa.
- **Wellmix no lugar da certificadora**: a Wellmix pode enviar o selo recebido por fora; o resto do caminho é igual.
- **Pedido encerrado ou cancelado**: os passos não aceitam mais envio e as pendências somem.

### 5. Casos especiais
- **Nenhuma certificadora no pedido** (nenhuma cadastrada ou mais de uma ativa; com uma só, ela é designada sozinha): a Wellmix recebe o aviso "sem certificadora para o selo" e a pendência de designar em Parceiros do pedido; a certificadora designada depois é avisada na hora e a pendência passa para ela. A Wellmix também pode enviar o selo recebido por fora.
- **Agência trocada ou retirada** depois de o selo chegar: quem passa a fazer a arte é avisado.
- **Wellmix fez a arte**: quem enviou não valida a própria arte com o selo; outro usuário da Wellmix (ou o administrador) valida, e o aviso de validar vai para o resto da equipe.
- **Arte feita pela Wellmix nas configurações** ("Arte da embalagem feita pela agência" desligado): a agência do pedido só acompanha as linhas do selo; não envia a arte com o selo.
- **Pedidos que já estavam abertos** antes desta entrega: ganham a pendência do selo na certificadora, ou na Wellmix quando o pedido não tem certificadora (sem aviso retroativo).

### 6. Papéis e o que cada um vê
| Papel | Vê | Faz |
|---|---|---|
| OCP | o **pedido completo** (abaixo); o cartão Certificação inteiro; o arquivo da arte com o selo | envia o selo |
| Agência | só as duas linhas do selo e os dois arquivos | envia a arte com o selo |
| Wellmix | tudo | valida a arte com o selo; pode agir no lugar de quem falta |
| Fornecedor, cliente, comex, demais | nada do selo | — |

O cliente e o preço continuam invisíveis para OCP e agência.

#### O que a certificadora vê: o pedido completo (decisão do dono, 10/11/2026)
Para gerar o selo ela precisa de tudo o que é do produto e do pedido. No pedido em que é a certificadora, ela vê, só para ler:

- **Resumo**: fornecedor, data do pedido e o atalho "Ver ficha de compra".
- **Itens**: foto, nome, código, variação e quantidade. As fotos são as de vitrine do cadastro do produto mais, no pedido de um item só, as enviadas na ficha do pedido.
- **Ficha de compra do pedido** inteira, com todos os blocos abertos: fornecedor (nome, cidade, loja, telefone, código na fábrica), produto (pesos, capacidade, cores Pantone, material, energia), caixa e embalagem (medidas, CBM), programação, **fotos** (balança, medidas, ângulos, original, HD, faca), despachante (NCM, II, IPI, dumping, certificação pedida) e descrição/observações.
- **Certificações já registradas** do produto e do fornecedor (tipo, número, emissor, situação, validade e o arquivo).
- **Documentos** do pedido que já eram dela: artes, faca, etiquetas, manual, BL, inspeção e fotos.
- A **certificação pedida na ficha** aparece no cartão Certificação só para a Wellmix e para ela (não para a agência nem para o comex).

O que **não** vai para a certificadora: preço (o bloco Preço da ficha não aparece e os valores não saem do servidor: condição, moeda, preço, pedido mínimo e a média do despachante), pagamentos, margem, valores do pedido e o nome do cliente. Cartão do fabricante e foto de referência do cadastro também não. Ela não edita nada na ficha.

### 7. Dados
Sem tabela e sem coluna nova: dois valores novos no enum `import_steps.key` (`cert_seal`, `cert_seal_art`). O arquivo é um documento `import_step` do pedido (visibilidade interna; abre só para quem vê o passo). **O esquema precisa ser publicado no Appwrite antes do primeiro envio** (GitHub Actions → "Publicar esquema Appwrite"); sem isso o envio avisa que o passo ainda não está liberado no sistema.

### 8. Avisos e pendências
| Quando | Para quem | Aviso | Pendência |
|---|---|---|---|
| Pedido gerado (ou OCP designado depois) | certificadora | gerar o selo | Gerar o selo de certificação |
| Selo enviado | quem faz a arte | selo disponível | Aplicar o selo na arte |
| Selo trocado | quem faz a arte | selo trocado | Aplicar o selo na arte (reaberta) |
| Arte com o selo enviada | Wellmix | validar | Validar o selo aplicado na arte |
| Arte recusada | quem faz a arte | recusado + motivo | Aplicar o selo na arte |
| Pedido sem certificadora | Wellmix | designar certificadora | Designar a certificadora do selo |

As pendências de certificação aparecem com o tipo "Certificação" e abrem direto na tarefa: o selo e o memorial a enviar, no quadro em destaque do cartão (`#certification-featured`); aplicar o selo e as validações, na linha do passo (`#certification-step-<passo>`); a de designar a certificadora, em Parceiros do pedido. Os avisos usam os mesmos links. Quem recebe cada uma: seção 13. A recusa de uma ação (arquivo que falta, formato não aceito, passo anterior por fazer) aparece dentro do próprio cartão. Arquivo grande (a arte com o selo) sobe direto ao armazenamento, até 50 MB, e o botão só envia depois que o arquivo terminou de subir.

### 9. Indicadores
- Control Tower, "Certificação pendente": todo pedido aberto sem o selo enviado ou sem a arte com o selo conferida; com certificação pedida (OCP, ficha ou passo começado), também memorial, laudo e registro.
- Painéis → Certificação e artes, "em andamento": passo enviado sem concluir ou passo seguinte de um concluído ainda por fazer (ex.: selo enviado e a arte pendente).

### 10. Auditoria e segurança
- Cada envio, validação, recusa e reabertura fica na auditoria (`import.step_*`, com o texto "Certificação: ...").
- O servidor confere quem pode antes de gravar o arquivo; a agência nunca abre memorial, laudo ou registro.

### 11. Booking e Superplan
O **Booking** de que o dono fala é a tela **Pedidos → Booking** (`docs/BOOKING.md`): as planilhas de fornecedor, com a análise do Superplan nos itens, a Seleção de itens e a solicitação ao fornecedor. Não é o booking do navio (passo do embarque). A fila antiga de produtos (tabela `bookings`) foi removida em 11/11/2026.

Na ordem do fluxo, o selo fica depois dele: Booking e Superplan → solicitação → fornecedor escolhido → sinal → **pedido gerado → selo**. Nada no selo depende do Booking.

### 11.1 Decisões do dono (10/11/2026)
1. **Todo pedido precisa de selo**: feito (regra da seção 4).
2. **Sem trava na aprovação da arte por enquanto**: travas ficam para depois.
3. **Booking**: decidido (10/11/2026, com a tela Booking no ar): a certificadora recebe **quando o pedido é criado**, não antes. O selo não depende de nenhuma etapa do Booking.
4. **Quem confere o selo na arte**: a Wellmix (confirmado).
5. **A certificadora vê o pedido completo**, fotos e tudo o mais: feito (seção 6).

### 11.1a Pedido de compra: certificação pela linha (dono, 13/11/2026)
No pedido de compra (`orders.flow = "supplier_request"`) vale o mapa do processo: o certificado e a arte final com o selo só existem quando a linha do produto exige certificação, e o produto com certificação válida pelo período do pedido não renova (docs/PURCHASE_ORDER.md, seção 1a). Os passos do cartão Certificação (selo, memorial e arte com o selo) viram pendência nesses pedidos quando algum produto exige certificação (há o item "Certificado" na Preparação), cada um no login certo (seção 13; até 13/11/2026 não viravam pendência). Sem produto que exige certificação, nada do cartão vira pendência e o cartão avisa a Wellmix. A regra "todo pedido precisa do selo" segue para os outros fluxos.

### 11.2 Ainda em aberto
0. Registro das respostas do dono de 10/11/2026 sobre o fluxo com a RFQ em espera (docs/RFQ_STANDBY.md): a faca continua sendo pedida ao fornecedor **depois da confirmação** da cotação, como hoje; o selo é enviado pela certificadora, aplicado na arte por quem faz a arte e conferido pela Wellmix (o que já está feito aqui).
1. **Preço e cliente para a certificadora**: resolvido (dono, 10/11/2026): ela vê **tudo do pedido** (cliente, fornecedor, FOB, preço dos itens, a ficha inteira com o bloco Preço e o documento do pedido, só para ler; não assina). O dono vai pedir depois o que tirar: campo da ficha sai incluindo o nome em `CERTIFIER_HIDDEN_FIELDS` (`purchase-sheet.ts`); o resto, nas condições `certifier` de `orders/[id]/page.tsx` e em `canViewOrderDocument`. Ficam fora o financeiro da Wellmix (preço de venda, margem, pagamentos), que não é dado do pedido para ela.
2. **Quem gera e quem anexa o selo** (dono, 10/11/2026): a certificadora gera o selo; a agência anexa o selo ao produto/pedido (a arte com o selo) para o pedido seguir. É o que os passos `cert_seal` e `cert_seal_art` já fazem.

### 12. Melhorias futuras
- Prazo (SLA) para a certificadora e para a agência, com lembrete e atraso no Painel de SLA.
- Um envio só para a arte (hoje a arte com o selo é enviada no cartão Certificação e a arte para o fornecedor no item "Arte").
- Reaproveitar o selo de um produto já certificado em pedidos de recompra.
- Certificadora padrão nas Configurações quando houver mais de uma.

### 13. Quem recebe cada tarefa (dono, 13/11/2026)
Cada tarefa dos cartões **Certificação** e **Artes** do pedido vai para o login responsável, pelo que o pedido já tem: **Parceiros do pedido** (certificadora e agência), **Designer do pedido** (cartão Artes) e o **analista do pedido** (`orders.ownerUserId`, o mesmo dono do Painel de SLA), que é o responsável interno da Wellmix. Regra única em `src/lib/services/cert-art-routing.ts`, usada pelas pendências, pelos avisos e pela visão interna.

| Tarefa | Quem recebe | Sem ele |
|---|---|---|
| Gerar o selo | a certificadora do pedido (todos os logins dela) | o analista (pendência "Designar a certificadora", em Parceiros do pedido) |
| Enviar o memorial descritivo | o analista | a equipe Wellmix |
| Validar o memorial | a certificadora do pedido | a Wellmix valida no lugar (o analista; nunca quem enviou) |
| Aplicar o selo na arte (só depois do selo enviado) | o designer do pedido (login da Wellmix ou da agência) | a agência, quando é ela quem faz a arte; senão quem tem a função Designer; senão o analista; senão a equipe |
| Validar o selo aplicado na arte | o analista, se pode validar arte (ação "Validar a arte") | quem tem a ação; quem enviou nunca valida o próprio envio |
| Corrigir a arte (não conformidade, cartão Artes) | igual a "aplicar o selo na arte" | igual |
| Conferir a correção da arte | quem apontou a não conformidade, se pode validar arte | quem valida a arte (como acima) |

- **Só no login certo**: a pendência aparece só para quem a recebe. Os outros logins da Wellmix não a veem em Minhas pendências; o acompanhamento fica no cartão do pedido e no Painel de SLA, que mostra as da equipe toda, cada uma com quem a recebeu como dono. O fornecedor não recebe nenhuma destas.
- **Visão interna**: no cartão Certificação, a Wellmix vê em cada passo aberto com quem ele está ("Com: …" ou "Para validar: …"); no cartão Artes, "Quem faz a arte: …". O que falta designar aparece em destaque, com o link de onde designar: certificadora → Parceiros do pedido; designer → cartão Artes; analista → Equipe e acessos ("Distribuir agora"). A pendência sem dono certo também diz o que falta.
- **O servidor confere** antes de gravar: o selo, a certificadora do pedido ou a Wellmix; o memorial, a Wellmix ou a certificadora do pedido; a arte com o selo, quem faz a arte (o designer do pedido, a agência quando é ela quem faz a arte, a Wellmix); validar a arte com o selo e conferir a correção da arte, só quem tem a ação "Validar a arte" (o administrador sempre), como a validação da arte do pedido de compra. Quem enviou não valida o próprio passo (exceto o administrador).
- **Selo para baixar**: quem aplica o selo baixa o arquivo na linha "Selo aplicado na arte" ("Baixar o selo"), no quadro do alto ou no zip das artes.
- **Trocar o responsável**: as pendências são calculadas na hora a partir do pedido. Designar ou trocar a certificadora, a agência, o designer ou o analista muda o dono da pendência aberta, sem criar outra; o que já foi feito continua com quem fez e quem validou. No pedido de compra, os itens abertos das raias também passam para o parceiro novo: o certificado para a certificadora, a arte e a arte final com o selo para a agência quando é ela quem faz a arte (`syncLaneRoles`); sem o parceiro, voltam para a Wellmix.
- **Limites**: os itens das raias da Preparação (arte, validação e arte final do pedido de compra) seguem o papel de cada item (agência ou Wellmix) e continuam visíveis para a equipe Wellmix inteira; o designer do pedido ainda não é usado neles.
