import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { auth } from 'express-oauth2-jwt-bearer';
import { iniciarBanco, listarTarefas, criarTarefa, deletarTarefa } from './db.js';

const {
  PORT = 3000,
  AUTH0_AUDIENCE,
  AUTH0_ISSUER,
  DATABASE_URL,
  CORS_ORIGIN = 'http://localhost:5173',
  EMAIL_CLAIM = 'https://avaliacoes-api/email',
} = process.env;

if (!AUTH0_AUDIENCE || !AUTH0_ISSUER || !DATABASE_URL) {
  console.error('Defina AUTH0_AUDIENCE, AUTH0_ISSUER e DATABASE_URL no arquivo .env');
  process.exit(1);
}

const PRIORIDADES = ['baixa', 'media', 'alta'];

const app = express();
app.use(cors({ origin: CORS_ORIGIN.split(',').map((o) => o.trim()) }));
app.use(express.json());

// Todas as rotas exigem um access token válido emitido pelo Auth0
app.use(auth({ audience: AUTH0_AUDIENCE, issuerBaseURL: AUTH0_ISSUER }));

// E-mail de quem está logado: vem do custom claim (Action do Auth0) ou,
// se faltar, do endpoint /userinfo do Auth0 usando o próprio access token.
const cacheEmails = new Map();
async function emailDoUsuario(req) {
  const doClaim = req.auth.payload[EMAIL_CLAIM];
  if (doClaim) return doClaim;

  const sub = req.auth.payload.sub;
  if (cacheEmails.has(sub)) return cacheEmails.get(sub);

  const resp = await fetch(new URL('userinfo', AUTH0_ISSUER), {
    headers: { Authorization: req.headers.authorization },
  });
  if (!resp.ok) return null;
  const { email } = await resp.json();
  if (email) cacheEmails.set(sub, email);
  return email ?? null;
}

// GET /tarefa -> lista todas as tarefas
app.get('/tarefa', async (req, res) => {
  res.json(await listarTarefas());
});

// POST /tarefa -> cria uma tarefa (o e-mail do criador vem do login)
app.post('/tarefa', async (req, res) => {
  const { titulo, descricao = '', prioridade, projeto = 'Geral' } = req.body ?? {};
  const email = await emailDoUsuario(req);

  const erros = [];
  if (!email) erros.push('não foi possível obter o e-mail do usuário a partir do token');
  if (typeof titulo !== 'string' || !titulo.trim()) erros.push('titulo é obrigatório');
  if (typeof descricao !== 'string') erros.push('descricao deve ser texto');
  if (!PRIORIDADES.includes(prioridade)) erros.push(`prioridade deve ser: ${PRIORIDADES.join(', ')}`);
  if (typeof projeto !== 'string' || !projeto.trim()) erros.push('projeto deve ser texto');
  if (erros.length) return res.status(400).json({ erro: erros.join('; ') });

  const tarefa = await criarTarefa({
    projeto: projeto.trim(),
    titulo: titulo.trim(),
    descricao: descricao.trim(),
    prioridade,
    email,
  });
  res.status(201).json(tarefa);
});

// DELETE /tarefa?id=1  (também aceita DELETE /tarefa/1 ou body { "id": 1 })
async function deletar(req, res) {
  const id = Number(req.params.id ?? req.query.id ?? req.body?.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ erro: 'informe o id da tarefa' });

  const removida = await deletarTarefa(id);
  if (!removida) return res.status(404).json({ erro: 'tarefa não encontrada' });
  res.json(removida);
}
app.delete('/tarefa', deletar);
app.delete('/tarefa/:id', deletar);

// Erros (401 sem token, 400, 500) retornam JSON
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ erro: status === 500 ? 'Erro interno' : err.message });
});

await iniciarBanco();
app.listen(PORT, () => console.log(`API de tarefas rodando na porta ${PORT}`));
