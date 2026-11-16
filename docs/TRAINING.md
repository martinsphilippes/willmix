# Treinamento do Portal

Pedido do dono (16/11/2026): uma tela "Treinamento do Portal", aberta pelo ícone de capelo na barra vermelha do alto. A finalidade é oferecer, mais adiante, vídeos, quizzes e provas, para cada pessoa fazer o treinamento com o próprio login. Nesta etapa entram só a página vazia e o acesso pela barra.

## 1. O que tem hoje

- **Ícone na barra vermelha**:
  - um capelo, entre o seletor de idiomas (PT, EN, ZH) e o ícone de mensagens;
  - mesmo tamanho (36 px), cor e espaçamento do ícone de mensagens e do sino: os três usam a mesma classe (`HEADER_ICON` em `src/app/app/layout.tsx`);
  - "Treinamento do Portal" é o texto de ajuda (`title`) e o nome acessível (`aria-label`) do botão;
  - aparece em todos os tamanhos. No celular (abaixo de 768 px), o seletor de idiomas fica no menu (como antes), e o capelo fica na barra, logo antes das mensagens.
- **A página** (`/app/training`):
  - abre dentro do layout do portal (barra vermelha, menu lateral e "Voltar");
  - mostra só o título "Treinamento do Portal". A área de conteúdo fica em branco (`data-training-content`).
- **Idiomas:** o título e o texto do ícone em PT, EN e ZH ("Treinamento do Portal", "Portal Training", "门户培训"), em `src/i18n/modules/training.ts` (`nav.training` e `training.title`).

## 2. Quem abre

- **Todo login:** a equipe Wellmix, os clientes, os fornecedores (Trading, Factory, Supplier, GP e os tipos criados no painel) e os demais parceiros (agências, despachante, armador, transportadora, assessoria de comex, agente de carga, certificadora, jurídico).
- **Só exige estar logado**, como a troca de senha: a página não entra no controle de telas (`src/lib/auth/screens.ts`). Por isso não há caixa para tirar o acesso em Funções e acessos nem em Acessos externos, e as funções gravadas em produção não mudam. Mesmo o Comprador, que tem o Início desligado, abre.
- **Endereço direto:**
  - quem está logado abre `/app/training` direto;
  - sem login, a entrada pede o login (`/login?next=/app/training`) e depois volta ao Treinamento;
  - no primeiro acesso com senha provisória, a troca de senha vem antes, como em toda tela.

## 3. Onde está

- Rota: `src/lib/training.ts` (`TRAINING_PATH`).
- Página: `src/app/app/training/page.tsx`.
- Ícone: `TrainingLink` em `src/app/app/layout.tsx`.
- Textos: `src/i18n/modules/training.ts`.
- Testes:
  - `tests/unit/training.test.ts`: os textos nos três idiomas e a página fora do controle de telas.
  - `tests/e2e/training.spec.ts`: as 16 contas de demonstração, da equipe e de fora, abrem pelo ícone e pelo endereço, cada uma no idioma do próprio login (PT, EN e ZH); o endereço sem login; a troca de idioma; e a barra em 11 tamanhos (desktop, notebook, iPads em pé e deitados e celulares, até 320 px). A barra fica numa faixa só, com 56 px, os ícones do mesmo tamanho, centrados e na ordem idiomas → capelo → mensagens → sino, sem passar da largura da tela.

Sem mudança no banco.

## 4. Fica para depois (próximas etapas)

- Vídeos, quizzes e provas, cada pessoa com o próprio login.
- Para decidir com o dono quando a etapa vier:
  - o que cada perfil precisa fazer;
  - se há treinamento obrigatório (por exemplo, antes de liberar uma tela);
  - como guardar o andamento e as notas de cada login;
  - quem cria e publica o conteúdo.
