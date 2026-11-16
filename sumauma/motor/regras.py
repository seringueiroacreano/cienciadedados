"""Regras das Metas Nacionais 2026 (Glossário CNJ, Justiça Estadual, versão 3).

Entrada: linhas da base exportada pelo painel do TJAC (dicionários com as colunas
do CSV). Saída: processos classificados e indicadores por unidade e recorte.
Tudo aqui é função pura, sem rede nem banco, para poder ser testado.
"""
from __future__ import annotations

import math
import unicodedata
from collections import defaultdict

UNIDADE, MUNICIPIO, VAR, DATA, GRAU = "nome_orgao_julgador", "nome_municipio", "var", "dt_evento", "grau"

# Metas com lista fechada de distribuídos: recorte -> (nome, fração exigida)
RECORTES = {
    4: {"a": ("Crimes contra a administração pública", 0.65), "b": ("Improbidade administrativa", 1.0)},
    6: {"": ("Ações ambientais", 0.5)},
    7: {"a": ("Comunidades indígenas", 0.5), "b": ("Comunidades quilombolas", 0.5), "c": ("Racismo e injúria racial", 0.5)},
    8: {"a": ("Violência doméstica", 0.9), "b": ("Feminicídio", 0.75)},
    10: {"a": ("1º grau", 0.9), "b": ("2º grau", 0.99)},
}
METAS_COM_LISTA = (2, 4, 6, 7, 8, 10)


def norm(texto) -> str:
    sem_acento = unicodedata.normalize("NFKD", str(texto)).encode("ascii", "ignore").decode()
    return " ".join(sem_acento.lower().split())


def chave_processo(linha: dict) -> str:
    return linha.get("id_processo") or linha.get("numero") or ""


def tipo_var(valor: str) -> str | None:
    t = norm(valor)
    for prefixo, tipo in (("distribuid", "dis"), ("julgad", "jul"), ("suspens", "sus"), ("dessobrest", "des")):
        if t.startswith(prefixo):
            return tipo
    return None


def recorte_de(meta: int, var: str, grau: str) -> tuple[str, float] | None:
    if meta == 2:
        if "antigos" in norm(var):
            return ("Antigos (15 anos ou mais)", 1.0)
        return {"G1": ("1º grau", 0.8), "G2": ("2º grau", 0.9)}.get(grau, ("Juizados e Turmas Recursais", 0.95))
    tabela = RECORTES.get(meta)
    if not tabela:
        return None
    partes = var.rsplit("_", 1)
    sufixo = partes[1].lower() if len(partes) == 2 and len(partes[1]) == 1 else ""
    return tabela.get(sufixo)


def _item(situacao, recorte, pct, ref, entrada, evento, origem=None) -> dict:
    return {
        "situacao": situacao, "recorte": recorte, "pct": pct, "origem": origem,
        "unidade": ref.get(UNIDADE, ""), "municipio": ref.get(MUNICIPIO, ""),
        "id_processo": chave_processo(ref), "processo": ref.get("numero", ""),
        "grau": ref.get(GRAU, ""), "classe": ref.get("classe", ""), "natureza": ref.get("nome_natureza", ""),
        "sistema": ref.get("sistema", ""),
        "distribuido_em": (entrada or {}).get(DATA, "")[:10], "evento_em": (evento or {}).get(DATA, "")[:10],
    }


def fechar(distribuidos: int, suspensos: int, fora: int, julgados: int, pct: float) -> tuple[float | None, int]:
    """Cumprimento (%) e quantos julgamentos faltam para atingir a fração exigida."""
    base = distribuidos - suspensos - fora
    if base <= 0:
        return None, 0
    return julgados / base / pct * 100, max(0, math.ceil(pct * base - 1e-9) - julgados)


