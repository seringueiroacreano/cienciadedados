"""Modelo de dados do sistema Mandato — Gestão de Gabinete Parlamentar.

Cada entidade é descrita uma única vez aqui. A partir desta descrição:
  * o servidor cria as tabelas do SQLite (veja `python3 server.py --schema`);
  * a API valida os campos recebidos (só aceita colunas declaradas);
  * o frontend monta listas, filtros e formulários automaticamente.

Tipos de campo:
  text, textarea, int, money (centavos), date, datetime, bool, select,
  ref (chave estrangeira), phone, cpf, email, cep, uf, municipio, tags, url, file
"""

MUNICIPIOS_AC = [
    "Acrelândia", "Assis Brasil", "Brasiléia", "Bujari", "Capixaba", "Cruzeiro do Sul",
    "Epitaciolândia", "Feijó", "Jordão", "Mâncio Lima", "Manoel Urbano",
    "Marechal Thaumaturgo", "Plácido de Castro", "Porto Acre", "Porto Walter",
    "Rio Branco", "Rodrigues Alves", "Santa Rosa do Purus", "Sena Madureira",
    "Senador Guiomard", "Tarauacá", "Xapuri",
]

STATUS_EMENDA = ["Recebida", "Cadastrada", "Empenhada", "Paga parcialmente", "Paga",
                 "Arquivada / Não atendida"]
STATUS_DEMANDA = ["Aberta", "Em andamento", "Encaminhada", "Atendida", "Não atendida"]
PRIORIDADES = ["Baixa", "Média", "Alta", "Urgente"]
PAPEIS = ["admin", "assessor", "consulta"]
BASES_LEGAIS = ["Consentimento", "Atendimento a pedido do titular", "Cumprimento de obrigação legal",
                "Execução de políticas públicas", "Legítimo interesse"]


def F(nome, rotulo, tipo="text", **kw):
    campo = {"n": nome, "l": rotulo, "t": tipo}
    campo.update(kw)
    return campo


ENDERECO = [
    F("cep", "CEP", "cep"),
    F("uf", "Estado", "uf", padrao="AC"),
    F("municipio", "Município", "municipio", filtro=True),
    F("bairro", "Bairro", filtro=True),
    F("endereco", "Endereço"),
]

