import { createFileRoute, Link } from "@tanstack/react-router";
import logoAsset from "@/assets/logo-iara.png.asset.json";
import { IaraHeader } from "@/lib/iara-header";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IARA — Painel de Entrada · Inteligência Artificial de Rastreamento e Aprendizado de Dados" },
      {
        name: "description",
        content:
          "IARA — Inteligência Artificial de Rastreamento e Aprendizado de Dados do TJAC. Motor preditivo, chat analítico Gemini, dashboards por persona, Data Hub e alertas.",
      },
      { property: "og:title", content: "IARA · TJAC" },
      { property: "og:image", content: logoAsset.url },
    ],
  }),
  component: IaraEntryPanel,
});

function IaraEntryPanel() {
  return (
    <>
      <IaraHeader />

      <div className="iara-wave-wrap" aria-hidden="true">
        <svg width="1440" height="72" viewBox="0 0 1440 72" preserveAspectRatio="none">
          <path className="iara-wave-path-1" d="M0,36 C60,18 120,54 180,36 C240,18 300,54 360,36 C420,18 480,54 540,36 C600,18 660,54 720,36 C780,18 840,54 900,36 C960,18 1020,54 1080,36 C1140,18 1200,54 1260,36 C1320,18 1380,54 1440,36" />
          <path className="iara-wave-path-2" d="M0,42 C80,22 160,58 240,42 C320,22 400,58 480,42 C560,22 640,58 720,42 C800,22 880,58 960,42 C1040,22 1120,58 1200,42 C1280,22 1360,58 1440,42" />
          <path className="iara-wave-path-3" d="M0,30 C40,14 80,50 120,30 C160,14 200,50 240,30 C280,14 320,50 360,30 C400,14 440,50 480,30 C520,14 560,50 600,30 C640,14 680,50 720,30 C760,14 800,50 840,30 C880,14 920,50 960,30 C1000,14 1040,50 1080,30 C1120,14 1160,50 1200,30 C1240,14 1280,50 1320,30 C1360,14 1400,50 1440,30" />
        </svg>
        <div className="iara-river-labels">
          {["DataJud", "SAJ / SG5", "eproc", "PJe", "PDPJ", "Predição", "Insight"].map((l) => (
            <span key={l} className="iara-river-label">{l}</span>
          ))}
        </div>
      </div>

      <section className="iara-hero">
        <div>
          <h1 className="iara-hero-greeting">
            Bem-vindo à <span>IARA</span>
          </h1>
          <p className="iara-hero-meta">
            Inteligência Artificial de Rastreamento e Aprendizado de Dados do Tribunal de Justiça do Acre
            &nbsp;·&nbsp; Última sincronização: agora
          </p>
        </div>
        <div className="iara-hero-stats" role="group" aria-label="Indicadores">
          <StatCard tone="warn" value="67%" label="Meta 1 CNJ" />
          <StatCard tone="ok" value="84%" label="Meta 2 CNJ" />
          <StatCard tone="info" value="15.7k" label="Processos analisados" />
          <StatCard tone="alert" value="7" label="Alertas ativos" />
        </div>
      </section>

      <main className="iara-main">
        <p className="iara-section-label">Módulos ativos — clique para acessar</p>

        <div className="iara-module-grid">
          <ModCard
            to="/preditivo" cls="iara-mod-predictive" icon="🔮" status="Ativo" statusCls="iara-status-ativo"
            title="Motor" highlight="Preditivo"
            desc="Regressão linear sobre série mensal de estoque/baixados — projeta congestionamento por unidade nos próximos 6 meses."
            metric={<><strong>Modelo:</strong> tendência linear · base TCL · 5.713 pontos</>}
            footer="Acessar previsões" sub="Treinado nos dados TJAC"
          />
          <ModCard
            to="/chat" cls="iara-mod-chat" icon="💬" status="Gemini" statusCls="iara-status-ativo"
            title="Chat" highlight="Analítico"
            desc="Pergunte em português sobre os dados carregados. Powered by Google Gemini com contexto vivo do banco IARA."
            metric={<><strong>Exemplo:</strong> "Quais varas têm maior risco de não bater a Meta 2?"</>}
            footer="Iniciar consulta" sub="google/gemini-3.1-pro-preview"
          />
          <ModCard
            to="/dashboards" cls="iara-mod-dashboard" icon="📊" status="Adaptativo" statusCls="iara-status-auto"
            title="Dashboards" highlight="por Persona"
            desc="Painéis adaptativos para Magistrado, Gestor e Servidor — foco em decisão, não em dados brutos."
            metric={<>3 personas · indicadores específicos por papel</>}
            footer="Ver painel adaptativo" sub="Magistrado · Gestor · Servidor"
          />
          <ModCard
            to="/alertas" cls="iara-mod-alerts" icon="🚨" status="Ativo" statusCls="iara-status-alerta"
            title="Sistema de" highlight="Alertas"
            desc="Detecção automática de risco: estoque crítico, prescrição iminente, queda de produtividade."
            metric={<><strong>7</strong> alertas detectados a partir dos dados reais</>}
            footer="Ver alertas" sub="Severidade · crítica → baixa"
          />
          <ModCard
            to="/data-hub" cls="iara-mod-datahub" icon="🔗" status="Sincronizando" statusCls="iara-status-sync"
            title="Data" highlight="Hub"
            desc="Camada unificada — CNJ, TJAC, eproc e admin em fonte única de verdade com governança de TIC."
            metric={
              <div className="iara-node-row">
                <span className="iara-node connected">DataJud</span><span className="iara-node-arrow">›</span>
                <span className="iara-node connected">SAJ/SG5</span><span className="iara-node-arrow">›</span>
                <span className="iara-node connected">PJe</span><span className="iara-node-arrow">›</span>
                <span className="iara-node pending">eproc</span><span className="iara-node-arrow">›</span>
                <span className="iara-node pending">GRP</span>
              </div>
            }
            footer="Monitorar fontes" sub="7 fontes mapeadas"
          />
          <ModCard
            to="/dashboards" cls="iara-mod-reports" icon="📬" status="Agendado" statusCls="iara-status-agendado"
            title="Relatórios" highlight="Auto."
            desc="Relatórios semanais por unidade, gerados pela IARA e entregues toda segunda às 07h."
            metric={<><strong>47</strong> relatórios · semana anterior · <strong style={{ color: "#4ADE80" }}>100%</strong> entregues</>}
            footer="Ver relatórios" sub="Próximo: seg. 07:00"
          />
        </div>
      </main>

      <footer className="iara-footer">
        <div className="iara-status-sources" role="list">
          <Source tone="ok" label="DataJud" />
          <Source tone="ok" label="SAJ / SG5" />
          <Source tone="ok" label="PJe" />
          <Source tone="warn" label="eproc · integrando…" />
          <Source tone="warn" label="GRP · integrando…" />
          <Source tone="warn" label="PDPJ · integrando…" />
          <Source tone="ok" label="CNJ API" />
        </div>
        <div className="iara-footer-sys">
          IARA v0.2-MVP &nbsp;·&nbsp; <span>Operacional</span>
        </div>
      </footer>
    </>
  );
}

