"""python -m irdr_iac MATRIZ.xls [--irdr IRDR.csv] [--magistrados MAGISTRADOS.csv] [--corte AAAA-MM-DD] [--saida saida]"""
import argparse
from datetime import date
from pathlib import Path

from .etl import executar


def main():
    p = argparse.ArgumentParser(description="Gera as tabelas do Painel de Aferição IRDR/IAC.")
    p.add_argument("matriz", type=Path, help="Matriz_Afericao_IRDR_IAC_TJAC_2026*.xls(x) preenchida pela SEJUD")
    p.add_argument("--irdr", type=Path, help="extração de sobrestamento (IRDR.csv)")
    p.add_argument("--magistrados", type=Path, help="MAGISTRADOS.csv (processo -> relator)")
    p.add_argument("--corte", type=date.fromisoformat, help="data de corte; padrão: a da matriz")
    p.add_argument("--saida", type=Path, default=Path("saida"))
    a = p.parse_args()
    tabelas = executar(a.matriz, a.saida, a.irdr, a.magistrados, a.corte)
    for nome, df in tabelas.items():
        print(f"{nome:<20} {len(df):>6} linhas")
    if "qualidade" in tabelas:
        print("\nAchados de qualidade:")
        for _, r in tabelas["qualidade"].iterrows():
            print(f"  [{r['gravidade']}] {r['achado']}: {r['valor']}")


if __name__ == "__main__":
    main()
