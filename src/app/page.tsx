import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BUDGY - Sabe para onde vai cada metical",
  description:
    "O teu dinheiro organizado sem esforço. Importa SMS do banco, controla gastos, poupa para os teus sonhos e gere o xitique — tudo grátis.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-gray-900/90 backdrop-blur-lg border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
          <span className="text-xl font-bold text-white">
            <span className="text-emerald-400">B</span>UDGY
          </span>
          <Link
            href="/login"
            className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
          >
            Entrar
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gray-900 px-4 pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-block bg-emerald-500/10 text-emerald-400 text-sm font-medium px-4 py-1.5 rounded-full mb-6 border border-emerald-500/20">
            100% gr&aacute;tis &middot; Funciona no telem&oacute;vel
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight">
            O teu sal&aacute;rio chega.<br />
            <span className="text-emerald-400">Para onde vai?</span>
          </h1>
          <p className="mt-6 text-lg text-gray-400 max-w-xl mx-auto leading-relaxed">
            Entre as contas, as compras e as transfer&ecirc;ncias
            &mdash; o dinheiro desaparece. O BUDGY mostra-te exactamente para onde,
            sem teres de escrever nada &agrave; m&atilde;o.
          </p>
          <div className="mt-8">
            <Link
              href="/login"
              className="inline-flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-lg px-8 py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20"
            >
              Come&ccedil;ar agora &rarr;
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            Sem cart&atilde;o. Sem instala&ccedil;&atilde;o. Abre e usa.
          </p>
        </div>
      </section>

      {/* The real frustration */}
      <section className="bg-gray-50 px-4 py-16 sm:py-24">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
            Conheces esta sensa&ccedil;&atilde;o?
          </h2>
          <p className="text-gray-500 mb-10">
            Recebes o sal&aacute;rio e em duas semanas j&aacute; n&atilde;o sabes onde est&aacute;.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
            {[
              "Pagas aqui, ali, acol\u00E1\u2026 e no fim do m\u00EAs perde-se a conta",
              "Transferes entre contas e j\u00E1 n\u00E3o sabes o saldo total",
              "O xitique fica desorganizado e ningu\u00E9m sabe de quem \u00E9 a vez",
              "Queres poupar para algo mas o dinheiro nunca sobra",
              "J\u00E1 tentaste apps mas s\u00E3o todas em ingl\u00EAs ou pedem para escrever tudo \u00E0 m\u00E3o",
              "Pagas subscri\u00E7\u00E3o mensal de uma app que nem usas bem",
            ].map((text) => (
              <div key={text} className="flex items-start gap-3 bg-white rounded-xl p-4 border border-gray-100">
                <span className="text-red-400 mt-0.5">&#x2717;</span>
                <span className="text-sm text-gray-600 leading-relaxed">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The BUDGY way */}
      <section className="px-4 py-16 sm:py-24">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-4">
            Com o BUDGY &eacute; diferente.
          </h2>
          <p className="text-center text-gray-500 max-w-xl mx-auto mb-12">
            Tr&ecirc;s formas de registar &mdash; tu escolhes a mais f&aacute;cil.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-emerald-100 shadow-sm">
              <div className="text-3xl mb-3">&#x1F4F1;</div>
              <h3 className="font-bold text-gray-900 mb-2">Cola o SMS do banco</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Recebeste uma notifica&ccedil;&atilde;o do banco ou carteira m&oacute;vel?
                Cola aqui. O BUDGY l&ecirc; o valor, a data e organiza por categoria.
                Tu s&oacute; confirmas.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-emerald-100 shadow-sm">
              <div className="text-3xl mb-3">&#x1F4C4;</div>
              <h3 className="font-bold text-gray-900 mb-2">Importa o extrato</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Descarrega o extrato do teu banco &mdash; CSV ou Excel.
                O BUDGY l&ecirc; tudo de uma vez. Meses inteiros em segundos.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-emerald-100 shadow-sm">
              <div className="text-3xl mb-3">&#x270D;&#xFE0F;</div>
              <h3 className="font-bold text-gray-900 mb-2">Ou regista na hora</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Pagaste em dinheiro? Bot&atilde;o +, valor, categoria.
                Menos de 10 segundos.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="bg-gray-50 px-4 py-16 sm:py-24">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-12">
            Tudo o que precisas. Num s&oacute; lugar.
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { emoji: "\uD83D\uDCB0", title: "V\u00E1rias contas", desc: "Bancos, carteiras m\u00F3veis, dinheiro" },
              { emoji: "\uD83D\uDCE9", title: "Importa SMS", desc: "Qualquer banco" },
              { emoji: "\uD83D\uDCC1", title: "Importa extratos", desc: "CSV e Excel" },
              { emoji: "\uD83D\uDCCA", title: "Or\u00E7amentos", desc: "Limites por categoria" },
              { emoji: "\uD83C\uDFAF", title: "Metas", desc: "Poupa com objectivo" },
              { emoji: "\uD83D\uDC65", title: "Xitique", desc: "Poupan\u00E7a rotativa digital" },
              { emoji: "\uD83D\uDCB3", title: "D\u00EDvidas", desc: "Quem deve a quem" },
              { emoji: "\uD83D\uDCC8", title: "Relat\u00F3rios", desc: "Gr\u00E1ficos simples" },
              { emoji: "\uD83C\uDD93", title: "Gr\u00E1tis", desc: "Sem subscri\u00E7\u00F5es. Sempre." },
            ].map((f) => (
              <div key={f.title} className="bg-white rounded-xl p-4 border border-gray-100">
                <div className="text-2xl mb-2">{f.emoji}</div>
                <h3 className="font-semibold text-gray-900 text-sm">{f.title}</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quote */}
      <section className="px-4 py-16 sm:py-24">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-emerald-50 rounded-3xl p-8 sm:p-12">
            <div className="text-4xl mb-4">&#x1F49A;</div>
            <blockquote className="text-lg sm:text-xl text-gray-700 font-medium leading-relaxed italic">
              &ldquo;A minha app deve saber ler as mensagens que os bancos me mandam
              e registar sozinha. Pedir apenas que eu valide.&rdquo;
            </blockquote>
            <p className="mt-4 text-sm text-gray-500">
              &mdash; O pedido que inspirou o BUDGY
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-20 sm:pb-28">
        <div className="max-w-3xl mx-auto">
          <div className="bg-emerald-500 rounded-3xl p-8 sm:p-14 text-center text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
            <div className="relative z-10">
              <h2 className="text-2xl sm:text-3xl font-bold">
                O pr&oacute;ximo sal&aacute;rio pode ser diferente.
              </h2>
              <p className="mt-3 text-white/80">
                Come&ccedil;a hoje. V&ecirc; para onde vai cada metical.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center gap-2 bg-white text-emerald-600 font-semibold px-8 py-3.5 rounded-2xl shadow-lg hover:shadow-xl transition-all"
              >
                Criar conta gr&aacute;tis &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 px-4 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm font-bold text-gray-500">
            <span className="text-emerald-500">B</span>UDGY
          </span>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <Link href="/terms" className="hover:text-gray-300 transition-colors">Termos</Link>
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacidade</Link>
          </div>
          <p className="text-xs text-gray-600">&copy; 2026 BUDGY</p>
        </div>
      </footer>
    </div>
  );
}