ENTIDADES = {
    "cidadaos": {
        "rotulo": "Cidadãos", "singular": "Cidadão", "icone": "👤", "titulo": "nome", "ordem": "nome",
        "lista": ["nome", "telefone", "municipio", "bairro", "tags"],
        "campos": [
            F("nome", "Nome", req=True, busca=True),
            F("cpf", "CPF", "cpf", busca=True, sensivel=True),
            F("nascimento", "Data de nascimento", "date"),
            F("telefone", "Telefone", "phone", busca=True),
            F("whatsapp", "WhatsApp", "phone"),
            F("email", "E-mail", "email", busca=True),
            *ENDERECO,
            F("tags", "Tags", "tags", filtro=True, busca=True),
            F("lider", "Liderança comunitária", "bool", filtro=True),
            F("consentimento", "Autoriza contato (LGPD)", "bool", filtro=True,
              ajuda="Marque somente com autorização expressa do titular para receber mensagens."),
            F("base_legal", "Base legal (LGPD)", "select", opcoes=BASES_LEGAIS,
              padrao="Atendimento a pedido do titular"),
            F("observacoes", "Observações", "textarea"),
        ],
        "filhos": [["demandas", "cidadao_id"], ["atendimentos", "cidadao_id"], ["lembretes", "cidadao_id"]],
    },
    "instituicoes": {
        "rotulo": "Instituições", "singular": "Instituição", "icone": "🏛", "titulo": "nome", "ordem": "nome",
        "lista": ["nome", "tipo", "municipio", "telefone"],
        "campos": [
            F("nome", "Nome", req=True, busca=True),
            F("tipo", "Tipo", "select", filtro=True, opcoes=[
                "Associação", "Igreja", "Escola", "Unidade de saúde", "Prefeitura", "Secretaria",
                "Cooperativa", "Sindicato", "ONG", "Outro"]),
            F("cnpj", "CNPJ", busca=True),
            F("responsavel", "Responsável", busca=True),
            F("telefone", "Telefone", "phone"),
            F("email", "E-mail", "email"),
            *ENDERECO,
            F("observacoes", "Observações", "textarea"),
        ],
        "filhos": [["demandas", "instituicao_id"], ["emendas", "instituicao_id"]],
    },
    "autoridades": {
        "rotulo": "Contatos de autoridade", "singular": "Autoridade", "icone": "🎖", "titulo": "nome",
        "ordem": "nome", "lista": ["nome", "cargo", "partido", "uf", "telefone"],
        "campos": [
            F("nome", "Nome", req=True, busca=True),
            F("nome_civil", "Nome civil", busca=True),
            F("cargo", "Cargo", "select", filtro=True, opcoes=[
                "Deputado(a) Estadual", "Deputado(a) Federal", "Senador(a)", "Governador(a)",
                "Vice-governador(a)", "Secretário(a) de Estado", "Prefeito(a)", "Vice-prefeito(a)",
                "Vereador(a)", "Magistrado(a)", "Promotor(a)", "Outro"]),
            F("orgao", "Órgão / Casa", busca=True),
            F("partido", "Partido", filtro=True),
            F("uf", "UF", "uf", filtro=True),
            F("telefone", "Telefone", "phone"),
            F("email", "E-mail", "email"),
            F("gabinete", "Gabinete / sala"),
            F("aniversario", "Aniversário", "date"),
            F("observacoes", "Observações", "textarea"),
        ],
    },
    "demandas": {
        "rotulo": "Demandas", "singular": "Demanda", "icone": "📖", "titulo": "titulo", "ordem": "id DESC",
        "lista": ["protocolo", "titulo", "cidadao_id", "municipio", "status", "prazo"],
        "campos": [
            F("protocolo", "Protocolo", auto=True, busca=True),
            F("titulo", "Título", req=True, busca=True),
            F("descricao", "Descrição", "textarea", busca=True),
            F("categoria", "Categoria", "select", filtro=True, opcoes=[
                "Saúde", "Educação", "Infraestrutura", "Assistência social", "Segurança",
                "Emprego e renda", "Documentação", "Meio ambiente", "Produção rural", "Outro"]),
            F("cidadao_id", "Cidadão solicitante", "ref", ref="cidadaos", filtro=True),
            F("instituicao_id", "Instituição solicitante", "ref", ref="instituicoes", filtro=True),
            F("municipio", "Município", "municipio", filtro=True),
            F("bairro", "Bairro"),
            F("status", "Status", "select", opcoes=STATUS_DEMANDA, padrao="Aberta", filtro=True, req=True),
            F("prioridade", "Prioridade", "select", opcoes=PRIORIDADES, padrao="Média", filtro=True),
            F("responsavel_id", "Responsável", "ref", ref="usuarios", filtro=True),
            F("prazo", "Prazo", "date"),
            F("encaminhado_para", "Encaminhado para (órgão)"),
            F("resposta", "Resposta ao cidadão", "textarea"),
        ],
        "filhos": [["atendimentos", "demanda_id"], ["documentos", "demanda_id"]],
    },
    "atendimentos": {
        "rotulo": "Atendimentos", "singular": "Atendimento", "icone": "☰", "titulo": "assunto",
        "ordem": "data DESC, id DESC", "lista": ["data", "canal", "cidadao_id", "assunto", "responsavel_id"],
        "campos": [
            F("data", "Data", "date", req=True, padrao="hoje"),
            F("canal", "Canal", "select", filtro=True, req=True, padrao="Presencial", opcoes=[
                "Presencial", "Telefone", "WhatsApp", "E-mail", "Redes sociais", "Visita"]),
            F("cidadao_id", "Cidadão", "ref", ref="cidadaos", filtro=True),
            F("assunto", "Assunto", req=True, busca=True),
            F("relato", "Relato", "textarea", busca=True),
            F("demanda_id", "Demanda gerada", "ref", ref="demandas"),
            F("responsavel_id", "Atendido por", "ref", ref="usuarios", filtro=True),
        ],
    },
    "emendas": {
        "rotulo": "Emendas", "singular": "Emenda", "icone": "🏷", "titulo": "objeto", "ordem": "id DESC",
        "lista": ["numero", "objeto", "municipio", "valor", "valor_pago", "status"],
        "campos": [
            F("numero", "Nº da emenda", busca=True),
            F("tipo", "Tipo", "select", filtro=True, padrao="Individual",
              opcoes=["Individual", "Bancada", "Comissão"]),
            F("ano", "Ano de indicação", "int", req=True, padrao="ano", filtro=True),
            F("orgao", "Secretaria / Órgão executor", req=True, busca=True, filtro=True),
            F("objeto", "Destino / Objeto", req=True, busca=True),
            F("acao", "Ação orçamentária", "textarea"),
            F("beneficiario", "Beneficiário", busca=True),
            F("instituicao_id", "Instituição solicitante", "ref", ref="instituicoes", filtro=True),
            F("cidadao_id", "Cidadão solicitante", "ref", ref="cidadaos", filtro=True),
            F("contato_politico", "Contato político (telefone)", "phone"),
            F("origem", "Origem do pedido"),
            F("responsavel_id", "Responsável no gabinete", "ref", ref="usuarios", filtro=True),
            F("valor", "Valor indicado", "money", req=True),
            F("valor_empenhado", "Valor empenhado", "money"),
            F("empenho", "Nº do empenho"),
            F("tramite", "Trâmite (situação no órgão)", "textarea"),
            F("status", "Status", "select", opcoes=STATUS_EMENDA, padrao="Recebida", filtro=True, req=True),
            *ENDERECO,
            F("observacoes", "Observações", "textarea"),
        ],
        # colunas calculadas (somente leitura), resolvidas em SQL
        "calc": {
            "valor_pago": ("Valor pago", "money",
                           "(SELECT COALESCE(SUM(p.valor),0) FROM pagamentos p WHERE p.emenda_id=t.id)"),
            "ultimo_pagamento": ("Último pagamento", "date",
                                 "(SELECT MAX(p.data) FROM pagamentos p WHERE p.emenda_id=t.id)"),
        },
        "filhos": [["pagamentos", "emenda_id"], ["documentos", "emenda_id"]],
    },
    "pagamentos": {
        "rotulo": "Pagamentos de emendas", "singular": "Pagamento", "icone": "💲", "titulo": "documento",
        "ordem": "data DESC", "lista": ["emenda_id", "data", "valor", "documento"], "oculto": True,
        "campos": [
            F("emenda_id", "Emenda", "ref", ref="emendas", req=True, filtro=True),
            F("data", "Data do pagamento", "date", req=True, padrao="hoje"),
            F("valor", "Valor pago", "money", req=True),
            F("documento", "Ordem bancária / documento"),
        ],
    },
    "agenda": {
        "rotulo": "Agenda", "singular": "Compromisso", "icone": "📅", "titulo": "titulo", "ordem": "inicio",
        "lista": ["inicio", "titulo", "local", "municipio", "tipo"],
        "campos": [
            F("titulo", "Título", req=True, busca=True),
            F("inicio", "Início", "datetime", req=True),
            F("fim", "Fim", "datetime"),
            F("tipo", "Tipo", "select", filtro=True, opcoes=[
                "Sessão plenária", "Comissão", "Audiência pública", "Reunião", "Visita a município",
                "Evento", "Atendimento", "Outro"]),
            F("local", "Local", busca=True),
            F("municipio", "Município", "municipio", filtro=True),
            F("participantes", "Participantes", "textarea"),
            F("observacoes", "Observações", "textarea"),
        ],
    },
    "tarefas": {
        "rotulo": "Tarefas", "singular": "Tarefa", "icone": "✎", "titulo": "titulo", "ordem": "prazo",
        "lista": ["titulo", "responsavel_id", "prazo", "prioridade", "status"],
        "campos": [
            F("titulo", "Título", req=True, busca=True),
            F("descricao", "Descrição", "textarea"),
            F("responsavel_id", "Responsável", "ref", ref="usuarios", filtro=True),
            F("prazo", "Prazo", "date"),
            F("prioridade", "Prioridade", "select", opcoes=PRIORIDADES, padrao="Média", filtro=True),
            F("status", "Status", "select", opcoes=["A fazer", "Em andamento", "Concluída"],
              padrao="A fazer", filtro=True, req=True),
        ],
    },
    "lembretes": {
        "rotulo": "Lembretes de relacionamento", "singular": "Lembrete", "icone": "🔔", "titulo": "motivo",
        "ordem": "data", "lista": ["data", "cidadao_id", "motivo", "feito"],
        "campos": [
            F("cidadao_id", "Cidadão", "ref", ref="cidadaos", req=True, filtro=True),
            F("data", "Data", "date", req=True),
            F("motivo", "Motivo", req=True, busca=True),
            F("feito", "Concluído", "bool", filtro=True),
        ],
    },
    "documentos": {
        "rotulo": "Documentos", "singular": "Documento", "icone": "📄", "titulo": "nome", "ordem": "id DESC",
        "lista": ["nome", "tags", "arquivo", "criado_em"],
        "campos": [
            F("nome", "Nome", req=True, busca=True),
            F("arquivo", "Arquivo", "file", req=True),
            F("tags", "Tags", "tags", busca=True, filtro=True),
            F("emenda_id", "Emenda vinculada", "ref", ref="emendas"),
            F("demanda_id", "Demanda vinculada", "ref", ref="demandas"),
        ],
    },
    "links": {
        "rotulo": "Links sociais", "singular": "Link", "icone": "🔗", "titulo": "rede", "ordem": "rede",
        "lista": ["rede", "url", "descricao"],
        "campos": [
            F("rede", "Rede", "select", req=True, opcoes=[
                "Instagram", "Facebook", "YouTube", "TikTok", "X", "WhatsApp (canal)", "Site", "Outro"]),
            F("url", "Endereço (URL)", "url", req=True),
            F("descricao", "Descrição"),
        ],
    },
    "usuarios": {
        "rotulo": "Usuários", "singular": "Usuário", "icone": "🔑", "titulo": "nome", "ordem": "nome",
        "lista": ["nome", "email", "papel", "ativo", "ultimo_login"], "admin": True,
        "campos": [
            F("nome", "Nome", req=True, busca=True),
            F("email", "E-mail (login)", "email", req=True, busca=True, unico=True),
            F("papel", "Perfil de acesso", "select", opcoes=PAPEIS, padrao="assessor", req=True, filtro=True,
              ajuda="admin: tudo · assessor: cadastra e edita · consulta: somente leitura"),
            F("ativo", "Ativo", "bool", padrao=True, filtro=True),
            F("ultimo_login", "Último login", "datetime", somente_leitura=True),
            F("senha", "Senha (mín. 8 caracteres)", "password", virtual=True),
        ],
    },
    "gabinete": {
        "rotulo": "Dados do gabinete", "singular": "Gabinete", "icone": "⚙", "titulo": "parlamentar",
        "ordem": "id", "lista": ["parlamentar", "partido", "casa"], "unico": True, "admin_escrita": True,
        "campos": [
            F("parlamentar", "Nome parlamentar", req=True),
            F("nome_civil", "Nome civil"),
            F("partido", "Sigla do partido"),
            F("uf", "UF", "uf", padrao="AC"),
            F("casa", "Casa legislativa", padrao="Assembleia Legislativa do Estado do Acre"),
            F("predio", "Prédio"),
            F("sala", "Sala"),
            F("andar", "Andar"),
            F("telefone", "Telefone do gabinete", "phone"),
            F("email", "E-mail do gabinete", "email"),
            F("encarregado_lgpd", "Encarregado de dados (LGPD)",
              ajuda="Pessoa de contato para pedidos de titulares (acesso, correção, exclusão)."),
        ],
    },
}

