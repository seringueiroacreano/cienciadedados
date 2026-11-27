import unittest
from datetime import date

from irdr_iac import datajud, regras
from irdr_iac.etl import incidentes_do_datajud
import pandas as pd


def fonte(num, classe, ajuiz, movs, orgao="GABINETE DO DES. ROBERTO BARROS DOS SANTOS", atual="2026-09-14T00:00:00Z"):
    return {"numeroProcesso": num, "classe": {"codigo": classe}, "grau": "G2", "dataAjuizamento": ajuiz,
            "orgaoJulgador": {"nome": orgao}, "dataHoraUltimaAtualizacao": atual,
            "movimentos": [{"codigo": c, "nome": "x", "dataHora": d} for c, d in movs]}


class DataJud(unittest.TestCase):
    def test_formatos_de_data(self):
        self.assertEqual(datajud.para_data("2026051100"), date(2026, 5, 11))
        self.assertEqual(datajud.para_data("20260511000000"), date(2026, 5, 11))
        self.assertEqual(datajud.para_data("2026-05-11T10:00:00.000Z"), date(2026, 5, 11))
        self.assertIsNone(datajud.para_data(None))

    def test_conversao_e_pontuacao(self):
        regs, movs = datajud.converter([
            fonte("01009301720268010000", 12085, "2026071500", [(26, "2026-07-15T00:00:00Z"), (12257, "2026-08-11T00:00:00Z")]),
            fonte("01009259220268010000", 12087, "2026071400", [(12257, "2026-07-23T00:00:00Z")]),
            fonte("01002287120268010000", 12085, "2026021122", [(12095, "2026-05-21T00:00:00Z")]),
        ])
        por = {r["numero"]: r for r in regs}
        self.assertEqual(por["01009301720268010000"]["data_tese"], date(2026, 8, 11))
        self.assertEqual(por["01009259220268010000"]["especie"], "IAC")
        self.assertIn("não admitido", por["01002287120268010000"]["alertas"])
        self.assertEqual(len(movs), 4)
        dgab = pd.DataFrame({"chave": ["ROBERTO BARROS DOS SANTOS"], "gabinete": ["GABINETE DO DES. ROBERTO BARROS DOS SANTOS"]})
        pts = regras.pontuar(incidentes_do_datajud(regs, dgab), date(2026, 11, 27))
        self.assertEqual(sum(p["total"] for p in pts), 70)   # 35 + 35 (teto); o não admitido (10) fica fora

    def test_processo_repetido_fica_a_versao_mais_recente(self):
        regs, _ = datajud.converter([
            fonte("1", 12085, "2026010100", [], atual="2026-01-01T00:00:00Z"),
            fonte("1", 12085, "2026010100", [(12257, "2026-03-01T00:00:00Z")], atual="2026-06-01T00:00:00Z")])
        self.assertEqual(len(regs), 1)
        self.assertEqual(regs[0]["data_tese"], date(2026, 3, 1))

    def test_orgao_colegiado_gera_alerta(self):
        regs, _ = datajud.converter([fonte("2", 12085, "2025100100", [], orgao="1ª CÂMARA CÍVEL")])
        self.assertIn("não é gabinete", regs[0]["alertas"])


if __name__ == "__main__":
    unittest.main()
