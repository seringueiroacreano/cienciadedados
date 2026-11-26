// Teste ponta a ponta do formulário PUBLICADO (App da Web do Apps Script), em MODO DE TESTE.
// Uso: node teste_ao_vivo.js "https://script.google.com/a/macros/.../exec"
// Faz: abre o formulário, confere cabeçalho/logos, escolhe uma unidade, preenche um recurso
// completo (Anexo III), envia, confere o ID "-T" e o PDF devolvido; depois envia uma impugnação.
const { chromium } = require('playwright');
const fs = require('fs');

const URL_APP = process.argv[2];
if (!URL_APP) { console.error('Informe a URL /exec do App da Web.'); process.exit(2); }

function cnj(N, A, J, TR, O) { // calcula os dígitos verificadores (módulo 97)
  for (let d = 0; d < 100; d++) {
    const DD = String(d).padStart(2, '0');
    const r1 = parseInt(N, 10) % 97, r2 = parseInt(String(r1) + A + J + TR, 10) % 97, r3 = parseInt(String(r2) + O + DD, 10) % 97;
    if (r3 === 1) return `${N}-${DD}.${A}.${J}.${TR}.${O}`;
  }
}

async function quadroDoFormulario(page) {
  for (let i = 0; i < 60; i++) {
    for (const f of page.frames()) { try { if (await f.$('#r-unidade')) return f; } catch (e) { } }
    await page.waitForTimeout(500);
  }
  throw new Error('Formulário não encontrado na página (a URL exige login ou a implantação não é pública?).');
}

(async () => {
  const resultado = [];
  const ok = (nome, cond, extra) => { resultado.push([cond ? 'OK ' : 'FALHOU', nome, extra || '']); };
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1200, height: 900 } });
  try {
    await page.goto(URL_APP, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const f = await quadroDoFormulario(page);
    ok('Formulário carregou', true, page.url().slice(0, 80));
    await page.waitForTimeout(2500); // config do servidor
    ok('Logotipo PJAC no cabeçalho', !!(await f.$('.brasao img[src^="data:image/png"]')));
    const faixa = await f.textContent('#faixa-prazo');
    ok('Servidor em MODO DE TESTE', /MODO DE TESTE/.test(faixa), faixa.replace(/\s+/g, ' ').slice(0, 90));
    const qtdUnid = await f.$$eval('#r-unidade option', o => o.length - 1);
    ok('Lista de unidades avaliadas', qtdUnid >= 100, qtdUnid + ' unidades');

    // ---------- Recurso ----------
    await f.selectOption('#r-unidade', '3621');
    await page.waitForTimeout(3000);
    const st = await f.textContent('#r-status-unidade');
    ok('Consulta de preclusão (servidor)', /recurso/i.test(st), st.replace(/\s+/g, ' ').slice(0, 90));
    await f.fill('#r-cpf', '52998224725');
    await f.fill('#r-nome', 'TESTE AUTOMATIZADO - Claude');
    await f.fill('#r-email', 'teste.automatizado@tjac.jus.br');
    await f.selectOption('#r-cargo', { index: 4 });
    await f.fill('#r-matricula', '000000');
    if (await f.isVisible('#r-codemail')) await f.fill('#r-codemail', '000000');
    await f.click('#r-avancar');
    await f.check('input[name="ex-1G_GERAIS"][value="Sim"]');
    await f.check('input[name="ex-1G_TEMATICOS"][value="Não"]');
    await f.check('input[data-item="2"]');
    await f.fill('#it2-fund', 'TESTE AUTOMATIZADO. Recurso fictício para verificação do funcionamento do formulário; desconsiderar.');
    await f.selectOption('#it2-ftipo', { index: 1 });
    await f.fill('#it2-fid', 'BI PJAC > Prêmio TJAC 2026 > TPL (teste)');
    await f.fill('#it2-fcl', 'Todas');
    await f.fill('#it2-mem', 'Teste: TPL 820 dias; excluídos 2 suspensos; TPL 610 dias; faixa de 60 pontos.');
    await f.fill('#it2-pa', '30'); await f.fill('#it2-pp', '60');
    await f.fill('#it2-proc', [cnj('0700001', '2026', '8', '01', '0001'), cnj('0700002', '2025', '8', '01', '0001')].join('\n'));
    await f.fill('#it2-qtd', '2');
    fs.writeFileSync('evidencia_teste.csv', 'processo;situacao\n0700001;suspenso\n');
    await f.setInputFiles('#it2-arq', 'evidencia_teste.csv');
    for (const c of await f.$$('#r-declaracoes input')) await c.check();
    await f.click('#r-enviar');
    await f.waitForSelector('#dlg[open]', { timeout: 10000 });
    await f.click('#dlg-sim');
    await f.waitForSelector('#r-final:not(.oculto), #r-erros .aviso', { timeout: 120000 });
    const fim = (await f.textContent('#r-final')) || '';
    const erro = (await f.textContent('#r-erros')) || '';
    ok('Recurso gravado (ID de teste)', /REC-2026-\d{4}-T/.test(fim), (fim.match(/REC-2026-\d{4}-T/) || [erro.slice(0, 160)])[0]);
    ok('PDF do registro devolvido', !!(await f.$('#r-final-pdf')));
    await page.screenshot({ path: 'ao_vivo_recurso.png', fullPage: true });

    // ---------- Impugnação ----------
    await f.click('.abas button[data-aba=impugnacao]');
    await f.selectOption('#i-unidade', '3621');
    await f.fill('#i-cpf', '52998224725'); await f.fill('#i-matricula', '000000');
    await f.fill('#i-nome', 'TESTE AUTOMATIZADO - Claude'); await f.fill('#i-email', 'teste.automatizado@tjac.jus.br');
    if (await f.isVisible('#i-codemail')) await f.fill('#i-codemail', '000000');
    await f.fill('#s1-nome', 'SERVIDOR FICTÍCIO DE TESTE'); await f.fill('#s1-mat', '999999');
    await f.selectOption('#s1-tipo', { index: 1 }); await f.fill('#s1-ini', '2026-01-02');
    await f.fill('#i-fund', 'TESTE AUTOMATIZADO de impugnação; desconsiderar.');
    await f.check('#i-veracidade');
    await f.click('#i-enviar');
    await f.waitForSelector('#dlg[open]', { timeout: 10000 });
    await f.click('#dlg-sim');
    await f.waitForSelector('#i-final:not(.oculto), #i-erros .aviso', { timeout: 120000 });
    const fimI = (await f.textContent('#i-final')) || '', erroI = (await f.textContent('#i-erros')) || '';
    ok('Impugnação gravada (ID de teste)', /IMP-2026-\d{4}-T/.test(fimI), (fimI.match(/IMP-2026-\d{4}-T/) || [erroI.slice(0, 160)])[0]);
    await page.screenshot({ path: 'ao_vivo_impugnacao.png', fullPage: true });
  } catch (e) {
    ok('Execução do teste', false, e.message.slice(0, 200));
    await page.screenshot({ path: 'ao_vivo_erro.png', fullPage: true }).catch(() => { });
  }
  await b.close();
  resultado.forEach(r => console.log(r.join(' | ')));
  process.exit(resultado.some(r => r[0] !== 'OK ') ? 1 : 0);
})();
