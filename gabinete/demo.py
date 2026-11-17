"""Carrega dados FICTÍCIOS de demonstração (nomes, CPFs e telefones inventados)."""
import random
from datetime import date, timedelta

from entidades import MUNICIPIOS_AC

NOMES = ["Ana", "Bruno", "Carla", "Daniel", "Elaine", "Francisco", "Gabriela", "Henrique", "Iara", "João",
         "Kátia", "Luiz", "Marta", "Nilton", "Olga", "Paulo", "Raimunda", "Sérgio", "Tereza", "Valdir"]
SOBRENOMES = ["Albuquerque", "Barros", "Cunha", "Damasceno", "Esteves", "Farias", "Gomes", "Holanda",
              "Lima", "Moura", "Nobre", "Oliveira", "Prado", "Queiroz", "Rocha", "Siqueira"]
BAIRROS = ["Centro", "Bosque", "Estação Experimental", "Cidade Nova", "Aeroporto Velho", "Floresta",
           "Cadeia Velha", "Vila Ivonete", "Tancredo Neves", "Calafate"]


def cpf_ficticio(rng):
    n = [rng.randint(0, 9) for _ in range(9)]
    for k in (9, 10):
        s = sum(n[i] * (k + 1 - i) for i in range(k))
        n.append(s * 10 % 11 % 10)
    d = "".join(map(str, n))
    return f"{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}"


