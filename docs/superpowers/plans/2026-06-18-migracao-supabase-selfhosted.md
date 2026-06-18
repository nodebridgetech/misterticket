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

## Chunk 2: Estrutura (schema) e configuração do GoTrue

### Task 4: Aplicar as migrations do repo no Postgres novo

**Files:**
- Reference: `supabase/migrations/*.sql` (30+ arquivos), `supabase/config.toml`

- [ ] **Step 1:** Obter a connection string do Postgres novo (do Easypanel: host interno + `POSTGRES_PASSWORD`). Exportar como `PG_NEW` local.
- [ ] **Step 2: Aplicar migrations em ordem cronológica**

Run (via `psql` ou Supabase CLI `db push` apontando para o destino):
```bash
for f in $(ls supabase/migrations/*.sql | sort); do echo ">> $f"; psql "$PG_NEW" -v ON_ERROR_STOP=1 -f "$f" || break; done
```
Expected: todos aplicam sem erro. Schemas `auth` e `storage` já existem (criados por gotrue/storage-api).

- [ ] **Step 3: Verificar tabelas e bucket criados**

Run:
```bash
psql "$PG_NEW" -c "select count(*) from information_schema.tables where table_schema='public';"
psql "$PG_NEW" -c "select id,public from storage.buckets where id='event-images';"
```
Expected: 19 tabelas em `public`; bucket `event-images` com `public=true` (vem da migration `20251110041625`).

- [ ] **Step 4: Verificar policies RLS presentes**

Run: `psql "$PG_NEW" -c "select schemaname,tablename,policyname from pg_policies where schemaname in ('public','storage') limit 5;"`
Expected: policies listadas (RLS aplicado).

### Task 5: Configurar GoTrue (auth)

**Files:** nenhum (envs do serviço gotrue no Easypanel)

- [ ] **Step 1:** Setar `GOTRUE_SITE_URL=https://misterticket.com.br`.
- [ ] **Step 2:** Setar `GOTRUE_URI_ALLOW_LIST` com os redirects usados pelo app (rotas de `Auth.tsx`, `ProducerAuth.tsx`, confirmação/reset). Ex.: `https://misterticket.com.br/**`.
- [ ] **Step 3:** Configurar SMTP do GoTrue OU confirmar que e-mails de auth saem via funções Resend (o app usa `send-password-reset`); manter consistente com produção atual.
- [ ] **Step 4: Redeploy do gotrue e verificar health**

Run: `curl -s -o /dev/null -w "%{http_code}\n" https://api.misterticket.com.br/auth/v1/health`
Expected: `200`.

---

## Chunk 3: Migração de dados, usuários e storage

### Task 6: Implantar o migrate-helper no Lovable e exportar

**Files:** nenhum (no projeto Lovable)

