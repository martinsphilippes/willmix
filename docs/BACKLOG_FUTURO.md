# Backlog futuro

Ordem sugerida depois do MVP funcional.

## Vertical slice 2: cadastros

- Edição e inativação de produtos e linhas na lista; busca e paginação.
- Múltiplos endereços de entrega por cliente; contatos por parceiro.
- Importação XLSX além de CSV; validação de duplicidade por CNPJ/e-mail.

## Vertical slice 3: notificações

- Provedor de e-mail real; templates por idioma.
- Preferências por usuário (canal, horário); resumo diário para a Willmix.

## Vertical slice 4: conta corrente

- Segunda parcela e saldo por pedido; extrato por período; exportação.
- Câmbio de referência e variação cambial.

## Vertical slice 5: Sankhya

- Adapter real; fila de sincronização com retentativa; reconciliação de número do pedido.

## Vertical slice 6: WhatsApp

- Envio de lembretes e links de pendência; confirmação de leitura.

## Vertical slice 7: exceções e jurídico

- Escalonamento de atrasos (lembrete → supervisor → diretoria); SLA por parceiro.
- Fluxo de contestação de multa com anexos e histórico.

## Vertical slice 8: hardening

- Rate limiting em login e uploads; rotação de segredo de sessão; CSP.
- Permissões de linha no Appwrite como segunda barreira (hoje toda leitura é server-side).
- Testes de permissão por rota; testes de carga da Control Tower.
- Observabilidade: logs estruturados, alertas de job falho.

## Outros

- Realtime na Control Tower e nas pendências.
- Aplicativo/PWA para fotos na fábrica.
- Tolerância de peso por linha; checklist condicional por produto.
- Relatórios: lead time por etapa e por fornecedor, atrasos por parceiro.
