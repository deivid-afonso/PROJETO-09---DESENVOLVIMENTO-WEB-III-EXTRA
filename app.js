import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function getRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk.toString()));
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

function serveStaticFile(response, file) {
  fs.readFile(file, (err, data) => {
    if (err) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return response.end('404 - Página Não Encontrada');
    }
    const ext = path.extname(file).toLowerCase();
    response.writeHead(200, {
      'Content-Type': contentTypes[ext] || 'application/octet-stream'
    });
    response.end(data);
  });
}

function dbGetAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function dbAllAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

async function validarRegrasReserva(data, reservaIdIgnorar = null) {
  if (!data.sala_id || !data.solicitante || !data.data || !data.hora_inicio || !data.hora_fim) {
    return 'Sala, solicitante, data, horário inicial e horário final são obrigatórios.';
  }

  // Regra 1: Horário final deve ser maior que o horário inicial
  if (data.hora_fim <= data.hora_inicio) {
    return 'O horário de término deve ser posterior ao horário de início.';
  }

  // Regra 2: Verificar existência, status ativo e capacidade da sala
  const sala = await dbGetAsync('SELECT * FROM salas WHERE id = ?', [Number(data.sala_id)]);
  if (!sala) {
    return 'A sala selecionada não existe.';
  }
  if (Number(sala.ativa) === 0) {
    return `A sala "${sala.nome}" está INATIVA e não pode receber novas reservas.`;
  }

  const participantes = Number(data.participantes || 1);
  if (participantes <= 0 || participantes > Number(sala.capacidade)) {
    return `A quantidade de participantes (${participantes}) excede a capacidade máxima da sala "${sala.nome}" (${sala.capacidade} lugares).`;
  }

  // Regra 3: Impedir sobreposição de reservas ativas para a mesma sala e data
  if ((data.status || 'Ativa') === 'Ativa') {
    const conflitos = await dbAllAsync(
      `
      SELECT * FROM reservas
      WHERE sala_id = ?
        AND data = ?
        AND status = 'Ativa'
        AND (? < hora_fim AND ? > hora_inicio)
      `,
      [Number(data.sala_id), data.data, data.hora_inicio, data.hora_fim]
    );

    const conflitoReal = conflitos.find((r) => Number(r.id) !== Number(reservaIdIgnorar));
    if (conflitoReal) {
      return `Conflito de horário: a sala "${sala.nome}" já está reservada das ${conflitoReal.hora_inicio} às ${conflitoReal.hora_fim} por ${conflitoReal.solicitante}.`;
    }
  }

  return null;
}

