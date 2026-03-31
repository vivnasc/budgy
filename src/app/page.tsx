import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BUDGY - Sabe para onde vai cada metical",
  description:
    "O teu dinheiro organizado sem esforço. Importa SMS do banco, controla gastos, poupa para os teus sonhos e gere o xitique.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="relative">
              <img src="/Budgy-favicon.jpeg" alt="BUDGY" className="w-9 h-9 rounded-xl shadow-md animate-bounce-slow" />
            </div>
            <span className="text-xl font-black tracking-tight text-gray-900">BUDGY</span>
          </Link>
          <div className="hidden sm:flex items-center gap-8">
            <a href="#como-funciona" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">Como funciona</a>
            <a href="#funcionalidades" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">Funcionalidades</a>
          </div>
          <Link
            href="/login"
            className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold px-6 py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-emerald-500/25 active:scale-95"
          >
            Entrar
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-emerald-50/30 to-gray-50">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-100/40 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -left-32 w-72 h-72 bg-emerald-200/20 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 sm:pt-24 sm:pb-32">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
            {/* Left: Text */}
            <div className="flex-1 text-center lg:text-left">
              <div className="animate-fade-in-up">
                <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 text-sm font-semibold px-4 py-2 rounded-full mb-6">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  A tua app de finan&ccedil;as pessoais
                </div>
              </div>
              <h1 className="animate-fade-in-up text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 leading-[1.1] tracking-tight">
                Sabe para onde vai{" "}
                <span className="gradient-text">cada metical.</span>
              </h1>
              <p className="animate-fade-in-up-delay mt-6 text-lg text-gray-500 max-w-lg leading-relaxed">
                Importa SMS do banco, carrega o extrato, ou regista na hora.
                O BUDGY organiza tudo automaticamente por categoria.
              </p>
              <div className="animate-fade-in-up-delay-2 mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-lg px-8 py-4 rounded-2xl transition-all shadow-xl shadow-emerald-500/25 hover:shadow-2xl hover:shadow-emerald-500/30 active:scale-[0.98] animate-pulse-glow"
                >
                  Come&ccedil;ar agora &rarr;
                </Link>
                <a
                  href="#como-funciona"
                  className="inline-flex items-center justify-center text-gray-600 hover:text-gray-900 font-semibold text-lg px-8 py-4 rounded-2xl border border-gray-200 hover:border-gray-300 bg-white transition-all"
                >
                  Ver como funciona
                </a>
              </div>
            </div>

            {/* Right: Animated phone mockup */}
            <div className="flex-shrink-0 animate-fade-in">
              <div className="relative">
                {/* Phone frame */}
                <div className="w-72 sm:w-80 bg-white rounded-[2.5rem] shadow-2xl shadow-gray-900/10 border border-gray-200 p-3 animate-float">
                  <div className="bg-gray-900 rounded-[2rem] overflow-hidden">
                    {/* Status bar */}
                    <div className="flex items-center justify-between px-6 py-2 text-white/60 text-[10px]">
                      <span>9:41</span>
                      <div className="flex gap-1">
                        <div className="w-4 h-2 bg-white/40 rounded-sm" />
                        <div className="w-4 h-2 bg-white/40 rounded-sm" />
                        <div className="w-6 h-2 bg-emerald-400 rounded-sm" />
                      </div>
                    </div>
                    {/* App header */}
                    <div className="bg-emerald-500 px-5 pt-3 pb-5">
                      <div className="flex items-center gap-2 mb-3">
                        <img src="/Budgy-favicon.jpeg" alt="" className="w-7 h-7 rounded-lg" />
                        <span className="text-white text-sm font-bold">BUDGY</span>
                      </div>
                      <p className="text-emerald-100 text-[10px]">Saldo Total</p>
                      <p className="text-white text-2xl font-black">87.450 <span className="text-sm font-normal text-emerald-200">MZN</span></p>
                      <div className="flex items-center gap-1 mt-1">
                        <div className="w-3 h-3 bg-emerald-400 rounded-full flex items-center justify-center">
                          <span className="text-[6px] text-white">&uarr;</span>
                        </div>
                        <span className="text-emerald-200 text-[10px]">+8.2% vs m&ecirc;s anterior</span>
                      </div>
                    </div>
                    {/* Accounts */}
                    <div className="bg-gray-900 px-5 py-4 space-y-2.5">
                      <div className="flex gap-2">
                        <div className="flex-1 bg-gray-800 rounded-xl p-3">
                          <div className="w-5 h-5 bg-blue-500 rounded-md mb-1.5" />
                          <p className="text-gray-400 text-[8px]">Banco</p>
                          <p className="text-white text-xs font-bold">52.300</p>
                        </div>
                        <div className="flex-1 bg-gray-800 rounded-xl p-3">
                          <div className="w-5 h-5 bg-purple-500 rounded-md mb-1.5" />
                          <p className="text-gray-400 text-[8px]">Conta 2</p>
                          <p className="text-white text-xs font-bold">28.950</p>
                        </div>
                        <div className="flex-1 bg-gray-800 rounded-xl p-3">
                          <div className="w-5 h-5 bg-red-500 rounded-md mb-1.5" />
                          <p className="text-gray-400 text-[8px]">Carteira</p>
                          <p className="text-white text-xs font-bold">6.200</p>
                        </div>
                      </div>
                      {/* Mini chart */}
                      <div className="bg-gray-800 rounded-xl p-3">
                        <div className="flex items-end justify-between h-16 gap-1.5 px-2">
                          <div className="flex-1 bg-emerald-500/30 rounded-t animate-bar-1" style={{maxHeight: "100%"}} />
                          <div className="flex-1 bg-emerald-500/50 rounded-t animate-bar-2" style={{maxHeight: "100%"}} />
                          <div className="flex-1 bg-emerald-500 rounded-t animate-bar-3" style={{maxHeight: "100%"}} />
                          <div className="flex-1 bg-emerald-500/70 rounded-t animate-bar-1" style={{maxHeight: "100%"}} />
                          <div className="flex-1 bg-red-400/50 rounded-t animate-bar-2" style={{maxHeight: "100%"}} />
                          <div className="flex-1 bg-red-400/70 rounded-t animate-bar-3" style={{maxHeight: "100%"}} />
                          <div className="flex-1 bg-emerald-500/80 rounded-t animate-bar-1" style={{maxHeight: "100%"}} />
                        </div>
                        <div className="flex justify-between mt-2 text-[8px] text-gray-500 px-1">
                          <span>Set</span><span>Out</span><span>Nov</span><span>Dez</span><span>Jan</span><span>Fev</span><span>Mar</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Floating notification */}
                <div className="absolute -right-4 top-32 bg-white rounded-xl shadow-xl shadow-gray-900/10 p-3 w-48 border border-gray-100 animate-fade-in-up-delay">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center">
                      <span className="text-emerald-600 text-xs">&#x2713;</span>
                    </div>
                    <span className="text-[10px] font-bold text-gray-900">SMS importado</span>
                  </div>
                  <p className="text-[9px] text-gray-400">Shoprite -4.500 MZN detectado e categorizado automaticamente</p>
                </div>
                {/* Floating category badge */}
                <div className="absolute -left-6 bottom-40 bg-white rounded-lg shadow-lg shadow-gray-900/5 px-3 py-2 border border-gray-100 animate-fade-in-up-delay-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">&#x1F6D2;</span>
                    <div>
                      <p className="text-[10px] font-bold text-gray-900">Alimenta&ccedil;&atilde;o</p>
                      <p className="text-[9px] text-gray-400">32% dos gastos</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social proof strip */}
      <section className="bg-white border-y border-gray-100 py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-3xl font-black text-emerald-500">80+</p>
              <p className="text-sm text-gray-500 mt-1">regras de categoriza&ccedil;&atilde;o</p>
            </div>
            <div>
              <p className="text-3xl font-black text-gray-900">10</p>
              <p className="text-sm text-gray-500 mt-1">funcionalidades integradas</p>
            </div>
            <div>
              <p className="text-3xl font-black text-gray-900">2 min</p>
              <p className="text-sm text-gray-500 mt-1">para come&ccedil;ar</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900">
              Como funciona
            </h2>
            <p className="mt-3 text-lg text-gray-500">Tr&ecirc;s formas de registar. Tu escolhes.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                icon: "\uD83D\uDCF1",
                title: "Cola o SMS",
                desc: "Recebeste notifica\u00E7\u00E3o do banco? Cola aqui. O BUDGY l\u00EA o valor, data e categoriza sozinho.",
                color: "from-emerald-500 to-teal-500",
              },
              {
                step: "02",
                icon: "\uD83D\uDCC4",
                title: "Importa o extrato",
                desc: "Carrega o CSV ou Excel do teu banco. Meses inteiros importados em segundos.",
                color: "from-blue-500 to-indigo-500",
              },
              {
                step: "03",
                icon: "\u270D\uFE0F",
                title: "Regista na hora",
                desc: "Pagaste em dinheiro? Bot\u00E3o +, valor, categoria. 10 segundos.",
                color: "from-purple-500 to-pink-500",
              },
            ].map((item) => (
              <div key={item.step} className="group relative bg-white rounded-3xl border border-gray-100 p-6 hover:shadow-xl hover:shadow-gray-900/5 transition-all duration-300 hover:-translate-y-1">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center text-2xl mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                  {item.icon}
                </div>
                <div className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2">Passo {item.step}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem → Solution */}
      <section className="bg-white py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900">
              Porque &eacute; que as outras apps n&atilde;o funcionam
            </h2>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            {[
              { bad: "Escrever cada gasto \u00E0 m\u00E3o", good: "Cola o SMS e est\u00E1 feito" },
              { bad: "100 categorias confusas", good: "Categorias simples e autom\u00E1ticas" },
              { bad: "S\u00F3 funciona em d\u00F3lar ou real", good: "Pensado em meticais" },
              { bad: "Apps que n\u00E3o sabem o que \u00E9 xitique", good: "Xitique digital integrado" },
              { bad: "Sem suporte para bancos locais", good: "L\u00EA extratos dos teus bancos" },
            ].map((item) => (
              <div key={item.bad} className="flex items-center gap-4 bg-gray-50 rounded-2xl p-4 hover:bg-gray-100 transition-colors">
                <div className="flex-1 text-right">
                  <span className="text-sm text-gray-400 line-through">{item.bad}</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/25">
                  <span className="text-white font-bold text-sm">&rarr;</span>
                </div>
                <div className="flex-1">
                  <span className="text-sm font-semibold text-gray-900">{item.good}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section id="funcionalidades" className="py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900">Tudo num s&oacute; lugar</h2>
            <p className="mt-3 text-lg text-gray-500">Sem saltar entre apps. Sem perder dados.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { emoji: "\uD83C\uDFE6", title: "V\u00E1rias contas", desc: "Bancos, carteiras m\u00F3veis, dinheiro", color: "bg-blue-50" },
              { emoji: "\uD83D\uDCE9", title: "Importa SMS", desc: "L\u00EA mensagens do banco automaticamente", color: "bg-green-50" },
              { emoji: "\uD83D\uDCC1", title: "Importa extratos", desc: "CSV e Excel de qualquer banco", color: "bg-amber-50" },
              { emoji: "\uD83D\uDCCA", title: "Or\u00E7amentos", desc: "Limites por categoria com alertas", color: "bg-purple-50" },
              { emoji: "\uD83C\uDFAF", title: "Metas de poupan\u00E7a", desc: "V\u00EA o progresso para cada objectivo", color: "bg-pink-50" },
              { emoji: "\uD83D\uDC65", title: "Xitique digital", desc: "Grupos, turnos e transpar\u00EAncia total", color: "bg-orange-50" },
              { emoji: "\uD83D\uDCB3", title: "Controlo de d\u00EDvidas", desc: "Quem deve, a quem, com prazos", color: "bg-red-50" },
              { emoji: "\uD83D\uDCC8", title: "Relat\u00F3rios visuais", desc: "Gr\u00E1ficos de gastos por categoria e m\u00EAs", color: "bg-indigo-50" },
              { emoji: "\uD83C\uDF93", title: "Educa\u00E7\u00E3o financeira", desc: "Dicas e conte\u00FAdo para decidires melhor", color: "bg-cyan-50" },
              { emoji: "\uD83D\uDD14", title: "Alertas inteligentes", desc: "Avisa quando te aproximas do limite", color: "bg-yellow-50" },
              { emoji: "\uD83D\uDCF1", title: "Funciona no telem\u00F3vel", desc: "Abre no browser, sem instalar nada", color: "bg-teal-50" },
              { emoji: "\uD83D\uDD04", title: "Migra de outra app", desc: "Importa todo o teu hist\u00F3rico sem perder dados", color: "bg-rose-50" },
            ].map((f) => (
              <div key={f.title} className={`${f.color} rounded-2xl p-5 border border-white hover:shadow-lg hover:shadow-gray-900/5 transition-all duration-300 hover:-translate-y-0.5`}>
                <div className="text-3xl mb-3">{f.emoji}</div>
                <h3 className="font-bold text-gray-900 text-sm">{f.title}</h3>
                <p className="text-xs text-gray-500 mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quote */}
      <section className="bg-white py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-10 sm:p-14 shadow-glow-emerald">
            <img src="/Budgy-favicon.jpeg" alt="BUDGY" className="w-14 h-14 rounded-2xl shadow-lg mx-auto mb-6 animate-bounce-slow" />
            <blockquote className="text-xl sm:text-2xl text-gray-700 font-semibold leading-relaxed italic">
              &ldquo;A minha app deve saber ler as mensagens que os bancos me mandam
              e registar sozinha. Pedir apenas que eu valide.&rdquo;
            </blockquote>
            <p className="mt-6 text-sm text-gray-500 font-medium">
              &mdash; O pedido que inspirou o BUDGY
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-28">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 rounded-3xl p-10 sm:p-16 text-center text-white overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/3 -translate-x-1/3" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full" />

            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl font-black">
                O pr&oacute;ximo sal&aacute;rio pode ser diferente.
              </h2>
              <p className="mt-4 text-lg text-white/80 max-w-md mx-auto">
                Come&ccedil;a a controlar o teu dinheiro hoje.
              </p>
              <Link
                href="/login"
                className="mt-8 inline-flex items-center gap-2 bg-white text-emerald-600 font-bold text-lg px-10 py-4 rounded-2xl shadow-2xl hover:shadow-3xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Criar conta &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <img src="/Budgy-favicon.jpeg" alt="BUDGY" className="w-7 h-7 rounded-lg" />
            <span className="font-bold text-white">BUDGY</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link href="/terms" className="hover:text-gray-300 transition-colors">Termos</Link>
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacidade</Link>
          </div>
          <p className="text-xs text-gray-600">&copy; 2026 BUDGY</p>
        </div>
      </footer>
    </div>
  );
}
