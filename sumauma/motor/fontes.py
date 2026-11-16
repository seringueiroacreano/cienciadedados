"""Download da base de cada meta no serviço de exportação do painel do TJAC.

Uma requisição por meta, uma vez por dia, identificada como sumauma-rpa.
"""
from __future__ import annotations

import csv
import email.utils
import json
import time
import urllib.error
import urllib.request
from pathlib import Path

METAS = [1, 2, 3, 4, 5, 6, 7, 8, 10]
URL = "https://exportar-bi.tjac.jus.br/download/Metas_Nacionais_SAJ__meta_{:02d}"
USER_AGENT = "sumauma-rpa/1.0 (carga diaria de dados publicos; github.com/seringueiroacreano/cienciadedados)"


def baixar(meta: int, pasta: Path, tentativas: int = 7) -> None:
    """Grava pasta/meta_NN.csv e pasta/meta_NN.json (data em que o TJAC publicou a base)."""
    req = urllib.request.Request(URL.format(meta), headers={"User-Agent": USER_AGENT})
    for n in range(1, tentativas + 1):
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                dados = r.read()
                if len(dados) != int(r.headers.get("Content-Length") or len(dados)):
                    raise ConnectionError("download incompleto")
                publicada = email.utils.parsedate_to_datetime(r.headers["Last-Modified"]).isoformat()
            break
        except (urllib.error.URLError, ConnectionError, TimeoutError) as e:
            if n == tentativas:
                raise
            print(f"  meta {meta}: {e}; nova tentativa {n + 1}/{tentativas}")
            time.sleep(2 * n)
    pasta.mkdir(parents=True, exist_ok=True)
    (pasta / f"meta_{meta:02d}.csv").write_bytes(dados)
    (pasta / f"meta_{meta:02d}.json").write_text(json.dumps({"meta": meta, "publicada_em": publicada}), encoding="utf-8")


def ler(meta: int, pasta: Path) -> tuple[list[dict], str]:
    """Linhas da base (dicionários por coluna) e a data de publicação."""
    with open(pasta / f"meta_{meta:02d}.csv", encoding="utf-8-sig", newline="") as f:
        linhas = list(csv.DictReader(f, delimiter=";"))
    publicada = json.loads((pasta / f"meta_{meta:02d}.json").read_text(encoding="utf-8"))["publicada_em"]
    return linhas, publicada


if __name__ == "__main__":
    import sys
    destino = Path(sys.argv[1])
    for m in METAS:
        baixar(m, destino)
        print(f"meta {m}: baixada")
