import { createServerClient } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "BUDGY - Tuas financas, teus sonhos",
  description:
    "Controla receitas e despesas, cria orcamentos inteligentes, define metas de poupanca e acompanha o teu xitique. Comeca gratis.",
};

/* ── Inline SVG Icons ── */

interface IconProps {
  className?: string;
  style?: React.CSSProperties;
}

function IconWallet({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}

function IconCheck({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IconArrowRight({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function IconX({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function IconTrendingUp({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function IconPieChart({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  );
}

function IconTarget({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function IconUsers({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconBarChart({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" x2="12" y1="20" y2="10" />
      <line x1="18" x2="18" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="16" />
    </svg>
  );
}

function IconCreditCard({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}

function IconRepeat({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function IconBell({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function IconCalendar({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

function IconBookOpen({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </svg>
  );
}

function IconZap({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
    </svg>
  );
}

function IconGlobe({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

/* ── Data ── */

const stats = [
  { value: "72%", label: "das fam\u00EDlias n\u00E3o controlam despesas" },
  { value: "6x", label: "mais poupan\u00E7a com or\u00E7amento" },
  { value: "15 min", label: "por semana \u00E9 o que precisas" },
  { value: "0 MT", label: "para come\u00E7ar" },
];

const problems = [
  "Despesas em pap\u00E9is soltos ou no WhatsApp",
  "Fim do m\u00EAs sem saber para onde foi o dinheiro",
  "Xitique desorganizado com discuss\u00F5es constantes",
  "D\u00EDvidas esquecidas que se acumulam",
  "Metas de poupan\u00E7a que nunca avan\u00E7am",
];

const solutions = [
  "Cada metical registado automaticamente por categoria",
  "Relat\u00F3rios claros que mostram para onde vai o dinheiro",
  "Xitique digital com total transpar\u00EAncia para todos",
  "Painel de d\u00EDvidas com lembretes autom\u00E1ticos",
  "Metas visuais com progresso di\u00E1rio que motivam",
];

const steps = [
  {
    number: "01",
    title: "Regista as tuas contas",
    description: "Adiciona as tuas contas banc\u00E1rias, carteiras e fontes de rendimento. Tudo num s\u00F3 painel.",
  },
  {
    number: "02",
    title: "Define or\u00E7amentos e metas",
    description: "Cria limites por categoria e define metas de poupan\u00E7a. O BUDGY acompanha tudo por ti.",
  },
  {
    number: "03",
    title: "V\u00EA o teu dinheiro crescer",
    description: "Acompanha o progresso, recebe alertas inteligentes e toma decis\u00F5es financeiras com confian\u00E7a.",
  },
];

const platformFeatures = [
  { icon: IconCreditCard, title: "Multi-contas", description: "Gere v\u00E1rias contas banc\u00E1rias, carteiras e fontes de rendimento num s\u00F3 lugar." },
  { icon: IconRepeat, title: "Transa\u00E7\u00F5es autom\u00E1ticas", description: "Receitas e despesas recorrentes registadas automaticamente todos os meses." },
  { icon: IconPieChart, title: "Or\u00E7amentos por categoria", description: "Define limites para alimenta\u00E7\u00E3o, transportes, lazer e mais. V\u00EA o progresso em tempo real." },
  { icon: IconTarget, title: "Metas de poupan\u00E7a", description: "Cria metas visuais com prazos e acompanha quanto falta para o teu objectivo." },
  { icon: IconUsers, title: "Xitique digital", description: "Organiza poupan\u00E7as em grupo com total transpar\u00EAncia. Hist\u00F3rico, turnos e notifica\u00E7\u00F5es." },
  { icon: IconBarChart, title: "Relat\u00F3rios detalhados", description: "Gr\u00E1ficos mensais, tend\u00EAncias de gastos e compara\u00E7\u00F5es que te ajudam a decidir." },
  { icon: IconTrendingUp, title: "Gest\u00E3o de d\u00EDvidas", description: "Acompanha empr\u00E9stimos e d\u00EDvidas. Sabe exactamente quanto deves e a quem." },
  { icon: IconBell, title: "Alertas inteligentes", description: "Notifica\u00E7\u00F5es quando te aproximas do limite do or\u00E7amento ou tens pagamentos pendentes." },
  { icon: IconCalendar, title: "Calend\u00E1rio financeiro", description: "V\u00EA pagamentos futuros, datas de sal\u00E1rio e vencimentos num calend\u00E1rio visual." },
  { icon: IconBookOpen, title: "Educa\u00E7\u00E3o financeira", description: "Dicas e conte\u00FAdo adaptado ao teu perfil financeiro para tomares melhores decis\u00F5es." },
];

const uniqueFeatures = [
  {
    badge: "EXCLUSIVO",
    title: "Xitique digital integrado",
    description: "O primeiro xitique 100% digital de Mo\u00E7ambique. Cria grupos, define turnos, acompanha pagamentos e mant\u00E9m a transpar\u00EAncia total.",
    icon: IconUsers,
  },
  {
    badge: "AUTOM\u00C1TICO",
    title: "Or\u00E7amento que se adapta",
    description: "O or\u00E7amento aprende com os teus h\u00E1bitos e sugere ajustes. Se gastas menos numa categoria, redistribui para as tuas metas.",
    icon: IconZap,
  },
  {
    badge: "LOCAL",
    title: "Pensado em meticais",
    description: "Pre\u00E7os, categorias e conte\u00FAdo adaptados \u00E0 realidade mo\u00E7ambicana. Categorias como chapa, xitique e machamba.",
    icon: IconGlobe,
  },
];

/* ── Page ── */

export default async function DinheiroLanding() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/painel");

  return (
    <div className="min-h-screen bg-[#0A0F0A]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-[#0A0F0A]/80 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <IconWallet className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold text-white">VIDA<span className="text-emerald-400">.DINHEIRO</span></span>
          </div>
          <div className="hidden sm:flex items-center gap-8">
            <a href="#funcionalidades" className="text-sm text-white/60 hover:text-white transition-colors">Funcionalidades</a>
            <a href="#como-funciona" className="text-sm text-white/60 hover:text-white transition-colors">Como Funciona</a>
          </div>
          <Link href="/login" className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">Come&ccedil;ar</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-1/4 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 sm:pt-28 sm:pb-32">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 rounded-full px-4 py-2 mb-8 border border-emerald-500/20">
              <IconWallet className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-300">Parte do ecossistema VIDA</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight text-white leading-tight">
              Tuas finan&ccedil;as,<br /><span className="text-emerald-400">teus sonhos.</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
              Controla o teu dinheiro sem complica&ccedil;&otilde;es. Or&ccedil;amentos inteligentes, xitique digital, metas de poupan&ccedil;a e relat&oacute;rios claros &mdash; tudo num s&oacute; lugar.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/login" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-lg px-8 py-4 rounded-2xl transition-all">
                Come&ccedil;ar Gr&aacute;tis <IconArrowRight className="w-5 h-5" />
              </Link>
              <a href="#funcionalidades" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white font-semibold text-lg px-8 py-4 rounded-2xl border border-white/10 transition-colors">Ver Funcionalidades</a>
            </div>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-white/40">
              <div className="flex items-center gap-1.5"><IconCheck className="w-4 h-4 text-emerald-400" /><span>Sem cart&atilde;o de cr&eacute;dito</span></div>
              <div className="flex items-center gap-1.5"><IconCheck className="w-4 h-4 text-emerald-400" /><span>Configura em 2 minutos</span></div>
              <div className="flex items-center gap-1.5"><IconCheck className="w-4 h-4 text-emerald-400" /><span>Xitique inclu&iacute;do</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl sm:text-4xl font-extrabold text-emerald-400">{s.value}</div>
                <div className="mt-1 text-sm text-white/50">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem vs Solution */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">O dinheiro n&atilde;o tem de ser um problema.<br /><span className="text-white/50">Tem de ser uma ferramenta.</span></h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-white/[0.03] rounded-3xl border border-white/10 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center"><IconX className="w-5 h-5 text-red-400" /></div>
                <h3 className="text-lg font-bold text-red-400">O que N&Atilde;O funciona</h3>
              </div>
              <ul className="space-y-4">
                {problems.map((p) => (
                  <li key={p} className="flex items-start gap-3">
                    <div className="mt-1 w-5 h-5 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0"><IconX className="w-3 h-3 text-red-400" /></div>
                    <span className="text-white/60 text-sm leading-relaxed">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white/[0.03] rounded-3xl border border-emerald-500/20 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center"><IconCheck className="w-5 h-5 text-emerald-400" /></div>
                <h3 className="text-lg font-bold text-emerald-400">O que FUNCIONA com BUDGY</h3>
              </div>
              <ul className="space-y-4">
                {solutions.map((s) => (
                  <li key={s} className="flex items-start gap-3">
                    <div className="mt-1 w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0"><IconCheck className="w-3 h-3 text-emerald-400" /></div>
                    <span className="text-white/70 text-sm leading-relaxed">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="como-funciona" className="py-20 sm:py-28 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">As 3 fases do controlo financeiro</h2>
            <p className="mt-4 text-lg text-white/50">De desorganizado a no controlo em minutos.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {steps.map((step, i) => (
              <div key={step.number} className="relative">
                {i < steps.length - 1 && <div className="hidden md:block absolute top-12 left-full w-full h-px bg-gradient-to-r from-white/20 to-transparent -translate-x-8" />}
                <div className="bg-white/[0.03] rounded-3xl border border-white/10 p-8 h-full">
                  <div className="text-5xl font-extrabold text-emerald-400/30 mb-4">{step.number}</div>
                  <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Features */}
      <section id="funcionalidades" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">A plataforma completa</h2>
            <p className="mt-4 text-lg text-white/50">Tudo o que precisas para dominar as tuas finan&ccedil;as, numa s&oacute; app.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {platformFeatures.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="bg-white/[0.03] rounded-2xl border border-white/10 p-6 hover:border-emerald-500/20 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4"><Icon className="w-5 h-5 text-emerald-400" /></div>
                  <h3 className="font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{f.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Unique Features */}
      <section className="py-20 sm:py-28 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">Funcionalidades exclusivas</h2>
            <p className="mt-4 text-lg text-white/50">O que s&oacute; encontras no BUDGY.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {uniqueFeatures.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.badge} className="bg-white/[0.03] rounded-3xl border border-white/10 p-8 hover:border-emerald-500/20 transition-all">
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center"><Icon className="w-6 h-6 text-emerald-400" /></div>
                    <span className="text-[10px] font-bold tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">{f.badge}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3">{f.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">{f.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-500 rounded-3xl p-10 sm:p-16 text-center text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl font-bold">Pronto para controlar o teu dinheiro?</h2>
              <p className="mt-4 text-lg text-white/80 max-w-xl mx-auto">Come&ccedil;a hoje e v&ecirc; exactamente para onde vai cada metical.</p>
              <Link href="/login" className="mt-8 inline-flex items-center gap-2 bg-white text-emerald-600 font-semibold text-lg px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all">
                Come&ccedil;ar Gr&aacute;tis Agora <IconArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex flex-col items-center md:items-start gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center"><IconWallet className="w-3.5 h-3.5 text-white" /></div>
                <span className="text-lg font-bold text-white">VIDA<span className="text-emerald-400">.DINHEIRO</span></span>
              </div>
              <p className="text-sm text-white/40">Parte do ecossistema VIDA</p>
            </div>
            <div className="flex items-center gap-6 text-sm text-white/50">
              <Link href="/terms" className="hover:text-white transition-colors">Termos</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">Privacidade</Link>
            </div>
            <p className="text-sm text-white/30">&copy; 2025 VIDA. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
