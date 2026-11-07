import { Link } from 'react-router'
import { LogoMark } from '../../components/brand/Logo'
import { contactEmail, contactWhatsapp } from '../../config/env'
import { usePageTitle } from '../../lib/usePageTitle'

/**
 * Página inicial pública (quem ainda não tem sessão).
 * Sem números nem testemunhos inventados: só o que a app faz de verdade.
 * Os contactos vêm das variáveis VITE_CONTACT_*; sem elas, os botões não aparecem.
 */

const WHATSAPP_TEXT = 'Olá! Tenho uma oficina e gostava de saber mais sobre o RevyAuto.'

function contactHref(): { href: string; label: string } | null {
  if (contactWhatsapp) {
    return {
      href: `https://wa.me/${contactWhatsapp}?text=${encodeURIComponent(WHATSAPP_TEXT)}`,
      label: 'Falar connosco no WhatsApp',
    }
  }
  if (contactEmail) {
    return {
      href: `mailto:${contactEmail}?subject=${encodeURIComponent('RevyAuto para a minha oficina')}`,
      label: 'Pedir informações por email',
    }
  }
  return null
}

/** Matrícula portuguesa (faixa azul à esquerda, amarela à direita) */
function Plate({ value }: { value: string }) {
  return (
    <span className="inline-flex h-7 items-stretch overflow-hidden rounded-[4px] border border-slate-400 bg-white text-[13px] leading-none font-bold tracking-wider text-slate-900 shadow-sm">
      <span className="flex w-4 flex-col items-center justify-end bg-[#1f4fb5] pb-0.5 text-[8px] font-bold text-white">
        P
      </span>
      <span className="flex items-center px-2 font-mono">{value}</span>
      <span className="w-2 bg-[#f6c400]" />
    </span>
  )
}

