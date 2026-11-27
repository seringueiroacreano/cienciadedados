import unittest
from datetime import date

from irdr_iac import regras
from irdr_iac.etl import casar_gabinete, chave_nome, classificar_tema
from irdr_iac.regras import Incidente

CORTE = date(2026, 11, 11)


def inc(ordem, gab="G1", **kw):
    base = dict(numero=f"P{ordem}", especie="IRDR", gabinete=gab, evidencia_sus="DJe", evidencia_julgamento="Acórdão")
    base.update(kw)
    return Incidente(ordem=ordem, **base)


class Regras(unittest.TestCase):
    def test_sus_e_tese_no_mesmo_incidente_somam_35(self):
        r = regras.pontuar([inc(1, data_suscitamento=date(2026, 2, 1), marco_sus="Suscitamento",
                                data_julgamento=date(2026, 9, 1), tese_fixada=True)], CORTE)[0]
        self.assertEqual((r["sus"], r["tese"], r["total"]), (1, 1, 35))

    def test_so_dois_maiores_por_gabinete(self):
        lst = [inc(1, data_admissao=date(2026, 3, 1), marco_sus="Admissão"),
               inc(2, data_julgamento=date(2026, 5, 1), tese_fixada=True),
               inc(3, data_suscitamento=date(2026, 4, 1), data_julgamento=date(2026, 8, 1), tese_fixada=True)]
        r = regras.pontuar(lst, CORTE)
        self.assertEqual([x["selecionado"] for x in r], [0, 1, 1])
        self.assertEqual(sum(x["total"] for x in r), 60)

    def test_empate_respeita_ordem_da_linha(self):
        lst = [inc(1, data_suscitamento=date(2026, 1, 5)), inc(2, data_suscitamento=date(2026, 1, 6)),
               inc(3, data_suscitamento=date(2026, 1, 7))]
        self.assertEqual([x["selecionado"] for x in regras.pontuar(lst, CORTE)], [1, 1, 0])

    def test_fora_do_periodo_ou_depois_do_corte_nao_pontua(self):
        lst = [inc(1, data_suscitamento=date(2025, 12, 31)), inc(2, gab="G2", data_suscitamento=date(2026, 11, 20))]
        self.assertTrue(all(x["total"] == 0 for x in regras.pontuar(lst, CORTE)))

    def test_marco_admissao_ignora_suscitamento_antigo(self):
        r = regras.pontuar([inc(1, data_suscitamento=date(2025, 10, 1), data_admissao=date(2026, 2, 1),
                                marco_sus="Admissão")], CORTE)[0]
        self.assertEqual(r["sus"], 1)

    def test_sem_evidencia_nao_pontua_e_gera_pendencia(self):
        r = regras.pontuar([inc(1, data_suscitamento=date(2026, 2, 1), evidencia_sus=None)], CORTE)[0]
        self.assertEqual(r["total"], 0)
        self.assertIn("SUS sem evidência", r["pendencias"])

    def test_tese_sem_fixacao_nao_pontua(self):
        r = regras.pontuar([inc(1, data_julgamento=date(2026, 6, 1), tese_fixada=False)], CORTE)[0]
        self.assertEqual(r["tese"], 0)

    def test_situacao(self):
        self.assertEqual(regras.situacao(True, None, 0, 0, 0), "Aguardando manifestação ou fonte")
        self.assertEqual(regras.situacao(True, "Sem registros", 0, 0, 0), "Sem registros no período")
        self.assertEqual(regras.situacao(True, "Informado", 2, 0, 35), "Aferido")
        self.assertTrue(regras.fora_do_escopo("GABINETE DA VICE-PRESIDÊNCIA"))


class DePara(unittest.TestCase):
    def test_casa_nome_curto_com_nome_completo(self):
        chaves = {chave_nome("GABINETE DO DES. ROBERTO BARROS DOS SANTOS"): "ROBERTO",
                  chave_nome("GABINETE DO DES.ª REGINA CÉLIA FERRARI LONGUINI"): "REGINA"}
        self.assertEqual(casar_gabinete("Gabinete do Des. Roberto Barros", chaves), "ROBERTO")
        self.assertEqual(casar_gabinete("Gabinete da Desª. Regina Célia Ferrari Longuini", chaves), "REGINA")
        self.assertIsNone(casar_gabinete("PRIMEIRA CÂMARA CÍVEL", chaves))

    def test_classifica_rotulos(self):
        self.assertEqual(classificar_tema("Recurso Extraordinário com repercussão geral"), ("Repercussão Geral", "STF"))
        self.assertEqual(classificar_tema("Processo suspenso por Recurso Especial Repetitivo"),
                         ("Recurso Especial Repetitivo", "STJ"))
        self.assertEqual(classificar_tema("Incidente de Resolução de Demandas Repetitivas"), ("IRDR", "TJAC"))
        self.assertEqual(classificar_tema("FORA DE USO - Processo Suspenso"), ("Rótulo fora de uso", "Indefinido"))


if __name__ == "__main__":
    unittest.main()
