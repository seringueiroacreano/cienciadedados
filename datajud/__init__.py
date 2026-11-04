"""
Pacote de integração com a API Pública do Datajud (CNJ).

Estrutura:
- client.py       : Cliente HTTP para a API
- models.py       : Modelos de dados (Pydantic)
- collectors/     : Scripts de coleta de dados
- analysis/       : Análises estatísticas e exploratórias
- ml/             : Modelos de machine learning
"""

from .client import DatajudClient
from .models import Processo, Movimentacao

__all__ = ["DatajudClient", "Processo", "Movimentacao"]
