"""
Modelo preditivo de resultado de ações judiciais.

Pipeline:
1. Engenharia de features (classe, tribunal, grau, duração, n° movimentos...)
2. Treinamento com RandomForest / XGBoost / LogisticRegression
3. Avaliação: acurácia, F1, matriz de confusão, feature importance
"""

from __future__ import annotations

from typing import Optional, Literal
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    ConfusionMatrixDisplay,
)


class ModeloPreditivo:
    """
    Pipeline de aprendizado de máquina para prever o resultado de processos
    judiciais (PROCEDENTE / IMPROCEDENTE / EXTINTO).

    Exemplo de uso:
        modelo = ModeloPreditivo(algoritmo="random_forest")
        modelo.preparar_dados(df_processos, df_resultados)
        modelo.treinar()
        modelo.avaliar()
        modelo.feature_importance()
    """

    ALGORITMOS = {
        "random_forest": RandomForestClassifier,
        "gradient_boosting": GradientBoostingClassifier,
        "logistic_regression": LogisticRegression,
    }

    def __init__(
        self,
        algoritmo: Literal["random_forest", "gradient_boosting", "logistic_regression"] = "random_forest",
        random_state: int = 42,
        **params,
    ):
        self.algoritmo_nome = algoritmo
        self.random_state = random_state
        self.params = params
        self.modelo = None
        self.encoders: dict[str, LabelEncoder] = {}
        self.feature_names: list[str] = []
        self.X_train = self.X_test = self.y_train = self.y_test = None
        self.label_encoder = LabelEncoder()

    def preparar_dados(
        self,
        df_processos: pd.DataFrame,
        df_resultados: pd.DataFrame,
        test_size: float = 0.2,
        colunas_categoricas: list[str] = None,
        colunas_numericas: list[str] = None,
    ) -> "ModeloPreditivo":
        """
        Une df_processos com df_resultados e prepara features.

        Args:
            df_processos        : DataFrame de processos (coletar_dataframe)
            df_resultados       : DataFrame com colunas [numero_processo, resultado]
            test_size           : Proporção do conjunto de teste
            colunas_categoricas : Colunas categóricas para encoding
            colunas_numericas   : Colunas numéricas

        Returns:
            self (para encadeamento)
        """
        df = df_processos.merge(df_resultados, on="numero_processo", how="inner")

        # Features padrão
        if colunas_categoricas is None:
            colunas_categoricas = ["tribunal", "grau", "classe_nome", "orgao_julgador"]

        if colunas_numericas is None:
            colunas_numericas = ["total_movimentos"]
            # Adicionar duração se existir
            if "data_ajuizamento" in df.columns and "ultima_atualizacao" in df.columns:
                df["duracao_dias"] = (
                    df["ultima_atualizacao"] - df["data_ajuizamento"]
                ).dt.days.clip(lower=0)
                colunas_numericas.append("duracao_dias")

        # Encoding de categóricas
        features = []
        for col in colunas_categoricas:
            if col not in df.columns:
                continue
            le = LabelEncoder()
            df[f"{col}_enc"] = le.fit_transform(df[col].fillna("DESCONHECIDO"))
            self.encoders[col] = le
            features.append(f"{col}_enc")

        features += [c for c in colunas_numericas if c in df.columns]
        self.feature_names = features

        df_clean = df[features + ["resultado"]].dropna()
        X = df_clean[features].values
        y = self.label_encoder.fit_transform(df_clean["resultado"])

        self.X_train, self.X_test, self.y_train, self.y_test = train_test_split(
            X, y, test_size=test_size, random_state=self.random_state, stratify=y
        )
        print(f"Train: {len(self.X_train)} | Test: {len(self.X_test)}")
        print(f"Classes: {self.label_encoder.classes_}")
        return self

    def treinar(self) -> "ModeloPreditivo":
        """Treina o modelo com validação cruzada."""
        cls = self.ALGORITMOS[self.algoritmo_nome]
        defaults = {"random_state": self.random_state} if self.algoritmo_nome != "logistic_regression" else {
            "random_state": self.random_state, "max_iter": 1000
        }
        self.modelo = cls(**{**defaults, **self.params})
        self.modelo.fit(self.X_train, self.y_train)

        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=self.random_state)
        scores = cross_val_score(self.modelo, self.X_train, self.y_train, cv=cv, scoring="f1_weighted")
        print(f"CV F1 (média ± std): {scores.mean():.3f} ± {scores.std():.3f}")
        return self

    def avaliar(self) -> dict:
        """Avalia o modelo no conjunto de teste."""
        y_pred = self.modelo.predict(self.X_test)
        classes = self.label_encoder.classes_

        print(classification_report(self.y_test, y_pred, target_names=classes))

        cm = confusion_matrix(self.y_test, y_pred)
        fig, ax = plt.subplots(figsize=(7, 5))
        ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=classes).plot(ax=ax, cmap="Blues")
        ax.set_title(f"Matriz de Confusão — {self.algoritmo_nome}")
        plt.tight_layout()
        plt.show()

        return {"y_test": self.y_test, "y_pred": y_pred}

    def feature_importance(self, top_n: int = 15) -> pd.DataFrame:
        """Plota e retorna a importância das features."""
        if not hasattr(self.modelo, "feature_importances_"):
            print("Modelo não suporta feature_importances_. Use random_forest ou gradient_boosting.")
            return pd.DataFrame()

        importancias = pd.DataFrame({
            "feature": self.feature_names,
            "importancia": self.modelo.feature_importances_,
        }).sort_values("importancia", ascending=False).head(top_n)

        fig, ax = plt.subplots(figsize=(9, 5))
        sns.barplot(data=importancias, y="feature", x="importancia", palette="viridis", ax=ax)
        ax.set_title("Importância das Features")
        plt.tight_layout()
        plt.show()

        return importancias

    def prever(self, X: np.ndarray) -> list[str]:
        """Retorna as classes previstas para novos dados."""
        y_pred = self.modelo.predict(X)
        return self.label_encoder.inverse_transform(y_pred).tolist()
