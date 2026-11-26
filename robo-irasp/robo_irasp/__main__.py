"""Executa o robô: python -m robo_irasp PASTA_DE_SAIDA [--config config.json]

Gera, em PASTA_DE_SAIDA, os CSV que o painel Power BI lê (mesmos cabeçalhos das tabelas da
planilha) e a memória de cálculo:
  apuracoes.csv   pontuacao.csv   situacao.csv   sintese.csv
  memoria_sna.csv memoria_cniep.csv status.json
"""
import argparse
import csv
import datetime as dt
import json
import os
import sys
from zoneinfo import ZoneInfo

from . import cniep, sna

ACRE = ZoneInfo("America/Rio_Branco")
COMPONENTES_SNA = ["SNA a", "SNA b.1", "SNA b.2", "SNA c"]
COMPONENTES = COMPONENTES_SNA + ["CNIEP"]


def gravar_csv(caminho, linhas, cabecalho):
    with open(caminho, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cabecalho, extrasaction="ignore")
        w.writeheader()
        for linha in linhas:
            w.writerow({k: ("" if v is None else v) for k, v in linha.items()})


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("saida")
    p.add_argument("--config", default=os.path.join(os.path.dirname(__file__), "..", "config.json"))
    p.add_argument("--hoje", help="data de referência AAAA-MM-DD (para testes)")
    args = p.parse_args(argv)

    with open(args.config, encoding="utf-8") as f:
        cfg = json.load(f)
    agora = dt.datetime.now(ACRE)
    hoje = dt.date.fromisoformat(args.hoje) if args.hoje else agora.date()
    os.makedirs(args.saida, exist_ok=True)
    ap = cfg["apuracao"]
    codigo = ap["codigo"]
    erros, alertas = [], []

    # ---- SNA ----
    try:
        brutos_sna = sna.coletar(cfg["sna"])
        pts_sna, mem_sna, uf_sna, al = sna.calcular(cfg["sna"], brutos_sna)
        alertas += al
    except Exception as erro:  # segue com o CNIEP; o painel mantém o que já tinha
        erros.append(f"SNA: {erro}")
        pts_sna, mem_sna, uf_sna = {}, [], {}

    # ---- CNIEP ----
    try:
        brutos_cniep = cniep.coletar(cfg["cniep"])
        pts_cniep, mem_cniep, uf_cniep, al = cniep.calcular(cfg["cniep"], brutos_cniep, hoje)
        alertas += al
    except Exception as erro:
        erros.append(f"CNIEP: {erro}")
        pts_cniep, mem_cniep, uf_cniep = {}, [], {}

    if erros and not (pts_sna or pts_cniep):
        print("\n".join(erros), file=sys.stderr)
        return 1  # nada coletado: não publica, o painel fica com a última carga boa

    # ---- Pontuação (uma linha por unidade, componentes automáticos) ----
    unidades = sorted(set(pts_sna) | set(pts_cniep))
    pontuacao = []
    for mpm in unidades:
        linha = {"Apuração": codigo, "Código MPM": mpm}
        for c in COMPONENTES_SNA:
            linha[c] = pts_sna.get(mpm, {}).get(c, "-") if pts_sna else ""
        linha["CNIEP"] = pts_cniep.get(mpm, "-") if pts_cniep else ""
        pontuacao.append(linha)
    automaticos = (COMPONENTES_SNA if pts_sna else []) + (["CNIEP"] if pts_cniep else [])

    # ---- Situação: observações por unidade ----
    situacao = []
    for m in mem_sna:
        situacao.append({
            "Apuração": codigo, "Código MPM": m["Código MPM"], "Componente": m["Componente"],
            "Situação": "Apurado",
            "Observação": f"Robô: {m['Percentual']:.2f}% ({m['Quantidade']} registros, {m['Pendências']} pendências) "
                          f"no painel SNA da COGER, atualizado em {m['Fonte atualizada em']}.",
        })
    vistos = set()
    for m in mem_cniep:
        if m["Código MPM"] in vistos:
            continue
        vistos.add(m["Código MPM"])
        situacao.append({
            "Apuração": codigo, "Código MPM": m["Código MPM"], "Componente": "CNIEP",
            "Situação": "Apurado",
            "Observação": f"Robô: {m['IPr (vara)']} inspeções no prazo e {m['IFPr (vara)']} fora do prazo "
                          f"(API CNIEP/CNJ, consulta {agora:%d/%m/%Y %H:%M}). Pontos = {m['Pontos (vara)']}.",
        })

    # ---- Síntese estadual ----
    sintese = []
    for c in COMPONENTES_SNA:
        if c in uf_sna:
            u = uf_sna[c]
            sintese.append({
                "Apuração": codigo, "Componente": c, "Pontos de referência": u["pontos"],
                "Valor bruto": round(float(u["percentual"]), 4), "Situação": "Apurado",
                "Base / fonte": f"Média TJAC no painel SNA da COGER: {u['total']} registros, "
                                f"{u['pendencias']} pendências; fonte atualizada em {u['atualizado_em']}",
            })
    if uf_cniep:
        sintese.append({
            "Apuração": codigo, "Componente": "CNIEP", "Pontos de referência": uf_cniep["pontos"],
            "Valor bruto": None if uf_cniep["bruto"] is None else round(uf_cniep["bruto"], 4),
            "Situação": "Apurado",
            "Base / fonte": f"API CNIEP/CNJ: {uf_cniep['ipr']} IPr + {uf_cniep['ifpr']} IFPr; "
                            f"{uf_cniep['estabelecimentos']} estabelecimentos; {uf_cniep['meses_fechados']} meses "
                            f"encerrados e {uf_cniep['meses_abertos']} em andamento; {uf_cniep['lacunas']} lacunas",
        })

    apuracoes = [{
        "Apuração": codigo, "Data de referência": hoje.isoformat(), "Descrição": ap["descricao"],
        "Tipo": ap["tipo"],
        "Observação": f"Gerada pelo robô em {agora:%d/%m/%Y %H:%M} (horário do Acre). Retrato do dia das fontes, "
                      f"não o fechamento oficial. Componentes automáticos: {', '.join(automaticos)}.",
        "Apuração base": ap["apuracao_base"], "Componentes automáticos": ";".join(automaticos),
    }]

    gravar_csv(os.path.join(args.saida, "apuracoes.csv"), apuracoes, list(apuracoes[0]))
    gravar_csv(os.path.join(args.saida, "pontuacao.csv"), pontuacao, ["Apuração", "Código MPM"] + COMPONENTES)
    gravar_csv(os.path.join(args.saida, "situacao.csv"), situacao,
               ["Apuração", "Código MPM", "Componente", "Situação", "Observação"])
    gravar_csv(os.path.join(args.saida, "sintese.csv"), sintese,
               ["Apuração", "Componente", "Pontos de referência", "Valor bruto", "Situação", "Base / fonte"])
    gravar_csv(os.path.join(args.saida, "memoria_sna.csv"), mem_sna,
               ["Código MPM", "Componente", "Unidade na fonte", "Percentual", "Quantidade", "Pendências",
                "Pontos", "Fonte atualizada em"])
    if mem_cniep:
        gravar_csv(os.path.join(args.saida, "memoria_cniep.csv"), mem_cniep, list(mem_cniep[0]))

    status = {"executado_em": agora.isoformat(), "data_referencia": hoje.isoformat(),
              "componentes_automaticos": automaticos, "erros": erros, "alertas": alertas}
    with open(os.path.join(args.saida, "status.json"), "w", encoding="utf-8") as f:
        json.dump(status, f, ensure_ascii=False, indent=2)

    for a in alertas:
        print(f"::warning::{a}")
    for e in erros:
        print(f"::error::{e}")
    print(f"Robô IRASP: {len(pontuacao)} unidades; componentes {', '.join(automaticos)}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
