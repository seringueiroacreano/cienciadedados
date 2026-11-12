# Texto para o LinkedIn

Troque o que está entre colchetes antes de publicar.

---

**Sumaúma RPA: do dado público à lista de trabalho de cada unidade judiciária**

Acompanhar as Metas Nacionais do Poder Judiciário exigia sempre o mesmo ritual: abrir o painel de estatística, filtrar a unidade, baixar a base, abrir no Excel e separar à mão os processos de cada variável. Eram cerca de 1 minuto e 40 segundos de cliques para uma única unidade. E, no fim, a planilha ainda não dizia o que mais interessa a quem está na vara: quais processos preciso julgar para melhorar o indicador?

Resolvi tratar isso como problema de ciência de dados. O resultado é o Sumaúma RPA, um robô que:

🔹 busca a base da meta direto do painel de estatística;
🔹 filtra as unidades judiciárias escolhidas;
🔹 gera o Excel por variável, sem corromper os números de processo;
🔹 entrega a gestão à vista: cumprimento, quanto falta e a lista de processos a julgar, do mais antigo para o mais novo.

A parte mais trabalhosa não foi o código, foi a regra de negócio. Cada meta tem a sua fórmula no Glossário do CNJ: o que conta como julgado, o que sai da conta quando o processo é suspenso, as cláusulas de barreira da conciliação e do congestionamento. Hoje o robô cobre nove metas e mais de 1,16 milhão de linhas, e só considerei pronto quando o resultado da Meta 1 bateu com o painel oficial.

O projeto nasceu em dois lugares ao mesmo tempo. No Bacharelado em Ciência de Dados [da/do instituição], de onde vieram o Python, o pandas e o método de validar cada número. E na rotina da Divisão de Gestão de Dados e Estatística (DIGED), da SUMAE do Tribunal de Justiça do Acre, de onde vieram o problema real e o conhecimento das metas.

O nome homenageia a sumaúma, a grande árvore da Amazônia: raízes largas para sustentar, copa alta para enxergar longe. É o que eu espero de um bom dado.

O código é aberto e trabalha apenas com dados públicos: github.com/seringueiroacreano/cienciadedados

[Opcional: Parte da programação foi feita com apoio de inteligência artificial generativa; a definição do problema, as regras e a validação são minhas.]

Nos cards, o passo a passo e as telas. Críticas e sugestões são bem-vindas, principalmente de quem lida com metas em outros tribunais.

#CiênciaDeDados #RPA #PoderJudiciário #MetasNacionais #CNJ #TJAC #GestãoDeDados #Python #Amazônia #Acre

---

## Versão curta (para a legenda do carrossel)

Separar os dados das Metas Nacionais de uma única unidade levava 1 minuto e 40 segundos de cliques, e a planilha não dizia quais processos julgar. Criei o Sumaúma RPA: ele busca a base pública, aplica as regras do Glossário do CNJ e mostra, por unidade, o cumprimento, quanto falta e a fila de processos, do mais antigo para o mais novo. Projeto do meu Bacharelado em Ciência de Dados, desenvolvido na DIGED/SUMAE do TJAC. Código aberto: github.com/seringueiroacreano/cienciadedados

## Antes de publicar

- As imagens das telas usam o total do tribunal e têm os números de processo mascarados. Evite publicar telas com o resultado de uma unidade específica.
- O símbolo e o nome são do projeto; os cards não usam a marca nem o brasão do TJAC.
- Confirme com a chefia da DIGED/SUMAE se há orientação da comunicação institucional para citar o tribunal em publicação pessoal.
- O nome "Sumaúma RPA" não foi pesquisado em bases de marcas registradas.
