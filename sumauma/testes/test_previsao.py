import unittest
from datetime import date, timedelta

from motor import previsao


def serie_constante(inicio: date, fim: date, por_dia_util: int) -> dict:
    return {inicio + timedelta(i): por_dia_util for i in range((fim - inicio).days + 1) if (inicio + timedelta(i)).weekday() < 5}


class DiasUteis(unittest.TestCase):
    def test_semana_cheia(self):
        self.assertEqual(previsao.dias_uteis(date(2026, 11, 16), date(2026, 11, 22)), 5)
        self.assertEqual(previsao.dias_uteis(date(2026, 11, 16), date(2026, 12, 19)), 25)
        self.assertEqual(previsao.dias_uteis(date(2026, 12, 20), date(2026, 12, 19)), 0)


class Ritmo(unittest.TestCase):
    def setUp(self):
        self.serie = serie_constante(date(2026, 1, 1), date(2026, 11, 13), 4)

    def test_ritmo_constante_e_previsto_sem_erro(self):
        corte, fim = date(2026, 11, 13), date(2026, 12, 19)
        for metodo in previsao.JANELAS:
            self.assertAlmostEqual(previsao.prever(self.serie, corte, fim, metodo), 4 * 25)

    def test_sazonalidade_multiplica_o_ritmo(self):
        historico = serie_constante(date(2025, 9, 1), date(2025, 11, 13), 10)
        historico.update(serie_constante(date(2025, 11, 14), date(2025, 12, 19), 5))   # caiu pela metade no fim do ano
        corte, fim = date(2026, 11, 13), date(2026, 12, 19)
        self.assertAlmostEqual(previsao.razao_sazonal(historico, corte, fim), 0.5)
        self.assertAlmostEqual(previsao.prever(self.serie, corte, fim, "ritmo_8_semanas_sazonal", historico), 4 * 25 * 0.5)

    def test_backtest_de_serie_constante_nao_erra(self):
        bt = previsao.backtest({"Vara A": self.serie}, date(2026, 11, 13), list(previsao.JANELAS))
        for metodo in previsao.JANELAS:
            self.assertAlmostEqual(bt[metodo]["erro_geral"], 0, places=6)


class Projecao(unittest.TestCase):
    def test_cumprimento_margem_e_ritmo_necessario(self):
        p = previsao.projetar(casos_novos=1000, julgados=800, suspensos=20, dessobrestados=0,
                              novos_previstos=100, julgados_previstos=120, margem_pp=5.0, semanas_restantes=5)
        self.assertAlmostEqual(p["cumprimento"], 920 / 1080 * 100)
        self.assertAlmostEqual(p["cumprimento_max"] - p["cumprimento_min"], 10.0)
        self.assertAlmostEqual(p["ritmo_atual_semana"], 24)
        self.assertAlmostEqual(p["ritmo_necessario_semana"], (1080 - 800) / 5)
        self.assertEqual(previsao.situacao(p), "Tende a não cumprir")

    def test_situacoes(self):
        base = dict(casos_novos=100, suspensos=0, dessobrestados=0, novos_previstos=0, semanas_restantes=5)
        self.assertEqual(previsao.situacao(previsao.projetar(julgados=120, julgados_previstos=0, margem_pp=5.0, **base)), "Tende a cumprir")
        self.assertEqual(previsao.situacao(previsao.projetar(julgados=98, julgados_previstos=0, margem_pp=5.0, **base)), "Em risco")
        self.assertEqual(previsao.situacao(previsao.projetar(julgados=98, julgados_previstos=0, margem_pp=None, **base)), "Sem histórico para medir a margem")


if __name__ == "__main__":
    unittest.main()
