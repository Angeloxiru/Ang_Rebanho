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
   * Renderiza alertas de animais sem medicação recente
   */
  async renderAlertMedicacoes() {
    const alertaDias = parseInt(await DB.getConfig('alerta_medicacao_dias') || '60', 10);
    const animais = await DB.getAnimaisAtivos();
    const medicacoes = await DB.getMedicacoes();
    const today = Utils.today();

    // Find last medication date for each animal
    const lastMed = {};
    medicacoes.forEach(m => {
      if (!lastMed[m.animal_id] || m.data_aplicacao > lastMed[m.animal_id]) {
        lastMed[m.animal_id] = m.data_aplicacao;
      }
    });

    const alertas = [];
    animais.forEach(a => {
      const lastDate = lastMed[a.id];
      if (!lastDate) {
        // Never medicated
        const daysSinceCadastro = Utils.diffDays(a.data_cadastro, today);
        if (daysSinceCadastro >= alertaDias) {
          alertas.push({
            animal: a,
            dias: daysSinceCadastro,
            message: 'Nunca medicado'
          });
        }
      } else {
        const daysSince = Utils.diffDays(lastDate, today);
        if (daysSince >= alertaDias) {
          alertas.push({
            animal: a,
            dias: daysSince,
            message: `Última medicação há ${daysSince} dias`
          });
        }
      }
    });

    alertas.sort((a, b) => b.dias - a.dias);

    const container = document.getElementById('alertMedicacoesContent');

    if (alertas.length === 0) {
      container.innerHTML = `<p class="no-alerts">Todos os animais estão com medicação em dia (limite: ${alertaDias} dias)</p>`;
    } else {
      container.innerHTML = alertas.map(a => `
        <div class="alert-item alert-medicacao" onclick="App.navigate('ficha', '${a.animal.id}')">
          <strong>${a.animal.codigo}</strong> — ${a.animal.nome}: ${a.message}
        </div>
      `).join('');
    }
  }
};
