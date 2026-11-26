"""Acesso HTTP com novas tentativas (só biblioteca padrão)."""
import json
import time
import urllib.error
import urllib.request

AGENTE = "robo-irasp/1.0 (+github.com/seringueiroacreano/cienciadedados)"


def obter_json(url, tentativas=5, espera=5, tempo_limite=180, metodo="GET"):
    """Baixa um JSON. O Metabase responde 202 com os dados prontos; tratamos 2xx como sucesso."""
    ultimo_erro = None
    for n in range(1, tentativas + 1):
        try:
            req = urllib.request.Request(
                url,
                method=metodo,
                headers={"Accept": "application/json", "User-Agent": AGENTE},
            )
            with urllib.request.urlopen(req, timeout=tempo_limite) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, ConnectionError, json.JSONDecodeError) as erro:
            ultimo_erro = erro
            if n < tentativas:
                time.sleep(espera * n)
    raise RuntimeError(f"Falha ao acessar {url} após {tentativas} tentativas: {ultimo_erro}")
