# Migração Supabase Self-Hospedado — Plano de Implementação

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar todo o backend do Mister Ticket do Lovable Cloud (Supabase gerenciado) para um Supabase self-hospedado na VPS própria (Easypanel), preservando todos os dados de produção.

**Architecture:** Stack Supabase self-hospedado (enxuto, sem Studio/analytics/imgproxy) no projeto `outros` do Easypanel, exposto via Kong em `api.misterticket.com.br`. Estrutura criada pelas migrations do repo; dados/usuários/storage migrados via `migrate-helper` do Lovable. Frontend re-apontado e cutover com janela de manutenção.

**Tech Stack:** Supabase (Postgres, GoTrue, PostgREST, Realtime, Storage, Kong, edge-runtime), Easypanel (tRPC API + Docker Compose), Deno (edge functions), Stripe, Resend, Vite/React (frontend).

**Spec de referência:** [docs/superpowers/specs/2026-06-18-migracao-supabase-selfhosted-design.md](../specs/2026-06-18-migracao-supabase-selfhosted-design.md)

**Convenções de execução:**
- API Easypanel: `BASE=https://easypanel.nodebridge.com.br`, header `Authorization: Bearer $EP_TOKEN`. Mutations = `POST /api/trpc/<proc>` com body `{"json":{...}}`. Leituras = **POST** (não GET) com `{"json":{...}}`.
- Segredos (tokens, keys) **nunca** são commitados. Ficam em variáveis de ambiente locais / nos secrets do Easypanel.
- "Verificar" = rodar o comando e conferir a saída esperada antes de marcar o passo.

**Setup do ambiente local (rodar antes de qualquer task):**
```bash
export BASE="https://easypanel.nodebridge.com.br"
export EP_TOKEN="<token da API Easypanel>"   # P4
```

**Estratégia central:** o backend é migrado por **clone completo** via a CLI `lovable-cloud-to-supabase-exporter` (dreamlit), que **exige o target em branco**. Portanto **NÃO** rodamos as migrations do repo no destino — o clone traz schema + dados + `auth.users` + storage. As migrations seguem como fonte da verdade só para mudanças futuras. Edge Functions são deployadas à parte.

---

## Pré-requisitos (bloqueiam o início — providenciar antes da Fase 1)

- [ ] **P1:** Usuário fornece `STRIPE_SECRET_KEY` (painel Stripe ou secrets do Lovable).
- [ ] **P2:** Usuário fornece `RESEND_API_KEY`.
- [ ] **P3:** Usuário confirma acesso ao Lovable Cloud para implantar o `migrate-helper`.
- [ ] **P4:** `EP_TOKEN` (token da API Easypanel) disponível no ambiente local.
- [ ] **P5:** Janela de manutenção combinada com o usuário (horário de baixo movimento) para a Fase 6.

---

## Chunk 1: Descoberta e provisionamento do stack

### Task 1: Descobrir disponibilidade do template Supabase no Easypanel

**Files:** nenhum (operação via API/painel)

- [ ] **Step 1: Listar templates disponíveis**

Run:
```bash
curl -s -X POST -H "Authorization: Bearer $EP_TOKEN" -H "Content-Type: application/json" \
  -d '{"json":{}}' "$BASE/api/trpc/templates.listTemplates" | grep -io "supabase" | head
```
Expected: aparece "supabase" → template existe. Se retornar `{"error":"Not found"}` ou vazio, **template indisponível → usar fallback Task 2b** (Docker Compose custom).

- [ ] **Step 2: Registrar a decisão**

Anotar no topo do plano: "template Supabase: DISPONÍVEL" ou "INDISPONÍVEL → compose custom". As tasks seguintes assumem um dos caminhos.

### Task 2a: Provisionar via template (caminho preferido)

**Files:** nenhum (via painel Easypanel, projeto `outros`)

