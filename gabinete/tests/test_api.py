"""Testes da API. Rode com:  python3 -m unittest discover -s tests -v   (dentro de gabinete/)"""
import http.cookiejar
import json
import os
import shutil
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ["GABINETE_ADMIN_SENHA"] = "senha-admin-teste"
from server import cpf_valido, criar_servidor  # noqa: E402


class Cliente:
    def __init__(self, base):
        self.base = base
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def req(self, metodo, caminho, corpo=None, csrf=True):
        dados = json.dumps(corpo).encode() if corpo is not None else None
        r = urllib.request.Request(self.base + caminho, data=dados, method=metodo)
        if dados:
            r.add_header("Content-Type", "application/json")
        if csrf:
            r.add_header("X-Requested-With", "fetch")
        try:
            with self.op.open(r) as resp:
                txt = resp.read().decode("utf-8-sig")
                return resp.status, (json.loads(txt) if "json" in resp.headers.get("Content-Type", "") else txt)
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def login(self, email, senha):
        return self.req("POST", "/api/login", {"email": email, "senha": senha})


class TestAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pasta = tempfile.mkdtemp()
        cls.srv, cls.app = criar_servidor(cls.pasta, 0)
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.srv.server_address[1]}"
        cls.adm = Cliente(cls.base)
        assert cls.adm.login("admin@gabinete.local", "senha-admin-teste")[0] == 200

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.srv.server_close()
        shutil.rmtree(cls.pasta)

    def test_sem_login_bloqueia(self):
        s, _ = Cliente(self.base).req("GET", "/api/cidadaos")
        self.assertEqual(s, 401)

    def test_login_errado(self):
        s, r = Cliente(self.base).login("admin@gabinete.local", "errada")
        self.assertEqual(s, 401)

    def test_csrf_exige_cabecalho(self):
        s, _ = self.adm.req("POST", "/api/cidadaos", {"nome": "X"}, csrf=False)
        self.assertEqual(s, 403)

    def test_cpf(self):
        self.assertTrue(cpf_valido("529.982.247-25"))
        self.assertFalse(cpf_valido("111.111.111-11"))
        self.assertFalse(cpf_valido("529.982.247-24"))

    def test_crud_cidadao_e_validacao(self):
        s, r = self.adm.req("POST", "/api/cidadaos", {"nome": "", "cpf": "123", "email": "x"})
        self.assertEqual(s, 400)
        self.assertEqual(set(r["campos"]), {"nome", "cpf", "email"})
        s, c = self.adm.req("POST", "/api/cidadaos", {"nome": "Maria Teste", "cpf": "52998224725",
                                                       "telefone": "68999998888", "cep": "69900000",
                                                       "municipio": "Xapuri", "tags": "saúde, saúde, rural"})
        self.assertEqual(s, 201)
        self.assertEqual(c["cpf"], "529.982.247-25")
        self.assertEqual(c["telefone"], "(68) 99999-8888")
        self.assertEqual(c["tags"], "saúde, rural")
        s, r = self.adm.req("GET", "/api/cidadaos?municipio=Xapuri&q=Maria")
        self.assertEqual(r["total"], 1)
        s, r = self.adm.req("GET", "/api/cidadaos?tags=rural")
        self.assertEqual(r["total"], 1)
        s, c2 = self.adm.req("PUT", f"/api/cidadaos/{c['id']}", {"bairro": "Centro"})
        self.assertEqual(c2["bairro"], "Centro")
        self.assertEqual(c2["nome"], "Maria Teste")
        s, rel = self.adm.req("GET", f"/api/cidadaos/{c['id']}/titular")
        self.assertEqual(rel["cidadao"]["nome"], "Maria Teste")
        s, _ = self.adm.req("DELETE", f"/api/cidadaos/{c['id']}")
        self.assertEqual(s, 200)
        s, _ = self.adm.req("GET", f"/api/cidadaos/{c['id']}")
        self.assertEqual(s, 404)

    def test_emenda_status_automatico_por_pagamentos(self):
        s, e = self.adm.req("POST", "/api/emendas", {"orgao": "SESACRE", "objeto": "Ambulância", "valor": 100000})
        self.assertEqual(s, 201, e)
        self.assertEqual(e["status"], "Recebida")
        self.adm.req("POST", "/api/pagamentos", {"emenda_id": e["id"], "valor": 40000})
        _, e = self.adm.req("GET", f"/api/emendas/{e['id']}")
        self.assertEqual((e["status"], e["valor_pago"]), ("Paga parcialmente", 40000))
        _, p = self.adm.req("POST", "/api/pagamentos", {"emenda_id": e["id"], "valor": 60000})
        _, e = self.adm.req("GET", f"/api/emendas/{e['id']}")
        self.assertEqual(e["status"], "Paga")
        self.assertEqual(self.adm.req("DELETE", f"/api/pagamentos/{p['id']}"), (200, {"ok": True}))
        _, e = self.adm.req("GET", f"/api/emendas/{e['id']}")
        self.assertEqual(e["status"], "Paga parcialmente")

    def test_demanda_protocolo_e_referencia_invalida(self):
        s, r = self.adm.req("POST", "/api/demandas", {"titulo": "Teste", "cidadao_id": 99999})
        self.assertEqual(s, 400)
        self.assertIn("cidadao_id", r["campos"])
        s, d = self.adm.req("POST", "/api/demandas", {"titulo": "Teste"})
        self.assertRegex(d["protocolo"], r"^\d{4}-\d{5}$")
        self.assertEqual(d["status"], "Aberta")

    def test_perfis_de_acesso(self):
        s, _ = self.adm.req("POST", "/api/usuarios", {"nome": "Leitor", "email": "leitor@x.org",
                                                       "papel": "consulta", "senha": "12345678"})
        self.assertEqual(s, 201)
        s, r = self.adm.req("POST", "/api/usuarios", {"nome": "Dup", "email": "LEITOR@x.org",
                                                       "papel": "consulta", "senha": "12345678"})
        self.assertEqual(r["campos"].get("email"), "já cadastrado")
        leitor = Cliente(self.base)
        self.assertEqual(leitor.login("leitor@x.org", "12345678")[0], 200)
        self.assertEqual(leitor.req("GET", "/api/cidadaos")[0], 200)
        self.assertEqual(leitor.req("POST", "/api/cidadaos", {"nome": "X"})[0], 403)
        self.assertEqual(leitor.req("GET", "/api/usuarios")[0], 403)
        self.assertEqual(leitor.req("GET", "/api/auditoria")[0], 403)
        _, u = self.adm.req("GET", "/api/usuarios")
        self.assertNotIn("senha_hash", json.dumps(u))

    def test_nao_remove_ultimo_admin(self):
        s, r = self.adm.req("PUT", "/api/usuarios/1", {"papel": "consulta"})
        self.assertEqual(s, 400)

    def test_auditoria_nao_guarda_valores(self):
        self.adm.req("POST", "/api/cidadaos", {"nome": "Sigiloso Fulano", "cpf": "52998224725"})
        _, log = self.adm.req("GET", "/api/auditoria")
        texto = json.dumps(log, ensure_ascii=False)
        self.assertIn("cpf", texto)
        self.assertNotIn("529.982.247-25", texto)
        self.assertNotIn("Sigiloso", texto)

    def test_relatorios(self):
        for rota in ("painel", "notificacoes", "aniversarios", "mapa", "meta"):
            s, _ = self.adm.req("GET", f"/api/{rota}")
            self.assertEqual(s, 200, rota)
        s, csv = self.adm.req("GET", "/api/exportar/cidadaos.csv")
        self.assertEqual(s, 200)
        self.assertTrue(csv.startswith("ID;Nome"))

    def test_documento_upload_e_download(self):
        import base64
        s, d = self.adm.req("POST", "/api/documentos", {"nome": "Ofício", "arquivo": {
            "nome": "../../oficio.txt", "base64": base64.b64encode(b"conteudo").decode()}})
        self.assertEqual(s, 201, d)
        self.assertEqual(d["arquivo"]["nome"], "oficio.txt")
        s, txt = self.adm.req("GET", f"/api/documentos/{d['id']}/arquivo")
        self.assertEqual((s, txt), (200, "conteudo"))

    def test_estatico_sem_path_traversal(self):
        s, txt = self.adm.req("GET", "/../server.py")
        self.assertNotIn("import", txt[:200] if isinstance(txt, str) else "")


if __name__ == "__main__":
    unittest.main()
