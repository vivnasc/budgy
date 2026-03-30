import Link from "next/link";

export const metadata = {
  title: "Politica de Privacidade",
};

export default function PrivacyPage() {
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
          Politica de Privacidade
        </h1>
        <p className="mb-8 text-sm text-gray-500 dark:text-gray-400">
          Ultima actualizacao: 27 de Fevereiro de 2026
        </p>

        <div className="space-y-8 text-gray-700 dark:text-gray-300">
          <section>
            <p className="leading-relaxed">
              A VIDA compromete-se a proteger a privacidade dos seus
              utilizadores. Esta Politica de Privacidade explica como recolhemos,
              usamos e protegemos as suas informacoes pessoais quando utiliza
              qualquer aplicacao do ecossistema VIDA — incluindo VIDA.FAMILIA,
              VIDA.DINHEIRO, VIDA.LAR e VIDA.SAUDE — em conformidade com as
              melhores praticas de proteccao de dados e a legislacao aplicavel,
              incluindo principios da LGPD (Lei Geral de Proteccao de Dados).
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100">
              1. Informacao que Recolhemos
            </h2>
            <p className="mb-3 leading-relaxed">
              Recolhemos os seguintes tipos de informacao:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Dados de registo:</strong> nome completo, endereco de
                email, numero de telefone e palavra-passe.
              </li>
              <li>
                <strong>Dados de perfil:</strong> fotografia, preferencias e
                configuracoes da conta.
              </li>
              <li>
                <strong>Dados de utilizacao:</strong> informacoes sobre como
                interage com as nossas aplicacoes, incluindo paginas visitadas,
                funcionalidades utilizadas e tempo de sessao.
              </li>
              <li>
                <strong>Dados do dispositivo:</strong> tipo de dispositivo,
                sistema operativo, identificadores unicos e endereco IP.
              </li>
              <li>
                <strong>Dados especificos da aplicacao:</strong> informacoes
                financeiras (VIDA.DINHEIRO), dados de saude (VIDA.SAUDE), dados
                familiares (VIDA.FAMILIA) e dados domesticos (VIDA.LAR),
                conforme as funcionalidades que utilizar.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100">
              2. Como Usamos a Informacao
            </h2>
            <p className="mb-3 leading-relaxed">
              Utilizamos as suas informacoes para:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Fornecer, manter e melhorar os nossos servicos.</li>
              <li>
                Personalizar a sua experiencia nas aplicacoes VIDA.
              </li>
              <li>
                Processar transaccoes e gerir a sua conta.
              </li>
              <li>
                Enviar notificacoes relevantes sobre os servicos.
              </li>
              <li>
                Garantir a seguranca e prevenir fraudes.
              </li>
              <li>
                Cumprir obrigacoes legais e regulatorias.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100">
              3. Partilha de Dados
            </h2>
            <p className="leading-relaxed">
              Nao vendemos as suas informacoes pessoais. Podemos partilhar dados
              com terceiros apenas nas seguintes circunstancias: com
              fornecedores de servicos que nos ajudam a operar a plataforma (como
              o Supabase para armazenamento e autenticacao de dados), quando
              exigido por lei ou ordem judicial, para proteger os direitos e a
              seguranca dos nossos utilizadores, ou com o seu consentimento
              explicito. Todos os parceiros e fornecedores estao vinculados a
              acordos de confidencialidade.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100">
              4. Seguranca
            </h2>
            <p className="leading-relaxed">
              Implementamos medidas de seguranca tecnicas e organizacionais para
              proteger as suas informacoes, incluindo encriptacao de dados em
              transito e em repouso, autenticacao segura atraves do Supabase,
              controlos de acesso rigorosos e monitorizacao continua de
              seguranca. Os seus dados sao armazenados em servidores seguros
              fornecidos pelo Supabase, com protocolos de seguranca de nivel
              empresarial. Apesar dos nossos esforcos, nenhum metodo de
              transmissao ou armazenamento electronico e 100% seguro.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100">
              5. Cookies
            </h2>
            <p className="leading-relaxed">
              Utilizamos cookies e tecnologias similares para manter a sua sessao
              activa, lembrar as suas preferencias, analisar o uso da plataforma
              e melhorar a experiencia do utilizador. Os cookies essenciais sao
              necessarios para o funcionamento dos servicos. Pode gerir as suas
              preferencias de cookies atraves das configuracoes do seu navegador,
              embora desactivar certos cookies possa afectar a funcionalidade da
              plataforma.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100">
              6. Direitos do Utilizador
            </h2>
            <p className="mb-3 leading-relaxed">
              Em conformidade com os principios de proteccao de dados e a LGPD,
              tem os seguintes direitos:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Acesso:</strong> solicitar uma copia dos seus dados
                pessoais.
              </li>
              <li>
                <strong>Rectificacao:</strong> corrigir dados incorrectos ou
                incompletos.
              </li>
              <li>
                <strong>Eliminacao:</strong> solicitar a remocao dos seus dados
                pessoais.
              </li>
              <li>
                <strong>Portabilidade:</strong> receber os seus dados num formato
                estruturado e legivel por maquina.
              </li>
              <li>
                <strong>Oposicao:</strong> opor-se ao tratamento dos seus dados
                em determinadas circunstancias.
              </li>
              <li>
                <strong>Revogacao do consentimento:</strong> retirar o
                consentimento a qualquer momento.
              </li>
            </ul>
            <p className="mt-3 leading-relaxed">
              Para exercer qualquer um destes direitos, entre em contacto
              connosco atraves do email indicado abaixo.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100">
              7. Contacto
            </h2>
            <p className="leading-relaxed">
              Para questoes relacionadas com a sua privacidade ou para exercer os
              seus direitos, entre em contacto connosco atraves do email{" "}
              <a
                href="mailto:privacidade@vida.co.mz"
                className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                privacidade@vida.co.mz
              </a>
              . Esta politica e regida pelas leis da Republica de Mocambique.
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
