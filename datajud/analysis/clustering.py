"""
Clusterização de processos por similaridade de assunto/texto.

Algoritmos disponíveis:
- KMeans    : rápido, bom para grandes volumes
- DBSCAN    : detecta outliers, não requer número de clusters
- Agglomerative: hierárquico, útil para exploração
"""

from __future__ import annotations

from typing import Optional, Literal
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import normalize
from sklearn.metrics import silhouette_score


def clusterizar_processos(
    matriz_features,
    n_clusters: int = 8,
    algoritmo: Literal["kmeans", "dbscan", "agglomerative"] = "kmeans",
    n_componentes_svd: int = 50,
    random_state: int = 42,
    **kwargs,
) -> tuple[np.ndarray, object]:
    """
    Aplica clusterização sobre a matriz TF-IDF (ou qualquer matriz esparsa/densa).

    Args:
        matriz_features    : Matriz de features (scipy sparse ou numpy array)
        n_clusters         : Número de clusters (KMeans / Agglomerative)
        algoritmo          : Algoritmo a utilizar
        n_componentes_svd  : Dimensões do SVD antes de clusterizar
        random_state       : Semente para reprodutibilidade

    Returns:
        Tupla (labels, modelo) onde labels é array com o cluster de cada processo
    """
    # Redução dimensional com SVD (LSA) para melhor performance
    n_comp = min(n_componentes_svd, matriz_features.shape[1] - 1)
    svd = TruncatedSVD(n_components=n_comp, random_state=random_state)
    X = svd.fit_transform(matriz_features)
    X = normalize(X)

    if algoritmo == "kmeans":
        modelo = KMeans(
            n_clusters=n_clusters,
            random_state=random_state,
            n_init="auto",
            **kwargs,
        )
    elif algoritmo == "dbscan":
        modelo = DBSCAN(eps=kwargs.get("eps", 0.5), min_samples=kwargs.get("min_samples", 5))
    elif algoritmo == "agglomerative":
        modelo = AgglomerativeClustering(n_clusters=n_clusters, **kwargs)
    else:
        raise ValueError(f"Algoritmo desconhecido: {algoritmo}")

    labels = modelo.fit_predict(X)
    return labels, modelo


def escolher_k(
    matriz_features,
    k_min: int = 2,
    k_max: int = 15,
    n_componentes_svd: int = 50,
    random_state: int = 42,
    plot: bool = True,
) -> pd.DataFrame:
    """
    Auxilia na escolha do número ideal de clusters via:
    - Inércia (método do cotovelo)
    - Silhouette Score

    Returns:
        DataFrame com colunas: k, inercia, silhouette
    """
    n_comp = min(n_componentes_svd, matriz_features.shape[1] - 1)
    svd = TruncatedSVD(n_components=n_comp, random_state=random_state)
    X = normalize(svd.fit_transform(matriz_features))

    resultados = []
    for k in range(k_min, k_max + 1):
        modelo = KMeans(n_clusters=k, random_state=random_state, n_init="auto")
        labels = modelo.fit_predict(X)
        sil = silhouette_score(X, labels, sample_size=min(2000, X.shape[0]))
        resultados.append({"k": k, "inercia": modelo.inertia_, "silhouette": sil})
        print(f"  k={k:2d} | inércia={modelo.inertia_:,.0f} | silhouette={sil:.3f}")

    df_res = pd.DataFrame(resultados)

    if plot:
        fig, axes = plt.subplots(1, 2, figsize=(12, 4))
        axes[0].plot(df_res["k"], df_res["inercia"], "o-")
        axes[0].set_xlabel("Número de clusters (k)")
        axes[0].set_ylabel("Inércia")
        axes[0].set_title("Método do Cotovelo")

        axes[1].plot(df_res["k"], df_res["silhouette"], "o-", color="orange")
        axes[1].set_xlabel("Número de clusters (k)")
        axes[1].set_ylabel("Silhouette Score")
        axes[1].set_title("Silhouette Score")

        plt.tight_layout()
        plt.show()

    return df_res


def top_termos_por_cluster(
    labels: np.ndarray,
    vetorizador,
    df_textos: pd.DataFrame,
    coluna_texto: str,
    top_n: int = 10,
) -> dict[int, list[str]]:
    """
    Retorna os termos mais frequentes de cada cluster.

    Args:
        labels        : Array de labels gerado pelo clusterizador
        vetorizador   : TfidfVectorizer ajustado
        df_textos     : DataFrame com os textos usados no fit
        coluna_texto  : Coluna com os textos
        top_n         : Número de termos por cluster

    Returns:
        Dicionário {cluster_id: [termo1, termo2, ...]}
    """
    from sklearn.feature_extraction.text import TfidfVectorizer
    from ..analysis.nlp import limpar_texto

    df = df_textos.copy()
    df["_cluster"] = labels
    termos = vetorizador.get_feature_names_out()
    resultado = {}

    for cluster_id in sorted(set(labels)):
        if cluster_id == -1:  # Ruído no DBSCAN
            continue
        textos_cluster = df[df["_cluster"] == cluster_id][coluna_texto].apply(limpar_texto)
        vec_temp = TfidfVectorizer(vocabulary=vetorizador.vocabulary_)
        try:
            matriz = vec_temp.fit_transform(textos_cluster)
            medias = np.asarray(matriz.mean(axis=0)).flatten()
            top_idx = medias.argsort()[::-1][:top_n]
            resultado[cluster_id] = [termos[i] for i in top_idx]
        except Exception:
            resultado[cluster_id] = []

    return resultado
