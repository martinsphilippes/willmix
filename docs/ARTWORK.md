# Artes do pedido e tabela de preços (Fase F)

## Cartão "Artes" no pedido
Visível para a Wellmix, para o designer do pedido e para a agência do pedido.

- **Designer**:
  - a Wellmix escolhe alguém da equipe com a função **Designer** (Equipe → Funções) ou um login da agência do pedido;
  - a pessoa é avisada.
- **Não conformidade por SKU**:
  - a Wellmix aponta, em cada item do pedido, o que está errado na arte (com arquivo, se quiser);
  - o designer recebe a pendência e envia a correção (texto e a arte nova, que fica visível para quem trabalha no pedido, inclusive o fornecedor que imprime);
  - a Wellmix aceita ou reabre com o motivo;
  - tudo vai para a auditoria (`artwork.*`).
- **Baixar todas as artes**:
  - um zip com a versão mais nova de cada arte, faca, etiqueta, arquivo de gráfica e foto de embalagem do pedido e do briefing de embalagem;
  - só entra o que o usuário pode abrir;
  - o zip é gerado em fluxo, sem carregar tudo na memória.

## Tabela de preços
Em Marketing → **Tabela de preços** (só a Wellmix): cada produto ativo com:
- o último preço praticado (valor ao cliente ÷ quantidade da última solicitação com fornecedor escolhido);
- o pedido mínimo, o FOB unitário e a data.

Baixa em CSV (separador ";"), com proteção contra fórmula no Excel.
