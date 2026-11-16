"""Testes das regras com bases pequenas, montadas à mão.

    python -m unittest discover -s sumauma/testes -t sumauma
"""
import unittest

from motor import regras


def linha(idp, var, data="2020-01-10 00:00:00", unidade="Vara A", grau="G1", numero=None):
    return {"id_processo": str(idp), "numero": numero or f"{int(idp):07d}-00.2020.8.01.0001", "grau": grau, "classe": "Classe",
            "nome_natureza": "Natureza", "nome_orgao_julgador": unidade, "nome_municipio": "CIDADE",
            "dt_evento": data, "var": var, "sistema": "SAJ"}


class Meta2(unittest.TestCase):
    def setUp(self):
        self.linhas = [
            linha(1, "Distribuidos"), linha(1, "Julgados", "2026-03-01 00:00:00"),          # julgado
            linha(2, "Distribuidos"), linha(2, "Suspensos", "2026-02-01 00:00:00"),         # suspenso
            linha(3, "Distribuidos", "2019-05-05 00:00:00"),                                # a julgar (mais antigo)
            linha(4, "Distribuidos", "2021-01-01 00:00:00"),                                # a julgar
            linha(5, "Distribuidos", grau="JE"),                                            # outro recorte
            linha(6, "Julgados"),                                                           # sem distribuído: fora
            linha(7, "Distribuidos", "2009-01-01 00:00:00"), linha(7, "Distribuidos Antigos", "2009-01-01 00:00:00"),
            linha(7, "Suspensos Antigos"), linha(7, "Dessobrestados Antigos"),
        ]
        self.itens = regras.classificar(2, self.linhas)

    def test_situacoes(self):
        sit = {(i["recorte"], i["id_processo"]): i["situacao"] for i in self.itens}
        self.assertEqual(sit[("1º grau", "1")], "Julgado")
        self.assertEqual(sit[("1º grau", "2")], "Suspenso")
        self.assertEqual(sit[("1º grau", "3")], "A julgar")
        self.assertEqual(sit[("Juizados e Turmas Recursais", "5")], "A julgar")
        self.assertEqual(sit[("Antigos (15 anos ou mais)", "7")], "Fora do cômputo")
        self.assertNotIn(("1º grau", "6"), sit)

    def test_ordem_do_mais_antigo(self):
        fila = [i["id_processo"] for i in self.itens if i["situacao"] == "A julgar" and i["recorte"] == "1º grau"]
        self.assertEqual(fila, ["7", "3", "4"])

    def test_indicadores(self):
        r = {x["recorte"]: x for x in regras.resumir(self.itens)}["1º grau"]
        self.assertEqual((r["distribuidos"], r["suspensos"], r["julgados"], r["a_julgar"]), (5, 1, 1, 3))
        self.assertAlmostEqual(r["cumprimento"], 1 / 4 / 0.8 * 100)
        self.assertEqual(r["faltam"], 3)  # teto(0,8 × 4) = 4 julgados necessários


class Recortes(unittest.TestCase):
    def test_sufixos(self):
        self.assertEqual(regras.recorte_de(4, "Distribuidos_b", "G1"), ("Improbidade administrativa", 1.0))
        self.assertEqual(regras.recorte_de(8, "Julgados_b", "G1")[0], "Feminicídio")
        self.assertEqual(regras.recorte_de(6, "Distribuidos", "JE")[0], "Ações ambientais")
        self.assertEqual(regras.recorte_de(10, "Suspensos_a", "G1"), ("1º grau", 0.9))
        self.assertIsNone(regras.recorte_de(7, "Distribuidos_z", "G1"))

    def test_fechar(self):
        self.assertEqual(regras.fechar(99, 60, 1, 35, 1.0), (35 / 38 * 100, 3))
        self.assertEqual(regras.fechar(0, 0, 0, 0, 0.5), (None, 0))


