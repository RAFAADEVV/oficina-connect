# Oficina Connect

Plataforma web de acompanhamento de clientes para oficinas automóveis: importar clientes e veículos, identificar quem deve voltar à oficina, preparar mensagens de WhatsApp e acompanhar resultados.

> **Estado atual:** fundação do projeto (estrutura, navegação e páginas iniciais). Ainda não tem autenticação, base de dados nem importação.

---

## Tecnologias

| Área | Tecnologia |
|---|---|
| Interface | React 19 + TypeScript |
| Ferramenta de build | Vite 8 |
| Estilos | Tailwind CSS v4 (plugin `@tailwindcss/vite`) |
| Navegação | React Router 7 |
| Base de dados e autenticação *(próximas fases)* | Supabase (PostgreSQL, Auth, Row Level Security) |
| Publicação *(próximas fases)* | Cloudflare Pages |

---

## Requisitos

- **Node.js 22.12 ou superior** (ou 20.19+ na linha 20; recomendado: versão LTS mais recente) — https://nodejs.org
- **npm** (instalado com o Node.js)
- **Git** — https://git-scm.com

Para confirmar, abra o terminal e execute:

```bash
node -v
npm -v
```

---

## Instalação

```bash
# 1. Entrar na pasta do projeto
cd oficina-connect

# 2. Instalar as dependências (só é preciso da primeira vez ou quando package.json mudar)
npm install

# 3. (Opcional nesta fase) criar o ficheiro de variáveis de ambiente
cp .env.example .env.local
```

No Windows (PowerShell), o passo 3 é: `Copy-Item .env.example .env.local`

---

## Executar em desenvolvimento

```bash
npm run dev
```

Abra no navegador o endereço que aparece no terminal (normalmente **http://localhost:5173**).
As alterações ao código aparecem automaticamente. Para parar, carregue `Ctrl + C` no terminal.

---

## Comandos disponíveis

| Comando | O que faz |
|---|---|
| `npm run dev` | Arranca a aplicação em modo de desenvolvimento |
| `npm run typecheck` | Verifica erros de TypeScript |
| `npm run lint` | Verifica problemas de qualidade de código (oxlint) |
| `npm test` | Corre os testes automáticos (vitest) |
| `npm run build` | Gera a versão de produção na pasta `dist/` |
| `npm run preview` | Abre localmente a versão de produção gerada |
| `npm run check` | Faz tudo de uma vez: TypeScript + lint + testes + build. **Executar antes de cada commit.** |

---

## Estrutura de pastas

```
oficina-connect/
├── public/                  Ficheiros servidos tal como estão (ícone, cabeçalhos de segurança)
├── src/
│   ├── app/                 Configuração geral: rotas e página de erro
│   ├── components/
│   │   ├── layout/          Estrutura da aplicação: AppLayout, Sidebar, Topbar
│   │   └── ui/              Componentes reutilizáveis: Button, Card, StatCard, PageHeader, EmptyState, Icon
│   ├── config/              Menu de navegação e leitura das variáveis de ambiente
│   ├── lib/                 Funções utilitárias
│   ├── pages/               Uma pasta por módulo (dashboard, clientes, veiculos, ...)
│   ├── index.css            Tailwind + cores da marca
│   └── main.tsx             Ponto de entrada da aplicação
├── .env.example             Modelo das variáveis de ambiente (sem valores reais)
└── package.json             Dependências e comandos
```

### Como adicionar uma página nova

1. Criar `src/pages/<modulo>/<Nome>Page.tsx`
2. Registar a rota em `src/app/router.tsx`
3. Adicionar o item ao menu em `src/config/navigation.ts`

---

## Variáveis de ambiente e segurança

| Variável | Descrição |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave pública **anon / publishable** do Supabase |

Regras importantes:

- Tudo o que começa por `VITE_` fica **visível no navegador**. Nunca coloque segredos nessas variáveis.
- **Nunca** use a chave `service_role` / `secret` do Supabase no frontend — ela ignora todas as regras de segurança.
- O ficheiro `.env.local` está no `.gitignore` e **não deve ser enviado para o GitHub**.
- A proteção dos dados de cada oficina será garantida na base de dados através de **Row Level Security**, e não apenas pela interface.

---

## Publicação (Cloudflare Pages) — próxima fase

Configuração prevista:

- **Comando de build:** `npm run build`
- **Pasta de saída:** `dist`
- **Variáveis:** `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` definidas no painel do Cloudflare Pages

O ficheiro `public/_headers` aplica cabeçalhos de segurança básicos. Como não existe `404.html`, o Cloudflare Pages trata a aplicação como SPA e os endereços como `/clientes` funcionam ao recarregar a página.
