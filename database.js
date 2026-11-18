import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'database.sqlite');

const sqlite = new DatabaseSync(dbPath);

const db = {
  run(sql, params = [], callback) {
    const cb = typeof params === 'function' ? params : callback;
    const bindParams = Array.isArray(params) ? params : [];
    try {
      const stmt = sqlite.prepare(sql);
      const result = stmt.run(...bindParams);
      if (cb) {
        cb.call({ lastID: Number(result.lastInsertRowid), changes: result.changes }, null);
      }
    } catch (err) {
      if (cb) cb.call({}, err);
    }
  },
  get(sql, params = [], callback) {
    const cb = typeof params === 'function' ? params : callback;
    const bindParams = Array.isArray(params) ? params : [];
    try {
      const stmt = sqlite.prepare(sql);
      const row = stmt.get(...bindParams);
      if (cb) cb(null, row);
    } catch (err) {
      if (cb) cb(err, null);
    }
  },
  all(sql, params = [], callback) {
    const cb = typeof params === 'function' ? params : callback;
    const bindParams = Array.isArray(params) ? params : [];
    try {
      const stmt = sqlite.prepare(sql);
      const rows = stmt.all(...bindParams);
      if (cb) cb(null, rows);
    } catch (err) {
      if (cb) cb(err, null);
    }
  }
};

db.run(`
  CREATE TABLE IF NOT EXISTS salas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    bloco TEXT,
    capacidade INTEGER NOT NULL,
    recursos TEXT,
    ativa INTEGER NOT NULL DEFAULT 1
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS reservas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sala_id INTEGER NOT NULL,
    solicitante TEXT NOT NULL,
    finalidade TEXT,
    data TEXT NOT NULL,
    hora_inicio TEXT NOT NULL,
    hora_fim TEXT NOT NULL,
    participantes INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'Ativa',
    FOREIGN KEY (sala_id) REFERENCES salas(id)
  )
`);

console.log('Conectado ao banco SQLite (database.sqlite) - Sistema de Reserva de Salas.');

export default db;
