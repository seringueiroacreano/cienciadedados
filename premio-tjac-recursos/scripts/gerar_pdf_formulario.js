// Gera um PDF do formulário completo (todas as perguntas, itens de todas as categorias,
// campos de evidência e a aba de impugnação), para conferência e divulgação.
// Uso: node scripts/gerar_pdf_formulario.js site/index.html Formulario_Recursos_PremioTJAC_2026.pdf
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const [, , html, saida] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1100, height: 1400 }, locale: 'pt-BR' });
  await p.goto('file://' + path.resolve(html));
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    // Faixa de prazo neutra (sem aviso de "modo de demonstração")
    $('faixa-prazo').innerHTML = '<div class="aviso info"><strong>Prazo recursal</strong>De 04/12/2026 (publicação do Resultado Preliminar) até <strong>07/12/2026, 23h59min59s</strong> (horário do Acre). Resultado Final: 18/12/2026 (art. 5º da Portaria PRESI nº 1.961/2026).</div>';
    // Passo 1 e Passo 2 visíveis ao mesmo tempo
    $('r-passo2').classList.remove('oculto');
    $('r-passo-txt').textContent = 'Passos 1 e 2 de 2';
    $('r-barra').style.width = '100%'; $('r-barra').textContent = '100%';
    $('r-status-unidade').innerHTML = '';

    function blocoCategoria(cat, codigoExemplo, titulo, expandirItem) {
      estado.unidade = UNID[codigoExemplo];
      desenharEixos();
      const box = $('r-eixos');
      box.querySelectorAll('input[value="Sim"]').forEach(r => { r.checked = true; r.dispatchEvent(new Event('change')); });
      if (expandirItem) { const c = box.querySelector('input[data-item="' + expandirItem + '"]'); c.checked = true; c.dispatchEvent(new Event('change')); }
      const wrap = document.createElement('div');
      wrap.innerHTML = '<div class="aviso info" style="margin-top:26px"><strong>' + titulo + '</strong>As perguntas abaixo aparecem para: ' + DADOS.categorias[cat].rotulo + '.</div>';
      while (box.firstChild) wrap.appendChild(box.firstChild);
      return wrap;
    }
    const destino = document.createElement('div');
    destino.appendChild(blocoCategoria('1G', '3621', 'Questionário — Unidades judiciárias de 1º grau', 2));
    destino.appendChild(blocoCategoria('2G_GAB', '75537', 'Questionário — Gabinetes de Desembargador(a)'));
    destino.appendChild(blocoCategoria('SEJUD', '81518', 'Questionário — Secretaria Judiciária (SEJUD)'));
    destino.appendChild(blocoCategoria('VPRES', '74296', 'Questionário — Vice-Presidência'));
    $('r-eixos').appendChild(destino);
    $('r-unidade-resumo').textContent = 'conforme a unidade selecionada no Passo 1';
    // Exemplo de preenchimento do bloco do item (para ilustrar)
    const ex = document.querySelector('[data-n="2"] .rot');
    if (ex) ex.insertAdjacentHTML('beforebegin', '<div class="ajuda" style="margin-bottom:6px"><em>Exemplo: bloco que se abre para cada item marcado (aqui, Nº 2 - TPL). Os mesmos campos se repetem para todos os itens.</em></div>');
    $('r-checklist').innerHTML = '<li>a) Identificação do painel ou relatório</li><li>b) Filtros aplicados (período, unidade, classe)</li><li>c) Período de referência</li><li>d) Memória de cálculo e pontuações</li><li>e) Número e quantidade exata dos processos</li>';
    // Aba de impugnação logo após o recurso
    const imp = $('aba-impugnacao'); imp.classList.remove('oculto'); imp.style.marginTop = '24px'; imp.style.breakBefore = 'page';
    // Remove elementos só de tela
    document.querySelectorAll('.abas, .botoes, #r-busca, .servidor .remover, #i-add, #r-pedircod, #i-pedircod').forEach(e => e.remove());
    document.querySelectorAll('textarea').forEach(t => { t.style.minHeight = '90px'; });
    // Datas no padrão brasileiro (o navegador sem interface mostra mm/dd/yyyy)
    document.querySelectorAll('input[type=date]').forEach(d => {
      const v = d.value; d.type = 'text';
      d.value = v ? v.split('-').reverse().join('/') : ''; d.placeholder = 'dd/mm/aaaa';
    });
    const st = document.createElement('style');
    st.textContent = '@media print{.barra-topo,.menu{display:none} .campo,.subtit{break-inside:avoid} .subtit{break-after:avoid} .folha{box-shadow:none}} body{-webkit-print-color-adjust:exact;print-color-adjust:exact}';
    document.head.appendChild(st);
  });
  await p.emulateMedia({ media: 'print' });
  await p.pdf({
    path: saida, format: 'A4', printBackground: true,
    margin: { top: '12mm', bottom: '16mm', left: '8mm', right: '8mm' },
    displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#555;font-family:Arial">Prêmio TJAC de Qualidade 2026 — Formulário de recursos e impugnações · página <span class="pageNumber"></span> de <span class="totalPages"></span></div>'
  });
  await b.close();
  console.log('PDF gerado:', saida);
})();
