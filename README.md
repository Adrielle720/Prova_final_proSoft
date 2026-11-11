# Gerenciador de Tarefas

Sistema onde os usuários criam e gerenciam tarefas de um projeto. Todas as requisições são autenticadas pelo **Auth0** e os dados ficam em **PostgreSQL**.

| Rota | Descrição |
|---|---|
| `POST /tarefa` | cria uma tarefa (`titulo`, `descricao`, `prioridade`, `projeto`). O e-mail de quem criou vem do login. |
| `DELETE /tarefa?id=1` | deleta uma tarefa (também aceita `DELETE /tarefa/1` ou body `{ "id": 1 }`) |
| `GET /tarefa` | lista todas as tarefas |

**Tabela `tarefa`:** `id`, `projeto`, `titulo`, `descricao`, `prioridade` (`baixa` / `media` / `alta`), `email` (do usuário logado), `criada_em`.

```
backend/    Node.js + Express + Postgres (pg) → AWS EC2 (deploy via GitHub Actions)
frontend/   React + Vite + Auth0 → Vercel (proxy /api → EC2)
.github/workflows/deploy-backend.yml
```

---

## 1. Auth0

1. **Applications → APIs → Create API** com Identifier (audience) `https://avaliacoes-api`.
2. Na aba **Settings** da API, em *Application Access Policy*, deixar **User-delegated Access = All apps allowed**.
3. **Applications → Create Application → Single Page Application**.
   - Allowed Callback URLs / Logout URLs / Web Origins: `http://localhost:5173, https://SEU-APP.vercel.app`
4. (Opcional) **Actions → Library → Create Action (Login / Post Login)**, *Deploy* e arrastar para **Triggers → post-login**:
   ```js
   exports.onExecutePostLogin = async (event, api) => {
     api.accessToken.setCustomClaim('https://avaliacoes-api/email', event.user.email);
   };
   ```
   Sem essa Action a API busca o e-mail no endpoint `/userinfo` do Auth0.

## 2. Rodando localmente

Crie o banco (uma vez):
```bash
psql -U postgres -c "CREATE DATABASE tarefas;"
```

```bash
cd backend
cp .env.example .env   # preencher DATABASE_URL e AUTH0_ISSUER
npm install
npm run dev
```

```bash
cd frontend
cp .env.example .env   # preencher domain e client id
npm install
npm run dev
```

Abra http://localhost:5173, faça login, crie, liste e delete tarefas. A tabela é criada automaticamente na primeira execução da API.

## 3. EC2 (AWS)

1. Ubuntu 24.04. Security Group liberando as portas **22** e **3000**.
2. Postgres em Docker:
   ```bash
   sudo docker run -d --name postgres-tarefas --restart always \
     -e POSTGRES_PASSWORD=SENHA -e POSTGRES_DB=tarefas \
     -p 127.0.0.1:5433:5432 postgres:16
   ```
3. Node, pm2 e a API:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt install -y nodejs git
   sudo npm install -g pm2
   git clone https://github.com/Adrielle720/Prova_final_proSoft.git ~/Prova_final_proSoft
   cd ~/Prova_final_proSoft/backend
   cp .env.example .env && nano .env   # DATABASE_URL=postgres://postgres:SENHA@localhost:5433/tarefas
   npm ci --omit=dev
   pm2 start src/index.js --name tarefas-api
   pm2 save && pm2 startup   # rode o comando sudo que ele imprimir
   ```

## 4. GitHub Actions

Em **Settings → Secrets and variables → Actions**, crie:

| Secret | Valor |
|---|---|
| `EC2_HOST` | IP público da EC2 |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | conteúdo do arquivo `.pem` |

Todo push na `main` que mexer em `backend/` faz o deploy (ou rode manualmente em *Actions → Run workflow*).

## 5. Vercel (com proxy para o back)

1. Em `frontend/vercel.json`, `/api/*` é repassado para `http://IP_DA_EC2:3000/*`. Assim o navegador só fala HTTPS com a Vercel e não há bloqueio de *mixed content*.
2. Na Vercel: **Add New → Project**, importar o repositório, **Root Directory = `frontend`**.
3. Environment Variables: `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE` e `VITE_API_URL=/api`.
4. Adicionar a URL da Vercel no Auth0 (passo 1.3) e no `CORS_ORIGIN` do `.env` da EC2.
