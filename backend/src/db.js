import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export async function iniciarBanco() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tarefa (
      id          SERIAL PRIMARY KEY,
      projeto     TEXT        NOT NULL DEFAULT 'Geral',
      titulo      TEXT        NOT NULL,
      descricao   TEXT        NOT NULL DEFAULT '',
      prioridade  TEXT        NOT NULL CHECK (prioridade IN ('baixa', 'media', 'alta')),
      email       TEXT        NOT NULL,
      criada_em   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function listarTarefas() {
  const { rows } = await pool.query('SELECT * FROM tarefa ORDER BY criada_em DESC');
  return rows;
}

export async function criarTarefa({ projeto, titulo, descricao, prioridade, email }) {
  const { rows } = await pool.query(
    `INSERT INTO tarefa (projeto, titulo, descricao, prioridade, email)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [projeto, titulo, descricao, prioridade, email]
  );
  return rows[0];
}

export async function deletarTarefa(id) {
  const { rows } = await pool.query('DELETE FROM tarefa WHERE id = $1 RETURNING *', [id]);
  return rows[0] ?? null;
}
