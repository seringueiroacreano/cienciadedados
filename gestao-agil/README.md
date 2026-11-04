# Fluxo — Gestão Ágil de Projetos (pt-BR)

Aplicação web de página única, sem dependências e sem build, inspirada nos fluxos de
trabalho de ferramentas de gestão ágil de tarefas. Licença **Apache-2.0**.

## Como usar

Abra `index.html` no navegador (ou `python3 -m http.server` nesta pasta).
Os dados ficam no `localStorage` do navegador; use *Configurações › Exportar JSON* para backup.

## Funcionalidades

- **Caixa de entrada** com alertas derivados (atrasadas, vencendo em 3 dias, bloqueadas).
- **Tarefas**: status (Backlog → Concluída), prioridade, responsável, prazo, estimativa em
  pontos, etiquetas, checklist, comentários e **dependências** (bloqueada por).
- **Lista agrupável e Quadro kanban** com arrastar-e-soltar e **limite WIP** configurável.
- **Projetos** com progresso (por pontos ou contagem) e **saúde automática**
  (No prazo / Em risco / Atrasado, comparando progresso real × esperado).
- **Ciclos (sprints)** com **burndown**, velocidade e lista de tarefas.
- **Pulso**: vazão, tempo de ciclo, lead time, WIP, atrasadas, bloqueadas, atividade.
- **Visões** (filtros salvos), **Favoritos**, **Equipes**, **Busca/paleta** (`Ctrl+K`), atalho `C` para nova tarefa.
- Exportação JSON/CSV, importação JSON, tema claro/escuro, layout responsivo.

## Melhorias em relação ao modelo de referência

Burndown e velocidade nativos, WIP por coluna, saúde de projeto calculada (não manual),
dependências com alerta de bloqueio, métricas de fluxo (lead/cycle time), exportação CSV
e funcionamento 100% offline, sem conta.

## Limites conhecidos

Armazenamento local por navegador (sem colaboração em tempo real). Para multiusuário,
o próximo passo é trocar `load()/save()` em `app.js` por uma API/banco (ex.: Postgres).
Os dados de exemplo são fictícios.

## Licença

Apache License 2.0 — veja `LICENSE` e `NOTICE`.
