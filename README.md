# Sistema de Avaliações

API de avaliações em que um usuário avalia outras pessoas da empresa. Todas as rotas são autenticadas pelo **Auth0**.

| Rota | Descrição | Quem acessa |
|---|---|---|
| `POST /avaliacoes` | cadastrar avaliação | ADMIN |
| `GET /avaliacoes` | listar avaliações | ADMIN e USER |

**Entidade Avaliação:** `id`, `emailAvaliador` (vem do token de quem está logado), `emailAvaliado`, `comentarios`, `nota` (0 a 10), `dataAvaliacao` (gerada pelo servidor).

```
backend/    API Node.js + Express + SQLite → AWS EC2 (deploy via GitHub Actions)
frontend/   React + Vite + Auth0 → Vercel
.github/workflows/deploy-backend.yml
```

---

## 1. Auth0

1. **Applications → APIs → Create API**
   - Identifier (audience): `https://avaliacoes-api`
   - Settings → RBAC: ligar **Enable RBAC** e **Add Permissions in the Access Token**
   - Permissions: `create:avaliacoes` e `read:avaliacoes`
2. **User Management → Roles**
   - `ADMIN` → `create:avaliacoes`, `read:avaliacoes`
   - `USER` → `read:avaliacoes`
3. **User Management → Users**: criar um usuário ADMIN e outro USER e atribuir as roles.
4. **Applications → Create Application → Single Page Application**
   - Allowed Callback URLs / Logout URLs / Web Origins: `http://localhost:5173, https://SEU-APP.vercel.app`
5. **Actions → Library → Create Action (Login / Post Login)**, depois *Deploy* e arrastar para **Triggers → post-login**:
   ```js
   exports.onExecutePostLogin = async (event, api) => {
     api.accessToken.setCustomClaim('https://avaliacoes-api/email', event.user.email);
   };
   ```

## 2. Rodando localmente

```bash
cd backend
cp .env.example .env   # preencher AUTH0_ISSUER
npm install
npm run dev
```

```bash
cd frontend
cp .env.example .env   # preencher domain e client id
npm install
npm run dev
```

Abra http://localhost:5173. O ADMIN vê o formulário e a lista; o USER vê só a lista (e a API devolve 403 se ele tentar cadastrar).

## 3. EC2 (AWS)

1. Ubuntu 24.04, `t2.micro`/`t3.micro`. Security Group liberando as portas **22** e **3000**.
2. Na máquina:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs git build-essential
   sudo npm install -g pm2
   git clone https://github.com/Adrielle720/Prova_final_proSoft.git ~/Prova_final_proSoft
   cd ~/Prova_final_proSoft/backend
   cp .env.example .env && nano .env
   npm ci --omit=dev
   pm2 start src/index.js --name avaliacoes-api
   pm2 save && pm2 startup   # rode o comando sudo que ele imprimir
   ```

## 4. GitHub Actions

Em **Settings → Secrets and variables → Actions**, crie:

| Secret | Valor |
|---|---|
| `EC2_HOST` | IP público da EC2 |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | conteúdo do arquivo `.pem` |

Todo push na `main` que mexer em `backend/` faz o deploy (também dá pra rodar manualmente em *Actions → Run workflow*).

## 5. Vercel

1. Edite `frontend/vercel.json` trocando `IP_DA_EC2` pelo IP da máquina. A Vercel faz proxy de `/api/*` para a EC2, evitando o bloqueio de *mixed content* (HTTPS → HTTP).
2. Na Vercel: **Add New → Project**, importar o repositório, **Root Directory = `frontend`**.
3. Environment Variables: `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE` e `VITE_API_URL=/api`.
4. Adicionar a URL da Vercel no Auth0 (passo 1.4) e no `CORS_ORIGIN` do `.env` da EC2.
