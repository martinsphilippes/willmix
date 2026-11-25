# Gestão do projeto (Plataforma Wellmix v2 no portal)

Pedido do dono, 25/11/2026: a Plataforma Wellmix v2 (o artifact do claude.ai
com a visão, o quadro Kanban, o mapa, o roadmap e as outras abas) aberta pelo
portal, só no login do Wellington (well@wellmix.com.br), sem mexer em mais
nada do portal. Ele edita o quadro (cria e move cards, aprova, pede ajuste,
comenta e anexa) com o login dele.

## Como funciona

- Menu: grupo **Gestão do projeto** no fim do menu lateral, com uma subaba
  por aba da plataforma (Visão, Projeto (Kanban), Mapa, Processo, RACI,
  Personas, O que já foi feito, Telas e integrações, Roadmap, Custos e A
  validar). Endereço `/app/project-management/<aba>`.
- Acesso: todo login de administrador (dono, 25/11/2026, no mesmo dia) e os
  e-mails de `PROJECT_MANAGEMENT_EMAILS` (`src/lib/project-management/index.ts`),
  em `canSeeProjectManagement`. Fica fora do controle de telas (nenhuma
  função ou cargo abre); para os outros logins o menu não muda e os
  endereços respondem "não encontrado". Para liberar alguém que não é
  administrador, acrescentar o e-mail na lista.
- A plataforma roda num iframe (`/app/project-management/frame`, o HTML de
  `src/lib/project-management/plataforma-html.ts`), no layout da seção: trocar
  de aba pelo menu não recarrega a plataforma, e trocar de aba dentro dela
  muda o endereço e o menu.
- Dados: o artifact usava o banco do claude.ai (`window.claude.use("db")`).
  No portal, a ponte `src/lib/project-management/shim.ts` responde a essas
  chamadas e pede cada leitura e escrita à página por `postMessage`; a página
  chama as Server Actions de `src/app/app/actions/project-management.ts`
  (zod e o mesmo teste de acesso). Tabela `project_docs` (coleção
  `atividades`, `pessoas` ou `registros`, `docId` e `data` com o documento
  inteiro, id da linha `<coleção>.<docId>`). O quadro relê a cada 20 s e logo
  depois de cada escrita.
- Autor do histórico: o login do portal (o nome vem de `users`).
- Anexos: guardados no armazenamento do portal; abrem por
  `/app/project-management/file?k=<chave>`, só para os mesmos logins e só
  chave que está nos anexos de alguma atividade.
- O botão "Editar" da plataforma (textos das abas) continua guardando só no
  navegador, como no artifact.
- Os textos de dentro da plataforma são só em português; o menu tem pt, en
  e zh (`src/i18n/modules/project-management.ts`).

## Atualizar a plataforma

1. Publicar a versão nova do artifact e baixar o HTML dele.
2. `node scripts/project-management-html.mjs <arquivo.html>` (regrava
   `plataforma-html.ts`).
3. Testes (`tests/unit/project-management.test.ts` confere as abas e a ponte)
   e o PR de sempre.

Os dados do quadro não vão no HTML: ficam em `project_docs`. A carga inicial
(25/11/2026) veio do banco do artifact (atividades, pessoas e registros).
