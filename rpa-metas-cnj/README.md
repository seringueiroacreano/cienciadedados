# RPA – Extração das Metas Nacionais (TJAC)

Faz com um comando o que o vídeo mostra em ~1min40 de cliques: baixar a base da meta
no painel de estatística, filtrar a unidade judiciária e separar
Casos Novos / Julgados / Pendentes / Suspensos em abas de um Excel.

## Jeito mais fácil: página web (sem instalar nada)
Abra `index.html` no navegador (duplo clique no arquivo, ou o endereço do GitHub Pages
se estiver ativado). A página busca a base, lista as unidades para marcar e baixa o Excel.
Ela lembra a meta e as unidades marcadas na vez anterior.
`web/pagina.html` é a fonte; `index.html` é a mesma página com o cabeçalho HTML.

Onde a página não pode acessar o TJAC (por exemplo, publicada como artefato do Claude),
ela lê uma cópia da base publicada junto, em `dados/`. `python web/gerar_copia.py PASTA`
baixa as metas e gera essa cópia; a página mostra a data da base que está usando.

## Linha de comando (Python)

### Instalação (uma vez)
```bash
pip install -r requirements.txt
```

### Uso
```bash
# uma unidade (trecho do nome, sem se preocupar com acento/maiúscula)
python extrair_meta.py --unidade "1ª Vara Cível de Cruzeiro do Sul"

# várias unidades, ou a comarca inteira
python extrair_meta.py --unidade "1ª vara civel de cruzeiro" --unidade "2ª vara civel de cruzeiro"
python extrair_meta.py --municipio "cruzeiro do sul"

# outra meta
python extrair_meta.py --meta 2 --municipio "rio branco"

# descobrir o nome exato das unidades
python extrair_meta.py --listar --unidade cruzeiro
```
Saída em `saida/`: o CSV bruto baixado e `meta_NN_<filtro>_<data_hora>.xlsx`
com a aba `Todos` e uma aba por valor da coluna `var`.

## Como funciona
O botão **Download** do painel (Power BI) é um link fixo, `link.tjac.jus.br/meta-N`,
que redireciona para `exportar-bi.tjac.jus.br/download/Metas_Nacionais_SAJ__meta_NN`
e entrega o CSV com a base **inteira**: os filtros da tela não alteram o arquivo.
Por isso o robô não precisa de navegador: baixa o CSV e aplica no pandas o filtro
que no vídeo é feito no Excel.

- `--unidade` e `--municipio` filtram por "contém"; o robô imprime as unidades incluídas.
- IDs são lidos como texto (o Excel os convertia em `8,15E+10`) e `dt_evento` vira data.
- O servidor às vezes derruba a conexão; o robô tenta de novo sozinho (5 tentativas).

## Limites conhecidos
- **Meta 9**: o link aponta para um arquivo no Google Drive, não para um CSV.
  Baixe manualmente e use `--csv arquivo.csv`.
- Testado nas metas 1 e 2 (11/11/2026). Metas 3–8 e 10 usam o mesmo endereço-padrão,
  mas não foram baixadas; se alguma não tiver a coluna `var`, sai só a aba `Todos`.
- Se o TJAC mudar o endereço do link, ajuste `URL` em `extrair_meta.py`.