class Meta1(unittest.TestCase):
    def test_formula_e_fila(self):
        linhas = [
            linha(1, "Casos Novos", "2026-01-05 00:00:00"), linha(1, "Julgados", "2026-02-05 00:00:00"),
            linha(2, "Casos Novos", "2026-01-06 00:00:00"),
            linha(3, "Casos Novos", "2026-01-07 00:00:00"), linha(3, "Suspensos", "2026-03-01 00:00:00"),
            linha(4, "Pendentes", "2015-09-21 00:00:00"),
            linha(5, "Julgados", "2026-04-01 00:00:00"),                                     # julgado do acervo
            linha(6, "Casos Novos", "2026-01-08 00:00:00"), linha(6, "Julgados"), linha(6, "Suspensos"),  # julgado e suspenso
        ]
        itens, resumo = regras.classificar_meta1(linhas)
        r = resumo[0]
        self.assertEqual((r["distribuidos"], r["suspensos"], r["julgados"], r["a_julgar"]), (4, 2, 3, 2))
        self.assertAlmostEqual(r["cumprimento"], 3 / (4 - 2) * 100)
        self.assertEqual(r["faltam"], 0)
        fila = [(i["id_processo"], i["origem"]) for i in itens if i["situacao"] == "A julgar"]
        self.assertEqual(fila, [("4", "Acervo anterior"), ("2", "Caso novo do ano")])
        self.assertEqual({i["id_processo"]: i["situacao"] for i in itens}["6"], "Julgado")

    def test_dessobrestado_volta_a_ser_cobrado(self):
        linhas = [linha(1, "Casos Novos", "2026-01-05 00:00:00"), linha(1, "Suspensos", "2026-02-01 00:00:00"),
                  linha(1, "Dessobrestados", "2026-03-01 00:00:00")]
        itens, resumo = regras.classificar_meta1(linhas)
        self.assertEqual(itens[0]["situacao"], "A julgar")
        self.assertEqual(resumo[0]["faltam"], 1)  # 1 caso novo + 1 dessobrestado − 1 suspenso


class Indices(unittest.TestCase):
    def test_meta3_clausula_de_barreira(self):
        linhas = [linha(i, "Sentencas Totais", "2026-02-01 00:00:00") for i in range(10)]
        linhas += [linha(i, "Homologatoria", "2026-02-01 00:00:00") for i in range(2)]
        linhas += [linha(100 + i, "Sentencas Totais", "2025-02-01 00:00:00") for i in range(10)]
        linhas += [linha(100 + i, "Homologatoria", "2025-02-01 00:00:00") for i in range(3)]
        r = regras.indice_meta3(linhas)[0]
        self.assertAlmostEqual(r["detalhes"]["indice"], 0.2)
        self.assertAlmostEqual(r["detalhes"]["indice_ano_anterior"], 0.3)
        self.assertEqual(r["cumprimento"], 100.0)   # caiu, mas está acima de 18%
        self.assertEqual(r["faltam"], 0)

    def test_meta5_taxa(self):
        linhas = [linha(i, "CPLC1", "202611", numero=f"P{i}") for i in range(6)]
        linhas += [linha(i, "TBaixC1", "202603", numero=f"B{i}") for i in range(4)]
        linhas += [linha(i, "CPLC1", "202512", numero=f"P{i}") for i in range(5)]
        linhas += [linha(i, "TBaixC1", "202506", numero=f"B{i}") for i in range(5)]
        indicadores, acervo = regras.indice_meta5(linhas)
        r = indicadores[0]
        self.assertAlmostEqual(r["detalhes"]["taxa"], 0.6)
        self.assertAlmostEqual(r["detalhes"]["taxa_ano_anterior"], 0.5)
        self.assertAlmostEqual(r["cumprimento"], (0.5 - 0.005) / 0.6 * 100)
        self.assertEqual(r["faltam"], 1)   # 6 − 0,52 × 10 = 0,8 → 1 baixa
        self.assertEqual(len(acervo), 6)


class Serie(unittest.TestCase):
    def test_conta_processos_distintos_por_mes(self):
        linhas = [linha(1, "Julgados", "2026-03-01 00:00:00"), linha(1, "Julgados", "2026-03-09 00:00:00"),
                  linha(2, "Julgados", "2026-03-02 00:00:00"), linha(3, "CPLC1", "202611")]
        s = {(x["variavel"], x["anomes"]): x["quantidade"] for x in regras.serie_mensal(linhas)}
        self.assertEqual(s, {("Julgados", 202603): 2, ("CPLC1", 202611): 1})


if __name__ == "__main__":
    unittest.main()
