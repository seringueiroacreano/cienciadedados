"""CNIEP: inspeções mensais em estabelecimentos penais (API de dados abertos do CNJ/Geopresídios).

Fórmula do Anexo IV, item 6 (Portaria PRESI nº 1.961/2026):
    {[(IPr + IFPr/2) × DiasRef] ÷ (12 × DiasEstab)} × 30
    IPr  = inspeções realizadas no prazo; IFPr = inspeções fora do prazo (valem metade).
    Falta de inspeção em qualquer mês de qualquer estabelecimento zera o componente.
    Arredondado ao inteiro; limite 30.

Aqui todos os estabelecimentos estão ativos o período inteiro (DiasEstab = DiasRef), então a
fórmula vira (IPr + IFPr/2) ÷ (meses × estabelecimentos) × 30. O divisor de meses é configurável:
"meses_fechados" (padrão, proporcional ao que já venceu) ou 12 (leitura literal).
"""
import calendar
import datetime as dt
import re

from .rede import obter_json

MESES = {
    "janeiro": 1, "fevereiro": 2, "marco": 3, "março": 3, "abril": 4, "maio": 5, "junho": 6,
    "julho": 7, "agosto": 8, "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12,
}


def ciclo_para_mes(ciclo):
    """'Março/26' ou 'Abril/2026' -> (2026, 3). Devolve None se não reconhecer."""
    m = re.match(r"\s*([A-Za-zçÇ]+)\s*/\s*(\d{2,4})\s*$", ciclo or "")
    if not m:
        return None
    mes = MESES.get(m.group(1).lower())
    ano = int(m.group(2))
    if ano < 100:
        ano += 2000
    return (ano, mes) if mes else None


def meses_da_janela(cfg, hoje):
    """Meses da janela (ano, mês) separados em fechados e em andamento na data de hoje."""
    fechados, abertos = [], []
    for mes in range(cfg["mes_inicial"], cfg["mes_final"] + 1):
        ultimo_dia = dt.date(cfg["ano"], mes, calendar.monthrange(cfg["ano"], mes)[1])
        prazo = ultimo_dia + dt.timedelta(days=cfg["dias_tolerancia"])
        (fechados if hoje > prazo else abertos).append((cfg["ano"], mes))
    return fechados, abertos


def coletar(cfg):
    estabelecimentos = obter_json(f"{cfg['api']}/geopresidios/estabelecimentos", tempo_limite=300)
    inspecoes = obter_json(f"{cfg['api']}/geopresidios/inspecoes", tempo_limite=600)
    do_tribunal = [e for e in estabelecimentos if e.get("dsc_tribunal") == cfg["tribunal"]]
    ids = {e["seq_estabelecimento"] for e in do_tribunal}
    return {
        "estabelecimentos": do_tribunal,
        "inspecoes": [i for i in inspecoes if i.get("seq_estabelecimento") in ids],
    }


def situacao_mensal(inspecoes):
    """{(estab, (ano, mes)): 'P' no prazo | 'F' fora do prazo}. Ignora excluídas e não submetidas."""
    situacao = {}
    for i in inspecoes:
        if i.get("excluida") or not i.get("status_submissao"):
            continue
        mes = ciclo_para_mes(i.get("ciclo"))
        if not mes:
            continue
        chave = (i["seq_estabelecimento"], mes)
        marca = "F" if i.get("fora_do_prazo") else "P"
        if situacao.get(chave) != "P":  # se houver duas no mês, vale a melhor
            situacao[chave] = marca
    return situacao


def pontuar_grupo(estabs, situacao, fechados, divisor, maximo):
    """Pontos de um grupo de estabelecimentos. Devolve (pontos, ipr, ifpr, faltas)."""
    ipr = ifpr = 0
    faltas = []
    for e in estabs:
        for mes in fechados:
            marca = situacao.get((e, mes))
            if marca == "P":
                ipr += 1
            elif marca == "F":
                ifpr += 1
            else:
                faltas.append((e, mes))
    if not estabs or not fechados:
        return None, ipr, ifpr, faltas
    if faltas:
        return 0, ipr, ifpr, faltas
    meses = len(fechados) if divisor == "meses_fechados" else int(divisor)
    bruto = (ipr + ifpr / 2) / (meses * len(estabs)) * maximo
    return min(maximo, int(bruto + 0.5)), ipr, ifpr, faltas


def calcular(cfg, brutos, hoje):
    fechados, abertos = meses_da_janela(cfg, hoje)
    situacao = situacao_mensal(brutos["inspecoes"])
    nomes = {e["seq_estabelecimento"]: e["dsc_identificacao"] for e in brutos["estabelecimentos"]}
    pontos, memoria, alertas = {}, [], []

    mapeados = {e for lista in cfg["estabelecimentos"].values() for e in lista}
    for e, nome in nomes.items():
        if e not in mapeados and e not in cfg["fora_do_calculo"]:
            alertas.append(f"CNIEP: estabelecimento novo no AC sem vara em config.json: {e} - {nome}")
    for e in mapeados - set(nomes):
        alertas.append(f"CNIEP: estabelecimento {e} de config.json não veio da API (inativado?)")

    for mpm, estabs in cfg["estabelecimentos"].items():
        pts, ipr, ifpr, faltas = pontuar_grupo(
            estabs, situacao, fechados, cfg["divisor"], cfg["pontos_maximos"]
        )
        pontos[int(mpm)] = pts if pts is not None else "-"
        for e in estabs:
            linha = {"Código MPM": int(mpm), "seq_estabelecimento": e, "Estabelecimento": nomes.get(e, "?")}
            for ano, mes in fechados + abertos:
                marca = situacao.get((e, (ano, mes)))
                aberto = (ano, mes) in abertos
                linha[f"{ano}-{mes:02d}"] = marca or ("em andamento" if aberto else "FALTA")
            linha.update({"IPr (vara)": ipr, "IFPr (vara)": ifpr, "Pontos (vara)": pts})
            memoria.append(linha)
        for e, (ano, mes) in faltas:
            alertas.append(
                f"CNIEP: sem inspeção em {mes:02d}/{ano} no estabelecimento {e} ({nomes.get(e, '?')}); "
                f"zera a vara {mpm}."
            )

    todos = sorted(mapeados)
    pts_uf, ipr, ifpr, faltas = pontuar_grupo(
        todos, situacao, fechados, cfg["divisor"], cfg["pontos_maximos"]
    )
    meses = len(fechados) if cfg["divisor"] == "meses_fechados" else int(cfg["divisor"])
    bruto_uf = (ipr + ifpr / 2) / (meses * len(todos)) * cfg["pontos_maximos"] if fechados else None
    estadual = {
        "pontos": pts_uf, "bruto": bruto_uf, "ipr": ipr, "ifpr": ifpr, "lacunas": len(faltas),
        "estabelecimentos": len(todos), "meses_fechados": len(fechados), "meses_abertos": len(abertos),
    }
    return pontos, memoria, estadual, alertas
