# Gabinete Dep. Marcus Alexandre — Sistema de Gestão do Mandato

Sistema web para a equipe do gabinete: cidadãos, demandas, atendimentos, **emendas com execução
financeira**, agenda, aniversariantes, instituições, autoridades, tarefas, documentos,
**mapa do Acre**, **importação de planilhas** e **assistente de IA com dados anonimizados**.

- **Banco e login:** Supabase (Postgres + Auth + Storage + Edge Functions), projeto
  `gabinete-marcus-alexandre`, região **São Paulo (sa-east-1)**.
- **Frontend:** HTML/CSS/JS sem build e sem dependências externas em tempo de execução
  (a biblioteca `supabase-js` 2.118.0 está copiada em `web/vendor/`).
- **Funciona no celular** (tabelas viram cartões) e no computador.

## Estrutura

```
supabase/migrations/   esquema, segurança (RLS), auditoria, relatórios — já aplicados no projeto
supabase/functions/    assistente/  (Edge Function do assistente de IA) — já publicada
supabase/tests/        teste_banco.sql (rode no SQL Editor; termina em ROLLBACK)
web/                   o aplicativo (abra web/index.html por um servidor)
  entidades.js         modelo das telas: cada cadastro descrito uma vez
  importar.js          leitor de CSV/XLSX e conversões (CPF, datas, R$, telefone, município)
  app.js               telas e integração com o Supabase
  dados/acre.json      malha dos 22 municípios (IBGE, via geodata-br) já convertida para SVG
tests/                 testes do importador (node --test tests/importar.test.mjs)
```

## Como rodar

```bash
cd gabinete-ma/web
python3 -m http.server 8080      # abra http://localhost:8080
```

Para publicar, sirva a pasta `web/` em qualquer hospedagem estática com HTTPS
(GitHub Pages, Netlify, Cloudflare Pages ou servidor da Casa).

### Primeiro acesso

1. Na tela de login, clique em **Solicitar acesso** e cadastre o e-mail do administrador.
   **O primeiro usuário cadastrado vira administrador automaticamente.**
2. Confirme o e-mail pelo link recebido.
3. Os demais membros da equipe fazem o mesmo; eles entram **desativados**.
   O administrador abre **Usuários**, escolhe o perfil (assessor ou consulta) e marca
   **Acesso aprovado**.

### Configurações no painel do Supabase (uma vez)

| Onde | O quê |
| --- | --- |
| Authentication → URL Configuration | **Site URL** e **Redirect URLs**: o endereço onde o sistema for publicado (necessário para confirmação de e-mail e "Esqueci minha senha") |
| Authentication → Sign In / Providers | Depois que a equipe estiver cadastrada, desligue **Allow new users to sign up** se não quiser novos pedidos |
| Edge Functions → Secrets | Crie `ANTHROPIC_API_KEY` com a chave da API do Claude para ligar o assistente de IA |

## Perfis de acesso

| Perfil | Pode |
| --- | --- |
| admin | tudo, inclusive usuários, auditoria e dados do gabinete |
| assessor | ler, cadastrar, editar, excluir, importar e exportar |
| consulta | somente leitura |
| (desativado) | nada: a RLS do banco bloqueia toda leitura |

As regras estão **no banco** (Row Level Security), não só nas telas. Mesmo quem tiver a chave
pública do projeto não lê nada sem um usuário ativo.

## Novidades desta versão

### Importação de planilhas
*Importar planilhas* aceita `.xlsx` e `.csv`, inclusive exportações de outros sistemas de gabinete
(como a planilha de aniversariantes com títulos de seção e linhas "Nenhum … encontrado").

- Detecta sozinho a linha do cabeçalho e sugere o campo de cada coluna; tudo pode ser ajustado.
- Converte datas (dd/mm/aaaa, aaaa-mm-dd, número de série do Excel), valores (`R$ 1.234,56`),
  telefones (assume DDD 68 quando falta), CPF (valida dígitos), UF por extenso e grafia dos municípios.
- Ignora duplicados (mesmo CPF, ou mesmo nome + telefone) e linhas vazias.
- Mostra prévia, erros e avisos antes de gravar; gera relatório de erros em CSV.
- Cidadãos importados recebem a base legal escolhida e **"Autoriza contato" = Não**.

### Mapa do Acre
Mapa por município (cidadãos, demandas, atendimentos, valor indicado e pago de emendas),
com legenda, dica ao passar o mouse e clique que abre a lista filtrada.

### Assistente de IA (com anonimização)
Responde perguntas de gestão ("onde estão as demandas em aberto?", "como está a execução das
emendas?") usando o modelo Claude, pela Edge Function `assistente`.

O que **sai** do banco para a IA (`public.assistente_contexto()`):
contagens por município, status, categoria, canal, faixa etária e mês; lista de emendas
(órgão, objeto, município, valores, status). Grupos com **menos de 3 pessoas viram "<3"**.

O que **nunca sai**: nomes, CPF, telefones, e-mails, endereços, bairros, datas de nascimento,
**tags** (podem revelar religião, saúde, filiação — dados sensíveis do art. 5º, II, da LGPD),
textos de demandas e atendimentos, beneficiários e contatos de emendas.

A pergunta digitada também passa por anonimização (CPF, telefone, e-mail, CEP, datas e números
longos são trocados por marcadores). A tela mostra exatamente o que foi enviado. Só a pergunta
já anonimizada fica registrada.

## LGPD e legislação eleitoral

- Base legal registrada por cidadão; contato por WhatsApp só com autorização marcada.
- **Relatório do titular** (art. 18) na ficha do cidadão.
- **Auditoria** de criação, edição, exclusão, visualização de ficha, exportação, download e
  importação. Ela guarda só os **nomes** dos campos alterados, nunca os valores.
- Dados hospedados no Brasil (São Paulo).
- **Dados e estrutura do mandato não podem ser usados em campanha** (Lei 9.504/1997, art. 73).
  O sistema avisa nas telas de cadastro, importação e WhatsApp, mas o controle é da gestão do gabinete.

## Testes

```bash
node --test tests/importar.test.mjs   # leitor de planilhas e conversões
```

`supabase/tests/teste_banco.sql` verifica a RLS, os perfis, o último administrador, o status
automático das emendas, os relatórios e a auditoria. Ele termina em ROLLBACK.

## Paleta institucional

| Cor | Uso |
| --- | --- |
| Verde Institucional `#009B3A` | faixas, gráficos, mapa e superfícies |
| Verde de ação `#007A2E` | botões e links. É uma variação do verde institucional, porque `#009B3A` com texto branco tem contraste 3,6:1 e fica abaixo do mínimo WCAG AA (4,5:1); `#007A2E` tem 5,5:1 |
| Amarelo Ouro `#FFDF00` | destaques e botão "+", sempre com texto azul-marinho (10,2:1) |
| Azul Marinho `#0B2E59` | menu e títulos (13,5:1 com branco) |
| Verde Esmeralda `#2ECC71` | detalhes sobre o azul-marinho; nunca texto sobre branco (2,1:1) |
| Branco `#FFFFFF` / Cinza Ardósia `#2C3E50` | fundo e texto (11:1) |

## Licença

Apache-2.0. Veja `LICENSE`. A malha municipal vem do IBGE, via
[geodata-br](https://github.com/tbrugz/geodata-br). `supabase-js` é licenciado sob MIT
(`web/vendor/supabase-LICENSE`).
