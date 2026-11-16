"""Carga diária: lê as bases já baixadas, aplica as regras e grava no banco.

    python -m motor.carga PASTA_COM_CSV            # grava no banco
    python -m motor.carga PASTA_COM_CSV --sem-banco # só mostra o resumo

A pasta é a que `python -m motor.fontes PASTA` preenche (um download por meta).
"""
from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from . import fontes, regras

ACRE = ZoneInfo("America/Rio_Branco")
SEM_UNIDADE = "(unidade não informada na base)"
SERIE_DESDE = 202101


def data_ou_nada(texto: str):
    return texto if len(texto) == 10 and texto[4] == "-" else None


def preparar(meta: int, linhas: list[dict], publicada_em: str) -> dict:
    """Linhas prontas para cada tabela, ainda com o nome da unidade no lugar do id."""
    data_base = datetime.fromisoformat(publicada_em).astimezone(ACRE).date().isoformat()
    for l in linhas:
        if not l.get(regras.UNIDADE):
            l[regras.UNIDADE] = SEM_UNIDADE
    res = regras.processar(meta, linhas)
    unidades = {}
    for l in linhas:
        unidades.setdefault(l[regras.UNIDADE], l.get(regras.MUNICIPIO, ""))
    indicadores = [{
        "data_base": data_base, "meta": meta, "unidade": r["unidade"], "recorte": r["recorte"],
        "percentual_exigido": r["pct"] * 100 if r["pct"] else None,
        "distribuidos": r["distribuidos"], "suspensos": r["suspensos"], "fora_computo": r["fora_computo"],
        "julgados": r["julgados"], "a_julgar": r["a_julgar"],
        "cumprimento": round(r["cumprimento"], 4) if r["cumprimento"] is not None else None,
        "faltam": r["faltam"], "detalhes": r["detalhes"]} for r in res["indicadores"]]
    fila, vistos = [], set()
    for i in res["fila"]:
        chave = (i["recorte"], i["id_processo"])
        if chave in vistos:      # na Meta 5 a chave é o número; evita repetir o mesmo processo
            continue
        vistos.add(chave)
        fila.append({
            "meta": meta, "recorte": i["recorte"], "id_processo": i["id_processo"], "unidade": i["unidade"],
            "processo": i["processo"], "situacao": i["situacao"], "origem": i["origem"],
            "distribuido_em": data_ou_nada(i["distribuido_em"]), "evento_em": data_ou_nada(i["evento_em"]),
            "grau": i["grau"], "classe": i["classe"], "natureza": i["natureza"], "sistema": i["sistema"],
            "data_base": data_base})
    serie = [dict(s, meta=meta) for s in res["serie"] if s["anomes"] >= SERIE_DESDE]
    return {"data_base": data_base, "unidades": unidades, "indicadores": indicadores, "fila": fila, "serie": serie,
            "carga": {"meta": meta, "base_publicada_em": publicada_em, "linhas": len(linhas), "situacao": "ok"}}


def gravar(banco, p: dict) -> None:
    ids = banco.ids_das_unidades(p["unidades"])
    troca = lambda linhas: [dict({k: v for k, v in l.items() if k != "unidade"}, unidade_id=ids[l["unidade"]]) for l in linhas]
    meta = p["carga"]["meta"]
    banco.gravar("indicadores_diarios", troca(p["indicadores"]), "data_base,meta,unidade_id,recorte")
    banco.gravar("serie_mensal", troca(p["serie"]), "meta,unidade_id,variavel,anomes")
    banco.apagar("fila_trabalho", f"meta=eq.{meta}")
    banco.gravar("fila_trabalho", troca(p["fila"]), "meta,recorte,id_processo")
    banco.gravar("cargas", [p["carga"]], "meta,base_publicada_em")   # por último: marca a carga como completa


def preparar_previsao(pasta: Path) -> tuple[list[dict], dict]:
    """Previsão da Meta 1: linhas para a tabela `previsoes` (com o nome da unidade) e o resultado completo."""
    from . import previsao
    linhas1, publicada_em = fontes.ler(1, pasta)
    for l in linhas1:
        if not l.get(regras.UNIDADE):
            l[regras.UNIDADE] = SEM_UNIDADE
    try:
        linhas3 = fontes.ler(3, pasta)[0]
    except FileNotFoundError:
        linhas3 = None
    data_base = datetime.fromisoformat(publicada_em).astimezone(ACRE).date()
    _, indicadores = regras.classificar_meta1(linhas1)
    r = previsao.prever_meta1(linhas1, indicadores, data_base, linhas3)
    modelo = f"julgados: {r['metodo_julgados']}; casos novos: {r['metodo_novos']}"
    anomes = r["fim"].year * 100 + r["fim"].month
    saida = []
    for p in [r["tribunal"]] + r["unidades"]:
        comum = {"data_base": data_base.isoformat(), "meta": 1, "unidade": p["unidade"], "recorte": "Julgar mais do que os distribuídos",
                 "anomes": anomes, "modelo": modelo, "erro_backtest": p["margem_pp"]}
        if p["cumprimento"] is not None:
            saida.append(dict(comum, variavel="cumprimento_projetado", valor=round(p["cumprimento"], 4),
                              limite_inferior=round(p["cumprimento_min"], 4), limite_superior=round(p["cumprimento_max"], 4)))
        for variavel in ("julgados_fim", "casos_novos_fim", "ritmo_atual_semana", "ritmo_necessario_semana"):
            saida.append(dict(comum, variavel=variavel, valor=round(p[variavel], 2), limite_inferior=None, limite_superior=None))
    return saida, r


def gravar_previsao(banco, linhas: list[dict]) -> None:
    ids = {u["nome"]: u["id"] for u in banco.ler("unidades", "select=id,nome")}
    prontas = [dict({k: v for k, v in l.items() if k != "unidade"}, unidade_id=ids.get(l["unidade"]) if l["unidade"] else None)
               for l in linhas]
    banco.apagar("previsoes", f"meta=eq.1&data_base=eq.{linhas[0]['data_base']}")
    banco.inserir("previsoes", prontas)


def main() -> None:
    pasta, sem_banco = Path(sys.argv[1]), "--sem-banco" in sys.argv
    banco = None
    if not sem_banco:
        from .banco import Banco
        banco = Banco()
    falhas = 0
    for meta in fontes.METAS:
        try:
            linhas, publicada_em = fontes.ler(meta, pasta)
            p = preparar(meta, linhas, publicada_em)
            if banco:
                gravar(banco, p)
            print(f"meta {meta}: base de {p['data_base']}, {len(linhas)} linhas, {len(p['indicadores'])} indicadores, "
                  f"{len(p['fila'])} na fila, {len(p['serie'])} pontos de série" + (" (não gravado)" if sem_banco else ""))
        except Exception as e:  # uma meta com problema não derruba as outras
            falhas += 1
            print(f"meta {meta}: FALHOU: {e}")
    try:
        linhas_prev, r = preparar_previsao(pasta)
        if banco:
            gravar_previsao(banco, linhas_prev)
        t = r["tribunal"]
        print(f"previsão da Meta 1 até {r['fim']}: tribunal em {t['cumprimento']:.2f}% ± {t['margem_pp']:.2f} p.p. ({t['situacao']}); "
              f"{len(r['unidades'])} unidades; métodos: julgados {r['metodo_julgados']}, casos novos {r['metodo_novos']}"
              + (" (não gravado)" if sem_banco else ""))
    except Exception as e:
        falhas += 1
        print(f"previsão da Meta 1: FALHOU: {e}")
    sys.exit(1 if falhas else 0)


if __name__ == "__main__":
    main()
