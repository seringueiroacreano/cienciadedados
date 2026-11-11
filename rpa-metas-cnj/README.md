# RPA – Extração das Metas Nacionais (portal de estatística TJAC)

Automatiza o que o vídeo mostra: abrir `link.tjac.jus.br/meta-1`, filtrar a Unidade
Judiciária, clicar em **Download**, abrir o CSV e separar por `var`
(Casos Novos / Julgados / Pendentes / Suspensos) em abas de um Excel.

## Uso
```bash
pip install -r requirements.txt && playwright install chromium
cp config.example.toml config.toml
python extrair_meta.py --meta 1 --busca "cruzeiro do sul" --unidade "1ª Vara Cível Cruzeiro Do Sul"
python extrair_meta.py --headed ...      # vê o robô trabalhando (para ajustar seletores)
python extrair_meta.py --csv arquivo.csv # só o pós-processamento
```
Saída: `saida/<data_hora>/meta_01.xlsx` (aba `Todos` + uma por categoria).

## Status / limites
- Pós-processamento: testado com dados sintéticos.
- Navegação no portal: **não testada** (sem acesso ao portal de dentro deste ambiente);
  os seletores foram inferidos do vídeo e ficam em `config.toml`. Rode com `--headed`
  na rede do TJAC e ajuste. Se o portal exigir login/SSO, usar perfil persistente do Chromium.
- IDs lidos como texto (evita `8,15E+10` do Excel).
