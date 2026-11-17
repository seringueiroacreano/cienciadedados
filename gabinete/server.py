#!/usr/bin/env python3
"""Mandato — Gestão de Gabinete Parlamentar.

Servidor web + API REST + banco SQLite, usando somente a biblioteca padrão do Python.

Uso:
    python3 server.py                 # inicia em http://localhost:8000
    python3 server.py --porta 8080
    python3 server.py --schema        # mostra o SQL das tabelas
    python3 server.py --demo          # cria dados fictícios de demonstração

Variáveis de ambiente opcionais:
    GABINETE_DADOS        pasta do banco e dos arquivos (padrão: ./dados)
    GABINETE_ADMIN_EMAIL  login do primeiro administrador (padrão: admin@gabinete.local)
    GABINETE_ADMIN_SENHA  senha inicial do administrador (padrão: gerada e exibida uma vez)
    GABINETE_HTTPS=1      marca o cookie de sessão como Secure (use atrás de HTTPS)
"""
import argparse
import base64
import csv
import hashlib
import hmac
import io
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import sys
import threading
import time
import traceback
import uuid
from datetime import date, datetime, timedelta
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from entidades import ENTIDADES, MENU, MUNICIPIOS_AC, colunas_db, ddl

BASE = os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.join(BASE, "static")
MAX_CORPO = 12 * 1024 * 1024
MAX_ARQUIVO = 8 * 1024 * 1024
SESSAO_HORAS = 12
FECHADAS_DEMANDA = ("Atendida", "Não atendida")


class ErroHTTP(Exception):
    def __init__(self, status, msg, campos=None):
        super().__init__(msg)
        self.status, self.msg, self.campos = status, msg, campos or {}


def agora():
    return datetime.now().replace(microsecond=0).isoformat(sep="T")


def hoje():
    return date.today().isoformat()


# ---------------------------------------------------------------- senhas
def gerar_hash(senha, sal=None):
    sal = sal or secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", senha.encode(), bytes.fromhex(sal), 200_000).hex()
    return h, sal


def confere_senha(senha, h, sal):
    if not h or not sal:
        return False
    return hmac.compare_digest(gerar_hash(senha, sal)[0], h)


# ---------------------------------------------------------------- validação
def cpf_valido(cpf):
    d = re.sub(r"\D", "", cpf)
    if len(d) != 11 or d == d[0] * 11:
        return False
    for n in (9, 10):
        s = sum(int(d[i]) * (n + 1 - i) for i in range(n))
        if (s * 10 % 11) % 10 != int(d[n]):
            return False
    return True


RE_DATA = re.compile(r"^\d{4}-\d{2}-\d{2}$")
RE_DATAHORA = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$")
RE_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normaliza(campo, valor):
    """Converte e valida um valor recebido; devolve (valor, erro)."""
    t = campo["t"]
    if valor is None or (isinstance(valor, str) and valor.strip() == ""):
        return None, None
    try:
        if t in ("int", "money", "ref"):
            if isinstance(valor, bool):
                raise ValueError
            return int(valor), None
        if t == "bool":
            return (1 if valor in (True, 1, "1", "true", "on", "sim") else 0), None
    except (TypeError, ValueError):
        return None, "número inválido"
    if not isinstance(valor, str):
        return None, "texto inválido"
    v = valor.strip()
    if len(v) > 20000:
        return None, "texto longo demais"
    if t == "date":
        if not RE_DATA.match(v):
            return None, "data inválida (use AAAA-MM-DD)"
        try:
            date.fromisoformat(v)
        except ValueError:
            return None, "data inexistente"
    elif t == "datetime" and not RE_DATAHORA.match(v):
        return None, "data e hora inválidas"
    elif t == "email" and not RE_EMAIL.match(v):
        return None, "e-mail inválido"
    elif t == "cpf":
        if not cpf_valido(v):
            return None, "CPF inválido"
        d = re.sub(r"\D", "", v)
        v = f"{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}"
    elif t == "cep":
        d = re.sub(r"\D", "", v)
        if len(d) != 8:
            return None, "CEP deve ter 8 dígitos"
        v = f"{d[:5]}-{d[5:]}"
    elif t == "uf":
        v = v.upper()
        if not re.fullmatch(r"[A-Z]{2}", v):
            return None, "UF deve ter 2 letras"
    elif t == "url" and not re.match(r"^https?://", v):
        return None, "endereço deve começar com http:// ou https://"
    elif t == "select" and v not in campo.get("opcoes", []):
        return None, "opção inválida"
    elif t == "phone":
        d = re.sub(r"\D", "", v)
        if len(d) not in (10, 11):
            return None, "telefone deve ter DDD + número"
        v = f"({d[:2]}) {d[2:-4]}-{d[-4:]}"
    elif t == "tags":
        v = ", ".join(dict.fromkeys(x.strip() for x in v.split(",") if x.strip()))
    return v, None