function StatCard({ tone, value, label }: { tone: "ok" | "warn" | "alert" | "info"; value: string; label: string }) {
  return (
    <div className={`iara-stat-card iara-stat-${tone}`} title={label}>
      <div className="iara-stat-value">{value}</div>
      <div className="iara-stat-label">{label}</div>
    </div>
  );
}

function Source({ tone, label }: { tone: "ok" | "warn" | "error"; label: string }) {
  return (
    <div className="iara-source">
      <span className={`iara-source-dot ${tone}`} aria-hidden="true" />
      {label}
    </div>
  );
}

function ModCard({
  to, cls, icon, status, statusCls, title, highlight, desc, metric, footer, sub,
}: {
  to: string; cls: string; icon: string; status: string; statusCls: string;
  title: string; highlight: string; desc: string; metric: React.ReactNode; footer: string; sub: string;
}) {
  return (
    <Link to={to} className={`iara-mod-card ${cls}`}>
      <div className="iara-card-top">
        <div className="iara-card-icon" aria-hidden="true">{icon}</div>
        <span className={`iara-status-badge ${statusCls}`}>{status}</span>
      </div>
      <div>
        <h2 className="iara-card-title">{title} <span>{highlight}</span></h2>
        <p className="iara-card-desc">{desc}</p>
      </div>
      <div className="iara-card-metric">{metric}</div>
      <div className="iara-card-footer">
        <span className="iara-card-cta">{footer} <span className="iara-cta-arrow">→</span></span>
        <span className="iara-card-updated">{sub}</span>
      </div>
    </Link>
  );
}
