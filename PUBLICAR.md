# Publicar o RevyAuto (Cloudflare Pages)

Guia passo a passo para pôr a app online, num endereço como `revyauto.pages.dev` (ou no teu domínio).
Demora cerca de 30 minutos da primeira vez. Os nomes dos menus podem mudar ligeiramente com o tempo.

---

## 0. Antes de começar

No PowerShell, na pasta do projeto:

```powershell
npm run check
```

Tem de terminar sem erros. Depois envia tudo para o GitHub, **um comando de cada vez**:

```powershell
git add -A
git commit -m "Pronto para publicar"
git push
```

---

## 1. Base de dados (Supabase)

1. Em **supabase.com → o teu projeto → SQL Editor**, confirma que já correste **todas** as migrações, por ordem:
   `0001` → `0002` → … → `0008` (pasta `supabase/migrations`). Cada uma só se corre **uma vez**.
2. Corre os testes da pasta `supabase/tests` (`0001` a `0008`). Todos têm de mostrar ✅.
3. **Advisors → Security Advisor**: corre e resolve os avisos.
4. Revê a lista do [SEGURANCA.md](SEGURANCA.md), secção 2 (confirmação de email, tamanho mínimo da password, etc.).

---

## 2. Criar o projeto no Cloudflare

1. Entra em **dash.cloudflare.com** (cria conta se ainda não tens; é gratuito).
2. Vai a **Workers & Pages → Create application → Pages → Connect to Git**.
3. Escolhe **GitHub**, autoriza, e seleciona **só** o repositório do RevyAuto (não dês acesso a todos).
4. Carrega em **Begin setup** e preenche:

| Campo | Valor |
|---|---|
| Project name | `revyauto` (fica `revyauto.pages.dev`) |
| Production branch | `main` |
| Framework preset | `None` (ou `Vite`, dá o mesmo) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | deixa vazio |

5. Em **Environment variables**, acrescenta:

| Nome | Valor |
|---|---|
| `VITE_SUPABASE_URL` | o mesmo do teu `.env.local` |
| `VITE_SUPABASE_ANON_KEY` | o mesmo do teu `.env.local` (a chave **anon / publishable**) |
| `NODE_VERSION` | `22` |

   ⚠️ **Nunca** coloques aqui a chave `service_role` / `secret`.
   O ficheiro `.node-version` do projeto já pede o Node 22. O `NODE_VERSION` é só uma garantia extra.

6. Carrega em **Save and Deploy** e espera 1 a 2 minutos.

---

## 3. Ligar o Supabase ao novo endereço

Sem isto, os emails de confirmação e de recuperação de password levam para o sítio errado.

Em **Supabase → Authentication → URL Configuration**:
- **Site URL:** `https://revyauto.pages.dev` (ou o teu domínio)
- **Redirect URLs:** acrescenta `https://revyauto.pages.dev/**` e mantém `http://localhost:5173/**` para continuares a trabalhar no teu computador.

---

## 4. Confirmar que está tudo bem

Abre o endereço e testa:
- [ ] Criar conta → chega o email → o link abre a app e entra.
- [ ] Criar oficina, adicionar um cliente, importar um ficheiro pequeno.
- [ ] Recarregar a página em `/clientes` (tem de abrir normalmente, sem erro 404).
- [ ] Convidar um funcionário (com outro email teu) e entrar com o código.
- [ ] Ativar a autenticação em dois passos na tua conta de Dono.
- [ ] Em **securityheaders.com**, testar o endereço: deve dar nota **A**.

---

## 5. Atualizações

Cada `git push` para o `main` publica automaticamente uma nova versão.
Se algo correr mal: **Workers & Pages → revyauto → Deployments**. Na versão anterior, carrega em **⋯ → Rollback**.

Quando houver uma migração nova (`0009`, …), corre-a **primeiro** no Supabase e só depois faz `git push`.

---

## 6. Antes de teres clientes reais

- **Emails:** o envio de emails incluído no Supabase é só para testes (poucos emails por hora).
  Segue o [EMAILS.md](EMAILS.md): emails enviados de `suporte@revyauto.pt`, em português e com a marca.
- **Domínio próprio** (ex.: `app.revyauto.pt`): **Workers & Pages → revyauto → Custom domains**.
  Depois atualiza a **Site URL** e as **Redirect URLs** do Supabase (passo 3).
- **CAPTCHA:** ver [SEGURANCA.md](SEGURANCA.md), secção 4.
- **Cópias de segurança e RGPD:** ver [SEGURANCA.md](SEGURANCA.md), secções 2 e 6.