function Hero({ contact }: { contact: ReturnType<typeof contactHref> }) {
  return (
    <section className="bg-graphite text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" aria-label="RevyAuto, página inicial">
          <LogoMark size={34} background="#2A3240" />
          <span className="font-display text-xl font-extrabold tracking-tight">
            Revy<span className="text-brand-500">Auto</span>
          </span>
        </Link>
        <Link
          to="/entrar"
          className="rounded-lg border border-white/25 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          Entrar
        </Link>
      </header>

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-8 pb-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-14 lg:pb-28">
        <div>
          <h1 className="font-display text-5xl leading-[1.02] font-extrabold tracking-tight text-balance sm:text-6xl lg:text-7xl">
            Clientes que voltam.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
            Tenha os clientes, as viaturas e o histórico de cada serviço organizados num só sítio. Saiba quando é altura
            de voltar a contactar cada cliente.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
            {contact ? (
              <a
                href={contact.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-brand-600 px-6 py-3.5 text-base font-semibold text-ink shadow-sm hover:bg-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {contact.label}
              </a>
            ) : (
              <Link
                to="/entrar"
                className="rounded-lg bg-brand-600 px-6 py-3.5 text-base font-semibold text-ink shadow-sm hover:bg-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Entrar na minha conta
              </Link>
            )}
            <p className="text-sm text-slate-400">Grátis para as primeiras oficinas. Ajudamos na instalação.</p>
          </div>
        </div>

        <ReminderPreview />
      </div>
    </section>
  )
}

/** O momento que define o produto: o aviso e a mensagem pronta. */
function ReminderPreview() {
  return (
    <div
      className="relative mx-auto w-full max-w-md"
      aria-label="Exemplo da ficha de uma viatura no RevyAuto, com o histórico e o lembrete da próxima revisão"
      role="img"
    >
      <div className="rounded-2xl bg-white p-5 text-slate-900 shadow-2xl shadow-black/30">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Plate value="AA-00-BB" />
            <p className="mt-2.5 font-semibold">Renault Clio</p>
            <p className="text-sm text-slate-500">Maria Santos</p>
          </div>
          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800">Falta 1 mês</span>
        </div>
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold text-slate-500">Histórico</p>
          <ul className="mt-1.5 space-y-1 text-sm">
            <li className="flex justify-between gap-3">
              <span className="text-slate-800">Revisão, filtros e óleo</span>
              <span className="shrink-0 text-slate-500">12/2025 · 85 000 km</span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-slate-800">Pastilhas da frente</span>
              <span className="shrink-0 text-slate-500">05/2025 · 79 300 km</span>
            </li>
          </ul>
          <p className="mt-3 text-sm text-slate-600">
            Próxima revisão combinada para <span className="font-semibold text-slate-900">1 de dezembro</span>
          </p>
        </div>

        <div className="mt-4 rounded-xl rounded-tl-sm bg-[#e7f8dc] px-4 py-3 text-[15px] leading-snug text-slate-800">
          Olá Maria, daqui a cerca de um mês (01/12) está prevista a revisão do seu Renault Clio (AA-00-BB). Quer que
          lhe marquemos já uma data?
          <span className="mt-1.5 block text-right text-xs text-slate-500">Auto Silva</span>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-emerald-700 py-2.5 text-sm font-semibold text-white">
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="currentColor">
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.2 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.1.1.7-.1 1.2Z" />
          </svg>
          Enviar notificação
        </div>
      </div>
    </div>
  )
}

/** A linha do tempo de uma revisão: é exatamente assim que a app pensa. */
function Timeline() {
  const steps = [
    {
      when: 'Na revisão',
      title: 'Fica tudo registado',
      text: 'Registe os quilómetros, o trabalho feito, as peças utilizadas e o que ficou recomendado para a próxima visita.',
    },
    {
      when: 'Falta 1 mês',
      title: 'Comece a preparar',
      text: 'O RevyAuto avisa a oficina para poder contactar o cliente com antecedência.',
    },
    {
      when: 'Falta 1 semana',
      title: 'Está quase na altura',
      text: 'Receba um novo aviso e envie uma mensagem pelo WhatsApp com os dados da viatura.',
    },
    {
      when: 'Passou a data',
      title: 'Não deixe esquecer',
      text: 'A revisão fica assinalada como atrasada para poder voltar a contactar o cliente.',
    },
  ]
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <h2 className="max-w-2xl font-display text-3xl leading-tight font-extrabold tracking-tight text-balance text-slate-900 sm:text-4xl">
          Cada revisão tem o seu momento. Não deixe passar nenhum.
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">
          Registe o serviço, combine a próxima revisão e saiba quando deve contactar cada cliente.
        </p>

        <ol className="mt-14 grid gap-10 md:grid-cols-4 md:gap-6">
          {steps.map((step, index) => (
            <li key={step.title} className="relative pl-8 md:pt-10 md:pl-0">
              {/* linha: vertical no telemóvel, horizontal no computador */}
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute top-5 bottom-[-2.5rem] left-[7px] w-0.5 bg-slate-200 md:top-[7px] md:right-[-1.5rem] md:bottom-auto md:left-4 md:h-0.5 md:w-auto"
                />
              )}
              <span
                aria-hidden="true"
                className={
                  index === steps.length - 1
                    ? 'absolute top-1 left-0 size-4 rounded-full border-[3px] border-slate-400 bg-white md:top-0'
                    : 'absolute top-1 left-0 size-4 rounded-full border-[3px] border-brand-600 bg-white md:top-0'
                }
              />
              <p className="text-sm font-semibold text-brand-700">{step.when}</p>
              <p className="mt-1 font-display text-lg font-bold text-slate-900">{step.title}</p>
              <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    {
      title: 'Importe os seus clientes',
      text: 'Exporte os clientes e as viaturas do programa que já utiliza. Carregue o ficheiro no RevyAuto e confirme os dados antes de importar.',
    },
    {
      title: 'Registe cada serviço',
      text: 'Guarde os quilómetros, o trabalho feito, as peças utilizadas e as recomendações. Consulte o histórico de cada viatura sempre que precisar.',
    },
    {
      title: 'Envie lembretes',
      text: 'Combine a próxima revisão e receba avisos na altura certa. Prepare a mensagem e abra o WhatsApp para a enviar ao cliente.',
    },
  ]
  return (
    <section className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-balance text-slate-900 sm:text-4xl">
          Tudo organizado, sem complicar o trabalho.
        </h2>
        <ol className="mt-12 grid gap-10 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title}>
              <span className="font-display text-5xl font-extrabold text-brand-600">{index + 1}</span>
              <p className="mt-3 font-display text-xl font-bold text-slate-900">{step.title}</p>
              <p className="mt-2 leading-relaxed text-slate-600">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function ForWhom() {
  return (
    <section className="bg-white">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-24">
        <div>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-balance text-slate-900 sm:text-4xl">
            Feito para o dia&nbsp;a&nbsp;dia da sua oficina.
          </h2>
          <ul className="mt-8 space-y-4 text-lg text-slate-700">
            <li className="flex gap-3">
              <Check />
              Para quem quer deixar de procurar informações em papéis, cadernos e ficheiros espalhados.
            </li>
            <li className="flex gap-3">
              <Check />
              Para quem precisa de consultar rapidamente o histórico de cada viatura e saber o que foi feito.
            </li>
            <li className="flex gap-3">
              <Check />
              Para quem quer acompanhar as próximas revisões e manter o contacto com os clientes.
            </li>
          </ul>
        </div>
        <div className="rounded-2xl bg-slate-50 p-8 lg:mt-2">
          <h3 className="font-display text-xl font-bold text-slate-900">Não substitui o programa que já utiliza.</h3>
          <p className="mt-3 leading-relaxed text-slate-600">
            O RevyAuto não faz faturação, gestão de stock, preços ou ordens de reparação.
          </p>
          <p className="mt-3 leading-relaxed text-slate-600">
            As mensagens não são enviadas automaticamente. É sempre a oficina que decide quando e a quem enviar.
          </p>
        </div>
      </div>
    </section>
  )
}

function Check() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="mt-1 size-5 shrink-0 text-brand-600"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="m4 10.5 4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Trust() {
  const items = [
    {
      title: 'Dados separados por oficina',
      text: 'Cada oficina só pode consultar os seus próprios dados. A separação é garantida pela base de dados.',
    },
    {
      title: 'Acesso protegido',
      text: 'Verificação em dois passos e fim de sessão automático para proteger os dados em computadores partilhados.',
    },
    {
      title: 'Controlo dos seus dados',
      text: 'Consulte o registo de eliminações e exporte ou apague os dados de um cliente quando ele pedir.',
    },
  ]
  return (
    <section className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <dl className="grid gap-8 md:grid-cols-3">
          {items.map((item) => (
            <div key={item.title} className="border-l-2 border-brand-600 pl-5">
              <dt className="font-display font-bold text-slate-900">{item.title}</dt>
              <dd className="mt-1.5 leading-relaxed text-slate-600">{item.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

function FinalCall({ contact }: { contact: ReturnType<typeof contactHref> }) {
  return (
    <section className="bg-graphite text-white">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-4 py-20 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
            Comece a organizar a sua oficina.
          </h2>
          <p className="mt-3 text-lg text-slate-300">
            Estamos a preparar o RevyAuto para as primeiras oficinas. A adesão é gratuita nesta fase e ajudamos a
            importar os seus clientes e a começar.
          </p>
        </div>
        {contact ? (
          <a
            href={contact.href}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg bg-brand-600 px-6 py-3.5 text-base font-semibold text-ink hover:bg-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {contact.label}
          </a>
        ) : (
          <Link
            to="/entrar"
            className="shrink-0 rounded-lg border border-white/25 px-6 py-3.5 text-base font-semibold text-white hover:bg-white/10"
          >
            Já tenho conta: entrar
          </Link>
        )}
      </div>
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-slate-400 sm:px-6">
          <span className="flex items-center gap-2">
            <LogoMark size={22} background="#2A3240" />
            RevyAuto, clientes que voltam.
          </span>
          <span className="flex gap-5">
            {contactEmail && (
              <a href={`mailto:${contactEmail}`} className="hover:text-white">
                {contactEmail}
              </a>
            )}
            <Link to="/entrar" className="hover:text-white">
              Entrar
            </Link>
          </span>
        </div>
      </footer>
    </section>
  )
}

export function LandingPage() {
  usePageTitle('Clientes que voltam')
  const contact = contactHref()
  return (
    <main className="min-h-dvh bg-white">
      <Hero contact={contact} />
      <Timeline />
      <HowItWorks />
      <ForWhom />
      <Trust />
      <FinalCall contact={contact} />
    </main>
  )
}
