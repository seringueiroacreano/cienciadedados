// Executa o Code.gs em Node com simulações mínimas dos serviços do Google.
const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const code = fs.readFileSync(process.argv[2], 'utf8');
const unidades = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const payload = JSON.parse(fs.readFileSync('payload.json', 'utf8'));
const sheets = {};
function sheet(name) {
  if (!sheets[name]) sheets[name] = { rows: [], getName: () => name,
    appendRow(r) { this.rows.push(r.map(v => typeof v === 'string' && v[0] === "'" ? v.slice(1) : v)); },
    getLastRow() { return this.rows.length; }, getLastColumn() { return this.rows[0] ? this.rows[0].length : 0; },
    getDataRange() { const s = this; return { getDisplayValues: () => s.rows.map(r => r.map(v => String(v))), getValues: () => s.rows }; },
    getRange() { return { setFontWeight() { return this; }, setBackground() { return this; }, setFontColor() { return this; }, setDataValidation() { return this; }, clearContent() {}, getValues: () => [sheets[name].rows[0]] }; },
    setFrozenRows() {}, deleteRow(i) { this.rows.splice(i - 1, 1); } };
  return sheets[name];
}
sheet('Unidades').appendRow(['codigo', 'nome', 'comarca', 'categoria', 'competencias', 'competencias_descritivas', 'observacao']);
unidades.forEach(u => sheet('Unidades').appendRow([u.codigo, u.nome, u.comarca, u.categoria, u.competencias.join(','), '', '']));
const files = [];
function folder(nome) { return { nome, getFoldersByName: n => ({ hasNext: () => false }), createFolder: n => folder(nome + '/' + n), getUrl: () => 'https://drive/' + nome,
  createFile(b) { files.push(nome + '/' + b.getName()); return { getUrl: () => 'https://drive/' + nome + '/' + b.getName() }; }, getFilesByName: () => ({ hasNext: () => false }) }; }
const props = { MODO_TESTE: process.argv[4] || 'NAO' };
let lastHtml = {};
function blob(data, type, name) { return { _d: data, getName: () => name, setName(n) { name = n; return this; }, getBytes: () => Buffer.from(String(data)), getAs(t) { lastHtml[name] = data; return blob(data, t, name); }, getContentType: () => type }; }
const ctx = {
  console, Date: (function () { const R = Date; class F extends R { constructor(...a) { if (a.length) super(...a); else super(process.env.AGORA || R.now()); } static now() { return new F().getTime(); } } return F; })(), JSON, Math, String, Number, Object, Array, parseInt, parseFloat, isNaN,
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: n => sheets[n] ? sheet(n) : null, insertSheet: n => sheet(n), getSheets: () => [sheet('Unidades')], getId: () => 'x' }), flush() {}, newDataValidation() { const o = { requireValueInList() { return o; }, build() { return o; } }; return o; } },
  DriveApp: { getFileById: () => ({ getParents: () => ({ hasNext: () => true, next: () => folder('RAIZ') }) }), getRootFolder: () => folder('RAIZ') },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => props[k] = v, deleteProperty: k => delete props[k] }) },
  CacheService: { getScriptCache: () => ({ get: k => k.startsWith('cod_') ? '123456' : null, put() {} }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  MailApp: { sendEmail: o => { console.log('EMAIL ->', o.to, '|', o.subject); } },
  Utilities: { formatDate: (d) => d.toLocaleString('pt-BR', { timeZone: 'America/Rio_Branco' }), newBlob: blob, base64Decode: s => Buffer.from(s, 'base64'), base64Encode: b => Buffer.from(b).toString('base64'),
    computeDigest: (a, s) => [...crypto.createHash('sha256').update(s).digest()].map(b => b > 127 ? b - 256 : b), DigestAlgorithm: {}, Charset: {} },
  ScriptApp: { getProjectTriggers: () => [], newTrigger() { const o = { timeBased: () => o, after: () => o, create() {} }; return o; } },
  HtmlService: {}, ContentService: {}, UrlFetchApp: {}
};
vm.createContext(ctx); vm.runInContext(code, ctx);
let r = JSON.parse(ctx.api('enviarRecurso', JSON.stringify(payload)));
console.log('1º envio:', r.ok, r.id || r.erro);
fs.writeFileSync('registro.html', lastHtml[Object.keys(lastHtml).pop()]);
r = JSON.parse(ctx.api('enviarRecurso', JSON.stringify(payload)));
console.log('2º envio (preclusão):', r.ok, r.erro);
const ruim = JSON.parse(JSON.stringify(payload)); ruim.unidade.codigo = '3620x';
console.log('unid inválida:', JSON.parse(ctx.api('enviarRecurso', JSON.stringify(ruim))).erro);
const semE = JSON.parse(JSON.stringify(payload)); semE.unidade.codigo = '3622'; semE.eixos[0].itens[0].evid.memoria = ''; semE.eixos[0].itens[0].evid.qtd = '5';
console.log('sem evid:', JSON.parse(ctx.api('enviarRecurso', JSON.stringify(semE))).erro);
console.log('status 3621:', ctx.api('status', JSON.stringify({ codigo: '3621' })));
// relatórios finais
ctx.gerarRelatoriosFinais();
console.log('relatorios:', sheets.Relatorios_Finais ? sheets.Relatorios_Finais.rows.length : 0, 'arquivos:', files.length);
const k = Object.keys(lastHtml).find(n => n.includes('Relatorio_Final_3621')); fs.writeFileSync('final_3621.html', lastHtml[k]);
const k2 = Object.keys(lastHtml).find(n => n.includes('Relatorio_Final_3622')); fs.writeFileSync('final_3622.html', lastHtml[k2]);
