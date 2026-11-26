"""Testes das regras de pontuação (rodam sem internet): python -m unittest discover -s testes -t ."""
import datetime as dt
import json
import os
import unittest

from robo_irasp import cniep, sna

with open(os.path.join(os.path.dirname(__file__), "..", "config.json"), encoding="utf-8") as f:
    CFG = json.load(f)


class TestSNA(unittest.TestCase):
    F = CFG["sna"]["faixas"]

    def test_faixas_reavaliacao(self):
        self.assertEqual(sna.pontuar("SNA a", 98.0, self.F), 20)
        self.assertEqual(sna.pontuar("SNA a", 97.99, self.F), 10)
        self.assertEqual(sna.pontuar("SNA a", 90.0, self.F), 10)
        self.assertEqual(sna.pontuar("SNA a", 89.99, self.F), 0)

    def test_prazos_b(self):
        self.assertEqual(sna.pontuar("SNA b.1", 80.0, self.F), 10)
        self.assertEqual(sna.pontuar("SNA b.2", 33.33, self.F), 0)

    def test_etnico_racial_estrito(self):
        self.assertEqual(sna.pontuar("SNA c", 90.0, self.F), 0)  # "> 90,00%"
        self.assertEqual(sna.pontuar("SNA c", 90.01, self.F), 10)

    def test_nomes(self):
        self.assertEqual(
            sna.normalizar("Rio Branco - Infância e Juventude / 2ª Vara da Infância e da Juventude"),
            "rio branco - infancia e juventude / 2a vara da infancia e da juventude",
        )

    def test_calcular_aplicabilidade(self):
        brutos = {"SNA a": {"atualizado_em": "x", "ranking": [
            {"unidade": "Feijó / Vara Cível", "percentual": 100.0, "total": 6, "pendencias": 0},
            {"unidade": ">> MÉDIA TJAC <<", "percentual": 96.5, "total": 6, "pendencias": 0},
            {"unidade": "Unidade Nova / Vara X", "percentual": 50.0, "total": 1, "pendencias": 1},
        ]}}
        pontos, memoria, uf, alertas = sna.calcular(CFG["sna"], brutos)
        self.assertEqual(pontos[8153]["SNA a"], 20)
        self.assertEqual(pontos[11674]["SNA a"], "-")  # fora do ranking = não se aplica
        self.assertEqual(uf["SNA a"]["pontos"], 10)
        self.assertEqual(len(alertas), 1)


class TestCNIEP(unittest.TestCase):
    def test_ciclos(self):
        self.assertEqual(cniep.ciclo_para_mes("Março/26"), (2026, 3))
        self.assertEqual(cniep.ciclo_para_mes("Abril/2026"), (2026, 4))
        self.assertIsNone(cniep.ciclo_para_mes("Outro"))

    def test_janela(self):
        fechados, abertos = cniep.meses_da_janela(CFG["cniep"], dt.date(2026, 11, 26))
        self.assertEqual(len(fechados), 10)
        self.assertEqual(abertos, [(2026, 11)])

    def test_regra_zero_e_fora_do_prazo(self):
        meses = [(2026, m) for m in range(1, 4)]
        sit = {(1, m): "P" for m in meses}
        self.assertEqual(cniep.pontuar_grupo([1], sit, meses, "meses_fechados", 30)[0], 30)
        sit[(1, (2026, 2))] = "F"  # (2 + 0,5) / 3 × 30 = 25
        self.assertEqual(cniep.pontuar_grupo([1], sit, meses, "meses_fechados", 30)[0], 25)
        del sit[(1, (2026, 3))]
        self.assertEqual(cniep.pontuar_grupo([1], sit, meses, "meses_fechados", 30)[0], 0)

    def test_divisor_literal(self):
        meses = [(2026, m) for m in range(1, 12)]
        sit = {(1, m): "P" for m in meses}
        # leitura literal: 11 ÷ 12 × 30 = 27,5 -> 28
        self.assertEqual(cniep.pontuar_grupo([1], sit, meses, 12, 30)[0], 28)


if __name__ == "__main__":
    unittest.main()