def classificar(meta: int, linhas) -> list[dict]:
    """Metas 2, 4, 6, 7, 8 e 10: um item por (recorte, processo) que tem linha de distribuído.

    A julgar = distribuído, não julgado, não suspenso (Glossário, Meta 2, "Aba Downloads").
    """
    grupos: dict[tuple, dict] = {}
    for l in linhas:
        tipo = tipo_var(l.get(VAR, ""))
        rec = recorte_de(meta, l.get(VAR, ""), l.get(GRAU, "")) if tipo else None
        if not rec:
            continue
        g = grupos.setdefault((rec[0], chave_processo(l)), {"rec": rec})
        g[tipo] = l
    itens = []
    for g in grupos.values():
        if "dis" not in g:
            continue
        situacao = ("Julgado" if "jul" in g else "Fora do cômputo" if "des" in g
                    else "Suspenso" if "sus" in g else "A julgar")
        itens.append(_item(situacao, g["rec"][0], g["rec"][1], g["dis"], g["dis"], g.get("jul") or g.get("des") or g.get("sus")))
    itens.sort(key=lambda i: (i["distribuido_em"] or "9", i["processo"]))
    return itens


def resumir(itens: list[dict]) -> list[dict]:
    """Indicadores por unidade e recorte, a partir dos itens de `classificar`."""
    acc: dict[tuple, dict] = {}
    for it in itens:
        r = acc.setdefault((it["unidade"], it["recorte"]), {
            "unidade": it["unidade"], "municipio": it["municipio"], "recorte": it["recorte"], "pct": it["pct"],
            "distribuidos": 0, "suspensos": 0, "fora_computo": 0, "julgados": 0, "a_julgar": 0, "detalhes": {}})
        r["distribuidos"] += 1
        campo = {"Julgado": "julgados", "Suspenso": "suspensos", "Fora do cômputo": "fora_computo"}.get(it["situacao"], "a_julgar")
        r[campo] += 1
    for r in acc.values():
        r["cumprimento"], r["faltam"] = fechar(r["distribuidos"], r["suspensos"], r["fora_computo"], r["julgados"], r["pct"])
    return sorted(acc.values(), key=lambda r: (r["unidade"], r["recorte"]))


def classificar_meta1(linhas) -> tuple[list[dict], list[dict]]:
    """Meta 1: cumprimento = julgados ÷ (casos novos + dessobrestados − suspensos).

    Suspenso = Pendente (88) aberto com Pendente líquido (25) fechado: sai do denominador.
    Dessobrestado = reabriu a situação 25: volta a ser cobrado. "Pendentes", na base do
    TJAC, é o acervo anterior ao ano ainda sem julgamento; julgá-lo conta como julgado.
    Devolve (itens, resumo por unidade).
    """
    procs: dict[str, dict] = {}
    for l in linhas:
        t = norm(l.get(VAR, ""))
        tipo = ("cn" if t.startswith("casos novos") else "jul" if t.startswith("julgad") else "sus" if t.startswith("suspens")
                else "des" if t.startswith("dessobrest") else "pend" if t.startswith("pendente") else None)
        if tipo:
            procs.setdefault(chave_processo(l), {}).setdefault(tipo, l)
    nome = "Julgar mais do que os distribuídos"
    itens, por_unidade = [], {}
    for g in procs.values():
        ref = g.get("cn") or g.get("pend") or g.get("jul") or g.get("sus") or g.get("des")
        entrada = g.get("cn") or g.get("pend")
        retomado = "des" in g and ("sus" not in g or g["des"].get(DATA, "") >= g["sus"].get(DATA, ""))
        if "jul" in g:
            situacao = "Julgado"
        elif "sus" in g and not retomado:
            situacao = "Suspenso"
        elif entrada or "des" in g:
            situacao = "A julgar"
        else:
            continue
        origem = "Caso novo do ano" if "cn" in g else "Acervo anterior"
        itens.append(_item(situacao, nome, 1.0, ref, entrada, g.get("jul") or g.get("sus"), origem))
        r = por_unidade.setdefault(ref.get(UNIDADE, ""), {
            "unidade": ref.get(UNIDADE, ""), "municipio": ref.get(MUNICIPIO, ""), "recorte": nome, "pct": 1.0,
            "distribuidos": 0, "suspensos": 0, "fora_computo": 0, "julgados": 0, "a_julgar": 0,
            "detalhes": {"dessobrestados": 0, "a_julgar_casos_novos": 0, "a_julgar_acervo": 0}})
        r["distribuidos"] += "cn" in g
        r["suspensos"] += "sus" in g          # como no painel: conta também os já julgados
        r["julgados"] += "jul" in g
        r["detalhes"]["dessobrestados"] += "des" in g
        if situacao == "A julgar":
            r["a_julgar"] += 1
            r["detalhes"]["a_julgar_casos_novos" if "cn" in g else "a_julgar_acervo"] += 1
    for r in por_unidade.values():
        base = r["distribuidos"] + r["detalhes"]["dessobrestados"] - r["suspensos"]
        r["cumprimento"] = r["julgados"] / base * 100 if base > 0 else None
        r["faltam"] = max(0, base - r["julgados"]) if base > 0 else 0
    itens.sort(key=lambda i: (i["distribuido_em"] or "9", i["processo"]))
    return itens, sorted(por_unidade.values(), key=lambda r: r["unidade"])


