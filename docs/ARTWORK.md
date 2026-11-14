# Artes do pedido e tabela de preços (Fase F)

## Cartão "Artes" no pedido
Visível para a Wellmix, para o designer do pedido e para a agência do pedido.

- **Designer**:
  - a Wellmix escolhe alguém da equipe com a função **Designer** (Equipe → Funções) ou um login da agência do pedido;
  - a pessoa é avisada.
- **Não conformidade por SKU**:
  - a Wellmix aponta, em cada item do pedido, o que está errado na arte (com arquivo, se quiser);
  - quem faz a arte recebe o aviso e a pendência "Corrigir a arte" e envia a correção (texto e a arte nova, que fica visível para quem trabalha no pedido, inclusive o fornecedor que imprime). Quem faz a arte: o designer do pedido; sem ele, a agência quando é ela quem faz a arte; senão quem tem a função Designer; senão o analista do pedido (docs/CERTIFICATION.md, seção 13);
  - quem apontou recebe a pendência "Conferir a correção da arte" (sem a ação "Validar a arte", quem valida a arte do pedido) e aceita ou reabre com o motivo; aceitar e reabrir exigem a ação "Validar a arte" (Equipe → Funções e acessos; o administrador sempre);
  - as pendências abrem direto na linha da não conformidade (`#artwork-issue-<id>`);
  - tudo vai para a auditoria (`artwork.*`).
- **Quem faz a arte** (visão da Wellmix): o cartão mostra com quem ficam as correções e a aplicação do selo; sem designer com a arte feita pela Wellmix, o aviso pede para escolher o designer.
- **Baixar todas as artes**:
  - um zip com a versão mais nova de cada arte, faca, etiqueta, arquivo de gráfica e foto de embalagem do pedido e do briefing de embalagem, mais o selo de certificação do pedido (docs/CERTIFICATION.md), quando já foi enviado;
  - só entra o que o usuário pode abrir;
  - o zip é gerado em fluxo, sem carregar tudo na memória.

## Tabela de preços
Em Marketing → **Tabela de preços** (só a Wellmix): cada produto ativo com:
- o último preço praticado (valor ao cliente ÷ quantidade da última solicitação com fornecedor escolhido);
- o pedido mínimo, o FOB unitário e a data.

Baixa em CSV (separador ";"), com proteção contra fórmula no Excel.
