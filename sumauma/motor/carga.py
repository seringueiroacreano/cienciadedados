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
    sys.exit(1 if falhas else 0)


if __name__ == "__main__":
    main()