- [ ] **Step 1:** No Lovable Cloud → Edge Functions → implantar `migrate-helper` (conforme [dreamlit](https://github.com/dreamlit-ai/lovable-cloud-to-supabase-exporter)). Definir a **chave de acesso de uso único**.
- [ ] **Step 2:** Copiar a URL do endpoint do `migrate-helper`.
- [ ] **Step 3:** Confirmar a **major version do Postgres** do Lovable (o helper/CLI reporta) e conferir que bate com a do stack novo (Task 2a Step 3). Se divergir, ajustar a versão do stack novo antes de prosseguir.
- [ ] **Step 4: Exportar (snapshot inicial, fora da janela — para validar o processo)**

Run (CLI da dreamlit ou UI web, apontando destino = `api.misterticket.com.br` + `SERVICE_ROLE_KEY` novo):
```bash
# exemplo conceitual; comando exato conforme a ferramenta
lovable-export --source-url <migrate-helper-url> --access-key <key> \
  --target-url https://api.misterticket.com.br --target-service-role <SERVICE_ROLE_NEW> \
  --include tables,auth,storage --schema-mode skip   # schema já veio das migrations
```
Expected: relatório com nº de tabelas, usuários e arquivos exportados.

### Task 7: Importar usuários (auth.users) primeiro

**Files:** nenhum (psql/ferramenta)

- [ ] **Step 1:** Importar linhas de `auth.users` preservando `id` e `encrypted_password` (hash bcrypt). Rodar como `service_role`/`postgres` (RLS ignorado).
- [ ] **Step 2: Verificar contagem de usuários**

Run: `psql "$PG_NEW" -c "select count(*) from auth.users;"`
Expected: igual ao reportado no export.

### Task 8: Importar dados das tabelas public

**Files:** nenhum

- [ ] **Step 1:** Desativar triggers durante a carga: `SET session_replication_role = replica;` (ou desabilitar por tabela).
- [ ] **Step 2:** Inserir dados respeitando ordem de FKs (usuários já estão; tabelas `public` referenciam `auth.users`).
- [ ] **Step 3:** Reativar triggers: `SET session_replication_role = origin;`
- [ ] **Step 4:** Acertar sequences/identity: rodar `setval` para cada coluna serial conforme max(id).
- [ ] **Step 5: Verificar contagens por tabela (novo vs antigo)**

Run: comparar `select count(*)` de cada uma das 19 tabelas com os números do export.
Expected: batem 100%.

### Task 9: Importar storage (arquivos + metadados)

**Files:** nenhum

- [ ] **Step 1:** **Não recriar** o bucket `event-images` (já existe da migration). Subir os arquivos para o storage novo via `service_role` (ignora policy de upload), preservando os caminhos.
- [ ] **Step 2:** Restaurar as linhas de `storage.objects` correspondentes aos arquivos.
- [ ] **Step 3: Verificar objetos e acesso público**

Run:
```bash
psql "$PG_NEW" -c "select count(*) from storage.objects where bucket_id='event-images';"
curl -s -o /dev/null -w "%{http_code}\n" "https://api.misterticket.com.br/storage/v1/object/public/event-images/<arquivo-conhecido>"
```
Expected: contagem == export; HTTP `200` no arquivo.

---

## Chunk 4: Edge Functions

### Task 10: Ajustar URLs hardcoded nas funções

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

### Task 11: Deploy das 10 functions com secrets

**Files:** nenhum (deploy via Supabase CLI/edge-runtime + secrets no Easypanel)

- [ ] **Step 1:** Configurar secrets no edge-runtime: `STRIPE_SECRET_KEY` (P1), `RESEND_API_KEY` (P2), `SUPABASE_URL=https://api.misterticket.com.br`, `SUPABASE_SERVICE_ROLE_KEY` (novo), `SUPABASE_ANON_KEY` (novo).
- [ ] **Step 2:** Deploy das 10 funções, replicando `config.toml` **literalmente** (`verify_jwt=false` só em `process-withdrawal` e `send-withdrawal-notification`; as outras 8 padrão `true`).
- [ ] **Step 3: Verificar funções respondem**

Run (exemplo, função simples):
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS "https://api.misterticket.com.br/functions/v1/create-checkout"
```
Expected: `200`/`204` (CORS preflight ok).

---

## Chunk 5: Cutover, backups e rollback

### Task 12: Configurar backups (antes do cutover)

**Files:** nenhum (Easypanel backups / cron)

- [ ] **Step 1:** Configurar backup automático do volume do Postgres (Easypanel volume backup) OU cron `pg_dump` para storage externo.
- [ ] **Step 2:** Configurar backup do volume do storage.
- [ ] **Step 3: Validar 1 restore** (restaurar dump num banco temporário e conferir contagens).
Expected: restore íntegro — critério de sucesso da spec.

### Task 13: Cutover (na janela de manutenção P5)

**Files:**
- Modify: `.env` (vars do frontend)
- Modify: `index.html:6` (preconnect)

- [ ] **Step 1:** Ativar modo manutenção (build com flag de manutenção OU pausar vendas pela UI admin).
- [ ] **Step 2:** Rodar **export final** via `migrate-helper` (delta desde o snapshot inicial) e importar (repetir Tasks 7-9 para novos registros).
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
- [ ] **Step 7: Testes ponta-a-ponta (ANTES de desligar manutenção / antes do DNS final se aplicável)**
  - Login de **usuário real pré-existente** (valida hash bcrypt).
  - Listar eventos (PostgREST + RLS).
  - Checkout em modo teste (Stripe) → `create-checkout` + `verify-payment`.
  - Receber 1 e-mail (Resend).
  - Realtime: abrir tela com canal e confirmar atualização.
  - Upload de imagem + `getPublicUrl` abre.

Expected: todos passam.

- [ ] **Step 8:** Desligar modo manutenção.

### Task 14: Encerramento

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