- [ ] **Step 1:** No painel Easypanel → projeto `outros` → **Create from Template → Supabase**.
- [ ] **Step 2:** Definir nome base do serviço `mt-supabase`, gerar/definir:
  - `POSTGRES_PASSWORD` (forte, salvar em local seguro)
  - `JWT_SECRET` (≥32 chars; gera `ANON_KEY` e `SERVICE_ROLE_KEY`)
  - `DASHBOARD` desabilitado (Studio off) se a opção existir; senão desligar o serviço `studio` depois.
- [ ] **Step 3:** Selecionar a **mesma major version do Postgres** do Lovable (confirmar a versão do Lovable via `migrate-helper`/painel antes; default Supabase atual = PG 15).
- [ ] **Step 4: Verificar serviços criados**

Run:
```bash
curl -s -X POST -H "Authorization: Bearer $EP_TOKEN" -H "Content-Type: application/json" \
  -d '{"json":{"projectName":"outros"}}' "$BASE/api/trpc/projects.inspectProject" \
  | python -c "import sys,json;[print(s['name']) for s in json.load(sys.stdin)['json']['services'] if 'supabase' in s['name'] or 'mt-' in s['name']]"
```
Expected: lista com db, auth(gotrue), rest(postgrest), realtime, storage, kong, meta, edge-runtime.

- [ ] **Step 5:** Desligar serviços não usados (`studio`, `analytics`/`vector`, `imgproxy`) via `services.app.stopService` ou removendo do compose.

### Task 2b: Provisionar via Docker Compose custom (fallback)

**Files:**
- Create: `infra/supabase/docker-compose.yml` (baseado no compose oficial do Supabase self-hosting, enxuto)
- Create: `infra/supabase/.env.example` (sem valores reais)

- [ ] **Step 1:** Copiar o `docker-compose.yml` oficial do Supabase self-hosting; remover `studio`, `analytics`/`vector`, `imgproxy`.
- [ ] **Step 2:** Criar serviço "Compose" no Easypanel (projeto `outros`, `services.compose.createService`) apontando para esse compose.
- [ ] **Step 3:** Configurar envs (POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY, SITE_URL).
- [ ] **Step 4:** Deploy (`services.compose.deployService`) e verificar containers de pé (`projects.getDockerContainers`).

### Task 3: Expor a API (Kong) no domínio

**Files:** nenhum (via API de domínios)

- [ ] **Step 1: Adicionar domínio ao serviço Kong**

Run (ajustar `serviceName` ao nome real do Kong):
```bash
ID=$(python -c "import uuid;print('c'+uuid.uuid4().hex[:24])")
curl -s -X POST -H "Authorization: Bearer $EP_TOKEN" -H "Content-Type: application/json" \
 -d "{\"json\":{\"projectName\":\"outros\",\"serviceName\":\"<kong>\",\"id\":\"$ID\",\"host\":\"api.misterticket.com.br\",\"https\":true,\"path\":\"/\",\"wildcard\":false,\"middlewares\":[],\"certificateResolver\":\"\",\"destinationType\":\"service\",\"serviceDestination\":{\"projectName\":\"outros\",\"serviceName\":\"<kong>\",\"port\":8000,\"protocol\":\"http\",\"path\":\"/\"}}}" \
 "$BASE/api/trpc/domains.createDomain"
```
Expected: `{}` (HTTP 200). `certificateResolver` vazio (padrão da VPS).

- [ ] **Step 2:** DNS — usuário cria A record `api.misterticket.com.br` → `72.61.25.199` (Hostinger).
- [ ] **Step 3: Verificar SSL emitido**

Run:
```bash
for i in $(seq 1 8); do echo | openssl s_client -servername api.misterticket.com.br -connect api.misterticket.com.br:443 2>/dev/null | openssl x509 -noout -issuer; sleep 20; done
```
Expected: issuer vira `Let's Encrypt` (não `CN=Easypanel`).

- [ ] **Step 4: Verificar a API responde**

Run: `curl -s -o /dev/null -w "%{http_code}\n" https://api.misterticket.com.br/auth/v1/health`
Expected: `200`.

---

## Chunk 2: Configuração do GoTrue (target permanece em branco)

