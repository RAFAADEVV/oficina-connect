# Emails da RevyAuto (em vez dos emails do Supabase)

Objetivo: os emails de confirmação de conta e de recuperação de password chegam de **RevyAuto &lt;suporte@revyauto.pt&gt;**, em português e com a marca.

São três peças:

1. **O domínio `revyauto.pt`.** Sem ele não é possível enviar de `@revyauto.pt`.
2. **Um serviço de envio de emails** (Resend ou Brevo, ambos com plano gratuito), que passa a enviar os emails no lugar do Supabase.
3. **Os textos dos emails**, que já estão prontos na pasta `supabase/emails`.

Os nomes dos menus podem mudar ligeiramente com o tempo.

---

## 1. Registar o domínio

1. Compra `revyauto.pt` num registador de domínios `.pt` (a lista oficial está em **pt.pt**). Cloudflare, PTisp, Amen e outros vendem `.pt`.
2. Dica: se o registares (ou transferires a gestão do DNS) no **Cloudflare**, fica tudo no mesmo sítio da app.

---

## 2. Serviço de envio (exemplo com Resend)

1. Cria conta em **resend.com**. O plano gratuito dá 3 000 emails por mês e 100 por dia, que chega bem para começar.
2. **Domains → Add Domain**: escreve `revyauto.pt` e escolhe a região **Europe** (por causa do RGPD).
3. O Resend mostra 3 ou 4 registos DNS (tipo **TXT** e **MX**). Copia cada um para o DNS do domínio.
   No Cloudflare: **o teu domínio → DNS → Records → Add record**.
4. Espera que o Resend mostre o domínio como **Verified** (de minutos a algumas horas).
5. **API Keys → Create API Key**: dá-lhe um nome (ex.: `supabase`) e permissão **Sending access**. Copia a chave, que começa por `re_`.
   ⚠️ Esta chave é **secreta**: vai só para o Supabase. Nunca para o `.env.local`, para o GitHub nem para a app.

---

## 3. Ligar ao Supabase

Em **Supabase → Authentication → Emails → SMTP Settings**, liga **Enable custom SMTP** e preenche:

| Campo | Valor |
|---|---|
| Sender email | `suporte@revyauto.pt` |
| Sender name | `RevyAuto` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | a chave `re_...` do passo 2 |

Carrega em **Save changes**.

Depois, em **Authentication → Rate Limits**, confirma o limite de emails por hora. Começa em 30 por hora, o que chega para o início.

---

## 4. Textos dos emails

Em **Supabase → Authentication → Emails → Templates**, para cada email, abre o ficheiro correspondente da pasta `supabase/emails` e cola o conteúdo:

| Email no Supabase | Assunto (Subject) | Ficheiro |
|---|---|---|
| Confirm signup | `Confirme o seu email no RevyAuto` | `confirmar-conta.html` |
| Reset password | `Escolher uma nova password no RevyAuto` | `recuperar-password.html` |
| Change email address | `Confirme o novo email no RevyAuto` | `alterar-email.html` |
| Reauthentication | `Código de confirmação RevyAuto` | `reautenticacao.html` |

No Supabase, o conteúdo vai no campo **Message body** (pode estar no separador **Source**). Carrega em **Save** em cada um.

Não mudes o que está entre `{{ }}`: é aí que o Supabase põe o link ou o código.

---

## 5. Testar

1. Na app, em **Entrar → Esqueceu-se da password?**, pede a recuperação para o teu email.
2. O email tem de chegar de **RevyAuto &lt;suporte@revyauto.pt&gt;**, com a marca.
3. Se não chegar: vê a pasta de spam e, no Resend, a página **Emails** (mostra cada envio e o erro, se houver).

---

## 6. Receber emails em suporte@revyauto.pt (opcional)

O passo 2 só serve para **enviar**. Para **receber** respostas de clientes em `suporte@revyauto.pt`, o mais simples é o **Cloudflare Email Routing** (gratuito, exige que o DNS do domínio esteja no Cloudflare), que reencaminha para o teu Gmail:
**o teu domínio → Email → Email Routing → criar `suporte@revyauto.pt` → destino: o teu Gmail.**
