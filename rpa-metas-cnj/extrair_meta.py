#!/usr/bin/env python3
"""RPA - extração das Metas Nacionais (portal Alvank/TJAC) com um comando.

Exemplo:
    python extrair_meta.py --meta 1 --busca "cruzeiro do sul" \
        --unidade "1ª Vara Cível Cruzeiro Do Sul"

Fluxo automatizado (o mesmo do vídeo):
 1. abre link.tjac.jus.br/meta-N  2. filtra "Unidade Judiciária"
 3. marca a(s) unidade(s)         4. clica em Download (CSV)
 5. separa o CSV por Casos Novos/Julgados/Pendentes/Suspensos em abas do Excel.
"""
from __future__ import annotations
import argparse, sys, tomllib
from datetime import datetime
from pathlib import Path

from pos_processamento import gerar_xlsx

PADRAO = {
    "url_base": "https://link.tjac.jus.br/meta-{meta}",
    "meta": 1, "pasta_saida": "saida", "timeout_s": 60,
    "termo_busca": "", "unidades": [],
    "seletores": {
        "filtro_unidade": "text=Unidade Judiciária",
        "caixa_busca": "input[placeholder*='esquis'], input[type='search'], input[type='text']",
        "botao_download": "text=Download",
    },
}


def carregar_config(args) -> dict:
    cfg = {**PADRAO, "seletores": dict(PADRAO["seletores"])}
    if args.config and Path(args.config).exists():
        user = tomllib.loads(Path(args.config).read_text(encoding="utf-8"))
        sel = user.pop("seletores", {})
        cfg.update(user); cfg["seletores"].update(sel)
    for k, v in (("meta", args.meta), ("pasta_saida", args.saida),
                 ("termo_busca", args.busca)):
        if v is not None:
            cfg[k] = v
    if args.url:
        cfg["url_base"] = args.url
    if args.unidade:
        cfg["unidades"] = args.unidade
    return cfg


def baixar_csv(cfg: dict, destino: Path, headed: bool) -> Path:
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
    s, t = cfg["seletores"], cfg["timeout_s"] * 1000
    destino.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not headed)
        ctx = browser.new_context(accept_downloads=True, viewport={"width": 1400, "height": 800})
        page = ctx.new_page(); page.set_default_timeout(t)
        try:
            page.goto(cfg["url_base"].replace("{meta}", str(cfg["meta"])), wait_until="networkidle")
            # Painel Meta N (menu lateral numerado, se não for a meta aberta pelo link)
            if cfg["unidades"]:
                page.locator(s["filtro_unidade"]).first.click()
                if cfg["termo_busca"]:
                    page.locator(s["caixa_busca"]).last.fill(cfg["termo_busca"])
                for u in cfg["unidades"]:
                    page.get_by_text(u, exact=False).first.click()
                page.keyboard.press("Escape")
                page.wait_for_load_state("networkidle")
            with page.expect_download() as dl:
                page.locator(s["botao_download"]).first.click()
            arq = destino / dl.value.suggested_filename
            dl.value.save_as(arq)
            return arq
        except PWTimeout as e:
            shot = destino / "erro.png"; page.screenshot(path=str(shot), full_page=True)
            sys.exit(f"Tempo esgotado. Veja {shot}. Ajuste os seletores em config.toml.\n{e}")
        finally:
            browser.close()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--meta", type=int); ap.add_argument("--url", help="URL direta (ex.: link público do Power BI)"); ap.add_argument("--busca")
    ap.add_argument("--unidade", action="append", help="repita para várias unidades")
    ap.add_argument("--saida"); ap.add_argument("--config", default="config.toml")
    ap.add_argument("--headed", action="store_true", help="mostra o navegador (depuração)")
    ap.add_argument("--csv", help="pula o portal e só processa este CSV já baixado")
    a = ap.parse_args(); cfg = carregar_config(a)
    pasta = Path(cfg["pasta_saida"]) / datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_path = Path(a.csv) if a.csv else baixar_csv(cfg, pasta, a.headed)
    pasta.mkdir(parents=True, exist_ok=True)
    xlsx = pasta / f"meta_{cfg['meta']:02d}.xlsx"
    cont = gerar_xlsx(csv_path, xlsx)
    print(f"CSV: {csv_path}\nExcel: {xlsx}")
    for k, v in cont.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