def indice_meta3(linhas) -> list[dict]:
    """Meta 3: IC = sentenças homologatórias (inclusive pré-processuais) ÷ sentenças.

    Cumprimento = IC do ano ÷ (IC do ano anterior + 0,01); com IC ≥ 18%, cumpre.
    O ano é o da data do evento.
    """
    ano_atual = max((int(l[DATA][:4]) for l in linhas if l.get(DATA, "")[:4].isdigit()), default=0)
    cont: dict[tuple, set] = defaultdict(set)
    municipios = {}
    for l in linhas:
        ano = l.get(DATA, "")[:4]
        if ano not in (str(ano_atual), str(ano_atual - 1)):
            continue
        t = norm(l.get(VAR, ""))
        tipo = "sent" if t.startswith("sentencas") else "pre" if "pre-processual" in t else "hom" if t.startswith("homologatoria") else None
        if tipo:
            cont[(l.get(UNIDADE, ""), tipo, int(ano))].add(chave_processo(l))
            municipios.setdefault(l.get(UNIDADE, ""), l.get(MUNICIPIO, ""))
    saida = []
    for u in sorted(municipios):
        n = lambda tipo, ano: len(cont.get((u, tipo, ano), ()))
        sent, acordos = n("sent", ano_atual), n("hom", ano_atual) + n("pre", ano_atual)
        sent_ant, acordos_ant = n("sent", ano_atual - 1), n("hom", ano_atual - 1) + n("pre", ano_atual - 1)
        ic = acordos / sent if sent else None
        ic_ant = acordos_ant / sent_ant if sent_ant else None
        bruto = ic / (ic_ant + 0.01) * 100 if ic is not None and ic_ant is not None else None
        barreira = ic is not None and ic >= 0.18
        alvo = 0.18 if ic_ant is None else min(ic_ant + 0.01, 0.18)
        saida.append({
            "unidade": u, "municipio": municipios[u], "recorte": "Índice de conciliação", "pct": None,
            "distribuidos": sent, "suspensos": 0, "fora_computo": 0, "julgados": acordos, "a_julgar": 0,
            "cumprimento": 100.0 if barreira and (bruto is None or bruto < 100) else bruto,
            "faltam": max(0, math.ceil(alvo * sent - 1e-9) - acordos) if sent else 0,
            "detalhes": {"ano": ano_atual, "indice": ic, "indice_ano_anterior": ic_ant, "sentencas": sent, "acordos": acordos,
                         "pre_processuais": n("pre", ano_atual), "sentencas_ano_anterior": sent_ant,
                         "acordos_ano_anterior": acordos_ant, "clausula_barreira": barreira}})
    return saida


