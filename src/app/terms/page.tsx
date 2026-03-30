import Link from "next/link";

export const metadata = {
  title: "Termos de Servico",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4 dark:bg-gray-950">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/login"
          className="mb-8 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
          Voltar ao login
        </Link>

        <h1 className="mb-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Termos de Servico
        </h1>
        <p className="mb-8 text-sm text-gray-500 dark:text-gray-400">
          Ultima actualizacao: 27 de Fevereiro de 2026
        </p>

        <div className="space-y-8 text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100">
              1. Aceitacao dos Termos
            </h2>
            <p className="leading-relaxed">
              Ao aceder e utilizar qualquer aplicacao do ecossistema VIDA,
              incluindo VIDA.FAMILIA, VIDA.DINHEIRO, VIDA.LAR e VIDA.SAUDE,
              concorda em ficar vinculado a estes Termos de Servico. Se nao
              concordar com qualquer parte destes termos, nao devera utilizar os
              nossos servicos. Estes termos aplicam-se a todos os utilizadores da
              plataforma em Mocambique e noutras regioes onde os servicos estejam
              disponiveis.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100">
              2. Descricao do Servico
            </h2>
            <p className="leading-relaxed">
              O ecossistema VIDA e uma plataforma digital composta por quatro
              aplicacoes integradas, concebidas para melhorar a qualidade de vida
              dos seus utilizadores:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                <strong>VIDA.FAMILIA</strong> — Gestao familiar e comunicacao
                entre membros da familia.
              </li>
              <li>
                <strong>VIDA.DINHEIRO</strong> — Gestao de financas pessoais e
                familiares.
              </li>
              <li>
                <strong>VIDA.LAR</strong> — Gestao do lar e organizacao
                domestica.
              </li>
              <li>
                <strong>VIDA.SAUDE</strong> — Acompanhamento de saude e
                bem-estar familiar.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100">
              3. Conta do Utilizador
            </h2>
            <p className="leading-relaxed">
              Para utilizar os servicos VIDA, deve criar uma conta fornecendo
              informacoes precisas e actualizadas. E responsavel por manter a
              confidencialidade das suas credenciais de acesso e por todas as
              actividades realizadas na sua conta. Deve notificar-nos
              imediatamente sobre qualquer uso nao autorizado da sua conta.
              Reservamo-nos o direito de suspender ou encerrar contas que violem
              estes termos.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100">
              4. Uso Aceitavel
            </h2>
            <p className="mb-3 leading-relaxed">
              Ao utilizar os servicos VIDA, compromete-se a:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                Nao utilizar os servicos para fins ilegais ou nao autorizados.
              </li>
              <li>
                Nao transmitir conteudo ofensivo, difamatorio ou que viole
                direitos de terceiros.
              </li>
              <li>
                Nao tentar aceder a sistemas ou dados sem autorizacao.
              </li>
              <li>
                Nao interferir com o funcionamento normal da plataforma.
              </li>
              <li>
                Respeitar os direitos e a privacidade dos outros utilizadores.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100">
              5. Propriedade Intelectual
            </h2>
            <p className="leading-relaxed">
              Todo o conteudo, design, logotipos, marcas e software do
              ecossistema VIDA sao propriedade exclusiva da VIDA e estao
              protegidos pelas leis de propriedade intelectual aplicaveis em
              Mocambique e internacionalmente. Nao e permitido copiar,
              modificar, distribuir ou utilizar qualquer elemento da plataforma
              sem autorizacao previa por escrito.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100">
              6. Limitacao de Responsabilidade
            </h2>
            <p className="leading-relaxed">
              Os servicos VIDA sao fornecidos &ldquo;tal como estao&rdquo; e
              &ldquo;conforme disponiveis&rdquo;. Nao garantimos que os servicos
              serao ininterruptos, seguros ou livres de erros. Na medida maxima
              permitida pela legislacao mocambicana, a VIDA nao sera responsavel
              por quaisquer danos directos, indirectos, incidentais ou
              consequenciais resultantes do uso ou incapacidade de uso dos
              servicos.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100">
              7. Alteracoes aos Termos
            </h2>
            <p className="leading-relaxed">
              Reservamo-nos o direito de modificar estes Termos de Servico a
              qualquer momento. As alteracoes serao publicadas nesta pagina com a
              data de actualizacao revista. O uso continuado dos servicos apos
              quaisquer alteracoes constitui a sua aceitacao dos novos termos.
              Recomendamos que reveja periodicamente estes termos.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100">
              8. Contacto
            </h2>
            <p className="leading-relaxed">
              Para questoes relacionadas com estes Termos de Servico, entre em
              contacto connosco atraves do email{" "}
              <a
                href="mailto:suporte@vida.co.mz"
                className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                suporte@vida.co.mz
              </a>
              . Estes termos sao regidos pelas leis da Republica de Mocambique.
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-gray-200 pt-6 text-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
          <p>VIDA — Ecossistema digital para a vida moderna em Mocambique</p>
        </div>
      </div>
    </main>
  );
}
