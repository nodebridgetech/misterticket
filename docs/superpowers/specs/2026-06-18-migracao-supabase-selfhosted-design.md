# Design: Migração do backend Lovable Cloud → Supabase self-hospedado na VPS

**Data:** 2026-06-18
**Status:** Aprovado (design) — pendente revisão de spec
**Objetivo:** Tornar o Mister Ticket 100% independente do Lovable Cloud, self-hospedando todo o backend (banco, auth, storage, realtime, edge functions) na VPS própria (`72.61.25.199`, painel Easypanel `easypanel.nodebridge.com.br`), preservando todos os dados de produção.

---

## 1. Contexto atual

- **Frontend:** SPA Vite/React, já hospedado no Easypanel (projeto `outros`, serviço `misterticket`), servido por Nginx, domínio `misterticket.com.br` (SSL Let's Encrypt). Auto-deploy do repo GitHub `nodebridgetech/misterticket@main`.
- **Backend atual:** Supabase gerenciado pelo Lovable Cloud (projeto `txkwnrrhaahhhpmjjbyl.supabase.co`).
- **Acesso ao backend atual:** apenas via Lovable. O `.env` do repo só contém a chave pública `anon` (role `anon`) — não dá acesso de export. Não temos `service_role` key nem connection string do Postgres em mãos.

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
| Estratégia de migração | **Híbrida**: estrutura via migrations do repo; dados/usuários/storage via export |

---

## 3. Arquitetura alvo

Stack Supabase self-hospedado (template do Easypanel, ou Docker Compose custom se o template não existir), no projeto `outros` (limite de 3 projetos do plano impede projeto dedicado).

| Serviço | Função | Status |
|---|---|---|
| `postgres` | Banco (19 tabelas) | obrigatório |
| `gotrue` | Auth | obrigatório |
| `postgrest` | API REST | obrigatório |
| `realtime` | Canais `postgres_changes` | obrigatório |
| `storage-api` (+ `imgproxy`) | Bucket `event-images` | obrigatório (imgproxy só se houver transformação de imagem) |
| `kong` | Gateway da API | obrigatório → único exposto publicamente |
| `edge-runtime` | 10 Edge Functions | obrigatório |
| `meta` | Admin interno | obrigatório |
| `studio` | UI admin | desligado/interno em produção |
| `vector`/analytics | Logs | desligado |

- **Exposição pública:** apenas o Kong, em `api.misterticket.com.br` (SSL Let's Encrypt, `certificateResolver` vazio — padrão desta VPS). Demais serviços na rede interna do projeto.
- **Chaves:** o stack gera JWT secret próprio → novas `anon` e `service_role`. Todas as chaves mudam em relação ao Lovable.

---

## 4. Sequência de migração de dados (estratégia híbrida)

1. **Subir o Supabase novo vazio** na VPS; gerar JWT secret → novas chaves.
2. **Estrutura via migrations do repo** (fonte da verdade): rodar as migrations → tabelas + RLS + funções + triggers + grants. (Schemas `auth` e `storage` são criados pelo gotrue/storage-api automaticamente.)
3. **Export do Lovable via `migrate-helper`**: tabelas (dados) + `auth.users` (com `encrypted_password`/hash bcrypt) + arquivos do storage.
4. **Importar no novo Supabase:**
   - Dados: inserir respeitando ordem de FKs, triggers desativados durante a carga e reativados depois; acertar sequences/identity.
   - Usuários: preservar `id` + `encrypted_password` → **login sem reset de senha**.
   - Storage: recriar bucket `event-images` (público) e subir arquivos com os mesmos caminhos.
5. **Verificação:** comparar contagem de linhas por tabela (novo vs antigo) e testar login de um usuário real.

---

## 5. Edge Functions + secrets

10 funções Deno no `edge-runtime`.

| Function(s) | Depende de | Secret |
|---|---|---|
| `create-checkout`, `verify-payment` | Stripe | `STRIPE_SECRET_KEY` (+ provável `STRIPE_WEBHOOK_SECRET`) |
| `send-*` (7 e-mails) | Resend | `RESEND_API_KEY` |
| todas | Supabase interno | `SUPABASE_URL` (novo Kong), `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` (novos) |

- Replicar `verify_jwt = false` em `process-withdrawal` e `send-withdrawal-notification` (do `config.toml`).
- `verify-payment` é provável webhook do Stripe → **reconfigurar URL do webhook no Stripe** pro novo domínio no cutover.
- Trocar a URL hardcoded do logo no storage (`txkwnrrhaahhhpmjjbyl.supabase.co/.../mister-ticket-logo.png`) pro novo domínio.

---

## 6. Cutover + backups

App com vendas ativas → **janela de manutenção curta**:

1. App em manutenção/somente-leitura por alguns minutos.
2. Export final via `migrate-helper` → import → conferir contagens.
3. `.env` do front → `VITE_SUPABASE_URL=https://api.misterticket.com.br` + nova `anon key` → push (rebuild automático).
4. Reconfigurar **webhook do Stripe** pro novo domínio.
5. DNS: `api.misterticket.com.br` → A `72.61.25.199` (Hostinger).
6. Testes ponta-a-ponta: login real, eventos, checkout (teste), e-mail, realtime, upload.
7. Manter Lovable/Supabase antigo intacto por alguns dias (rollback).

**Backups (agora obrigatório):** backup automático do Postgres (recurso do Easypanel ou cron `pg_dump`) + backup do storage.

**Rollback:** reverter `.env` do front pro Supabase antigo e redeployar; manter projeto antigo até validação completa.

---

## 7. Pré-requisitos do usuário

1. `STRIPE_SECRET_KEY` (e `STRIPE_WEBHOOK_SECRET` se usado) — do painel Stripe ou dos secrets do Lovable.
2. `RESEND_API_KEY` — idem.
3. Rodar/autorizar o `migrate-helper` no Lovable Cloud para o export.
4. Confirmar controle do DNS `api.misterticket.com.br` (Hostinger — já confirmado para o domínio raiz).

---

## 8. Riscos

- **Webhook do Stripe** mal reconfigurado → pagamentos quebram (checklist no cutover).
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
