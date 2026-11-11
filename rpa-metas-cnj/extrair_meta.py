#!/usr/bin/env python3
"""RPA - extração das Metas Nacionais do TJAC com um comando.

Exemplos:
    python extrair_meta.py --unidade "1ª Vara Cível de Cruzeiro do Sul"
    python extrair_meta.py --meta 2 --municipio "cruzeiro do sul"
    python extrair_meta.py --listar --unidade cruzeiro     # mostra os nomes das unidades

O botão "Download" do painel é um link fixo (link.tjac.jus.br/meta-N) que entrega
o CSV com a base inteira; os filtros da tela não alteram o arquivo. Por isso o robô
baixa direto, sem navegador, e faz no pandas o filtro que no vídeo é feito no Excel.
"""
from __future__ import annotations

import argparse
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

from pos_processamento import COL_UNIDADE, filtrar, gerar_xlsx, ler_csv, normalizar

URL = "https://link.tjac.jus.br/meta-{meta}"
USER_AGENT = "rpa-metas-cnj/1.0 (extracao automatizada de dados publicos)"


def baixar_csv(meta: int, destino: Path, tentativas: int = 5) -> Path:
    req = urllib.request.Request(URL.format(meta=meta), headers={"User-Agent": USER_AGENT})
    for n in range(1, tentativas + 1):
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                tipo = resp.headers.get("Content-Type", "")
                if "csv" not in tipo:
                    sys.exit(f"A meta {meta} não entrega CSV (veio '{tipo}' de {resp.url}). "
                             "Baixe manualmente e use --csv.")
                destino.write_bytes(resp.read())
                return destino
        except (urllib.error.URLError, ConnectionError, TimeoutError) as e:
            if isinstance(e, urllib.error.HTTPError) and e.code < 500:
                sys.exit(f"A meta {meta} não pôde ser baixada automaticamente "
                         f"(erro {e.code} em {e.url}). Baixe manualmente e use --csv.")
            if n == tentativas:
                sys.exit(f"Falha ao baixar após {tentativas} tentativas: {e}")
            print(f"  conexão falhou ({e}); nova tentativa {n + 1}/{tentativas}...")
            time.sleep(2 ** n)


def slug(texto: str) -> str:
    return "_".join(normalizar(texto).replace("/", " ").split())[:60]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--meta", type=int, default=1, help="número da meta (padrão: 1)")
    ap.add_argument("--unidade", action="append", default=[],
                    help="trecho do nome da unidade judiciária; repita para várias")
    ap.add_argument("--municipio", action="append", default=[], help="trecho do nome do município")
    ap.add_argument("--saida", default="saida", help="pasta de saída (padrão: saida)")
    ap.add_argument("--csv", help="usa um CSV já baixado em vez de acessar o portal")
    ap.add_argument("--listar", action="store_true", help="só lista as unidades encontradas")
    a = ap.parse_args()

    pasta = Path(a.saida)
    pasta.mkdir(parents=True, exist_ok=True)
    carimbo = datetime.now().strftime("%Y%m%d_%H%M")
    if a.csv:
        csv_path = Path(a.csv)
    else:
        print(f"Baixando a base da Meta {a.meta}...")
        csv_path = baixar_csv(a.meta, pasta / f"meta_{a.meta:02d}_{carimbo}_base.csv")

    df = ler_csv(csv_path)
    total = len(df)
    df = filtrar(df, a.unidade, a.municipio)

    if a.listar:
        for nome, qtd in df[COL_UNIDADE].value_counts().sort_index().items():
            print(f"{qtd:>7}  {nome}")
        return
    if df.empty:
        sys.exit("Nenhuma linha para o filtro informado. Use --listar para ver os nomes das unidades.")

    if (a.unidade or a.municipio) and COL_UNIDADE in df.columns:
        print("Unidades incluídas:")
        for nome in sorted(df[COL_UNIDADE].unique()):
            print(f"  - {nome}")
    sufixo = slug(" ".join(a.unidade + a.municipio)) or "todas"
    xlsx = pasta / f"meta_{a.meta:02d}_{sufixo}_{carimbo}.xlsx"
    contagem = gerar_xlsx(df, xlsx)
    print(f"Base: {csv_path} ({total} linhas)\nExcel: {xlsx} ({len(df)} linhas)")
    for nome, qtd in contagem.items():
        print(f"  {nome}: {qtd}")


if __name__ == "__main__":
    main()
