// === Premio de Qualidade 2026 - Poder Judiciario do Estado do Acre ===

const app = {
    // --- Data Store (localStorage) ---
    getData(key) {
        return JSON.parse(localStorage.getItem(`pq2026_${key}`) || '[]');
    },
    setData(key, data) {
        localStorage.setItem(`pq2026_${key}`, JSON.stringify(data));
    },

    // --- Init ---
    init() {
        this.setupNavigation();
        this.seedDefaults();
        this.renderAll();
    },

    seedDefaults() {
        if (this.getData('criterios').length === 0) {
            const criterios = [
                { id: 1, nome: 'Produtividade', descricao: 'Volume de processos julgados e despachos proferidos em relacao a meta estabelecida', peso: 10, max: 100 },
                { id: 2, nome: 'Celeridade', descricao: 'Tempo medio de tramitacao dos processos e cumprimento de prazos legais', peso: 9, max: 100 },
                { id: 3, nome: 'Inovacao e Boas Praticas', descricao: 'Implementacao de solucoes inovadoras e adocao de boas praticas de gestao', peso: 7, max: 100 },
                { id: 4, nome: 'Satisfacao do Usuario', descricao: 'Resultado das pesquisas de satisfacao com jurisdicionados e advogados', peso: 8, max: 100 },
                { id: 5, nome: 'Gestao de Pessoas', descricao: 'Clima organizacional, capacitacao e desenvolvimento dos servidores', peso: 7, max: 100 },
                { id: 6, nome: 'Responsabilidade Socioambiental', descricao: 'Acoes de sustentabilidade e responsabilidade social desenvolvidas', peso: 5, max: 100 },
                { id: 7, nome: 'Governanca e Conformidade', descricao: 'Cumprimento das normas, resolucoes do CNJ e transparencia', peso: 8, max: 100 },
                { id: 8, nome: 'Tecnologia e Digitalizacao', descricao: 'Nivel de adocao de ferramentas tecnologicas e digitalizacao de processos', peso: 6, max: 100 },
            ];
            this.setData('criterios', criterios);
        }
        if (this.getData('unidades').length === 0) {
            const unidades = [
                { id: 1, nome: '1a Vara Civel da Comarca de Rio Branco', comarca: 'Rio Branco', tipo: 'Vara', responsavel: 'Dr. Carlos Mendes', email: 'vara1civel@tjac.jus.br', telefone: '(68) 3211-0001', status: 'Ativa' },
                { id: 2, nome: '2a Vara Criminal da Comarca de Rio Branco', comarca: 'Rio Branco', tipo: 'Vara', responsavel: 'Dra. Ana Paula Lima', email: 'vara2criminal@tjac.jus.br', telefone: '(68) 3211-0002', status: 'Ativa' },
                { id: 3, nome: 'Juizado Especial Civel de Cruzeiro do Sul', comarca: 'Cruzeiro do Sul', tipo: 'Juizado', responsavel: 'Dr. Roberto Alves', email: 'jecivel.czs@tjac.jus.br', telefone: '(68) 3322-0001', status: 'Ativa' },
                { id: 4, nome: 'Vara Unica da Comarca de Sena Madureira', comarca: 'Sena Madureira', tipo: 'Vara', responsavel: 'Dra. Fernanda Costa', email: 'vara.sena@tjac.jus.br', telefone: '(68) 3612-0001', status: 'Ativa' },
                { id: 5, nome: 'Secretaria de Gestao Estrategica', comarca: 'Rio Branco', tipo: 'Secretaria', responsavel: 'Maria Helena Souza', email: 'sge@tjac.jus.br', telefone: '(68) 3211-0100', status: 'Ativa' },
                { id: 6, nome: 'Diretoria de Tecnologia da Informacao', comarca: 'Rio Branco', tipo: 'Diretoria', responsavel: 'Joao Pedro Santos', email: 'dti@tjac.jus.br', telefone: '(68) 3211-0200', status: 'Ativa' },
            ];
            this.setData('unidades', unidades);
        }
        if (this.getData('avaliacoes').length === 0) {
            const criterios = this.getData('criterios');
            const unidades = this.getData('unidades');
            const avaliacoes = unidades.map((u, i) => ({
                id: i + 1,
                unidadeId: u.id,
                avaliador: 'Comissao de Qualidade',
                data: '2026-01-15',
                status: 'Concluida',
                observacoes: 'Avaliacao do primeiro ciclo 2026',
                notas: criterios.map(c => ({
                    criterioId: c.id,
                    nota: Math.floor(Math.random() * 30) + 65
                }))
            }));
            this.setData('avaliacoes', avaliacoes);
            this.setData('nextAvalId', avaliacoes.length + 1);
        }
    },

    // --- Navigation ---
    setupNavigation() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                this.navigateTo(section);
            });
        });
        document.getElementById('menuToggle').addEventListener('click', () => {
            document.querySelector('.nav').classList.toggle('open');
        });
        const hash = window.location.hash.substring(1);
        if (hash) this.navigateTo(hash);
    },

    navigateTo(section) {
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        const el = document.getElementById(section);
        const link = document.querySelector(`[data-section="${section}"]`);
        if (el) el.classList.add('active');
        if (link) link.classList.add('active');
        document.querySelector('.nav').classList.remove('open');
        window.location.hash = section;
        this.renderAll();
    },

    // --- Render All ---
    renderAll() {
        this.renderDashboard();
        this.renderUnidades();
        this.renderCriterios();
        this.renderAvaliacoes();
        this.renderRanking();
    },

    // --- Dashboard ---
    renderDashboard() {
        const unidades = this.getData('unidades');
        const avaliacoes = this.getData('avaliacoes');
        const criterios = this.getData('criterios');

        document.getElementById('totalUnidades').textContent = unidades.length;
        document.getElementById('totalAvaliacoes').textContent = avaliacoes.filter(a => a.status === 'Concluida').length;

        const concluidas = avaliacoes.filter(a => a.status === 'Concluida');
        const pendentes = unidades.length - concluidas.length;
        document.getElementById('avaliacoesPendentes').textContent = Math.max(0, pendentes);

        let media = 0;
        if (concluidas.length > 0) {
            const scores = concluidas.map(a => this.calcularPontuacao(a));
            media = (scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(1);
        }
        document.getElementById('mediaGeral').textContent = media;

        // Chart
        this.renderChart(criterios, concluidas);

        // Top 5
        this.renderTop5(unidades, concluidas);

        // Recent activities
        this.renderAtividades(avaliacoes, unidades);
    },

    calcularPontuacao(avaliacao) {
        const criterios = this.getData('criterios');
        let totalPeso = 0, totalPonderado = 0;
        avaliacao.notas.forEach(n => {
            const c = criterios.find(cr => cr.id === n.criterioId);
            if (c) {
                totalPeso += c.peso;
                totalPonderado += (n.nota / c.max) * c.peso;
            }
        });
        return totalPeso > 0 ? (totalPonderado / totalPeso) * 100 : 0;
    },

    renderChart(criterios, avaliacoes) {
        const ctx = document.getElementById('chartCriterios');
        if (!ctx) return;
        if (this._chart) this._chart.destroy();

        const medias = criterios.map(c => {
            const notas = avaliacoes.flatMap(a => a.notas.filter(n => n.criterioId === c.id).map(n => n.nota));
            return notas.length > 0 ? (notas.reduce((s, v) => s + v, 0) / notas.length).toFixed(1) : 0;
        });

        this._chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: criterios.map(c => c.nome),
                datasets: [{
                    label: 'Media de Pontuacao',
                    data: medias,
                    backgroundColor: 'rgba(123, 26, 44, 0.8)',
                    borderColor: '#7B1A2C',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, max: 100 },
                    x: { ticks: { font: { size: 10 }, maxRotation: 45 } }
                }
            }
        });
    },

    renderTop5(unidades, avaliacoes) {
        const container = document.getElementById('topUnidades');
        const ranked = this.getRankedUnidades();
        const top = ranked.slice(0, 5);
        container.innerHTML = top.map((r, i) => {
            const cls = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
            return `<div class="top-list-item">
                <div class="top-rank ${cls}">${i + 1}</div>
                <div class="top-name">${r.nome}</div>
                <div class="top-score">${r.score.toFixed(1)}</div>
            </div>`;
        }).join('') || '<p style="color:var(--gray-400);text-align:center;padding:2rem;">Nenhuma avaliacao realizada</p>';
    },

    renderAtividades(avaliacoes, unidades) {
        const container = document.getElementById('atividadesRecentes');
        const recent = [...avaliacoes].reverse().slice(0, 5);
        container.innerHTML = recent.map(a => {
            const u = unidades.find(un => un.id === a.unidadeId);
            return `<div class="activity-item">
                <div class="activity-icon"><i class="fas fa-clipboard-check"></i></div>
                <div class="activity-text">Avaliacao de <strong>${u ? u.nome : 'Unidade removida'}</strong> - ${a.status}</div>
                <div class="activity-time">${a.data}</div>
            </div>`;
        }).join('') || '<p style="color:var(--gray-400);text-align:center;padding:2rem;">Nenhuma atividade recente</p>';
    },

    // --- Unidades ---
    renderUnidades() {
        const unidades = this.getData('unidades');
        const search = (document.getElementById('searchUnidades')?.value || '').toLowerCase();
        const filtered = unidades.filter(u =>
            u.nome.toLowerCase().includes(search) ||
            u.comarca.toLowerCase().includes(search) ||
            u.responsavel.toLowerCase().includes(search)
        );
        const tbody = document.getElementById('tabelaUnidades');
        if (!tbody) return;
        tbody.innerHTML = filtered.map(u => `<tr>
            <td><strong>${u.nome}</strong></td>
            <td>${u.comarca}</td>
            <td><span class="badge badge-blue">${u.tipo}</span></td>
            <td>${u.responsavel}</td>
            <td><span class="badge badge-green">${u.status}</span></td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="app.editarUnidade(${u.id})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger" onclick="app.excluirUnidade(${u.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--gray-400);padding:2rem;">Nenhuma unidade encontrada</td></tr>';
    },

    filterUnidades() { this.renderUnidades(); },

    salvarUnidade(e) {
        e.preventDefault();
        const unidades = this.getData('unidades');
        const id = document.getElementById('unidadeId').value;
        const data = {
            nome: document.getElementById('unidadeNome').value,
            comarca: document.getElementById('unidadeComarca').value,
            tipo: document.getElementById('unidadeTipo').value,
            responsavel: document.getElementById('unidadeResponsavel').value,
            email: document.getElementById('unidadeEmail').value,
            telefone: document.getElementById('unidadeTelefone').value,
            status: 'Ativa'
        };

        if (id) {
            const idx = unidades.findIndex(u => u.id === parseInt(id));
            if (idx !== -1) { unidades[idx] = { ...unidades[idx], ...data }; }
        } else {
            data.id = (Math.max(0, ...unidades.map(u => u.id)) + 1);
            unidades.push(data);
        }

        this.setData('unidades', unidades);
        this.hideModal('modalUnidade');
        document.getElementById('formUnidade').reset();
        document.getElementById('unidadeId').value = '';
        this.renderAll();
        this.toast(id ? 'Unidade atualizada com sucesso!' : 'Unidade cadastrada com sucesso!', 'success');
    },

    editarUnidade(id) {
        const u = this.getData('unidades').find(u => u.id === id);
        if (!u) return;
        document.getElementById('unidadeId').value = u.id;
        document.getElementById('unidadeNome').value = u.nome;
        document.getElementById('unidadeComarca').value = u.comarca;
        document.getElementById('unidadeTipo').value = u.tipo;
        document.getElementById('unidadeResponsavel').value = u.responsavel;
        document.getElementById('unidadeEmail').value = u.email || '';
        document.getElementById('unidadeTelefone').value = u.telefone || '';
        document.getElementById('modalUnidadeTitulo').textContent = 'Editar Unidade';
        this.showModal('modalUnidade');
    },

    excluirUnidade(id) {
        if (!confirm('Deseja realmente excluir esta unidade?')) return;
        const unidades = this.getData('unidades').filter(u => u.id !== id);
        this.setData('unidades', unidades);
        const avaliacoes = this.getData('avaliacoes').filter(a => a.unidadeId !== id);
        this.setData('avaliacoes', avaliacoes);
        this.renderAll();
        this.toast('Unidade excluida com sucesso!', 'success');
    },

    // --- Criterios ---
    renderCriterios() {
        const criterios = this.getData('criterios');
        const container = document.getElementById('listaCriterios');
        if (!container) return;
        container.innerHTML = criterios.map(c => `<div class="criterio-card">
            <h4>${c.nome}</h4>
            <p>${c.descricao}</p>
            <div class="criterio-meta">
                <span><i class="fas fa-weight-hanging"></i> Peso: ${c.peso}</span>
                <span><i class="fas fa-star"></i> Max: ${c.max} pts</span>
            </div>
            <div class="criterio-actions">
                <button class="btn btn-sm btn-secondary" onclick="app.editarCriterio(${c.id})"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn btn-sm btn-danger" onclick="app.excluirCriterio(${c.id})"><i class="fas fa-trash"></i></button>
            </div>
        </div>`).join('');
    },

    salvarCriterio(e) {
        e.preventDefault();
        const criterios = this.getData('criterios');
        const id = document.getElementById('criterioId').value;
        const data = {
            nome: document.getElementById('criterioNome').value,
            descricao: document.getElementById('criterioDescricao').value,
            peso: parseInt(document.getElementById('criterioPeso').value),
            max: parseInt(document.getElementById('criterioMax').value)
        };

        if (id) {
            const idx = criterios.findIndex(c => c.id === parseInt(id));
            if (idx !== -1) criterios[idx] = { ...criterios[idx], ...data };
        } else {
            data.id = (Math.max(0, ...criterios.map(c => c.id)) + 1);
            criterios.push(data);
        }

        this.setData('criterios', criterios);
        this.hideModal('modalCriterio');
        e.target.reset();
        document.getElementById('criterioId').value = '';
        this.renderAll();
        this.toast('Criterio salvo com sucesso!', 'success');
    },

    editarCriterio(id) {
        const c = this.getData('criterios').find(c => c.id === id);
        if (!c) return;
        document.getElementById('criterioId').value = c.id;
        document.getElementById('criterioNome').value = c.nome;
        document.getElementById('criterioDescricao').value = c.descricao;
        document.getElementById('criterioPeso').value = c.peso;
        document.getElementById('criterioMax').value = c.max;
        this.showModal('modalCriterio');
    },

    excluirCriterio(id) {
        if (!confirm('Deseja realmente excluir este criterio?')) return;
        const criterios = this.getData('criterios').filter(c => c.id !== id);
        this.setData('criterios', criterios);
        this.renderAll();
        this.toast('Criterio excluido!', 'success');
    },

    // --- Avaliacoes ---
    renderAvaliacoes() {
        const avaliacoes = this.getData('avaliacoes');
        const unidades = this.getData('unidades');
        const tbody = document.getElementById('tabelaAvaliacoes');
        if (!tbody) return;
        tbody.innerHTML = avaliacoes.map(a => {
            const u = unidades.find(un => un.id === a.unidadeId);
            const score = this.calcularPontuacao(a).toFixed(1);
            const statusClass = a.status === 'Concluida' ? 'badge-green' : 'badge-yellow';
            return `<tr>
                <td><strong>${u ? u.nome : 'Unidade removida'}</strong></td>
                <td>${a.data}</td>
                <td>${a.avaliador}</td>
                <td><strong>${score}</strong></td>
                <td><span class="badge ${statusClass}">${a.status}</span></td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="app.verAvaliacao(${a.id})"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="app.excluirAvaliacao(${a.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--gray-400);padding:2rem;">Nenhuma avaliacao registrada</td></tr>';
    },

    iniciarAvaliacao() {
        const unidades = this.getData('unidades');
        const criterios = this.getData('criterios');
        if (unidades.length === 0) { this.toast('Cadastre unidades antes de avaliar!', 'error'); return; }
        if (criterios.length === 0) { this.toast('Cadastre criterios antes de avaliar!', 'error'); return; }

        const sel = document.getElementById('avalUnidade');
        sel.innerHTML = '<option value="">Selecione</option>' + unidades.map(u => `<option value="${u.id}">${u.nome}</option>`).join('');

        const container = document.getElementById('avalCriterios');
        container.innerHTML = criterios.map(c => `<div class="aval-criterio-item">
            <label>${c.nome}</label>
            <span class="peso">Peso: ${c.peso}</span>
            <input type="number" min="0" max="${c.max}" required class="input" data-criterio="${c.id}" placeholder="0-${c.max}">
        </div>`).join('');

        document.getElementById('avalData').value = new Date().toISOString().split('T')[0];
        this.showModal('modalAvaliacao');
    },

    salvarAvaliacao(e) {
        e.preventDefault();
        const avaliacoes = this.getData('avaliacoes');
        const notas = [];
        document.querySelectorAll('#avalCriterios input').forEach(inp => {
            notas.push({ criterioId: parseInt(inp.dataset.criterio), nota: parseInt(inp.value) || 0 });
        });

        const nextId = parseInt(localStorage.getItem('pq2026_nextAvalId') || '1');
        const avaliacao = {
            id: nextId,
            unidadeId: parseInt(document.getElementById('avalUnidade').value),
            avaliador: document.getElementById('avalAvaliador').value,
            data: document.getElementById('avalData').value,
            status: 'Concluida',
            observacoes: document.getElementById('avalObs').value,
            notas
        };

        avaliacoes.push(avaliacao);
        this.setData('avaliacoes', avaliacoes);
        localStorage.setItem('pq2026_nextAvalId', String(nextId + 1));
        this.hideModal('modalAvaliacao');
        e.target.reset();
        this.renderAll();
        this.toast('Avaliacao registrada com sucesso!', 'success');
    },

    verAvaliacao(id) {
        const a = this.getData('avaliacoes').find(av => av.id === id);
        const u = this.getData('unidades').find(un => un.id === a.unidadeId);
        const criterios = this.getData('criterios');
        let msg = `Unidade: ${u ? u.nome : 'Removida'}\nAvaliador: ${a.avaliador}\nData: ${a.data}\nPontuacao: ${this.calcularPontuacao(a).toFixed(1)}\n\nNotas:\n`;
        a.notas.forEach(n => {
            const c = criterios.find(cr => cr.id === n.criterioId);
            msg += `  ${c ? c.nome : 'Criterio removido'}: ${n.nota}\n`;
        });
        if (a.observacoes) msg += `\nObservacoes: ${a.observacoes}`;
        alert(msg);
    },

    excluirAvaliacao(id) {
        if (!confirm('Deseja realmente excluir esta avaliacao?')) return;
        const avaliacoes = this.getData('avaliacoes').filter(a => a.id !== id);
        this.setData('avaliacoes', avaliacoes);
        this.renderAll();
        this.toast('Avaliacao excluida!', 'success');
    },

    // --- Ranking ---
    getRankedUnidades() {
        const unidades = this.getData('unidades');
        const avaliacoes = this.getData('avaliacoes').filter(a => a.status === 'Concluida');

        return unidades.map(u => {
            const uAvals = avaliacoes.filter(a => a.unidadeId === u.id);
            let score = 0;
            if (uAvals.length > 0) {
                const scores = uAvals.map(a => this.calcularPontuacao(a));
                score = scores.reduce((s, v) => s + v, 0) / scores.length;
            }
            return { ...u, score };
        }).sort((a, b) => b.score - a.score);
    },

    renderRanking() {
        const comarcaFilter = document.getElementById('filtroComarca')?.value || '';
        const tipoFilter = document.getElementById('filtroTipo')?.value || '';
        let ranked = this.getRankedUnidades();

        if (comarcaFilter) ranked = ranked.filter(r => r.comarca === comarcaFilter);
        if (tipoFilter) ranked = ranked.filter(r => r.tipo === tipoFilter);

        // Populate comarca filter
        const comarcas = [...new Set(this.getData('unidades').map(u => u.comarca))];
        const sel = document.getElementById('filtroComarca');
        if (sel && sel.options.length <= 1) {
            comarcas.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o); });
        }

        const container = document.getElementById('rankingList');
        if (!container) return;
        const maxScore = Math.max(...ranked.map(r => r.score), 1);

        container.innerHTML = ranked.map((r, i) => {
            const posClass = i === 0 ? 'p1' : i === 1 ? 'p2' : i === 2 ? 'p3' : 'other';
            const barWidth = (r.score / maxScore) * 100;
            return `<div class="ranking-item">
                <div class="ranking-pos ${posClass}">${i + 1}o</div>
                <div class="ranking-info">
                    <div class="ranking-name">${r.nome}</div>
                    <div class="ranking-meta">${r.comarca} - ${r.tipo}</div>
                </div>
                <div class="ranking-bar-bg"><div class="ranking-bar" style="width:${barWidth}%"></div></div>
                <div class="ranking-score">${r.score.toFixed(1)}</div>
            </div>`;
        }).join('') || '<p style="color:var(--gray-400);text-align:center;padding:3rem;">Nenhum resultado encontrado</p>';
    },

    // --- Relatorios ---
    gerarRelatorio(tipo) {
        const output = document.getElementById('relatorioOutput');
        const titulo = document.getElementById('relatorioTitulo');
        const conteudo = document.getElementById('relatorioConteudo');
        output.style.display = 'block';

        const unidades = this.getData('unidades');
        const avaliacoes = this.getData('avaliacoes').filter(a => a.status === 'Concluida');
        const criterios = this.getData('criterios');
        const ranked = this.getRankedUnidades();

        let html = '';

        switch (tipo) {
            case 'geral':
                titulo.innerHTML = '<i class="fas fa-file-alt"></i> Relatorio Geral';
                html = `<div class="table-wrapper"><table class="table">
                    <thead><tr><th>Unidade</th><th>Comarca</th><th>Tipo</th><th>Avaliacoes</th><th>Media</th></tr></thead>
                    <tbody>${ranked.map(r => {
                        const count = avaliacoes.filter(a => a.unidadeId === r.id).length;
                        return `<tr><td>${r.nome}</td><td>${r.comarca}</td><td>${r.tipo}</td><td>${count}</td><td><strong>${r.score.toFixed(1)}</strong></td></tr>`;
                    }).join('')}</tbody>
                </table></div>`;
                break;

            case 'ranking':
                titulo.innerHTML = '<i class="fas fa-trophy"></i> Relatorio de Ranking';
                html = `<div class="table-wrapper"><table class="table">
                    <thead><tr><th>Posicao</th><th>Unidade</th><th>Comarca</th><th>Pontuacao</th></tr></thead>
                    <tbody>${ranked.map((r, i) => `<tr><td><strong>${i + 1}o</strong></td><td>${r.nome}</td><td>${r.comarca}</td><td><strong>${r.score.toFixed(1)}</strong></td></tr>`).join('')}</tbody>
                </table></div>`;
                break;

            case 'criterios':
                titulo.innerHTML = '<i class="fas fa-chart-pie"></i> Analise por Criterio';
                html = `<div class="table-wrapper"><table class="table">
                    <thead><tr><th>Criterio</th><th>Peso</th><th>Media</th><th>Menor Nota</th><th>Maior Nota</th></tr></thead>
                    <tbody>${criterios.map(c => {
                        const notas = avaliacoes.flatMap(a => a.notas.filter(n => n.criterioId === c.id).map(n => n.nota));
                        const avg = notas.length > 0 ? (notas.reduce((s, v) => s + v, 0) / notas.length).toFixed(1) : '-';
                        const min = notas.length > 0 ? Math.min(...notas) : '-';
                        const max = notas.length > 0 ? Math.max(...notas) : '-';
                        return `<tr><td>${c.nome}</td><td>${c.peso}</td><td><strong>${avg}</strong></td><td>${min}</td><td>${max}</td></tr>`;
                    }).join('')}</tbody>
                </table></div>`;
                break;

            case 'comparativo':
                titulo.innerHTML = '<i class="fas fa-balance-scale"></i> Comparativo por Comarca';
                const comarcas = [...new Set(unidades.map(u => u.comarca))];
                html = `<div class="table-wrapper"><table class="table">
                    <thead><tr><th>Comarca</th><th>Unidades</th><th>Media</th></tr></thead>
                    <tbody>${comarcas.map(comarca => {
                        const cUnidades = ranked.filter(r => r.comarca === comarca);
                        const avg = cUnidades.length > 0 ? (cUnidades.reduce((s, u) => s + u.score, 0) / cUnidades.length).toFixed(1) : '0.0';
                        return `<tr><td><strong>${comarca}</strong></td><td>${cUnidades.length}</td><td><strong>${avg}</strong></td></tr>`;
                    }).join('')}</tbody>
                </table></div>`;
                break;
        }

        conteudo.innerHTML = html;
        this._lastReportType = tipo;
    },

    exportarCSV() {
        const ranked = this.getRankedUnidades();
        let csv = 'Posicao,Unidade,Comarca,Tipo,Pontuacao\n';
        ranked.forEach((r, i) => {
            csv += `${i + 1},"${r.nome}","${r.comarca}","${r.tipo}",${r.score.toFixed(1)}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'premio_qualidade_2026.csv'; a.click();
        URL.revokeObjectURL(url);
        this.toast('CSV exportado com sucesso!', 'success');
    },

    // --- Modals ---
    showModal(id) { document.getElementById(id).classList.add('active'); },
    hideModal(id) {
        document.getElementById(id).classList.remove('active');
        if (id === 'modalUnidade') {
            document.getElementById('formUnidade').reset();
            document.getElementById('unidadeId').value = '';
            document.getElementById('modalUnidadeTitulo').textContent = 'Nova Unidade';
        }
    },

    // --- Toast ---
    toast(msg, type = '') {
        const el = document.getElementById('toast');
        el.textContent = msg;
        el.className = 'toast show ' + type;
        setTimeout(() => { el.className = 'toast'; }, 3000);
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
