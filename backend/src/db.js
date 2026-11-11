import Database from 'better-sqlite3';

const db = new Database(process.env.DB_PATH || 'avaliacoes.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS avaliacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emailAvaliador TEXT NOT NULL,
    emailAvaliado TEXT NOT NULL,
    comentarios TEXT NOT NULL DEFAULT '',
    nota INTEGER NOT NULL CHECK (nota BETWEEN 0 AND 10),
    dataAvaliacao TEXT NOT NULL
  )
`);

export function listarAvaliacoes() {
  return db.prepare('SELECT * FROM avaliacoes ORDER BY dataAvaliacao DESC').all();
}

export function criarAvaliacao({ emailAvaliador, emailAvaliado, comentarios, nota }) {
  const dataAvaliacao = new Date().toISOString();
  const r = db
    .prepare(
      `INSERT INTO avaliacoes (emailAvaliador, emailAvaliado, comentarios, nota, dataAvaliacao)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(emailAvaliador, emailAvaliado, comentarios, nota, dataAvaliacao);

  return { id: Number(r.lastInsertRowid), emailAvaliador, emailAvaliado, comentarios, nota, dataAvaliacao };
}
