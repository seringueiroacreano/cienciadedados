"""
Modelos de dados baseados na estrutura da API Pública do Datajud.
Referência: Portaria CNJ nº 160/2020 (padrão MNI / tabelas unificadas CNJ).
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class Movimentacao:
    """Representa uma movimentação/andamento processual."""
    codigo: Optional[int] = None
    nome: Optional[str] = None
    data_hora: Optional[str] = None
    complemento: Optional[str] = None
    complemento_nacional: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "Movimentacao":
        return cls(
            codigo=data.get("codigo"),
            nome=data.get("nome"),
            data_hora=data.get("dataHora"),
            complemento=data.get("complemento"),
            complemento_nacional=data.get("complementoNacional"),
        )


@dataclass
class Parte:
    """Representa uma parte do processo (autor, réu, etc.)."""
    nome: Optional[str] = None
    tipo: Optional[str] = None  # ATIVO | PASSIVO | OUTROS
    documento: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "Parte":
        return cls(
            nome=data.get("nome"),
            tipo=data.get("tipo"),
            documento=data.get("documento"),
        )


@dataclass
class Processo:
    """
    Representa a capa de um processo judicial.
    Campos aderentes ao padrão Datajud / MNI.
    """
    id: Optional[str] = None
    numero_processo: Optional[str] = None
    tribunal: Optional[str] = None
    grau: Optional[str] = None                  # G1, G2, JE, SUP
    data_ajuizamento: Optional[str] = None
    ultima_atualizacao: Optional[str] = None
    classe: Optional[dict] = None               # {codigo, nome}
    assuntos: list = field(default_factory=list) # [{codigo, nome}]
    orgao_julgador: Optional[dict] = None        # {codigo, nome, municipio}
    movimentos: list = field(default_factory=list)
    partes: list = field(default_factory=list)
    situacao: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "Processo":
        source = data.get("_source", data)
        return cls(
            id=data.get("_id"),
            numero_processo=source.get("numeroProcesso"),
            tribunal=source.get("tribunal"),
            grau=source.get("grau"),
            data_ajuizamento=source.get("dataAjuizamento"),
            ultima_atualizacao=source.get("@timestamp") or source.get("dataUltimaAtualizacao"),
            classe=source.get("classe"),
            assuntos=source.get("assuntos", []),
            orgao_julgador=source.get("orgaoJulgador"),
            movimentos=[
                Movimentacao.from_dict(m) for m in source.get("movimentos", [])
            ],
            partes=[
                Parte.from_dict(p) for p in source.get("partes", [])
            ],
            situacao=source.get("situacao"),
        )

    @property
    def classe_nome(self) -> Optional[str]:
        return self.classe.get("nome") if self.classe else None

    @property
    def orgao_julgador_nome(self) -> Optional[str]:
        return self.orgao_julgador.get("nome") if self.orgao_julgador else None

    @property
    def assuntos_nomes(self) -> list:
        return [a.get("nome") for a in self.assuntos if a.get("nome")]