def indice_meta5(linhas) -> tuple[list[dict], list[dict]]:
    """Meta 5: TCLC = pendentes líquidos ÷ (pendentes líquidos + baixados no ano).

    Cumprimento = (TCLC do ano anterior − 0,005) ÷ TCLC do ano; com TCLC ≤ 52%, cumpre.
    Devolve (indicadores por unidade, acervo pendente do último mês).
    """
    meses_cp = sorted({l[DATA] for l in linhas if norm(l.get(VAR, "")).startswith("cplc")})
    ano_atual = max((int(l[DATA][:4]) for l in linhas if l.get(DATA, "")[:4].isdigit()), default=0)
    mes_atual = next((m for m in reversed(meses_cp) if m[:4] == str(ano_atual)), None)
    mes_ant = next((m for m in reversed(meses_cp) if m[:4] == str(ano_atual - 1)), None)
    cont: dict[tuple, set] = defaultdict(set)
    municipios, acervo = {}, []
    for l in linhas:
        mes, t, u = l.get(DATA, ""), norm(l.get(VAR, "")), l.get(UNIDADE, "")
        if t.startswith("cplc"):
            if mes == mes_atual:
                cont[(u, "cp")].add(l.get("numero", ""))
                acervo.append(l)
            elif mes == mes_ant:
                cont[(u, "cp_ant")].add(l.get("numero", ""))
            else:
                continue
        elif t.startswith("tbaix") and mes[:4] in (str(ano_atual), str(ano_atual - 1)):
            cont[(u, "tb" if mes[:4] == str(ano_atual) else "tb_ant")].add(l.get("numero", "") + mes)
        else:
            continue
        municipios.setdefault(u, l.get(MUNICIPIO, ""))
    saida = []
    for u in sorted(municipios):
        cp, tb = len(cont.get((u, "cp"), ())), len(cont.get((u, "tb"), ()))
        cp_ant, tb_ant = len(cont.get((u, "cp_ant"), ())), len(cont.get((u, "tb_ant"), ()))
        taxa = cp / (cp + tb) if cp + tb else None
        taxa_ant = cp_ant / (cp_ant + tb_ant) if cp_ant + tb_ant else None
        bruto = None
        if taxa is not None and taxa_ant is not None:
            bruto = (taxa_ant - 0.005) / taxa * 100 if taxa > 0 else 100.0
        barreira = taxa is not None and taxa <= 0.52
        alvo = 0.52 if taxa_ant is None else max(taxa_ant - 0.005, 0.52)
        saida.append({
            "unidade": u, "municipio": municipios[u], "recorte": "Taxa de congestionamento líquida", "pct": None,
            "distribuidos": 0, "suspensos": 0, "fora_computo": 0, "julgados": tb, "a_julgar": cp,
            "cumprimento": 100.0 if barreira and (bruto is None or bruto < 100) else bruto,
            "faltam": max(0, math.ceil(cp - alvo * (cp + tb) - 1e-9)) if taxa is not None else 0,
            "detalhes": {"ano": ano_atual, "taxa": taxa, "taxa_ano_anterior": taxa_ant, "pendentes_liquidos": cp, "baixados": tb,
                         "mes_pendentes": mes_atual, "pendentes_ano_anterior": cp_ant, "baixados_ano_anterior": tb_ant,
                         "mes_pendentes_ano_anterior": mes_ant, "clausula_barreira": barreira}})
    itens = [dict(_item("Pendente", "Taxa de congestionamento líquida", None, l, None, None),
                  origem=(l.get("numero", "")[11:15] if len(l.get("numero", "")) > 15 else None)) for l in acervo]
    itens.sort(key=lambda i: (i["origem"] or "9", i["processo"]))
    return saida, itens


def serie_mensal(linhas) -> list[dict]:
    """Processos distintos por unidade, variável e mês do evento (AAAAMM)."""
    cont: dict[tuple, set] = defaultdict(set)
    for l in linhas:
        d = l.get(DATA, "")
        anomes = d[:4] + d[5:7] if len(d) >= 7 and d[4] == "-" else d[:6]
        if anomes.isdigit() and len(anomes) == 6:
            cont[(l.get(UNIDADE, ""), l.get(VAR, ""), int(anomes))].add(chave_processo(l))
    return [{"unidade": u, "variavel": v, "anomes": a, "quantidade": len(ids)} for (u, v, a), ids in sorted(cont.items())]


def processar(meta: int, linhas) -> dict:
    """Aplica a regra da meta e devolve indicadores, fila de trabalho e série mensal."""
    if meta == 1:
        itens, indicadores = classificar_meta1(linhas)
    elif meta in METAS_COM_LISTA:
        itens = classificar(meta, linhas)
        indicadores = resumir(itens)
    elif meta == 3:
        itens, indicadores = [], indice_meta3(linhas)
    elif meta == 5:
        indicadores, itens = indice_meta5(linhas)
    else:
        raise ValueError(f"Meta {meta} sem regra implementada")
    fila = [i for i in itens if i["situacao"] in ("A julgar", "Suspenso", "Pendente")]
    return {"indicadores": indicadores, "fila": fila, "itens": itens, "serie": serie_mensal(linhas)}
