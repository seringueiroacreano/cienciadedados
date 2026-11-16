"""Confere as regras em Python contra os números validados na base de 11/11/2026.

    python sumauma/testes/conferir_gabarito.py PASTA_COM_dados/

PASTA é uma cópia gerada por rpa-metas-cnj/web/gerar_copia.py naquela data. Fora dessa
data os totais mudam; aí o script só serve para ver os números, não para conferir.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from motor import regras  # noqa: E402

CZS = "1ª Vara Cível de Cruzeiro do Sul"
GABARITO = {  # (meta, escopo, recorte): (distribuídos, suspensos, julgados, a julgar, cumprimento, faltam)
    (1, CZS, "Julgar mais do que os distribuídos"): (1194, 13, 935, 1344, 79.17, 246),
    (1, "TJAC", "Julgar mais do que os distribuídos"): (62599, 1501, 63338, 34016, 103.67, 0),
    (2, CZS, "1º grau"): (935, 6, 841, 88, 113.16, 0),
    (2, "TJAC", "1º grau"): (25988, 1179, 23759, 1050, 119.71, 0),
    (2, "TJAC", "2º grau"): (2953, 16, 2936, 1, 111.07, 0),
    (2, "TJAC", "Juizados e Turmas Recursais"): (7640, 281, 7344, 15, 105.05, 0),
    (2, "TJAC", "Antigos (15 anos ou mais)"): (99, 60, 35, 3, 92.11, 3),
    (4, "TJAC", "Crimes contra a administração pública"): (553, 37, 513, 3, 152.95, 0),
    (4, "TJAC", "Improbidade administrativa"): (199, 6, 191, 2, 98.96, 2),
    (6, "TJAC", "Ações ambientais"): (327, 53, 229, 45, 167.15, 0),
    (8, "TJAC", "Violência doméstica"): (1650, 509, 1104, 37, 107.51, 0),
    (8, "TJAC", "Feminicídio"): (74, 8, 62, 4, 125.25, 0),
    (10, "TJAC", "1º grau"): (8594, 90, 8487, 17, 110.89, 0),
    (10, "TJAC", "2º grau"): (400, 0, 400, 0, 101.01, 0),
}


def linhas_da_copia(pasta: Path, meta: int):
    manifesto = json.loads((pasta / "manifest.json").read_text(encoding="utf-8"))
    for parte in manifesto["metas"][str(meta)]["partes"]:
        j = json.loads((pasta.parent / parte).read_text(encoding="utf-8"))
        colunas = [c["v"] if "v" in c else [c["d"][i] for i in c["i"]] for c in j["colunas"]]
        for valores in zip(*colunas):
            yield dict(zip(j["cabecalho"], valores))


def somar(indicadores, escopo, recorte, meta):
    rs = [r for r in indicadores if r["recorte"] == recorte and (escopo == "TJAC" or r["unidade"] == escopo)]
    d, s, f, j, a = (sum(r[k] for r in rs) for k in ("distribuidos", "suspensos", "fora_computo", "julgados", "a_julgar"))
    if meta == 1:
        des = sum(r["detalhes"]["dessobrestados"] for r in rs)
        base = d + des - s
        return d, s, j, a, round(j / base * 100, 2), max(0, base - j)
    c, falta = regras.fechar(d, s, f, j, rs[0]["pct"])
    return d, s, j, a, round(c, 2), falta


def main():
    pasta = Path(sys.argv[1])
    erros = 0
    for meta in (1, 2, 4, 6, 8, 10):
        res = regras.processar(meta, list(linhas_da_copia(pasta, meta)))
        for (m, escopo, recorte), esperado in GABARITO.items():
            if m != meta:
                continue
            obtido = somar(res["indicadores"], escopo, recorte, meta)
            ok = obtido == esperado
            erros += not ok
            print(f"{'ok ' if ok else 'ERRO'} Meta {meta} | {escopo[:14]:14} | {recorte[:30]:30} | {obtido}" + ("" if ok else f" esperado {esperado}"))
    r3 = regras.indice_meta3(list(linhas_da_copia(pasta, 3)))
    sent, acordos = sum(r["detalhes"]["sentencas"] for r in r3), sum(r["detalhes"]["acordos"] for r in r3)
    ok = (sent, acordos, sum(r["detalhes"]["sentencas_ano_anterior"] for r in r3), sum(r["detalhes"]["acordos_ano_anterior"] for r in r3)) == (37506, 8769, 43173, 9896)
    erros += not ok
    print(f"{'ok ' if ok else 'ERRO'} Meta 3 | TJAC | {acordos} acordos em {sent} sentenças ({acordos / sent:.2%})")
    r5, acervo = regras.indice_meta5(list(linhas_da_copia(pasta, 5)))
    cp, tb = sum(r["a_julgar"] for r in r5), sum(r["julgados"] for r in r5)
    czs = next(r for r in r5 if r["unidade"] == CZS)
    ok = (cp, tb, len(acervo)) == (45644, 63879, 45644) and (czs["a_julgar"], czs["julgados"], round(czs["cumprimento"], 2), czs["faltam"]) == (1666, 1009, 97.52, 42)
    erros += not ok
    print(f"{'ok ' if ok else 'ERRO'} Meta 5 | TJAC {cp} pendentes, {tb} baixados ({cp / (cp + tb):.2%}) | CZS {czs['a_julgar']}/{czs['julgados']} {czs['cumprimento']:.2f}% faltam {czs['faltam']}")
    sys.exit(1 if erros else 0)


if __name__ == "__main__":
    main()
