# Design: Migração do backend Lovable Cloud → Supabase self-hospedado na VPS

**Data:** 2026-06-18
**Status:** Aprovado (design) — pendente revisão de spec
**Objetivo:** Tornar o Mister Ticket 100% independente do Lovable Cloud, self-hospedando todo o backend (banco, auth, storage, realtime, edge functions) na VPS própria (`72.61.25.199`, painel Easypanel `easypanel.nodebridge.com.br`), preservando todos os dados de produção.

---

## 1. Contexto atual

- **Frontend:** SPA Vite/React, já hospedado no Easypanel (projeto `outros`, serviço `misterticket`), servido por Nginx, domínio `misterticket.com.br` (SSL Let's Encrypt). Auto-deploy do repo GitHub `nodebridgetech/misterticket@main`.
- **Backend atual:** Supabase gerenciado pelo Lovable Cloud (projeto `txkwnrrhaahhhpmjjbyl.supabase.co`).
- **Acesso ao backend atual:** apenas via Lovable. O `.env` do repo só contém a chave pública `anon` (role `anon`) — não dá acesso de export. Não temos `service_role` key nem connection string do Postgres em mãos.

### O que é o `migrate-helper` (peça central da migração)

`migrate-helper` é uma **Edge Function que se implanta no próprio projeto Lovable Cloud** (Cloud → Edge Functions). Ela resolve a falta de `service_role` local porque **executa dentro do Lovable**, onde o Supabase injeta automaticamente a `SUPABASE_SERVICE_ROLE_KEY` do projeto no ambiente da função. A função expõe um **endpoint temporário e seguro**, protegido por uma **chave de acesso de uso único** que o usuário define.

- **Interface:** o exportador (CLI ou UI web da dreamlit) chama o endpoint passando a chave de acesso.
- **Saída:** (a) schema + dados das tabelas (`public`), (b) linhas de `auth.users` **incluindo `encrypted_password`** (hash bcrypt), (c) arquivos do Storage + as linhas de metadados de `storage.objects`/`storage.buckets`.
- **Ciclo de vida:** implantada só para a migração e **removida ao final**.
- **Fonte:** [Lovable Docs – Connect to Supabase](https://docs.lovable.dev/integrations/supabase), [dreamlit lovable-cloud-to-supabase-exporter](https://github.com/dreamlit-ai/lovable-cloud-to-supabase-exporter).

### Footprint do app (o que ele usa do Supabase)
- **Postgres:** 19 tabelas (migrations em `supabase/migrations/`, 30+ arquivos).
- **Auth (GoTrue):** uso intenso — `signIn/signUp/signOut/getUser/getSession/onAuthStateChange`. RLS usa `auth.uid()` 59x e referencia `auth.users` 9x.
- **Storage:** bucket `event-images` (público); `upload` + `getPublicUrl`.
- **Realtime:** 3 canais `postgres_changes`.
- **Edge Functions (Deno):** 10 funções; 7+ chamadas do frontend via `functions.invoke`.

### Recursos da VPS (confirmados via Monitor)
- RAM: 7,8 GB total, ~2,1 GB em uso → **~5,7 GB livres**.
- CPU: 2 cores, ocioso (load ~0.08).
- Disco: 95,8 GB total, ~59 GB livres.
- A VPS roda 27 serviços (Chatwoot, Evolution API, n8n, nodehub etc.), mas em uso real está quase parada.

**Veredito:** há folga para o stack Supabase (enxuto). Restrição principal: 2 cores → começar enxuto e monitorar.

---

## 2. Decisões tomadas (no brainstorming)

| Decisão | Escolha |
|---|---|
| Dados de produção | **Preservar tudo** (tabelas + usuários com senha + storage) |
| Acesso ao Supabase atual | Apenas via Lovable → usar `migrate-helper` |
| Onde hospedar | **Mesma VPS** (RAM confirmada suficiente) |
| Escopo do stack | Supabase **completo, porém enxuto** (sem Studio/analytics/vector em produção) |
| Estratégia de migração | **Clone completo via exporter dreamlit** (`export run`) para um target **em branco**: traz schema + dados + `auth.users` + storage de uma vez. As migrations do repo permanecem como fonte da verdade para mudanças futuras, mas **não** são rodadas antes do clone (o target precisa estar vazio). |

---

## 3. Arquitetura alvo

Stack Supabase self-hospedado (template do Easypanel, ou Docker Compose custom se o template não existir), no projeto `outros` (limite de 3 projetos do plano impede projeto dedicado).

| Serviço | Função | Status |
|---|---|---|
| `postgres` | Banco (19 tabelas) | obrigatório |
| `gotrue` | Auth | obrigatório |
| `postgrest` | API REST | obrigatório |
| `realtime` | Canais `postgres_changes` | obrigatório |
| `storage-api` | Bucket `event-images` (backend de arquivos = filesystem em volume na VPS) | obrigatório |
| `imgproxy` | Transformação de imagem | **não necessário** (app não usa `getPublicUrl` com transform) |
| `kong` | Gateway da API | obrigatório → único exposto publicamente |
| `edge-runtime` | 10 Edge Functions | obrigatório |
| `meta` | Admin interno | obrigatório |
| `studio` | UI admin | desligado/interno em produção |
| `vector`/analytics | Logs | desligado |

- **Exposição pública:** apenas o Kong, em `api.misterticket.com.br` (SSL Let's Encrypt, `certificateResolver` vazio — padrão desta VPS). Demais serviços na rede interna do projeto.
- **Versão do Postgres:** usar a **mesma major version** do Postgres do Lovable no stack self-hospedado — restaurar `auth.users` e colunas de identidade entre majors diferentes pode dar problema.
- **Chaves:** o stack gera JWT secret próprio → novas `anon` e `service_role`. Todas as chaves mudam em relação ao Lovable.

---

## 4. Sequência de migração de dados (clone completo via exporter)

A ferramenta `lovable-cloud-to-supabase-exporter` (dreamlit) faz o trabalho pesado: o comando `export run` chama o `migrate-helper` (que roda dentro do Lovable com `SERVICE_ROLE` injetada), **clona o banco** (schema `public` + dados + `auth.users` com `encrypted_password`) e **copia o storage** para o Supabase de destino. Requisitos da ferramenta: target **em branco** (`--confirm-target-blank`), Docker local, e os 3 valores do target (DB URL, project URL, admin/`service_role` key). Ela **pula** tabelas de bookkeeping (`auth.schema_migrations`, `storage.migrations`, sessões/tokens efêmeros). **Edge Functions NÃO são migradas pela ferramenta** (são código, ver Seção 5).

1. **Subir o Supabase novo vazio** na VPS; gerar JWT secret → novas chaves. O `public` deve estar **em branco** (NÃO rodar as migrations antes — o clone traz o schema, RLS, funções e triggers).
2. **Configurar GoTrue:** `SITE_URL=https://misterticket.com.br` e lista de redirects permitidos (o app usa `emailRedirectTo`/`redirectTo` em cadastro, confirmação e reset de senha — `AuthContext.tsx`, `Auth.tsx`, `ProducerAuth.tsx`, função `send-password-reset`). Configurar SMTP do GoTrue (via Resend) para os e-mails nativos de auth (confirmação/recuperação). Sem isso, links de auth quebram.
3. **Implantar o `migrate-helper`** no Lovable (gerado por `pnpm exporter -- setup edge-function`, que também imprime a access key de uso único).
4. **Rodar `export run`** apontando source (URL do `migrate-helper` + access key) e target (DB URL, project URL, `service_role` do novo Supabase) com `--confirm-target-blank`. A ferramenta clona schema+dados+`auth.users` e copia o storage.
5. **Verificação:** comparar contagem de linhas por tabela (novo vs antigo), `count(auth.users)`, nº de objetos em `storage.objects`, e — **antes da virada de DNS** — testar **login de um usuário real** (para que uma eventual incompatibilidade de hash bcrypt apareça dentro da janela) + abrir uma imagem via `getPublicUrl`.

> **Paridade de PG:** o clone entre majors diferentes pode falhar → o stack novo deve usar a mesma major version do Postgres do Lovable (confirmar antes).
> **Rehearsal:** ensaiar o `export run` num target descartável fora da janela (validar processo e medir tempo); depois **zerar o target** (`--confirm-target-blank` exige branco) e rodar de verdade na janela.

---

## 5. Edge Functions + secrets

As 10 funções Deno no `edge-runtime`: `create-checkout`, `verify-payment`, `process-withdrawal`, `send-email`, `send-password-reset`, `send-producer-approval`, `send-purchase-confirmation`, `send-transfer-notification`, `send-welcome-email`, `send-withdrawal-notification`.

| Function(s) | Depende de | Secret |
|---|---|---|
| `create-checkout`, `verify-payment` | Stripe (API) | `STRIPE_SECRET_KEY` |
| `send-*` (7 e-mails) | Resend | `RESEND_API_KEY` |
| todas | Supabase interno | `SUPABASE_URL` (novo Kong), `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` (novos) |

- **`verify-payment` NÃO é webhook do Stripe** (verificado no código: sem `constructEvent`/assinatura; é chamada pelo frontend com JWT do usuário para conferir a sessão de checkout). Logo: **não há `STRIPE_WEBHOOK_SECRET` nem webhook do Stripe para reconfigurar**.
- **`verify_jwt`**: replicar o `config.toml` **literalmente** — `verify_jwt = false` apenas em `process-withdrawal` e `send-withdrawal-notification`; as outras 8 ficam no padrão `true` (mantém o comportamento atual de produção).
- Trocar a URL hardcoded do logo no storage (`txkwnrrhaahhhpmjjbyl.supabase.co/.../mister-ticket-logo.png`) pro novo domínio — aparece em **duas** funções: `send-welcome-email/index.ts` e `send-password-reset/index.ts`.

---

## 6. Cutover + backups

App com vendas ativas → **janela de manutenção curta**:

1. **Modo manutenção:** publicar um build do frontend com flag de manutenção (página estática "em manutenção") OU pausar vendas pela UI de admin, durante a janela. Aceita-se uma pequena janela de inconsistência se o modo manutenção total não for viável.
2. Garantir target **em branco** (zerar se houve rehearsal) → rodar `export run` (clone completo) → conferir contagens. Sem deltas: é um clone único na janela.
3. **Flipar todas as referências ao backend antigo no frontend** → push (rebuild automático):
   - `.env`: `VITE_SUPABASE_URL=https://api.misterticket.com.br`, `VITE_SUPABASE_PUBLISHABLE_KEY=<nova anon key>` (o nome da var é `PUBLISHABLE_KEY`, não `ANON_KEY`), `VITE_SUPABASE_PROJECT_ID=<novo ref>`.
   - `index.html`: trocar o `<link rel="preconnect" href="https://txkwnrrhaahhhpmjjbyl.supabase.co">` pro novo domínio.
4. DNS: `api.misterticket.com.br` → A `72.61.25.199` (Hostinger).
5. Testes ponta-a-ponta: login real, eventos, checkout (teste), e-mail, realtime, upload.
6. Desligar modo manutenção.
7. Manter Lovable/Supabase antigo intacto por alguns dias (rollback).

> Nota: não há webhook do Stripe a reconfigurar (ver Seção 5). `create-checkout` usa `success_url`/`cancel_url` derivados de `req.headers.origin`, sem domínio hardcoded.

**Backups (agora obrigatório):** backup automático do Postgres (recurso do Easypanel ou cron `pg_dump`) + backup do storage. **Validar pelo menos 1 restore** antes de declarar a migração concluída (critério da Seção 9).

**Rollback:** reverter `.env` do front pro Supabase antigo e redeployar; manter projeto antigo até validação completa.

---

## 7. Pré-requisitos do usuário

1. `STRIPE_SECRET_KEY` — do painel Stripe ou dos secrets do Lovable. (Não há webhook secret — ver Seção 5.)
2. `RESEND_API_KEY` — idem.
3. Rodar/autorizar o `migrate-helper` no Lovable Cloud para o export.
4. Confirmar controle do DNS `api.misterticket.com.br` (Hostinger — já confirmado para o domínio raiz).

---

## 8. Riscos

- **2 cores** sob carga → stack enxuto + monitoramento; redimensionar VPS se necessário.
- **Compatibilidade de hash de senha** no GoTrue → validar 1 login real pós-migração.
- **Backups/segurança/upgrades** passam a ser responsabilidade própria.
- **Template Supabase no Easypanel** pode não existir → fallback Docker Compose custom (1º passo da implementação).
- **Drift de dados** durante o cutover → mitigado pela janela de manutenção.
- **Limite de projetos** do plano → serviços sob projeto `outros`.

---

## 9. Critérios de sucesso

- `api.misterticket.com.br` responde via Kong com SSL válido.
- Login de usuário pré-existente funciona sem reset de senha.
- Contagens de linhas por tabela conferem (novo == antigo).
- Checkout (Stripe), envio de e-mail (Resend), realtime e upload de imagem funcionam ponta-a-ponta.
- Frontend aponta 100% para o novo backend; nenhuma chamada ao `txkwnrrhaahhhpmjjbyl.supabase.co`.
- Backups automáticos configurados e testados (restore validado).
- Zero dependência do Lovable após período de rollback.

---

## 10. Fora de escopo

- Refatoração das Edge Functions além do necessário para self-host.
- Mudança de provedores de pagamento/e-mail (Stripe/Resend permanecem).
- Otimização de performance além de "rodar enxuto".
