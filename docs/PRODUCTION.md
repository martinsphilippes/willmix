# Produção (Fase C)

Cartão **Produção** no pedido, fora das etapas, para a Wellmix e para o fornecedor do pedido (cliente não vê).

## Dados da produção
- **Fornecedor é**: Fábrica ou Trade (revenda). Com Trade, informar a **fábrica** e o **endereço** (onde se inspeciona). Sem o endereço, a inspeção não pode ser agendada.
- **Início da produção** e **ETD** (saída prevista). Wellmix ou fornecedor preenchem.
- **Mudança de ETD**:
  - o primeiro ETD não precisa de motivo; mudar depois exige motivo;
  - o portal guarda o histórico (de → para, quem, quando, motivo) e o primeiro ETD, e mostra a diferença em dias;
  - mudou pelo fornecedor: alerta ao analista do pedido, planner e comprador;
  - mudou pela Wellmix: aviso ao fornecedor.

## Follow 5/15/25 dias
Contados do início da produção. Quando vence, vira pendência da Wellmix ("Follow de N dias"). Ao registrar, escolhe-se **No prazo** ou **Atrasado**; atrasado exige observação e avisa o analista e o planner.

## Inspeção
- **Agendada** pela Wellmix (data e observação). O fornecedor é avisado.
- **Por SKU**, um resultado por item do pedido, em rodadas:
  - Aprovado; ou Reprovado, que exige motivo;
  - reprovado volta ao fornecedor (aviso e pendência "Corrigir SKU reprovado"), que informa o que corrigiu;
  - a correção volta para a Wellmix (pendência "Inspecionar de novo"), que faz a próxima rodada;
  - sem a correção do fornecedor não há nova rodada; aprovado encerra o item;
  - com todos aprovados, o cartão mostra "Todos aprovados".

Isso não bloqueia as etapas atuais do pedido (a etapa Inspeção continua com fotos e pesagem). Tudo vai para a auditoria (`production.*`).

## Esquema
Tabelas `production_tracks` (uma por pedido) e `sku_inspections` (uma linha por item e rodada). Antes do push do esquema, o cartão aparece vazio e salvar responde "esquema desatualizado".