> Importante: **NÃO** rodar as migrations do repo no destino. O target deve ficar **em branco** para o `export run` (o clone traz o schema). Obter a connection string do Postgres novo (host interno + `POSTGRES_PASSWORD`) e exportar como `PG_NEW` local — usada só para verificações.

### Task 4: Configurar GoTrue (auth)

**Files:** nenhum (envs do serviço gotrue no Easypanel)

- [ ] **Step 1:** Setar `GOTRUE_SITE_URL=https://misterticket.com.br`.
- [ ] **Step 2:** Setar `GOTRUE_URI_ALLOW_LIST` com os redirects usados pelo app (rotas de `Auth.tsx`, `ProducerAuth.tsx`, confirmação/reset). Ex.: `https://misterticket.com.br/**`.
- [ ] **Step 3:** Configurar **SMTP do GoTrue via Resend** (host `smtp.resend.com`, user `resend`, pass `RESEND_API_KEY`, porta 465/587, `GOTRUE_SMTP_ADMIN_EMAIL`/`SENDER_NAME`) para os e-mails nativos de auth (confirmação/recuperação). As funções `send-*` do app continuam para os e-mails transacionais próprios.
- [ ] **Step 4: Redeploy do gotrue e verificar health**

Run: `curl -s -o /dev/null -w "%{http_code}\n" https://api.misterticket.com.br/auth/v1/health`
Expected: `200`.

- [ ] **Step 5: Verificar fluxo real de e-mail de auth**

Disparar um "esqueci a senha" de teste pela API (`POST /auth/v1/recover`) e confirmar recebimento do e-mail.
Expected: e-mail chega (valida `SITE_URL`/allow-list/SMTP, que o `/health` não exercita).

---

## Chunk 3: Clone de dados, usuários e storage (exporter dreamlit)

> Referência de comandos: `docs/run-exporter-locally.md` do repo dreamlit. Requer **Docker** local e **pnpm**. O comando `export run` clona schema+dados+`auth.users` e copia o storage para o target em branco.

### Task 5: Preparar o exporter e o migrate-helper

**Files:** nenhum (clone do repo dreamlit + projeto Lovable)

- [ ] **Step 1:** Clonar o exporter e instalar deps.

Run:
```bash
git clone https://github.com/dreamlit-ai/lovable-cloud-to-supabase-exporter /tmp/lc-exporter
cd /tmp/lc-exporter && pnpm install
```
Expected: instala sem erro; Docker disponível (`docker info`).

- [ ] **Step 2:** Gerar a fonte do helper + access key de uso único.

Run: `pnpm exporter -- setup edge-function`
Expected: imprime a fonte do `migrate-helper` e um `Generated access key` (anotar com segurança).

- [ ] **Step 3:** No Lovable: criar edge function vazia `migrate-helper`, colar a fonte do Step 2, mandar o Lovable deployar. Copiar a URL em Cloud → Edge Functions → migrate-helper → Copy URL.
- [ ] **Step 4: Confirmar paridade de major version do Postgres**

Confirmar a versão do PG do Lovable (via dashboard/CLI do helper) e conferir que bate com a do stack novo (Task 2a Step 3). Se divergir, ajustar a versão do stack novo antes do clone.
Expected: majors iguais (ex.: ambas PG 15).

### Task 6: Rehearsal do clone num target descartável (fora da janela)

**Files:** nenhum

- [ ] **Step 1:** Subir um Supabase descartável (ou usar um target de teste) e rodar o clone, validando processo e medindo tempo.

Run (substituir todos os placeholders pelos valores reais):
```bash
cd /tmp/lc-exporter
pnpm exporter -- export run \
  --source-edge-function-url <migrate-helper-url> \
  --source-edge-function-access-key <access-key> \
  --target-db-url <PG_TARGET_TESTE> \
  --target-project-url https://api-teste... \
  --target-admin-key <SERVICE_ROLE_TESTE> \
  --confirm-target-blank
```
Expected: job conclui; relatório com nº de tabelas/usuários/arquivos. Anotar a duração (define a janela de manutenção).

- [ ] **Step 2: Verificar o rehearsal**