async function callback(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);
  const method = request.method;

  // ==========================================================================
  // 1. ENDPOINTS REST: /api/salas
  // ==========================================================================
  if (pathname.startsWith('/api/salas')) {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    const id = url.searchParams.get('id') || pathname.split('/')[3] || null;

    if (method === 'POST') {
      try {
        const data = await getRequestBody(request);
        if (!data.nome || !data.capacidade || Number(data.capacidade) <= 0) {
          return response
            .writeHead(400)
            .end(JSON.stringify({ error: 'Nome e capacidade válida são obrigatórios.' }));
        }
        const sql = `
          INSERT INTO salas (nome, bloco, capacidade, recursos, ativa)
          VALUES (?, ?, ?, ?, ?)
        `;
        db.run(
          sql,
          [
            data.nome.trim(),
            data.bloco || 'Bloco A',
            Number(data.capacidade),
            data.recursos || '',
            data.ativa === undefined ? 1 : Number(data.ativa)
          ],
          function (err) {
            if (err) return response.writeHead(500).end(JSON.stringify({ error: err.message }));
            response
              .writeHead(201)
              .end(JSON.stringify({ id: this.lastID, message: 'Sala cadastrada com sucesso!' }));
          }
        );
      } catch (err) {
        response.writeHead(400).end(JSON.stringify({ error: 'Payload inválido.' }));
      }
      return;
    }

    if (method === 'GET') {
      if (id) {
        db.get('SELECT * FROM salas WHERE id = ?', [id], (err, row) => {
          if (err) return response.writeHead(500).end(JSON.stringify({ error: err.message }));
          response.writeHead(200).end(JSON.stringify(row || {}));
        });
      } else {
        db.all('SELECT * FROM salas ORDER BY nome ASC', [], (err, rows) => {
          if (err) return response.writeHead(500).end(JSON.stringify({ error: err.message }));
          response.writeHead(200).end(JSON.stringify(rows));
        });
      }
      return;
    }

    if (method === 'PUT' && id) {
      try {
        const data = await getRequestBody(request);
        const sql = `
          UPDATE salas
          SET nome = ?, bloco = ?, capacidade = ?, recursos = ?, ativa = ?
          WHERE id = ?
        `;
        db.run(
          sql,
          [
            data.nome.trim(),
            data.bloco || 'Bloco A',
            Number(data.capacidade),
            data.recursos || '',
            Number(data.ativa),
            id
          ],
          function (err) {
            if (err) return response.writeHead(500).end(JSON.stringify({ error: err.message }));
            response.writeHead(200).end(JSON.stringify({ message: 'Sala atualizada com sucesso!' }));
          }
        );
      } catch (err) {
        response.writeHead(400).end(JSON.stringify({ error: 'Payload inválido.' }));
      }
      return;
    }

    // Regra de Negócio: Impedir exclusão de sala com reservas vinculadas
    if (method === 'DELETE' && id) {
      db.get('SELECT COUNT(*) AS total FROM reservas WHERE sala_id = ?', [id], (err, row) => {
        if (row && row.total > 0) {
          return response.writeHead(400).end(
            JSON.stringify({
              error: 'Operação bloqueada: não é permitido excluir uma sala que possui reservas vinculadas.'
            })
          );
        }
        db.run('DELETE FROM salas WHERE id = ?', [id], function (delErr) {
          if (delErr) return response.writeHead(500).end(JSON.stringify({ error: delErr.message }));
          response.writeHead(200).end(JSON.stringify({ message: 'Sala excluída com sucesso!' }));
        });
      });
      return;
    }
  }

  // ==========================================================================
  // 2. ENDPOINTS REST: /api/reservas
  // ==========================================================================
  if (pathname.startsWith('/api/reservas')) {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    const id = url.searchParams.get('id') || pathname.split('/')[3] || null;

    if (method === 'POST') {
      try {
        const data = await getRequestBody(request);
        const erroValidacao = await validarRegrasReserva(data, null);
        if (erroValidacao) {
          return response.writeHead(400).end(JSON.stringify({ error: erroValidacao }));
        }

        const sql = `
          INSERT INTO reservas (sala_id, solicitante, finalidade, data, hora_inicio, hora_fim, participantes, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        db.run(
          sql,
          [
            Number(data.sala_id),
            data.solicitante.trim(),
            data.finalidade || 'Aula / Estudo',
            data.data,
            data.hora_inicio,
            data.hora_fim,
            Number(data.participantes),
            data.status || 'Ativa'
          ],
          function (err) {
            if (err) return response.writeHead(500).end(JSON.stringify({ error: err.message }));
            response
              .writeHead(201)
              .end(JSON.stringify({ id: this.lastID, message: 'Reserva registrada com sucesso!' }));
          }
        );
      } catch (err) {
        response.writeHead(400).end(JSON.stringify({ error: 'Payload inválido.' }));
      }
      return;
    }

    if (method === 'GET') {
      if (id) {
        db.get('SELECT * FROM reservas WHERE id = ?', [id], (err, row) => {
          if (err) return response.writeHead(500).end(JSON.stringify({ error: err.message }));
          response.writeHead(200).end(JSON.stringify(row || {}));
        });
      } else {
        const sql = `
          SELECT r.*, s.nome AS sala_nome, s.capacidade AS sala_capacidade
          FROM reservas r
          LEFT JOIN salas s ON r.sala_id = s.id
          ORDER BY r.data DESC, r.hora_inicio ASC
        `;
        db.all(sql, [], (err, rows) => {
          if (err) return response.writeHead(500).end(JSON.stringify({ error: err.message }));
          response.writeHead(200).end(JSON.stringify(rows));
        });
      }
      return;
    }

    if (method === 'PUT' && id) {
      try {
        const data = await getRequestBody(request);
        const erroValidacao = await validarRegrasReserva(data, id);
        if (erroValidacao) {
          return response.writeHead(400).end(JSON.stringify({ error: erroValidacao }));
        }

        const sql = `
          UPDATE reservas
          SET sala_id = ?, solicitante = ?, finalidade = ?, data = ?, hora_inicio = ?, hora_fim = ?, participantes = ?, status = ?
          WHERE id = ?
        `;
        db.run(
          sql,
          [
            Number(data.sala_id),
            data.solicitante.trim(),
            data.finalidade || '',
            data.data,
            data.hora_inicio,
            data.hora_fim,
            Number(data.participantes),
            data.status || 'Ativa',
            id
          ],
          function (err) {
            if (err) return response.writeHead(500).end(JSON.stringify({ error: err.message }));
            response.writeHead(200).end(JSON.stringify({ message: 'Reserva atualizada com sucesso!' }));
          }
        );
      } catch (err) {
        response.writeHead(400).end(JSON.stringify({ error: 'Payload inválido.' }));
      }
      return;
    }

    if (method === 'DELETE' && id) {
      db.run('DELETE FROM reservas WHERE id = ?', [id], function (err) {
        if (err) return response.writeHead(500).end(JSON.stringify({ error: err.message }));
        response.writeHead(200).end(JSON.stringify({ message: 'Reserva excluída com sucesso!' }));
      });
      return;
    }
  }

  const file = path.join(publicDir, pathname === '/' ? 'index.html' : pathname);
  if (!file.startsWith(publicDir)) {
    response.writeHead(403).end('Proibido');
    return;
  }

  serveStaticFile(response, file);
}

const server = http.createServer(callback);
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sistema de Reserva de Salas (Projeto 09 EXTRA - DWIII) iniciado em http://localhost:${PORT}/`);
});