# ordem do menu lateral (entidades ocultas ou administrativas ficam fora daqui)
MENU = [
    ("painel", "Visão geral", "📊"), ("notificacoes", "Notificações do dia", "🔔"),
    ("agenda", None, None), ("aniversarios", "Aniversariantes", "🎁"),
    ("cidadaos", None, None), ("demandas", None, None), ("atendimentos", None, None),
    ("emendas", None, None), ("instituicoes", None, None), ("autoridades", None, None),
    ("tarefas", None, None), ("lembretes", None, None), ("documentos", None, None),
    ("mapa", "Mapa por município", "📍"), ("whatsapp", "WhatsApp", "💬"),
    ("links", None, None), ("usuarios", None, None), ("gabinete", None, None),
    ("auditoria", "Auditoria", "🛡"),
]


def colunas_db(ent):
    """Colunas físicas da tabela (campos não virtuais; arquivos viram 4 colunas)."""
    cols = []
    for c in ENTIDADES[ent]["campos"]:
        if c.get("virtual"):
            continue
        if c["t"] == "file":
            cols += [(f"{c['n']}_nome", "TEXT"), (f"{c['n']}_mime", "TEXT"),
                     (f"{c['n']}_tamanho", "INTEGER"), (f"{c['n']}_caminho", "TEXT")]
        elif c["t"] in ("int", "money", "bool") or c["t"] == "ref":
            cols.append((c["n"], "INTEGER"))
        else:
            cols.append((c["n"], "TEXT"))
    return cols


