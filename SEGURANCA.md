# Segurança do RevyAuto

Este documento descreve como a plataforma está protegida e as definições que **têm de ser ligadas à mão** no Supabase, no Cloudflare e no GitHub. O código sozinho não chega: a maior parte dos ataques reais entra por contas mal protegidas.

---

## 1. O que já está protegido no código

### Base de dados (Supabase / PostgreSQL)
- **Isolamento por oficina (RLS)** em todas as tabelas: uma oficina nunca vê, altera nem apaga dados de outra. Garantido pela base de dados, não pela app.
- **Papéis:** o Funcionário vê, cria e edita; só o Dono apaga e altera os dados da oficina.
- **Ligações entre tabelas "da mesma oficina":** não é possível ligar um veículo, serviço, peça ou contacto a dados de outra oficina.
- **Colunas protegidas:** não é possível mudar um registo de oficina nem falsificar o autor (`created_by`).
- **Autenticação em dois passos (MFA):** quem a ativa só acede aos dados depois de introduzir o código. Regra *restritiva* em todas as tabelas (migração 0006).
- **Limite de 5 oficinas por conta** (anti-abuso).
- **Convites de equipa** (migração 0007): o código só é mostrado uma vez e a base de dados guarda apenas o resumo (SHA-256). Expira em 7 dias, só pode ser usado uma vez, e há um máximo de 10 tentativas por hora por conta, para não ser possível adivinhar códigos. Só o Dono convida e remove pessoas, e o Dono não pode ser removido.
- **Registo fechado** (migração 0009): só cria conta quem estiver na lista de emails autorizados (gerida pelo administrador) ou tiver um convite de equipa para o seu email. A regra está num gatilho da base de dados, por isso não se contorna pela app nem pela API. A administração exige a autenticação em dois passos confirmada.
- **Corrigir serviços** (migração 0008): qualquer pessoa da oficina pode corrigir um serviço. As peças retiradas ficam no registo de eliminações, com o nome de quem as retirou.
- **Registo de auditoria:** cada cliente, veículo, serviço ou peça apagado fica registado (quem e quando). Só o Dono vê.
- **Validação dos dados** na própria base de dados: telefone, email, NIF, matrícula, tamanhos máximos.
- **Funções privilegiadas** com `search_path` fixo e sem acesso para visitantes sem sessão.
- **Testes de segurança:** `supabase/tests/0001` a `0009`, 100 testes no total.

### Aplicação
- **Content-Security-Policy** e outros cabeçalhos de segurança (`public/_headers`): só carrega código da própria app, só fala com o Supabase, não pode ser metida dentro de outro site.
- **Fim de sessão por inatividade:** 4 horas sem uso (computadores partilhados na oficina).
- **CAPTCHA opcional** (Cloudflare Turnstile) no login, no registo e na recuperação de password.
- **Mensagens de erro sem detalhes técnicos**, e respostas iguais exista ou não a conta (não revela emails registados).
- **Sem `innerHTML`/`eval`**: o React protege contra XSS; os links de WhatsApp só levam dígitos.
- **Ficheiros importados** lidos só no navegador e nunca guardados; limite de 10 MB e 5000 linhas.
- **Letras servidas pela própria app** (sem pedidos ao Google Fonts, por causa do RGPD).
- **Sem mapas de código (source maps)** em produção.

---

## 2. Definições a ligar no Supabase (painel em supabase.com)

Os nomes dos menus podem mudar ligeiramente com o tempo.