Run (contra o target de teste): `psql "$PG_TESTE" -c "select count(*) from auth.users;"` e contagens de algumas tabelas.
Expected: batem com a origem.

- [ ] **Step 3:** Descartar/zerar o target de teste.

> O clone real (target = Supabase de produção da VPS, em branco) acontece na **janela de manutenção** (Task 13).

### Task 7: Verificações pós-clone (aplicáveis após o clone real da Task 11)

**Files:** nenhum

- [ ] **Step 1: Contagem de usuários**

Run: `psql "$PG_NEW" -c "select count(*) from auth.users;"`
Expected: igual à origem (do relatório do export).

- [ ] **Step 2: Contagens por tabela (novo vs antigo)**

Run: comparar `select count(*)` das 19 tabelas de `public` com os números da origem.
Expected: batem 100%.

- [ ] **Step 3: Storage — objetos e acesso público**

Run:
```bash
psql "$PG_NEW" -c "select count(*) from storage.objects where bucket_id='event-images';"
curl -s -o /dev/null -w "%{http_code}\n" "https://api.misterticket.com.br/storage/v1/object/public/event-images/mister-ticket-logo.png"
```
Expected: contagem == origem; HTTP `200` no logo (arquivo sabidamente existente).

---

## Chunk 4: Edge Functions

### Task 8: Ajustar URLs hardcoded nas funções

**Files:**
- Modify: `supabase/functions/send-welcome-email/index.ts` (URL do logo)
- Modify: `supabase/functions/send-password-reset/index.ts` (URL do logo)

- [ ] **Step 1:** Trocar `https://txkwnrrhaahhhpmjjbyl.supabase.co/storage/v1/object/public/event-images/mister-ticket-logo.png` por `https://api.misterticket.com.br/storage/v1/object/public/event-images/mister-ticket-logo.png` nas duas funções.
- [ ] **Step 2: Verificar que não restou referência ao projeto antigo nas functions**