# ---------------------------------------------------------------- aplicação
class App:
    def __init__(self, pasta_dados):
        self.pasta = pasta_dados
        self.arquivos = os.path.join(pasta_dados, "arquivos")
        os.makedirs(self.arquivos, exist_ok=True)
        self.db_path = os.path.join(pasta_dados, "gabinete.db")
        self.falhas_login = {}
        self.trava = threading.Lock()
        self.senha_inicial = None
        self.iniciar_banco()

    def conectar(self):
        db = sqlite3.connect(self.db_path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        return db

    def iniciar_banco(self):
        db = self.conectar()
        with db:
            db.execute("PRAGMA journal_mode=WAL")
            db.executescript(ddl())
            if not db.execute("SELECT 1 FROM usuarios LIMIT 1").fetchone():
                email = os.environ.get("GABINETE_ADMIN_EMAIL", "admin@gabinete.local")
                senha = os.environ.get("GABINETE_ADMIN_SENHA") or secrets.token_urlsafe(9)
                if not os.environ.get("GABINETE_ADMIN_SENHA"):
                    self.senha_inicial = (email, senha)
                h, sal = gerar_hash(senha)
                db.execute("INSERT INTO usuarios (nome,email,papel,ativo,senha_hash,senha_sal,criado_em) "
                           "VALUES (?,?,?,?,?,?,?)", ("Administrador", email, "admin", 1, h, sal, agora()))
            if not db.execute("SELECT 1 FROM gabinete WHERE id=1").fetchone():
                db.execute("INSERT INTO gabinete (id,parlamentar,uf,casa,criado_em) VALUES (1,?,?,?,?)",
                           ("Nome do(a) parlamentar", "AC", "Assembleia Legislativa do Estado do Acre", agora()))
        db.close()

    # ------------------------------------------------------------ sessão
    def autenticar(self, db, email, senha, ip):
        with self.trava:
            janela = [t for t in self.falhas_login.get(ip, []) if t > time.time() - 900]
            self.falhas_login[ip] = janela
            if len(janela) >= 10:
                raise ErroHTTP(429, "Muitas tentativas. Aguarde 15 minutos.")
        u = db.execute("SELECT * FROM usuarios WHERE lower(email)=lower(?)", (email or "",)).fetchone()
        if not u or not u["ativo"] or not confere_senha(senha or "", u["senha_hash"], u["senha_sal"]):
            with self.trava:
                self.falhas_login[ip].append(time.time())
            raise ErroHTTP(401, "E-mail ou senha incorretos.")
        token = secrets.token_urlsafe(32)
        expira = (datetime.now() + timedelta(hours=SESSAO_HORAS)).isoformat()
        db.execute("DELETE FROM sessoes WHERE expira_em < ?", (datetime.now().isoformat(),))
        db.execute("INSERT INTO sessoes VALUES (?,?,?)", (token, u["id"], expira))
        db.execute("UPDATE usuarios SET ultimo_login=? WHERE id=?", (agora()[:16], u["id"]))
        self.auditar(db, u, "login", "usuarios", u["id"])
        return token, u

    def usuario_da_sessao(self, db, token):
        if not token:
            return None
        return db.execute(
            "SELECT u.* FROM sessoes s JOIN usuarios u ON u.id=s.usuario_id "
            "WHERE s.token=? AND s.expira_em>? AND u.ativo=1", (token, datetime.now().isoformat())).fetchone()

    @staticmethod
    def auditar(db, usuario, acao, entidade=None, registro_id=None, detalhe=None):
        db.execute("INSERT INTO auditoria (ts,usuario_id,usuario_nome,acao,entidade,registro_id,detalhe) "
                   "VALUES (?,?,?,?,?,?,?)",
                   (agora(), usuario["id"] if usuario else None, usuario["nome"] if usuario else None,
                    acao, entidade, registro_id, detalhe))

    # ------------------------------------------------------------ permissões
    @staticmethod
    def pode(usuario, ent, escrita):
        meta = ENTIDADES[ent]
        papel = usuario["papel"]
        if meta.get("admin"):
            return papel == "admin"
        if escrita and meta.get("admin_escrita"):
            return papel == "admin"
        return papel in ("admin", "assessor") if escrita else True

    # ------------------------------------------------------------ consultas genéricas
    @staticmethod
    def select_sql(ent):
        meta = ENTIDADES[ent]
        partes = ["t.id", "t.criado_em", "t.atualizado_em"]
        partes += [f"t.{c}" for c, _ in colunas_db(ent)]
        for c in meta["campos"]:
            if c["t"] == "ref":
                alvo = ENTIDADES[c["ref"]]
                partes.append(f"(SELECT r.{alvo['titulo']} FROM {c['ref']} r WHERE r.id=t.{c['n']}) "
                              f"AS {c['n']}__rotulo")
        for nome, (_, _, expr) in meta.get("calc", {}).items():
            partes.append(f"{expr} AS {nome}")
        return f"SELECT {', '.join(partes)} FROM {ent} t"

    @staticmethod
    def linha(ent, row):
        d = dict(row)
        for c in ENTIDADES[ent]["campos"]:
            if c["t"] == "file":
                n = c["n"]
                caminho = d.pop(f"{n}_caminho", None)
                d[n] = {"nome": d.pop(f"{n}_nome", None), "mime": d.pop(f"{n}_mime", None),
                        "tamanho": d.pop(f"{n}_tamanho", None)} if caminho else None
            elif c["t"] == "bool" and c["n"] in d:
                d[c["n"]] = bool(d[c["n"]])
        return d

    def filtros(self, ent, params):
        meta = ENTIDADES[ent]
        onde, args = [], []
        nomes = {c["n"]: c for c in meta["campos"] if not c.get("virtual") and c["t"] != "file"}
        q = (params.get("q") or "").strip()
        if q:
            busca = [c["n"] for c in meta["campos"] if c.get("busca")]
            onde.append("(" + " OR ".join(f"t.{b} LIKE ?" for b in busca) + ")")
            args += [f"%{q}%"] * len(busca)
        for chave, valor in params.items():
            if valor in (None, ""):
                continue
            base, _, op = chave.partition("__")
            if base in ("criado_em", "atualizado_em"):
                campo = {"t": "datetime"}
            elif base in nomes:
                campo = nomes[base]
            else:
                continue
            if op == "de":
                onde.append(f"t.{base} >= ?")
                args.append(valor)
            elif op == "ate":
                onde.append(f"t.{base} <= ?")
                args.append(valor + ("T23:59:59" if campo["t"] == "datetime" and len(valor) == 10 else ""))
            elif op == "" and campo["t"] == "tags":
                onde.append(f"(', ' || t.{base} || ',') LIKE ?")
                args.append(f"%, {valor.strip()},%")
            elif op == "" and campo["t"] in ("text", "textarea"):
                onde.append(f"t.{base} LIKE ?")
                args.append(f"%{valor}%")
            elif op == "":
                if campo["t"] == "bool":
                    valor = 1 if valor in ("1", "true", "sim") else 0
                if valor == "__vazio":
                    onde.append(f"t.{base} IS NULL")
                    continue
                onde.append(f"t.{base} = ?")
                args.append(valor)
        return onde, args

    def listar(self, db, ent, params, limite_max=500):
        meta = ENTIDADES[ent]
        onde, args = self.filtros(ent, params)
        where = (" WHERE " + " AND ".join(onde)) if onde else ""
        total = db.execute(f"SELECT COUNT(*) FROM {ent} t{where}", args).fetchone()[0]
        ordem = meta["ordem"]
        pedido = params.get("ordem", "")
        validas = {c for c, _ in colunas_db(ent)} | {"id", "criado_em", "atualizado_em"} | set(meta.get("calc", {}))
        if pedido.lstrip("-") in validas:
            ordem = f"{pedido.lstrip('-')} {'DESC' if pedido.startswith('-') else 'ASC'}"
        try:
            limite = max(1, min(int(params.get("limite", 50)), limite_max))
            desloc = max(0, int(params.get("desloc", 0)))
        except ValueError:
            raise ErroHTTP(400, "Paginação inválida.")
        rows = db.execute(f"{self.select_sql(ent)}{where} ORDER BY {ordem} LIMIT ? OFFSET ?",
                          args + [limite, desloc]).fetchall()
        return {"itens": [self.linha(ent, r) for r in rows], "total": total}

    def obter(self, db, ent, rid):
        row = db.execute(f"{self.select_sql(ent)} WHERE t.id=?", (rid,)).fetchone()
        if not row:
            raise ErroHTTP(404, "Registro não encontrado.")
        return self.linha(ent, row)

    # ------------------------------------------------------------ gravação
    def preparar(self, db, ent, corpo, criando, rid=None):
        meta = ENTIDADES[ent]
        valores, erros, arquivos = {}, {}, {}
        for c in meta["campos"]:
            n = c["n"]
            if c.get("somente_leitura") or c.get("auto") or n not in corpo:
                continue
            if c["t"] == "file":
                arq = corpo[n]
                if arq:
                    if not isinstance(arq, dict) or not arq.get("base64"):
                        erros[n] = "arquivo inválido"
                        continue
                    try:
                        dados = base64.b64decode(arq["base64"], validate=True)
                    except ValueError:
                        erros[n] = "arquivo corrompido"
                        continue
                    if len(dados) > MAX_ARQUIVO:
                        erros[n] = "arquivo maior que 8 MB"
                        continue
                    nome = os.path.basename(str(arq.get("nome") or "arquivo"))[:180]
                    mime = mimetypes.guess_type(nome)[0] or "application/octet-stream"
                    arquivos[n] = (nome, mime, dados)
                continue
            if c.get("virtual"):
                continue
            v, e = normaliza(c, corpo[n])
            if e:
                erros[n] = e
            valores[n] = v
        if ent == "usuarios" and corpo.get("senha"):
            if len(str(corpo["senha"])) < 8:
                erros["senha"] = "mínimo de 8 caracteres"
            else:
                valores["senha_hash"], valores["senha_sal"] = gerar_hash(str(corpo["senha"]))
        if ent == "usuarios" and criando and not corpo.get("senha"):
            erros["senha"] = "informe a senha inicial"
        for c in meta["campos"]:
            n = c["n"]
            if c.get("auto") or c.get("virtual") or c.get("somente_leitura"):
                continue
            ausente = valores.get(n) is None and n not in arquivos
            if c.get("req") and ausente and (criando or n in valores):
                erros[n] = "obrigatório"
            if c["t"] == "ref" and valores.get(n) is not None:
                if not db.execute(f"SELECT 1 FROM {c['ref']} WHERE id=?", (valores[n],)).fetchone():
                    erros[n] = "registro relacionado não existe"
            if c.get("unico") and valores.get(n) is not None:
                dup = db.execute(f"SELECT id FROM {ent} WHERE lower({n})=lower(?) AND id IS NOT ?",
                                 (valores[n], rid)).fetchone()
                if dup:
                    erros[n] = "já cadastrado"
        if erros:
            raise ErroHTTP(400, "Verifique os campos destacados.", erros)
        for n, (nome, mime, dados) in arquivos.items():
            caminho = uuid.uuid4().hex
            with open(os.path.join(self.arquivos, caminho), "wb") as f:
                f.write(dados)
            valores.update({f"{n}_nome": nome, f"{n}_mime": mime, f"{n}_tamanho": len(dados),
                            f"{n}_caminho": caminho})
        return valores

    def criar(self, db, ent, corpo, usuario):
        meta = ENTIDADES[ent]
        if meta.get("unico"):
            raise ErroHTTP(405, "Este cadastro é único; use edição.")
        for c in meta["campos"]:  # padrões
            if c["n"] not in corpo and "padrao" in c:
                p = c["padrao"]
                corpo[c["n"]] = hoje() if p == "hoje" else date.today().year if p == "ano" else p
        valores = self.preparar(db, ent, corpo, True)
        valores.update(criado_em=agora(), atualizado_em=agora(), criado_por=usuario["id"])
        cols = ", ".join(valores)
        cur = db.execute(f"INSERT INTO {ent} ({cols}) VALUES ({', '.join('?' * len(valores))})",
                         list(valores.values()))
        rid = cur.lastrowid
        if ent == "demandas":
            db.execute("UPDATE demandas SET protocolo=? WHERE id=?", (f"{date.today().year}-{rid:05d}", rid))
        self.apos_gravar(db, ent, rid, usuario)
        self.auditar(db, usuario, "criar", ent, rid, self.resumo_campos(valores))
        return self.obter(db, ent, rid)

    def atualizar(self, db, ent, rid, corpo, usuario):
        antigo = db.execute(f"SELECT * FROM {ent} WHERE id=?", (rid,)).fetchone()
        if not antigo:
            raise ErroHTTP(404, "Registro não encontrado.")
        valores = self.preparar(db, ent, corpo, False, rid)
        if ent == "usuarios":
            self.protege_admin(db, rid, valores, usuario)
        mudou = {k: v for k, v in valores.items() if k in antigo.keys() and antigo[k] != v}
        if mudou:
            mudou["atualizado_em"] = agora()
            sets = ", ".join(f"{k}=?" for k in mudou)
            db.execute(f"UPDATE {ent} SET {sets} WHERE id=?", list(mudou.values()) + [rid])
            if ent == "usuarios" and ("senha_hash" in mudou or mudou.get("ativo") == 0):
                db.execute("DELETE FROM sessoes WHERE usuario_id=? AND usuario_id<>?", (rid, usuario["id"]))
            self.apos_gravar(db, ent, rid, usuario)
            self.auditar(db, usuario, "editar", ent, rid, self.resumo_campos(mudou))
        return self.obter(db, ent, rid)

    def excluir(self, db, ent, rid, usuario):
        if ENTIDADES[ent].get("unico"):
            raise ErroHTTP(405, "Este cadastro não pode ser excluído.")
        row = db.execute(f"SELECT * FROM {ent} WHERE id=?", (rid,)).fetchone()
        if not row:
            raise ErroHTTP(404, "Registro não encontrado.")
        if ent == "usuarios":
            if rid == usuario["id"]:
                raise ErroHTTP(400, "Você não pode excluir o próprio usuário.")
            self.protege_admin(db, rid, {"papel": None}, usuario)
        emenda = row["emenda_id"] if ent == "pagamentos" else None
        db.execute(f"DELETE FROM {ent} WHERE id=?", (rid,))
        for c in ENTIDADES[ent]["campos"]:
            if c["t"] == "file" and row[f"{c['n']}_caminho"]:
                try:
                    os.remove(os.path.join(self.arquivos, row[f"{c['n']}_caminho"]))
                except OSError:
                    pass
        if emenda:
            self.status_emenda(db, emenda, usuario)
        self.auditar(db, usuario, "excluir", ent, rid)

    @staticmethod
    def resumo_campos(valores):
        """Registra só os NOMES dos campos alterados — nunca os valores (minimização, LGPD)."""
        ocultos = {"criado_em", "atualizado_em", "criado_por", "senha_hash", "senha_sal"}
        nomes = sorted(k for k in valores if k not in ocultos)
        if "senha_hash" in valores:
            nomes.append("senha")
        return ", ".join(nomes)

    @staticmethod
    def protege_admin(db, rid, valores, usuario):
        alvo = db.execute("SELECT papel, ativo FROM usuarios WHERE id=?", (rid,)).fetchone()
        if not alvo or alvo["papel"] != "admin":
            return
        perde = ("papel" in valores and valores["papel"] != "admin") or valores.get("ativo") == 0
        if perde:
            n = db.execute("SELECT COUNT(*) FROM usuarios WHERE papel='admin' AND ativo=1").fetchone()[0]
            if n <= 1:
                raise ErroHTTP(400, "É preciso manter ao menos um administrador ativo.")

    def apos_gravar(self, db, ent, rid, usuario):
        if ent == "pagamentos":
            emenda = db.execute("SELECT emenda_id FROM pagamentos WHERE id=?", (rid,)).fetchone()
            if emenda:
                self.status_emenda(db, emenda[0], usuario)

    def status_emenda(self, db, emenda_id, usuario):
        """Atualiza o status da emenda conforme os pagamentos lançados."""
        e = db.execute("SELECT valor, status FROM emendas WHERE id=?", (emenda_id,)).fetchone()
        if not e or e["status"] == "Arquivada / Não atendida":
            return
        pago = db.execute("SELECT COALESCE(SUM(valor),0) FROM pagamentos WHERE emenda_id=?",
                          (emenda_id,)).fetchone()[0]
        if pago <= 0:
            novo = e["status"] if e["status"] not in ("Paga", "Paga parcialmente") else "Empenhada"
        elif e["valor"] and pago >= e["valor"]:
            novo = "Paga"
        else:
            novo = "Paga parcialmente"
        if novo != e["status"]:
            db.execute("UPDATE emendas SET status=?, atualizado_em=? WHERE id=?", (novo, agora(), emenda_id))
            self.auditar(db, usuario, "status automático", "emendas", emenda_id, f"{e['status']} → {novo}")

    # ------------------------------------------------------------ relatórios
    def painel(self, db):
        h = hoje()
        d30 = (date.today() - timedelta(days=30)).isoformat()
        um = lambda sql, *a: db.execute(sql, a).fetchone()[0]  # noqa: E731
        por = lambda sql, *a: [dict(r) for r in db.execute(sql, a).fetchall()]  # noqa: E731
        dem_status = por("SELECT status AS chave, COUNT(*) AS n FROM demandas GROUP BY status")
        total_dem = sum(x["n"] for x in dem_status)
        atendidas = next((x["n"] for x in dem_status if x["chave"] == "Atendida"), 0)
        ano = date.today().year
        return {
            "cidadaos": um("SELECT COUNT(*) FROM cidadaos"),
            "cidadaos_novos_30d": um("SELECT COUNT(*) FROM cidadaos WHERE criado_em>=?", d30),
            "liderancas": um("SELECT COUNT(*) FROM cidadaos WHERE lider=1"),
            "demandas_total": total_dem,
            "demandas_abertas": um(f"SELECT COUNT(*) FROM demandas WHERE status NOT IN {FECHADAS_DEMANDA}"),
            "demandas_atrasadas": um(f"SELECT COUNT(*) FROM demandas WHERE prazo<? AND status NOT IN "
                                     f"{FECHADAS_DEMANDA}", h),
            "taxa_resolucao": round(100 * atendidas / total_dem) if total_dem else None,
            "demandas_por_status": dem_status,
            "demandas_por_categoria": por("SELECT COALESCE(categoria,'Sem categoria') AS chave, COUNT(*) AS n "
                                          "FROM demandas GROUP BY chave ORDER BY n DESC"),
            "atendimentos_30d": um("SELECT COUNT(*) FROM atendimentos WHERE data>=?", d30),
            "atendimentos_por_canal": por("SELECT canal AS chave, COUNT(*) AS n FROM atendimentos "
                                          "WHERE data>=? GROUP BY canal ORDER BY n DESC", d30),
            "emendas_ano": ano,
            "emendas": dict(db.execute(
                "SELECT COUNT(*) AS n, COALESCE(SUM(valor),0) AS indicado, "
                "COALESCE(SUM(valor_empenhado),0) AS empenhado, "
                "(SELECT COALESCE(SUM(p.valor),0) FROM pagamentos p JOIN emendas e2 ON e2.id=p.emenda_id "
                " WHERE e2.ano=?) AS pago FROM emendas WHERE ano=?", (ano, ano)).fetchone()),
            "emendas_por_status": por("SELECT status AS chave, COUNT(*) AS n, COALESCE(SUM(valor),0) AS valor "
                                      "FROM emendas WHERE ano=? GROUP BY status", ano),
            "tarefas_abertas": um("SELECT COUNT(*) FROM tarefas WHERE status<>'Concluída'"),
            "tarefas_atrasadas": um("SELECT COUNT(*) FROM tarefas WHERE status<>'Concluída' AND prazo<?", h),
            "proximos_compromissos": por(
                "SELECT id, titulo, inicio, local, municipio FROM agenda WHERE substr(inicio,1,10) BETWEEN ? AND ? "
                "ORDER BY inicio LIMIT 8", h, (date.today() + timedelta(days=7)).isoformat()),
        }

    def notificacoes(self, db, dia):
        md = dia[5:]
        por = lambda sql, *a: [dict(r) for r in db.execute(sql, a).fetchall()]  # noqa: E731
        return {
            "data": dia,
            "tarefas": por("SELECT t.id, t.titulo, t.descricao, t.prazo, t.prioridade, u.nome AS responsavel "
                           "FROM tarefas t LEFT JOIN usuarios u ON u.id=t.responsavel_id "
                           "WHERE t.status<>'Concluída' AND t.prazo<=? ORDER BY t.prazo", dia),
            "aniversariantes": por(
                "SELECT id, nome, telefone, whatsapp, consentimento, 'cidadaos' AS origem, "
                "CAST(substr(?,1,4) AS INTEGER) - CAST(substr(nascimento,1,4) AS INTEGER) AS idade "
                "FROM cidadaos WHERE substr(nascimento,6,5)=? "
                "UNION ALL SELECT id, nome, telefone, NULL, 0, 'autoridades', NULL FROM autoridades "
                "WHERE substr(aniversario,6,5)=? ORDER BY nome", dia, md, md),
            "compromissos": por("SELECT id, titulo, inicio, fim, local, municipio FROM agenda "
                                "WHERE substr(inicio,1,10)=? ORDER BY inicio", dia),
            "lembretes": por("SELECT l.id, l.data, l.motivo, c.nome AS cidadao, c.telefone, c.id AS cidadao_id "
                             "FROM lembretes l JOIN cidadaos c ON c.id=l.cidadao_id "
                             "WHERE COALESCE(l.feito,0)=0 AND l.data<=? ORDER BY l.data", dia),
            "demandas_vencidas": por(f"SELECT id, protocolo, titulo, prazo, status FROM demandas WHERE prazo<? "
                                     f"AND status NOT IN {FECHADAS_DEMANDA} ORDER BY prazo", dia),
        }

    def aniversarios(self, db, p):
        ini = p.get("inicio") or hoje()
        fim = p.get("fim") or ini
        for d in (ini, fim):
            if not RE_DATA.match(d):
                raise ErroHTTP(400, "Datas inválidas.")
        a, b = ini[5:], fim[5:]
        cond = "BETWEEN ? AND ?" if a <= b else None

        def faixa(col):
            if cond:
                return f"substr({col},6,5) BETWEEN ? AND ?", [a, b]
            return f"(substr({col},6,5) >= ? OR substr({col},6,5) <= ?)", [a, b]

        ano = int(ini[:4])
        if p.get("autoridade") in ("1", "true"):
            w, args = faixa("aniversario")
            sql = (f"SELECT id, nome, cargo AS tags, telefone, NULL AS whatsapp, aniversario AS nascimento, "
                   f"0 AS consentimento, 'autoridades' AS origem FROM autoridades WHERE {w}")
        else:
            w, args = faixa("nascimento")
            sql = (f"SELECT id, nome, tags, telefone, whatsapp, nascimento, consentimento, lider, "
                   f"'cidadaos' AS origem FROM cidadaos WHERE {w}")
            if p.get("lider") in ("1", "true"):
                sql += " AND lider=1"
            if p.get("criado_por"):
                sql += " AND criado_por=?"
                args.append(p["criado_por"])
        rows = [dict(r) for r in db.execute(sql + " ORDER BY substr(" + (
            "aniversario" if "autoridades" in sql else "nascimento") + ",6,5), nome", args)]
        for r in rows:
            r["idade"] = ano - int(r["nascimento"][:4]) if r.get("nascimento") else None
            r["dia"] = r["nascimento"][8:10] + "/" + r["nascimento"][5:7] if r.get("nascimento") else ""
        return rows

    def mapa(self, db):
        dados = {}

        def soma(sql, chave):
            for r in db.execute(sql):
                m = r[0] or "Não informado"
                dados.setdefault(m, {"municipio": m, "cidadaos": 0, "demandas": 0, "demandas_abertas": 0,
                                     "emendas": 0, "emendas_valor": 0, "emendas_pago": 0})
                for i, k in enumerate(chave):
                    dados[m][k] += r[i + 1] or 0

        soma("SELECT municipio, COUNT(*) FROM cidadaos GROUP BY municipio", ["cidadaos"])
        soma(f"SELECT municipio, COUNT(*), SUM(status NOT IN {FECHADAS_DEMANDA}) FROM demandas GROUP BY municipio",
             ["demandas", "demandas_abertas"])
        soma("SELECT municipio, COUNT(*), SUM(valor), SUM((SELECT COALESCE(SUM(p.valor),0) FROM pagamentos p "
             "WHERE p.emenda_id=e.id)) FROM emendas e GROUP BY municipio",
             ["emendas", "emendas_valor", "emendas_pago"])
        return sorted(dados.values(), key=lambda x: (-x["cidadaos"] - x["demandas"], x["municipio"]))

    def titular(self, db, cid):
        """Relatório LGPD (art. 18): todos os dados de um cidadão mantidos pelo gabinete."""
        c = self.obter(db, "cidadaos", cid)
        rel = {"cidadao": c}
        for ent, col in ENTIDADES["cidadaos"]["filhos"] + [["emendas", "cidadao_id"]]:
            rel[ent] = [self.linha(ent, r) for r in db.execute(f"{self.select_sql(ent)} WHERE t.{col}=?", (cid,))]
        rel["gerado_em"] = agora()
        return rel

    def csv(self, ent, dados):
        meta = ENTIDADES[ent]
        campos = [c for c in meta["campos"] if not c.get("virtual")]
        calc = meta.get("calc", {})
        buf = io.StringIO()
        w = csv.writer(buf, delimiter=";")
        w.writerow(["ID"] + [c["l"] for c in campos] + [v[0] for v in calc.values()] + ["Criado em"])

        def fmt(c, v, row):
            if v is None:
                return ""
            if c["t"] == "money":
                return f"{v / 100:.2f}".replace(".", ",")
            if c["t"] == "bool":
                return "Sim" if v else "Não"
            if c["t"] == "ref":
                return row.get(c["n"] + "__rotulo") or v
            if c["t"] == "file":
                return v.get("nome") if v else ""
            return v

        for r in dados:
            w.writerow([r["id"]] + [fmt(c, r.get(c["n"]), r) for c in campos] +
                       [fmt({"t": t}, r.get(n), r) for n, (_, t, _) in calc.items()] + [r.get("criado_em")])
        return "﻿" + buf.getvalue()


# ---------------------------------------------------------------- HTTP
class Handler(BaseHTTPRequestHandler):
    app: App = None
    server_version = "Mandato/1.0"
    sys_version = ""

    def log_message(self, fmt, *args):  # registro enxuto, sem dados pessoais da URL
        sys.stderr.write(f"{self.log_date_time_string()} {self.command} {urlparse(self.path).path} {args[1]}\n")

    def do_GET(self):
        self.tratar("GET")

    def do_POST(self):
        self.tratar("POST")

    def do_PUT(self):
        self.tratar("PUT")

    def do_DELETE(self):
        self.tratar("DELETE")

    # ------------------------------------------------------------ respostas
    def cabecalhos_seguranca(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy",
                         "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
                         "img-src 'self' data:; connect-src 'self' https://viacep.com.br; frame-ancestors 'none'")

    def enviar(self, status, corpo, tipo, extra=None):
        if getattr(self, "_adiar", False):  # dentro de transação: envia só após o COMMIT
            self._pendente = (status, corpo, tipo, extra)
            return
        dados = corpo.encode() if isinstance(corpo, str) else corpo
        self.send_response(status)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(dados)))
        self.send_header("Cache-Control", "no-store")
        self.cabecalhos_seguranca()
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(dados)

    def json(self, status, obj, extra=None):
        self.enviar(status, json.dumps(obj, ensure_ascii=False, default=str), "application/json; charset=utf-8",
                    extra)

    def corpo(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_CORPO:
            raise ErroHTTP(413, "Envio grande demais.")
        if not n:
            return {}
        try:
            obj = json.loads(self.rfile.read(n))
        except (ValueError, UnicodeDecodeError):
            raise ErroHTTP(400, "JSON inválido.")
        if not isinstance(obj, dict):
            raise ErroHTTP(400, "Esperado um objeto JSON.")
        return obj

    def token(self):
        c = cookies.SimpleCookie(self.headers.get("Cookie", ""))
        return c["sessao"].value if "sessao" in c else None

    def cookie(self, valor, idade):
        seguro = "; Secure" if os.environ.get("GABINETE_HTTPS") else ""
        return f"sessao={valor}; HttpOnly; SameSite=Strict; Path=/; Max-Age={idade}{seguro}"

    # ------------------------------------------------------------ roteamento
    def tratar(self, metodo):
        url = urlparse(self.path)
        try:
            if not url.path.startswith("/api/"):
                if metodo != "GET":
                    raise ErroHTTP(405, "Método não permitido.")
                return self.estatico(url.path)
            if metodo != "GET" and self.headers.get("X-Requested-With") != "fetch":
                raise ErroHTTP(403, "Requisição recusada (proteção CSRF).")
            params = {k: v[-1] for k, v in parse_qs(url.query).items()}
            partes = [p for p in url.path[5:].split("/") if p]
            db = self.app.conectar()
            self._adiar, self._pendente = True, None
            try:
                with db:
                    self.api(db, metodo, partes, params)
            finally:
                self._adiar = False
                db.close()
            if self._pendente:
                self.enviar(*self._pendente)
        except ErroHTTP as e:
            self._adiar = False
            self.json(e.status, {"erro": e.msg, "campos": e.campos})
        except Exception:  # pragma: no cover - erro inesperado
            self._adiar = False
            traceback.print_exc()
            self.json(500, {"erro": "Erro interno no servidor."})

    def estatico(self, caminho):
        rel = "index.html" if caminho in ("/", "") else caminho.lstrip("/")
        alvo = os.path.realpath(os.path.join(STATIC, rel))
        if not alvo.startswith(os.path.realpath(STATIC) + os.sep) or not os.path.isfile(alvo):
            alvo = os.path.join(STATIC, "index.html")
        tipo = mimetypes.guess_type(alvo)[0] or "application/octet-stream"
        if tipo.startswith("text/") or tipo in ("application/javascript",):
            tipo += "; charset=utf-8"
        with open(alvo, "rb") as f:
            self.enviar(200, f.read(), tipo)

    def api(self, db, metodo, partes, p):
        app = self.app
        if partes == ["login"] and metodo == "POST":
            c = self.corpo()
            token, u = app.autenticar(db, c.get("email"), c.get("senha"), self.client_address[0])
            return self.json(200, {"usuario": {"id": u["id"], "nome": u["nome"], "papel": u["papel"]}},
                             {"Set-Cookie": self.cookie(token, SESSAO_HORAS * 3600)})
        usuario = app.usuario_da_sessao(db, self.token())
        if not usuario:
            raise ErroHTTP(401, "Sessão expirada. Entre novamente.")
        if partes == ["logout"] and metodo == "POST":
            db.execute("DELETE FROM sessoes WHERE token=?", (self.token(),))
            return self.json(200, {"ok": True}, {"Set-Cookie": self.cookie("", 0)})
        if partes == ["meta"]:
            ents = {k: v for k, v in ENTIDADES.items() if app.pode(usuario, k, False)}
            return self.json(200, {
                "usuario": {"id": usuario["id"], "nome": usuario["nome"], "papel": usuario["papel"]},
                "entidades": ents, "menu": MENU, "municipios": MUNICIPIOS_AC,
                "gabinete": dict(db.execute("SELECT parlamentar, partido, uf FROM gabinete WHERE id=1").fetchone()),
            })
        if partes == ["minha-senha"] and metodo == "PUT":
            c = self.corpo()
            if not confere_senha(c.get("atual", ""), usuario["senha_hash"], usuario["senha_sal"]):
                raise ErroHTTP(400, "Senha atual incorreta.", {"atual": "incorreta"})
            if len(c.get("nova", "")) < 8:
                raise ErroHTTP(400, "A nova senha deve ter ao menos 8 caracteres.", {"nova": "mínimo 8"})
            h, s = gerar_hash(c["nova"])
            db.execute("UPDATE usuarios SET senha_hash=?, senha_sal=? WHERE id=?", (h, s, usuario["id"]))
            db.execute("DELETE FROM sessoes WHERE usuario_id=? AND token<>?", (usuario["id"], self.token()))
            app.auditar(db, usuario, "trocar senha", "usuarios", usuario["id"])
            return self.json(200, {"ok": True})
        if partes == ["painel"]:
            return self.json(200, app.painel(db))
        if partes == ["notificacoes"]:
            dia = p.get("data") or hoje()
            if not RE_DATA.match(dia):
                raise ErroHTTP(400, "Data inválida.")
            return self.json(200, app.notificacoes(db, dia))
        if partes == ["aniversarios"]:
            return self.json(200, app.aniversarios(db, p))
        if partes == ["mapa"]:
            return self.json(200, app.mapa(db))
        if partes == ["auditoria"]:
            if usuario["papel"] != "admin":
                raise ErroHTTP(403, "Apenas administradores.")
            lim = min(int(p.get("limite", 200) or 200), 1000)
            rows = db.execute("SELECT * FROM auditoria ORDER BY id DESC LIMIT ?", (lim,)).fetchall()
            return self.json(200, [dict(r) for r in rows])
        if len(partes) == 2 and partes[0] == "opcoes" and partes[1] in ENTIDADES:
            ent = partes[1]
            t = ENTIDADES[ent]["titulo"]
            q = f"%{p.get('q', '')}%"
            rows = db.execute(f"SELECT id, {t} AS rotulo FROM {ent} WHERE COALESCE({t},'') LIKE ? "
                              f"ORDER BY {t} LIMIT 2000", (q,)).fetchall()
            return self.json(200, [dict(r) for r in rows])
        if len(partes) == 2 and partes[0] == "exportar" and partes[1].removesuffix(".csv") in ENTIDADES:
            ent = partes[1].removesuffix(".csv")
            if not app.pode(usuario, ent, False):
                raise ErroHTTP(403, "Sem permissão.")
            dados = app.listar(db, ent, {**p, "limite": 100000}, limite_max=100000)["itens"]
            app.auditar(db, usuario, "exportar", ent, None, f"{len(dados)} registros")
            return self.enviar(200, app.csv(ent, dados), "text/csv; charset=utf-8",
                               {"Content-Disposition": f'attachment; filename="{ent}-{hoje()}.csv"'})

        if not partes or partes[0] not in ENTIDADES:
            raise ErroHTTP(404, "Recurso não encontrado.")
        ent = partes[0]
        meta = ENTIDADES[ent]
        escrita = metodo != "GET"
        if not app.pode(usuario, ent, escrita):
            raise ErroHTTP(403, "Seu perfil não tem permissão para esta ação.")
        rid = None
        if len(partes) >= 2:
            try:
                rid = int(partes[1])
            except ValueError:
                raise ErroHTTP(404, "Recurso não encontrado.")
        if meta.get("unico") and rid is None and metodo == "GET":
            return self.json(200, app.obter(db, ent, 1))
        if len(partes) == 3 and ent == "cidadaos" and partes[2] == "titular" and metodo == "GET":
            rel = app.titular(db, rid)
            app.auditar(db, usuario, "relatório do titular (LGPD)", ent, rid)
            return self.json(200, rel)
        if len(partes) == 3 and ent == "documentos" and partes[2] == "arquivo" and metodo == "GET":
            row = db.execute("SELECT arquivo_nome, arquivo_mime, arquivo_caminho FROM documentos WHERE id=?",
                             (rid,)).fetchone()
            if not row or not row["arquivo_caminho"]:
                raise ErroHTTP(404, "Arquivo não encontrado.")
            with open(os.path.join(app.arquivos, row["arquivo_caminho"]), "rb") as f:
                dados = f.read()
            nome = re.sub(r'[^\w.\- ]', "_", row["arquivo_nome"])
            app.auditar(db, usuario, "baixar arquivo", ent, rid)
            return self.enviar(200, dados, row["arquivo_mime"] or "application/octet-stream",
                               {"Content-Disposition": f'attachment; filename="{nome}"'})
        if len(partes) > 2:
            raise ErroHTTP(404, "Recurso não encontrado.")
        if metodo == "GET" and rid is None:
            return self.json(200, app.listar(db, ent, p))
        if metodo == "GET":
            reg = app.obter(db, ent, rid)
            if ent == "cidadaos":
                app.auditar(db, usuario, "visualizar", ent, rid)
            return self.json(200, reg)
        if metodo == "POST" and rid is None:
            return self.json(201, app.criar(db, ent, self.corpo(), usuario))
        if metodo == "PUT" and rid is not None:
            return self.json(200, app.atualizar(db, ent, rid, self.corpo(), usuario))
        if metodo == "DELETE" and rid is not None:
            app.excluir(db, ent, rid, usuario)
            return self.json(200, {"ok": True})
        raise ErroHTTP(405, "Método não permitido.")


def criar_servidor(pasta_dados, porta=8000, host="127.0.0.1"):
    app = App(pasta_dados)
    handler = type("H", (Handler,), {"app": app})
    return ThreadingHTTPServer((host, porta), handler), app


def main():
    ap = argparse.ArgumentParser(description="Mandato — Gestão de Gabinete Parlamentar")
    ap.add_argument("--porta", type=int, default=int(os.environ.get("PORT", 8000)))
    ap.add_argument("--host", default="127.0.0.1", help="use 0.0.0.0 para acesso na rede local")
    ap.add_argument("--schema", action="store_true", help="mostra o SQL das tabelas e sai")
    ap.add_argument("--demo", action="store_true", help="carrega dados fictícios de demonstração")
    a = ap.parse_args()
    if a.schema:
        print(ddl())
        return
    pasta = os.environ.get("GABINETE_DADOS", os.path.join(BASE, "dados"))
    srv, app = criar_servidor(pasta, a.porta, a.host)
    if a.demo:
        from demo import carregar
        print(carregar(app))
    if app.senha_inicial:
        print("=" * 60)
        print(f"Primeiro acesso → login: {app.senha_inicial[0]}  senha: {app.senha_inicial[1]}")
        print("Troque a senha em 'Minha conta' após entrar. Ela não será exibida novamente.")
        print("=" * 60)
    print(f"Mandato rodando em http://{a.host}:{a.porta}  (Ctrl+C para parar)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