| Onde | O que fazer |
|---|---|
| **Authentication → Sign In / Providers → Email** | **Confirm email**: ligado. **Secure email change**: ligado. **Secure password change**: ligado. **Minimum password length**: 10. **Password requirements**: letras e números. |
| **Authentication → Multi-Factor** | **TOTP** ligado (vem ligado por defeito). |
| **Authentication → Attack Protection** | **Leaked password protection** (recusa passwords que já apareceram em fugas de dados), se o teu plano o permitir. **CAPTCHA**: ver secção 4. |
| **Authentication → Rate Limits** | Manter os valores por defeito, ou mais baixos. |
| **Authentication → URL Configuration** | **Site URL** = o endereço público da app. **Redirect URLs**: só os teus endereços (o de produção e `http://localhost:5173/**` para desenvolvimento). |
| **Advisors → Security Advisor** | Correr e resolver os avisos. Repetir depois de cada migração. |
| **Project Settings → Data API** | **Exposed schemas**: só `public`. O esquema `private` NUNCA deve estar exposto. |
| **Database → Extensions** | Desligar **pg_graphql**, porque a app não o usa (menos superfície de ataque). |
| **Project Settings → API Keys** | A chave `service_role` / `secret` nunca sai do painel. Se alguma vez a expuseres, gera uma nova. |

**Cópias de segurança:** o plano gratuito tem cópias limitadas. Até haver um plano pago, faz uma exportação regular da base de dados (Database → Backups, ou `pg_dump`) e guarda-a num sítio seguro e encriptado.

---

## 3. As tuas próprias contas (o ponto mais importante)

Quem entrar na tua conta do Supabase, do GitHub ou do Cloudflare tem acesso a TUDO. Liga a autenticação em dois passos em:
- [ ] **Supabase** (Account → Security)
- [ ] **GitHub** (Settings → Password and authentication)
- [ ] **Cloudflare** (My Profile → Authentication)
- [ ] **O email** usado nestas contas (Gmail: Segurança → Verificação em dois passos)

E também:
- [ ] Usa passwords diferentes em cada conta (um gestor de passwords ajuda: Bitwarden é gratuito).
- [ ] **GitHub:** repositório **privado**. Em Settings → Code security, liga **Dependabot alerts** e **Secret scanning**.
- [ ] Nunca envies o `.env.local` para ninguém, nem o coloques no GitHub (já está no `.gitignore`).

---

## 4. CAPTCHA contra robôs (Cloudflare Turnstile, gratuito)

1. Em **dash.cloudflare.com → Turnstile → Add widget**: indica o domínio da app e escolhe o modo **Managed**.
2. Copia a **Site Key** (pública) para o `.env.local`, e para as variáveis do Cloudflare Pages:
   `VITE_TURNSTILE_SITE_KEY=...`
3. No Supabase: **Authentication → Attack Protection → Enable CAPTCHA protection**, escolhe **Turnstile** e cola a **Secret Key**.
4. Faz as duas coisas juntas. Se ligares o CAPTCHA no Supabase sem a chave na app, ninguém consegue entrar.

---

## 5. Cloudflare Pages (publicação)

- O ficheiro `public/_headers` é aplicado automaticamente.
- Define as variáveis `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e, se usares, `VITE_TURNSTILE_SITE_KEY`.
- Usa sempre HTTPS (o Cloudflare trata disso).
- Se um dia acrescentares outro serviço externo (por exemplo pagamentos), tens de acrescentar a origem dele à `Content-Security-Policy` em `public/_headers`.

---

## 6. RGPD: o que ainda falta (não é código)

O RevyAuto guarda dados pessoais dos clientes das oficinas. A oficina é a **responsável pelo tratamento** e tu és o **subcontratante**. Antes de teres clientes pagantes, convém tratar com um jurista:
- **Política de privacidade** e **termos de utilização** da plataforma.
- **Contrato de subcontratação** (art. 28.º do RGPD) com cada oficina.
- **Lista de subcontratantes** que usas: Supabase (dados na UE) e Cloudflare.
- **Plano para fugas de dados:** notificar a **CNPD** em até 72 horas.
- **Prazo de conservação** dos dados. Exportar os dados de um cliente já existe (botão **Exportar dados** na ficha do cliente) e apagar também (só o Dono).

---

## 7. Como verificar

- **Base de dados:** corre os ficheiros `supabase/tests/*.sql` no SQL Editor do Supabase. Todos têm de mostrar ✅.
- **App:** `npm run check` (TypeScript, lint, testes e build).
- **Dependências:** `npm audit` deve mostrar `found 0 vulnerabilities`. Repete de vez em quando.
