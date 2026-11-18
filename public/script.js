let feriados2026 = [];

function mostrarMsg(el, texto, ok = true) {
  el.style.display = 'block';
  el.style.background = ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)';
  el.textContent = texto;
}

// Integração BrasilAPI Feriados Nacionais 2026 (https://brasilapi.com.br/api/feriados/v1/2026)
async function carregarFeriadosBrasilAPI() {
  try {
    const res = await fetch('https://brasilapi.com.br/api/feriados/v1/2026');
    if (res.ok) {
      feriados2026 = await res.json();
    }
  } catch (err) {
    console.warn('BrasilAPI Feriados indisponível no momento:', err);
  }
}

document.getElementById('dataReserva').addEventListener('change', (e) => {
  const dataEscolhida = e.target.value;
  const alertaEl = document.getElementById('alertaFeriado');
  const feriado = feriados2026.find((f) => f.date === dataEscolhida);
  if (feriado) {
    mostrarMsg(
      alertaEl,
      `⚠️ Atenção (BrasilAPI): A data selecionada (${dataEscolhida}) é feriado nacional: ${feriado.name}!`,
      false
    );
  } else {
    alertaEl.style.display = 'none';
  }
});

async function carregarSalas() {
  const res = await fetch('/api/salas');
  const salas = await res.json();
  const tbody = document.getElementById('tabelaSalas');
  const select = document.getElementById('salaReserva');

  tbody.innerHTML = salas
    .map(
      (s) => `
    <tr>
      <td>#${s.id}</td>
      <td><strong>${s.nome}</strong></td>
      <td>${s.bloco || '-'}</td>
      <td>${s.capacidade} lugares</td>
      <td>${s.recursos || '-'}</td>
      <td>
        ${
          Number(s.ativa) === 1
            ? '<span class="badge-ativa">ATIVA</span>'
            : '<span class="badge-inativa">INATIVA</span>'
        }
      </td>
      <td>
        <button class="btn btn-edit" onclick="editarSala(${s.id})">Editar</button>
        <button class="btn btn-del" onclick="excluirSala(${s.id})">Excluir</button>
      </td>
    </tr>
  `
    )
    .join('');

  select.innerHTML =
    '<option value="">-- Selecione a Sala --</option>' +
    salas
      .map(
        (s) =>
          `<option value="${s.id}">${s.nome} (Cap: ${s.capacidade} | ${
            Number(s.ativa) === 1 ? 'Ativa' : 'Inativa'
          })</option>`
      )
      .join('');
}

document.getElementById('formSala').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('salaId').value;
  const payload = {
    nome: document.getElementById('nomeSala').value.trim(),
    bloco: document.getElementById('blocoSala').value.trim(),
    capacidade: Number(document.getElementById('capacidadeSala').value),
    recursos: document.getElementById('recursosSala').value.trim(),
    ativa: Number(document.getElementById('ativaSala').value)
  };

  const url = id ? `/api/salas?id=${id}` : '/api/salas';
  const method = id ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  mostrarMsg(document.getElementById('msgSala'), data.message || data.error, res.ok);
  if (res.ok) {
    e.target.reset();
    document.getElementById('salaId').value = '';
    carregarSalas();
  }
});

window.editarSala = async function (id) {
  const res = await fetch(`/api/salas?id=${id}`);
  const s = await res.json();
  document.getElementById('salaId').value = s.id;
  document.getElementById('nomeSala').value = s.nome;
  document.getElementById('blocoSala').value = s.bloco || '';
  document.getElementById('capacidadeSala').value = s.capacidade;
  document.getElementById('recursosSala').value = s.recursos || '';
  document.getElementById('ativaSala').value = String(s.ativa);
};

window.excluirSala = async function (id) {
  if (!confirm('Confirma a exclusão desta sala?')) return;
  const res = await fetch(`/api/salas?id=${id}`, { method: 'DELETE' });
  const data = await res.json();
  mostrarMsg(document.getElementById('msgSala'), data.message || data.error, res.ok);
  carregarSalas();
};

async function carregarReservas() {
  const res = await fetch('/api/reservas');
  const reservas = await res.json();
  const tbody = document.getElementById('tabelaReservas');

  tbody.innerHTML = reservas
    .map(
      (r) => `
    <tr>
      <td>#${r.id}</td>
      <td><strong>${r.sala_nome || `Sala #${r.sala_id}`}</strong></td>
      <td>${r.solicitante}</td>
      <td>${r.finalidade || '-'}</td>
      <td>${r.data}</td>
      <td>${r.hora_inicio} às ${r.hora_fim}</td>
      <td>${r.participantes} / ${r.sala_capacidade || '?'}</td>
      <td>
        <span class="${r.status === 'Ativa' ? 'badge-ativa' : 'badge-inativa'}">${r.status}</span>
      </td>
      <td>
        <button class="btn btn-edit" onclick="editarReserva(${r.id})">Editar</button>
        <button class="btn btn-del" onclick="excluirReserva(${r.id})">Excluir</button>
      </td>
    </tr>
  `
    )
    .join('');
}

document.getElementById('formReserva').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('reservaId').value;
  const payload = {
    sala_id: Number(document.getElementById('salaReserva').value),
    solicitante: document.getElementById('solicitanteReserva').value.trim(),
    finalidade: document.getElementById('finalidadeReserva').value.trim(),
    data: document.getElementById('dataReserva').value,
    hora_inicio: document.getElementById('horaInicioReserva').value,
    hora_fim: document.getElementById('horaFimReserva').value,
    participantes: Number(document.getElementById('participantesReserva').value),
    status: document.getElementById('statusReserva').value
  };

  const url = id ? `/api/reservas?id=${id}` : '/api/reservas';
  const method = id ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  mostrarMsg(document.getElementById('msgReserva'), data.message || data.error, res.ok);
  if (res.ok) {
    e.target.reset();
    document.getElementById('reservaId').value = '';
    carregarReservas();
  }
});

window.editarReserva = async function (id) {
  const res = await fetch(`/api/reservas?id=${id}`);
  const r = await res.json();
  document.getElementById('reservaId').value = r.id;
  document.getElementById('salaReserva').value = r.sala_id;
  document.getElementById('solicitanteReserva').value = r.solicitante;
  document.getElementById('finalidadeReserva').value = r.finalidade || '';
  document.getElementById('dataReserva').value = r.data;
  document.getElementById('horaInicioReserva').value = r.hora_inicio;
  document.getElementById('horaFimReserva').value = r.hora_fim;
  document.getElementById('participantesReserva').value = r.participantes;
  document.getElementById('statusReserva').value = r.status;
};

window.excluirReserva = async function (id) {
  if (!confirm('Deseja realmente excluir esta reserva?')) return;
  await fetch(`/api/reservas?id=${id}`, { method: 'DELETE' });
  carregarReservas();
};

carregarFeriadosBrasilAPI();
carregarSalas();
carregarReservas();
