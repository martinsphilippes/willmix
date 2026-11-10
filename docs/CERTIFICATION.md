# Certificação com o OCP (Fase F)

- **OCP (organismo de certificação)**: login próprio (papel `ocp`, empresa do tipo OCP), designado no pedido em "Parceiros" (`orders.ocpId`). Com uma só certificadora ativa, ela é designada sozinha quando o pedido nasce. Vê só os pedidos em que está e, neles, só os passos da certificação.
- O cartão **Certificação** aparece no pedido quando há OCP designado, quando a ficha da cotação/pedido marca "Precisa de certificação" ou quando algum passo já começou. Aparece desde o pedido recém-criado (não espera a Preparação).

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
1. **Pedido gerado** (sinal confirmado da solicitação cujo fornecedor ganhou a RFQ): a certificadora do pedido recebe o aviso "gerar o selo de certificação" e a pendência em Minhas pendências, com o pedido ainda em "Conferência".
2. **Certificadora** abre o pedido, vê o cartão Certificação e envia o **arquivo do selo** (o número do selo ou do registro é opcional).
3. **Quem faz a arte** (a agência do pedido) recebe o aviso e a pendência "aplicar o selo de certificação na arte". Baixa o selo no cartão Certificação (ou no zip "Baixar todas as artes"), aplica na arte e envia a **arte com o selo**.
4. **Wellmix** recebe a pendência "validar o selo aplicado na arte": confere e valida, ou recusa com o motivo (a pendência volta para quem fez).
5. Concluído: o pedido sai de "Certificação pendente" na Control Tower quando os cinco passos estão concluídos.

A arte não espera o selo: o briefing de embalagem continua nascendo na RFQ. Na tela do briefing (onde a agência trabalha) e no cartão do pedido a agência vê desde cedo que haverá um selo e em que pé ele está.

### 4. Regras de negócio
- **Quem recebe o selo**: quem faz a arte, pela mesma regra do item "Arte" da etapa Arte e embalagem (`artRole`): a agência do pedido; sem agência, ou com "Arte da embalagem feita pela agência" desligado, a Wellmix (o designer do pedido, quem tem a função Designer ou o analista).
- **Pedido recém-criado**: só os passos do selo viram pendência; memorial, laudo e registro continuam a partir da Preparação.
- **Selo trocado**: a certificadora pode reenviar o selo. Se a arte com o selo já tinha sido enviada ou validada, o passo da arte **reabre** (a arte leva o selo antigo) e quem faz a arte é avisado. Reenviar sem mudar arquivo nem número não reabre nem avisa.
- **Wellmix no lugar da certificadora**: a Wellmix pode enviar o selo recebido por fora; o resto do caminho é igual.
- **Pedido encerrado ou cancelado**: os passos não aceitam mais envio e as pendências somem.

### 5. Casos especiais
- **Nenhuma certificadora no pedido** (zero ou mais de uma ativa): com mais de uma, a Wellmix recebe o aviso "sem certificadora para o selo" e designa em Parceiros do pedido; a certificadora designada depois é avisada na hora.
- **Agência trocada ou retirada** depois de o selo chegar: quem passa a fazer a arte é avisado.
- **Wellmix fez a arte**: quem enviou não valida a própria arte com o selo; outro usuário da Wellmix (ou o administrador) valida.
- **Pedidos que já estavam abertos** antes desta entrega: ganham a pendência do selo na certificadora (sem aviso retroativo).

### 6. Papéis e o que cada um vê
| Papel | Vê | Faz |
|---|---|---|
| OCP | cartão Certificação inteiro; o arquivo da arte com o selo | envia o selo |
| Agência | só as duas linhas do selo e os dois arquivos | envia a arte com o selo |
| Wellmix | tudo | valida a arte com o selo; pode agir no lugar de quem falta |
| Fornecedor, cliente, comex, demais | nada do selo | — |

O cliente e o preço continuam invisíveis para OCP e agência.

### 7. Dados
Sem tabela e sem coluna nova: dois valores novos no enum `import_steps.key` (`cert_seal`, `cert_seal_art`). O arquivo é um documento `import_step` do pedido (visibilidade interna; abre só para quem vê o passo). **O esquema precisa ser publicado no Appwrite antes do primeiro envio** (GitHub Actions → "Publicar esquema Appwrite"); sem isso o envio avisa "passo ainda não liberado no banco de dados".

### 8. Avisos e pendências
| Quando | Para quem | Aviso | Pendência |
|---|---|---|---|
| Pedido gerado (ou OCP designado depois) | certificadora | gerar o selo | Gerar o selo de certificação |
| Selo enviado | quem faz a arte | selo disponível | Aplicar o selo na arte |
| Selo trocado | quem faz a arte | selo trocado | Aplicar o selo na arte (reaberta) |
| Arte com o selo enviada | Wellmix | validar | Validar o selo aplicado na arte |
| Arte recusada | quem faz a arte | recusado + motivo | Aplicar o selo na arte |
| Pedido sem certificadora (mais de uma ativa) | Wellmix | designar certificadora | — |

As pendências de certificação aparecem com o tipo "Certificação" e abrem direto no cartão (`#certification`).

### 9. Indicadores
- Control Tower, "Certificação pendente": inclui os passos do selo.
- Painéis → Certificação e artes, "em andamento": passo enviado sem concluir ou passo seguinte de um concluído ainda por fazer (ex.: selo enviado e a arte pendente).

### 10. Auditoria e segurança
- Cada envio, validação, recusa e reabertura fica na auditoria (`import.step_*`, com o texto "Certificação: ...").
- O servidor confere quem pode antes de gravar o arquivo; a agência nunca abre memorial, laudo ou registro.

### 11. Decisões em aberto (confirmar com o dono)
1. **"Passou pelo booking e pelo Superplan"**: hoje o pedido nasce da confirmação do sinal; booking é um passo do embarque (depois da produção) e o Superplan é uma simulação que não grava nada. O selo foi ligado ao **nascimento do pedido**. Se booking (reserva de frete) e Superplan (viabilidade aprovada) devem virar travas antes de gerar o pedido, é uma entrega própria.
2. **Todo pedido precisa de selo?** Hoje todo pedido com certificadora designada ganha a pendência. Alternativa: só quando a ficha marca "Precisa de certificação".
3. **Travar a aprovação da arte sem o selo?** Hoje a arte pode ser aprovada pelo fornecedor sem o selo aplicado (a Control Tower mostra a certificação pendente). Recomendado travar quando a regra do item 2 estiver definida.
4. **Quem confere o selo na arte**: hoje a Wellmix. Alternativa: a própria certificadora.
5. **O que a certificadora precisa ver do produto** para gerar o selo (hoje: nome, variação, quantidade, fornecedor e a certificação pedida na ficha).

### 12. Melhorias futuras
- Prazo (SLA) para a certificadora e para a agência, com lembrete e atraso no Painel de SLA.
- Um envio só para a arte (hoje a arte com o selo é enviada no cartão Certificação e a arte para o fornecedor no item "Arte").
- Reaproveitar o selo de um produto já certificado em pedidos de recompra.
- Certificadora padrão nas Configurações quando houver mais de uma.