def carregar(app, semente=42):
    rng = random.Random(semente)
    hoje = date.today()
    db = app.conectar()
    with db:
        if db.execute("SELECT COUNT(*) FROM cidadaos").fetchone()[0]:
            return "Banco já tem dados; demonstração não carregada."
        admin = db.execute("SELECT * FROM usuarios WHERE papel='admin' ORDER BY id LIMIT 1").fetchone()
        c = lambda ent, **kw: app.criar(db, ent, kw, admin)["id"]  # noqa: E731
        u2 = c("usuarios", nome="Assessora Exemplo", email="assessora@gabinete.local", papel="assessor",
               senha="troque-esta-senha")
        app.atualizar(db, "gabinete", 1, {"parlamentar": "Dep. Exemplo da Silva", "partido": "XYZ",
                                          "sala": "12", "andar": "1", "predio": "Sede da ALEAC",
                                          "telefone": "6830000000", "email": "gabinete.exemplo@exemplo.org",
                                          "encarregado_lgpd": "Chefe de Gabinete"}, admin)
        cid = []
        for i in range(40):
            mun = rng.choice(MUNICIPIOS_AC[:8] + ["Rio Branco"] * 6 + ["Cruzeiro do Sul"] * 3)
            nasc = hoje - timedelta(days=rng.randint(18 * 365, 75 * 365))
            if i < 3:  # aniversariantes de hoje
                nasc = nasc.replace(month=hoje.month, day=min(hoje.day, 28))
            cid.append(c("cidadaos", nome=f"{rng.choice(NOMES)} {rng.choice(SOBRENOMES)} {rng.choice(SOBRENOMES)}",
                         cpf=cpf_ficticio(rng), nascimento=nasc.isoformat(),
                         telefone=f"68 9{rng.randint(8000, 9999)}{rng.randint(1000, 9999)}",
                         whatsapp=f"68 9{rng.randint(8000, 9999)}{rng.randint(1000, 9999)}",
                         municipio=mun, bairro=rng.choice(BAIRROS), uf="AC",
                         tags=rng.choice(["saúde", "educação", "produtor rural", "juventude", "", "igreja"]),
                         lider=rng.random() < .15, consentimento=rng.random() < .7))
        inst = [c("instituicoes", nome=n, tipo=t, municipio=m) for n, t, m in [
            ("Associação de Moradores do Bairro Exemplo", "Associação", "Rio Branco"),
            ("Cooperativa Agroextrativista Fictícia", "Cooperativa", "Xapuri"),
            ("Escola Estadual Modelo", "Escola", "Cruzeiro do Sul"),
            ("Unidade Básica de Saúde Central", "Unidade de saúde", "Sena Madureira")]]
        for n, cargo, part in [("Fulano de Tal", "Prefeito(a)", "ABC"), ("Beltrana Souza", "Secretário(a) de Estado", ""),
                               ("Ciclano Pereira", "Deputado(a) Federal", "DEF"), ("Maria Exemplo", "Vereador(a)", "ABC")]:
            c("autoridades", nome=n, cargo=cargo, partido=part or None, uf="AC",
              telefone=f"68 3{rng.randint(100, 999)}{rng.randint(1000, 9999)}",
              aniversario=(date(1970, hoje.month, min(hoje.day, 28)) if n == "Maria Exemplo" else date(1965, rng.randint(1, 12), 10)).isoformat())
        cats = ["Saúde", "Educação", "Infraestrutura", "Assistência social", "Documentação", "Produção rural"]
        dem = []
        for i in range(25):
            st = rng.choice(["Aberta", "Em andamento", "Encaminhada", "Atendida", "Atendida", "Não atendida"])
            dem.append(c("demandas", titulo=rng.choice([
                "Pedido de consulta especializada", "Reforma de ramal", "Vaga em creche", "Emissão de RG",
                "Iluminação pública na rua", "Cesta básica emergencial", "Apoio a feira do produtor"]),
                categoria=rng.choice(cats), cidadao_id=rng.choice(cid), status=st,
                municipio=rng.choice(["Rio Branco", "Cruzeiro do Sul", "Xapuri", "Tarauacá", "Feijó"]),
                prioridade=rng.choice(["Baixa", "Média", "Alta"]), responsavel_id=rng.choice([admin["id"], u2]),
                prazo=(hoje + timedelta(days=rng.randint(-20, 30))).isoformat()))
        for i in range(30):
            c("atendimentos", data=(hoje - timedelta(days=rng.randint(0, 45))).isoformat(),
              canal=rng.choice(["Presencial", "WhatsApp", "Telefone", "Visita"]), cidadao_id=rng.choice(cid),
              assunto=rng.choice(["Orientação sobre benefício", "Acompanhamento de demanda", "Convite para evento",
                                  "Pedido de apoio"]), demanda_id=rng.choice(dem + [None] * 5),
              responsavel_id=rng.choice([admin["id"], u2]))
        for i, (obj, mun, val) in enumerate([
                ("Aquisição de ambulância", "Sena Madureira", 35000000), ("Reforma de escola", "Cruzeiro do Sul", 25000000),
                ("Kit de equipamentos agrícolas", "Xapuri", 18000000), ("Custeio da atenção básica", "Rio Branco", 40000000),
                ("Apoio a evento cultural", "Tarauacá", 6000000), ("Pavimentação de ramal", "Feijó", 50000000)]):
            eid = c("emendas", numero=f"{hoje.year}-{i + 1:03d}", ano=hoje.year, orgao=rng.choice(["SESACRE", "SEE", "SEAGRI", "SEINFRA"]),
                    objeto=obj, municipio=mun, uf="AC", valor=val, instituicao_id=rng.choice(inst),
                    status=rng.choice(["Cadastrada", "Empenhada", "Empenhada"]), valor_empenhado=val if i < 4 else None,
                    responsavel_id=admin["id"])
            if i < 3:
                c("pagamentos", emenda_id=eid, data=(hoje - timedelta(days=20)).isoformat(), valor=val // 2,
                  documento=f"OB-{rng.randint(1000, 9999)}")
            if i == 0:
                c("pagamentos", emenda_id=eid, data=(hoje - timedelta(days=3)).isoformat(), valor=val - val // 2,
                  documento=f"OB-{rng.randint(1000, 9999)}")
        for d, t, tipo in [(0, "Sessão ordinária", "Sessão plenária"), (0, "Reunião com associação", "Reunião"),
                           (2, "Audiência pública sobre saúde", "Audiência pública"),
                           (4, "Visita a Xapuri", "Visita a município")]:
            dia = hoje + timedelta(days=d)
            c("agenda", titulo=t, tipo=tipo, inicio=f"{dia}T{rng.choice(['09', '14', '16'])}:00",
              local="Plenário" if tipo == "Sessão plenária" else "A definir",
              municipio="Xapuri" if "Xapuri" in t else "Rio Branco")
        for t, d in [("Responder ofícios pendentes", 0), ("Preparar relatório de emendas", 3),
                     ("Ligar para lideranças de Feijó", -1)]:
            c("tarefas", titulo=t, prazo=(hoje + timedelta(days=d)).isoformat(), responsavel_id=u2)
        for k in range(3):
            c("lembretes", cidadao_id=cid[k + 5], data=(hoje - timedelta(days=k)).isoformat(),
              motivo=rng.choice(["Retornar sobre consulta", "Parabenizar pela formatura", "Convidar para reunião"]))
        for rede, url in [("Instagram", "https://instagram.com/exemplo"), ("YouTube", "https://youtube.com/@exemplo")]:
            c("links", rede=rede, url=url, descricao="Perfil oficial (exemplo)")
    db.close()
    return ("Demonstração carregada. Usuário extra: assessora@gabinete.local / troque-esta-senha "
            "(dados 100% fictícios).")