def ddl():
    """Gera o SQL de criação de todas as tabelas."""
    sql = []
    for ent, meta in ENTIDADES.items():
        linhas = ["id INTEGER PRIMARY KEY AUTOINCREMENT"]
        for nome, tipo in colunas_db(ent):
            extra = ""
            campo = next((c for c in meta["campos"] if c["n"] == nome), None)
            if campo and campo.get("unico"):
                extra = " UNIQUE"
            if campo and campo["t"] == "ref":
                alvo = campo["ref"]
                acao = "CASCADE" if (ent, nome) in (("pagamentos", "emenda_id"), ("lembretes", "cidadao_id")) \
                    else "SET NULL"
                extra = f" REFERENCES {alvo}(id) ON DELETE {acao}"
            linhas.append(f"{nome} {tipo}{extra}")
        if ent == "usuarios":
            linhas += ["senha_hash TEXT", "senha_sal TEXT"]
        linhas += ["criado_em TEXT", "atualizado_em TEXT", "criado_por INTEGER"]
        sql.append(f"CREATE TABLE IF NOT EXISTS {ent} (\n  " + ",\n  ".join(linhas) + "\n);")
        for c in meta["campos"]:
            if c["t"] == "ref" or c.get("filtro"):
                if not c.get("virtual") and c["t"] != "file":
                    sql.append(f"CREATE INDEX IF NOT EXISTS ix_{ent}_{c['n']} ON {ent}({c['n']});")
    sql.append("""CREATE TABLE IF NOT EXISTS sessoes (
  token TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_em TEXT NOT NULL
);""")
    sql.append("""CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  usuario_id INTEGER,
  usuario_nome TEXT,
  acao TEXT NOT NULL,
  entidade TEXT,
  registro_id INTEGER,
  detalhe TEXT
);""")
    return "\n".join(sql)
