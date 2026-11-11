import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { auth, claimIncludes } from 'express-oauth2-jwt-bearer';
import { listarAvaliacoes, criarAvaliacao } from './db.js';

const {
  PORT = 3000,
  AUTH0_AUDIENCE,
  AUTH0_ISSUER,
  CORS_ORIGIN = 'http://localhost:5173',
  EMAIL_CLAIM = 'https://avaliacoes-api/email',
} = process.env;

if (!AUTH0_AUDIENCE || !AUTH0_ISSUER) {
  console.error('Defina AUTH0_AUDIENCE e AUTH0_ISSUER no arquivo .env');
  process.exit(1);
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const app = express();
app.use(cors({ origin: CORS_ORIGIN.split(',').map((o) => o.trim()) }));
app.use(express.json());

// Todas as rotas exigem um access token válido emitido pelo Auth0
app.use(auth({ audience: AUTH0_AUDIENCE, issuerBaseURL: AUTH0_ISSUER }));

// Permissões vindas do RBAC do Auth0 (claim "permissions" do access token)
// ADMIN -> create:avaliacoes + read:avaliacoes | USER -> read:avaliacoes
const podeCriar = claimIncludes('permissions', 'create:avaliacoes');
const podeLer = claimIncludes('permissions', 'read:avaliacoes');

app.get('/avaliacoes', podeLer, (req, res) => {
  res.json(listarAvaliacoes());
});

// E-mail do avaliador: vem do custom claim (Action do Auth0) ou, se faltar,
// do endpoint /userinfo do Auth0 usando o próprio access token.
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

app.post('/avaliacoes', podeCriar, async (req, res) => {
  const { emailAvaliado, comentarios = '', nota } = req.body ?? {};
  const emailAvaliador = await emailDoUsuario(req);

  const erros = [];
  if (!emailAvaliador) erros.push('não foi possível obter o e-mail do avaliador a partir do token');
  if (typeof emailAvaliado !== 'string' || !EMAIL_REGEX.test(emailAvaliado)) erros.push('emailAvaliado inválido');
  if (typeof comentarios !== 'string') erros.push('comentarios deve ser texto');
  if (!Number.isInteger(nota) || nota < 0 || nota > 10) erros.push('nota deve ser um inteiro de 0 a 10');
  if (erros.length) return res.status(400).json({ erro: erros.join('; ') });

  const avaliacao = criarAvaliacao({ emailAvaliador, emailAvaliado, comentarios: comentarios.trim(), nota });
  res.status(201).json(avaliacao);
});

// Erros (401 sem token / 403 sem permissão) retornam JSON
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ erro: status === 500 ? 'Erro interno' : err.message });
});

app.listen(PORT, () => console.log(`API de avaliações rodando na porta ${PORT}`));
