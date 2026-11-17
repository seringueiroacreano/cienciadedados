# Mandato — Gestão de Gabinete Parlamentar (Estadual)

Sistema completo, do banco de dados ao frontend, para o gabinete de um(a) deputado(a) estadual:
cidadãos, demandas, atendimentos, **emendas com execução financeira**, agenda, aniversariantes,
instituições, autoridades, tarefas, documentos, mapa por município, WhatsApp, usuários e auditoria.

- **Backend:** Python 3.9+ só com a biblioteca padrão (`http.server` + `sqlite3`). Nada para instalar.
- **Banco:** SQLite (`dados/gabinete.db`), criado sozinho na primeira execução.
- **Frontend:** HTML/CSS/JS sem dependências, pensado primeiro para o celular.

## Como rodar

```bash
cd gabinete
python3 server.py --demo        # com dados fictícios para conhecer o sistema
# ou
python3 server.py               # banco vazio
```

Abra http://localhost:8000. No primeiro uso o terminal mostra o login `admin@gabinete.local`
e uma senha gerada (só aparece uma vez). Troque-a em *Minha conta → Trocar senha*.
Para a equipe acessar pela rede do gabinete: `python3 server.py --host 0.0.0.0`.

Outros comandos:

```bash
python3 server.py --schema                  # mostra o SQL de todas as tabelas
python3 -m unittest discover -s tests -v     # roda os testes da API
```

## Arquitetura

```
entidades.py   modelo de dados: cada cadastro é descrito UMA vez (campos, tipos, filtros, relações)
server.py      cria o banco, valida, autentica, aplica permissões, registra auditoria e serve a API
demo.py        dados fictícios de demonstração
static/        frontend (index.html, app.js, styles.css): telas montadas a partir de /api/meta
tests/         testes automatizados da API
```

Para **criar um campo novo**, acrescente uma linha em `entidades.py`. Se a tabela já existir,
rode no banco um `ALTER TABLE <tabela> ADD COLUMN <campo> TEXT;`. O formulário, a lista, o filtro e a exportação
passam a mostrar o campo sem mudar mais nada.

## Módulos

| Módulo | O que faz |
| --- | --- |
| Visão geral | Indicadores: cidadãos, demandas abertas/vencidas, taxa de resolução, atendimentos por canal, execução das emendas do ano, agenda da semana |
| Notificações do dia | Tarefas, aniversariantes, compromissos, lembretes e demandas vencidas de qualquer data; exporta CSV e PDF |
| Cidadãos | Cadastro com CPF validado, endereço com busca de CEP, tags, liderança, **autorização de contato e base legal (LGPD)** |
| Demandas | Protocolo automático, categoria, prioridade, prazo, responsável, encaminhamento e resposta ao cidadão |
| Atendimentos | Registro por canal (presencial, WhatsApp, telefone…), ligado ao cidadão e à demanda |
| Emendas | Nº, tipo, órgão executor, valor indicado/empenhado, **pagamentos em parcelas com soma e status automáticos**, documentos anexos |
| Agenda, Tarefas, Lembretes | Compromissos, tarefas da equipe e lembretes de relacionamento |
| Instituições, Autoridades | Associações, escolas, prefeituras…; contatos de autoridades com aniversário |
| Documentos | Upload de até 8 MB, com tags e vínculo a emenda ou demanda |
| Mapa por município | Cidadãos, demandas e emendas por município (22 municípios do Acre já sugeridos) |
| WhatsApp | Abre a conversa com mensagem pronta, **só para quem autorizou contato** |
| Usuários, Auditoria | Perfis admin/assessor/consulta; registro de quem fez o quê e quando |

Todas as listas têm busca, filtros, paginação e exportação para Excel (CSV com `;`).

## O que foi melhorado em relação ao modelo de referência

- **Pagamentos de emenda viram parcelas** (data, valor, ordem bancária) em vez de texto livre.
  O total pago, o percentual de execução e o status (Paga parcialmente/Paga) são calculados.
- **Vínculos reais** entre cidadão, demanda, atendimento, emenda e documento, com as listas
  relacionadas na própria ficha. Os anexos deixam de ser 3 campos soltos.
- **Validação no servidor:** CPF com dígito verificador, telefone com DDD, CEP, e-mail e datas.
- **Perfis de acesso** e trava que impede remover o último administrador.
- **Auditoria** de login, visualização de ficha, criação, edição, exclusão, exportação e download.
- **Painel gerencial** com taxa de resolução e prazos vencidos, além das contagens.

## LGPD e legislação eleitoral

O gabinete trata dados pessoais de cidadãos, o que exige cuidado. O sistema ajuda, mas não substitui
os procedimentos do gabinete nem a orientação jurídica da Casa:

- **Minimização:** cadastre só o necessário. O CPF é opcional.
- **Base legal e autorização de contato:** cada cidadão tem uma base legal registrada e um campo
  "Autoriza contato". As telas de WhatsApp e de parabéns só oferecem contato quando ele está marcado.
- **Direitos do titular (art. 18):** o botão *Relatório LGPD do titular* gera tudo o que o gabinete
  guarda sobre a pessoa. A exclusão remove o cadastro e o registro fica na auditoria.
- **Auditoria sem dados pessoais:** o log guarda os nomes dos campos alterados, nunca os valores.
- **Encarregado de dados:** informe-o em *Dados do gabinete*.
- **Eleições:** dados e estrutura do mandato **não podem ser usados em campanha**
  (Lei 9.504/1997, art. 73). Não exporte a base para fins eleitorais.

## Colocar em produção

1. Rode em um servidor do gabinete ou da Casa, atrás de um proxy com **HTTPS** (nginx, Caddy),
   e defina `GABINETE_HTTPS=1` para o cookie de sessão ser enviado só por conexão segura.
2. Faça **backup diário** da pasta `dados/` (banco + arquivos). Ela contém dados pessoais:
   guarde-a criptografada e com acesso restrito.
3. Para muitos usuários ao mesmo tempo (dezenas), o próximo passo é migrar para PostgreSQL.
   A camada de SQL está toda em `server.py`.

## Próximos passos sugeridos

- **Assistente de IA** para perguntas sobre os dados do gabinete. Antes de ligar uma IA externa,
  defina quais dados podem sair do servidor (anonimizar/agregar) e registre isso no inventário LGPD.
- Mapa coroplético do Acre (exige arquivo GeoJSON dos municípios).
- WhatsApp Business API para envios em lote com opt-in e descadastro.
- Importação de planilhas antigas (CSV → cidadãos/emendas).

## Licença

Apache-2.0. Veja `LICENSE`. Os dados de demonstração são fictícios.
