/* ========================================
   dashboard.js — Dashboard e alertas
   ======================================== */

const Dashboard = {
  /**
   * Renderiza o dashboard completo
   */
  async render() {
    await Dashboard.renderStats();
    await Dashboard.renderAlertPartos();
    await Dashboard.renderAlertMedicacoes();
  },

  /**
   * Renderiza as estatísticas por categoria
   */
  async renderStats() {
    const animais = await DB.getAnimaisAtivos();

    const counts = {
      vaca: 0, touro: 0, novilha: 0, novilho: 0, terneira: 0, terneiro: 0
    };

    animais.forEach(a => {
      if (counts[a.categoria] !== undefined) {
        counts[a.categoria]++;
      }
    });

    const total = animais.length;

    const grid = document.getElementById('statsGrid');
    grid.innerHTML = `
      <div class="stat-card">
        <div class="stat-number">${total}</div>
        <div class="stat-label">Total</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${counts.vaca}</div>
        <div class="stat-label">Vacas</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${counts.touro}</div>
        <div class="stat-label">Touros</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${counts.novilha}</div>
        <div class="stat-label">Novilhas</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${counts.novilho}</div>
        <div class="stat-label">Novilhos</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${counts.terneira + counts.terneiro}</div>
        <div class="stat-label">Terneiros</div>
      </div>
    `;
  },

  /**
   * Renderiza alertas de partos previstos nos próximos 30 dias
   */
  async renderAlertPartos() {
    const cios = await DB.getCios();
    const today = Utils.today();
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    const limit = in30Days.toISOString().split('T')[0];

    const upcoming = cios.filter(c =>
      (c.status === 'aguardando' || c.status === 'confirmada') &&
      c.previsao_parto >= today &&
      c.previsao_parto <= limit
    );

    upcoming.sort((a, b) => a.previsao_parto.localeCompare(b.previsao_parto));

    const container = document.getElementById('alertPartosContent');

    if (upcoming.length === 0) {
      container.innerHTML = '<p class="no-alerts">Nenhum parto previsto nos próximos 30 dias</p>';
    } else {
      container.innerHTML = upcoming.map(c => {
        const dias = Utils.diffDays(today, c.previsao_parto);
        return `
          <div class="alert-item alert-parto" onclick="App.navigate('ficha', '${c.animal_id}')">
            <strong>${c.codigo_vaca}</strong> — Parto previsto em ${Utils.formatDate(c.previsao_parto)}
            (${dias} dia${dias !== 1 ? 's' : ''})
            ${c.status === 'confirmada' ? '<span class="badge badge-confirmada">confirmada</span>' : ''}
          </div>
        `;
      }).join('');
    }
  },

  /**
   * Renderiza alertas de medicações atrasadas
   * Usa a data de "próxima aplicação" para determinar atraso
   */
  async renderAlertMedicacoes() {
    const animais = await DB.getAnimaisAtivos();
    const medicacoes = await DB.getMedicacoes();
    const today = Utils.today();

    // Find overdue medications per animal (proxima_aplicacao already passed)
    // Also find animals that were never medicated
    const alertas = [];

    // Build map: animal_id -> list of medications
    const medByAnimal = {};
    medicacoes.forEach(m => {
      if (!medByAnimal[m.animal_id]) medByAnimal[m.animal_id] = [];
      medByAnimal[m.animal_id].push(m);
    });

    animais.forEach(a => {
      const meds = medByAnimal[a.id];

      if (!meds || meds.length === 0) {
        // Never medicated — alert if registered for more than 30 days
        const daysSinceCadastro = Utils.diffDays(a.data_cadastro, today);
        if (daysSinceCadastro >= 30) {
          alertas.push({
            animal: a,
            dias: daysSinceCadastro,
            message: 'Nunca medicado',
            severity: 'warning'
          });
        }
        return;
      }

      // Check for overdue medications (proxima_aplicacao < today)
      const overdue = [];
      meds.forEach(m => {
        if (m.proxima_aplicacao && m.proxima_aplicacao < today) {
          const diasAtraso = Utils.diffDays(m.proxima_aplicacao, today);
          overdue.push({
            medicacao: m.nome_medicacao,
            tipo: m.tipo,
            diasAtraso,
            prevista: m.proxima_aplicacao
          });
        }
      });

      if (overdue.length > 0) {
        // Sort by most overdue
        overdue.sort((a, b) => b.diasAtraso - a.diasAtraso);
        const worst = overdue[0];
        alertas.push({
          animal: a,
          dias: worst.diasAtraso,
          message: overdue.length === 1
            ? `${worst.medicacao} atrasada ${worst.diasAtraso} dia${worst.diasAtraso !== 1 ? 's' : ''} (prevista: ${Utils.formatDate(worst.prevista)})`
            : `${overdue.length} medicações atrasadas (pior: ${worst.medicacao}, ${worst.diasAtraso} dias)`,
          severity: worst.diasAtraso > 30 ? 'danger' : 'warning'
        });
      }
    });

    alertas.sort((a, b) => b.dias - a.dias);

    const container = document.getElementById('alertMedicacoesContent');

    if (alertas.length === 0) {
      container.innerHTML = '<p class="no-alerts">Todos os animais estão com medicação em dia!</p>';
    } else {
      container.innerHTML = alertas.map(a => `
        <div class="alert-item alert-medicacao ${a.severity === 'danger' ? 'alert-danger' : ''}" onclick="App.navigate('ficha', '${a.animal.id}')">
          <strong>${a.animal.codigo}</strong> — ${a.animal.nome}: ${a.message}
        </div>
      `).join('');
    }
  }
};
