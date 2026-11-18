# PROJETO 09 – DESENVOLVIMENTO WEB III (EXTRA: SISTEMA DE RESERVA DE SALAS – CRUD + API)

Aplicação Web desenvolvida em **Node.js, NPM, HTML, CSS e JavaScript (sem frameworks)** com persistência em **SQLite** e integração com a **BrasilAPI (Feriados Nacionais de 2026)** (FATEC Diadema — DSM 3º Semestre, Prof. Vinicius Heltai Pacheco).

---

## 🎯 Funcionalidades e Regras de Negócio

- **CRUD Completo de Salas (`/api/salas`) e Reservas (`/api/reservas`)**.
- **Regras de Negócio Implementadas no Back-end**:
  1. **Conflito de Horário**: Impede reservas ativas sobrepostas para a mesma sala na mesma data.
  2. **Validação Temporal**: Garante que o horário final seja estritamente posterior ao horário inicial (`hora_fim > hora_inicio`).
  3. **Capacidade da Sala**: Bloqueia reservas cujo número de participantes exceda a capacidade máxima da sala.
  4. **Bloqueio de Sala Inativa**: Impede novas reservas em salas com status inativo/em manutenção.
  5. **Integridade Referencial**: Impede a exclusão de salas que possuam reservas vinculadas.
- **Integração com BrasilAPI Feriados (`https://brasilapi.com.br/api/feriados/v1/2026`)**:
  - Verifica automaticamente se a data escolhida no agendamento corresponde a um feriado nacional de 2026.

---

## 🚀 Como Executar

```bash
npm start
# Acesse http://localhost:3000 no navegador
```