Run: `grep -rn "txkwnrrhaahhhpmjjbyl" supabase/functions`
Expected: nenhum resultado.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/send-welcome-email/index.ts supabase/functions/send-password-reset/index.ts
git commit -m "fix: aponta logo das functions para o novo backend Supabase"
```

### Task 9: Deploy das 10 functions com secrets

**Files:** nenhum (edge-runtime do Supabase self-hospedado + secrets)

> Mecanismo: no Supabase self-hospedado, o serviço `edge-runtime` serve as funções a partir de um **volume de arquivos** (ex.: `/home/deno/functions/<nome>/index.ts`), não via `supabase functions deploy` (que é para o cloud gerenciado). Vamos montar o código das funções nesse volume.

- [ ] **Step 1:** Copiar os 10 diretórios de `supabase/functions/*` para o volume de funções do `edge-runtime` (via mount no Easypanel apontando para um caminho versionado, ou copiando para o volume). Garantir que `config.toml` é respeitado: setar `verify_jwt=false` apenas para `process-withdrawal` e `send-withdrawal-notification` (variável de ambiente por função do edge-runtime, ex.: `FUNCTIONS_VERIFY_JWT` por path / config do runtime); as outras 8 ficam no padrão `true`.
- [ ] **Step 2:** Configurar secrets/envs do `edge-runtime`: `STRIPE_SECRET_KEY` (P1), `RESEND_API_KEY` (P2), `SUPABASE_URL=https://api.misterticket.com.br`, `SUPABASE_SERVICE_ROLE_KEY` (novo), `SUPABASE_ANON_KEY` (novo).
- [ ] **Step 3:** Redeploy/restart do `edge-runtime`.
- [ ] **Step 4: Verificar funções respondem**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS "https://api.misterticket.com.br/functions/v1/create-checkout"
```
Expected: `200`/`204` (CORS preflight ok).

- [ ] **Step 5: Verificar uma função autenticada e uma de e-mail**

Invocar `verify-payment` com um JWT de usuário (espera resposta de validação, não 5xx) e disparar um e-mail de teste via `send-welcome-email` (espera entrega via Resend).
Expected: sem erros 5xx; e-mail recebido.

---

## Chunk 5: Cutover, backups e rollback

### Task 10: Configurar backups (antes do cutover)

**Files:** nenhum (Easypanel backups / cron)

- [ ] **Step 1:** Configurar backup automático do volume do Postgres (Easypanel volume backup) OU cron `pg_dump` para storage externo.
- [ ] **Step 2:** Configurar backup do volume do storage.
- [ ] **Step 3: Validar 1 restore** (restaurar dump num banco temporário e conferir contagens).
Expected: restore íntegro — critério de sucesso da spec.

### Task 11: Cutover (na janela de manutenção P5)

**Files:**
- Modify: `.env` (vars do frontend)
- Modify: `index.html:6` (preconnect)

> DNS de `api.misterticket.com.br` já foi criado uma única vez na Chunk 1 (Task 3) para emissão do SSL — **não há mudança de DNS no cutover**.

- [ ] **Step 1:** Ativar modo manutenção (build com flag de manutenção OU pausar vendas pela UI admin).
- [ ] **Step 2:** Garantir o target (Postgres novo) **em branco** (se o rehearsal da Task 6 foi feito contra ele, zerar antes). Rodar o **clone real** (único, sem delta) com `export run` — mesmo comando da Task 6 Step 1, agora com o target de **produção** (`PG_NEW`, `https://api.misterticket.com.br`, `service_role` novo) e `--confirm-target-blank`. Em seguida rodar as verificações da **Task 7** (contagens + storage + login real).
- [ ] **Step 3:** Atualizar frontend e dar push:
  - `.env`: `VITE_SUPABASE_URL=https://api.misterticket.com.br`, `VITE_SUPABASE_PUBLISHABLE_KEY=<nova anon>`, `VITE_SUPABASE_PROJECT_ID=<novo ref>`.
  - `index.html`: trocar preconnect `txkwnrrhaahhhpmjjbyl.supabase.co` → `api.misterticket.com.br`.
- [ ] **Step 4: Verificar que o front não referencia mais o backend antigo**

Run: `grep -rn "txkwnrrhaahhhpmjjbyl" .env index.html src`
Expected: nenhum resultado.

- [ ] **Step 5:** Commit + push (Easypanel rebuilda o frontend automaticamente).

```bash
git add .env index.html
git commit -m "feat: aponta frontend para o Supabase self-hospedado"
git push origin main
```

- [ ] **Step 6:** Aguardar deploy do frontend `done` (via `actions.listActions`).
- [ ] **Step 7: Testes ponta-a-ponta (ANTES de desligar manutenção)**
  - Login de **usuário real pré-existente** (valida hash bcrypt).
  - Listar eventos (PostgREST + RLS).
  - Checkout em modo teste (Stripe) → `create-checkout` + `verify-payment`.
  - Receber 1 e-mail (Resend).
  - Realtime: abrir tela com canal e confirmar atualização.
  - Upload de imagem + `getPublicUrl` abre.

Expected: todos passam.

- [ ] **Step 8:** Desligar modo manutenção.

### Task 12: Encerramento

- [ ] **Step 1:** Monitorar erros/recursos por 24-48h (CPU/RAM da VPS, logs das functions).
- [ ] **Step 2:** Após validação, manter o Lovable/Supabase antigo congelado por alguns dias como rollback; depois descomissionar.
- [ ] **Step 3:** Remover o `migrate-helper` do Lovable.

**Rollback (se algo crítico falhar no cutover):** reverter `.env`/`index.html` para o backend antigo, `git push` (rebuild), reativar vendas. O Supabase antigo permanece intacto durante a janela.

---

## Critérios de sucesso (da spec)

- `api.misterticket.com.br` responde via Kong com SSL válido.
- Login de usuário pré-existente sem reset de senha.
- Contagens de linhas por tabela conferem (novo == antigo).
- Checkout, e-mail, realtime e upload funcionam ponta-a-ponta.
- Frontend sem nenhuma referência a `txkwnrrhaahhhpmjjbyl.supabase.co`.
- Backups automáticos configurados e restore validado.
- Zero dependência do Lovable após o período de rollback.
