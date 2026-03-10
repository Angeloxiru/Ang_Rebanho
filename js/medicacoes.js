/* ========================================
   medicacoes.js — CRUD de Medicações
   ======================================== */

const Medicacoes = {
  mode: 'individual', // 'individual' or 'lote'

  /**
   * Alterna entre modo individual e lote
   */
  setMode(mode) {
    Medicacoes.mode = mode;
    document.getElementById('btnMedIndividual').classList.toggle('active', mode === 'individual');
    document.getElementById('btnMedLote').classList.toggle('active', mode === 'lote');
    document.getElementById('medAnimalGroup').style.display = mode === 'individual' ? '' : 'none';
    document.getElementById('medLoteGroup').style.display = mode === 'lote' ? '' : 'none';
  },

  /**
   * Inicializa o formulário de medicação
   */
  async initForm() {
    await Animais.populateAnimalSelect('medAnimal');
    document.getElementById('medData').value = Utils.today();

    // If coming from a ficha, pre-select the animal and force individual mode
    if (Animais.currentAnimalId) {
      Medicacoes.setMode('individual');
      document.getElementById('medAnimal').value = Animais.currentAnimalId;
      document.getElementById('medModeToggle').style.display = 'none';
    } else {
      document.getElementById('medModeToggle').style.display = '';
    }

    // Populate batch list
    await Medicacoes.populateBatchList();

    document.getElementById('medNome').value = '';
    document.getElementById('medTipo').value = '';
    document.getElementById('medProxima').value = '';
    document.getElementById('medDose').value = '';
    document.getElementById('medObs').value = '';
  },

  /**
   * Popula a lista de animais para seleção em lote
   */
  async populateBatchList() {
    const animais = await DB.getAnimaisAtivos();
    animais.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));

    const container = document.getElementById('medAnimalList');
    container.innerHTML = animais.map(a => `
      <label class="med-animal-item">
        <input type="checkbox" value="${a.id}" data-campo="${a.campo || ''}" onchange="Medicacoes.updateLoteCount()">
        <span class="med-animal-code">${a.codigo}</span>
        <span class="med-animal-name">${a.nome}</span>
        ${a.campo ? `<span class="badge-campo badge-${a.campo}" style="font-size:0.7rem;margin-left:auto;">${Utils.campoLabel(a.campo)}</span>` : ''}
      </label>
    `).join('');

    Medicacoes.updateLoteCount();
  },

  /**
   * Atualiza contador de animais selecionados
   */
  updateLoteCount() {
    const checked = document.querySelectorAll('#medAnimalList input:checked').length;
    document.getElementById('medLoteCount').textContent = `(${checked} selecionado${checked !== 1 ? 's' : ''})`;
  },

  /**
   * Seleciona todos os animais
   */
  selecionarTodos() {
    document.querySelectorAll('#medAnimalList input[type="checkbox"]').forEach(cb => cb.checked = true);
    Medicacoes.updateLoteCount();
  },

  /**
   * Deseleciona todos os animais
   */
  deselecionarTodos() {
    document.querySelectorAll('#medAnimalList input[type="checkbox"]').forEach(cb => cb.checked = false);
    Medicacoes.updateLoteCount();
  },

  /**
   * Seleciona todos os animais de um campo específico
   */
  selecionarPorCampo(campo) {
    document.querySelectorAll('#medAnimalList input[type="checkbox"]').forEach(cb => {
      cb.checked = cb.dataset.campo === campo;
    });
    Medicacoes.updateLoteCount();
  },

  /**
   * Retorna IDs dos animais selecionados
   */
  getSelectedAnimalIds() {
    if (Medicacoes.mode === 'individual') {
      const id = document.getElementById('medAnimal').value;
      return id ? [id] : [];
    }
    return Array.from(document.querySelectorAll('#medAnimalList input:checked')).map(cb => cb.value);
  },

  /**
   * Salva uma nova medicação (individual ou lote)
   */
  async salvar() {
    const animalIds = Medicacoes.getSelectedAnimalIds();
    const nome = document.getElementById('medNome').value.trim();
    const tipo = document.getElementById('medTipo').value;
    const data = document.getElementById('medData').value;
    const proxima = document.getElementById('medProxima').value;
    const dose = document.getElementById('medDose').value.trim();
    const obs = document.getElementById('medObs').value.trim();

    if (animalIds.length === 0) {
      Utils.toast(Medicacoes.mode === 'lote' ? 'Selecione pelo menos um animal' : 'Selecione o animal', 'error');
      return;
    }
    if (!nome) {
      Utils.toast('Informe o nome da medicação', 'error');
      return;
    }
    if (!tipo) {
      Utils.toast('Selecione o tipo', 'error');
      return;
    }
    if (!data) {
      Utils.toast('Informe a data de aplicação', 'error');
      return;
    }

    let count = 0;
    for (const animalId of animalIds) {
      const animal = await DB.getAnimal(animalId);
      if (!animal) continue;

      const medicacao = {
        id: Utils.generateId(),
        animal_id: animalId,
        codigo_animal: animal.codigo,
        nome_medicacao: nome,
        tipo,
        data_aplicacao: data,
        proxima_aplicacao: proxima || '',
        dose: dose || '',
        observacoes: obs
      };

      await DB.saveMedicacao(medicacao);
      await Sync.queueOperation('addMedicacao', medicacao);
      count++;
    }

    if (count === 1 && Medicacoes.mode === 'individual') {
      const animal = await DB.getAnimal(animalIds[0]);
      Utils.toast(`Medicação registrada para ${animal ? animal.nome : 'animal'}!`, 'success');
    } else {
      Utils.toast(`Medicação registrada para ${count} animais!`, 'success');
    }

    // Navigate back to ficha if we came from one
    if (Animais.currentAnimalId && Medicacoes.mode === 'individual') {
      App.navigate('ficha', Animais.currentAnimalId);
    } else {
      // Clear form
      document.getElementById('medAnimal').value = '';
      document.getElementById('medNome').value = '';
      document.getElementById('medTipo').value = '';
      document.getElementById('medData').value = Utils.today();
      document.getElementById('medProxima').value = '';
      document.getElementById('medDose').value = '';
      document.getElementById('medObs').value = '';
      Medicacoes.deselecionarTodos();

      App.navigate('dashboard');
    }
  },

  /**
   * Renderiza a timeline de medicações
   */
  async renderTimeline() {
    const animais = await DB.getAnimaisAtivos();
    const medicacoes = await DB.getMedicacoes();
    const today = Utils.today();

    if (medicacoes.length === 0) {
      document.getElementById('timelineContainer').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💊</div>
          <p>Nenhuma medicação registrada</p>
        </div>
      `;
      document.getElementById('timelineLegend').innerHTML = '';
      return;
    }

    // Find date range
    let minDate = today;
    let maxDate = today;
    medicacoes.forEach(m => {
      if (m.data_aplicacao && m.data_aplicacao < minDate) minDate = m.data_aplicacao;
      if (m.data_aplicacao && m.data_aplicacao > maxDate) maxDate = m.data_aplicacao;
      if (m.proxima_aplicacao && m.proxima_aplicacao > maxDate) maxDate = m.proxima_aplicacao;
    });

    // Extend range a bit for readability
    const minD = new Date(minDate + 'T00:00:00');
    minD.setDate(minD.getDate() - 7);
    const maxD = new Date(maxDate + 'T00:00:00');
    maxD.setDate(maxD.getDate() + 30);

    const totalDays = Math.ceil((maxD - minD) / (1000 * 60 * 60 * 24));

    function dateToPercent(isoDate) {
      const d = new Date(isoDate + 'T00:00:00');
      const days = Math.ceil((d - minD) / (1000 * 60 * 60 * 24));
      return (days / totalDays) * 100;
    }

    // Medication type colors
    const typeColors = {
      vacina: { bg: '#e0f7fa', border: '#00695c', label: 'Vacina' },
      vermifugo: { bg: '#fce4ec', border: '#c62828', label: 'Vermífugo' },
      antibiotico: { bg: '#fff3e0', border: '#e65100', label: 'Antibiótico' },
      outro: { bg: '#e8eaf6', border: '#283593', label: 'Outro' }
    };

    // Legend
    document.getElementById('timelineLegend').innerHTML = `
      <div class="timeline-legend-items">
        ${Object.entries(typeColors).map(([tipo, c]) => `
          <span class="timeline-legend-item">
            <span class="timeline-legend-color" style="background:${c.border}"></span>
            ${c.label}
          </span>
        `).join('')}
        <span class="timeline-legend-item">
          <span class="timeline-legend-color timeline-legend-overdue"></span>
          Atrasada
        </span>
      </div>
    `;

    // Group medicações by animal
    const medByAnimal = {};
    medicacoes.forEach(m => {
      if (!medByAnimal[m.animal_id]) medByAnimal[m.animal_id] = [];
      medByAnimal[m.animal_id].push(m);
    });

    // Build month markers
    const months = [];
    const cursor = new Date(minD);
    cursor.setDate(1);
    cursor.setMonth(cursor.getMonth() + 1);
    while (cursor <= maxD) {
      const iso = cursor.toISOString().split('T')[0];
      const pct = dateToPercent(iso);
      const label = cursor.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      months.push({ pct, label });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    // Today marker
    const todayPct = dateToPercent(today);

    // Sort animais by codigo
    const sortedAnimais = animais
      .filter(a => medByAnimal[a.id])
      .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));

    let html = `
      <div class="timeline-chart">
        <div class="timeline-header">
          <div class="timeline-label-col"></div>
          <div class="timeline-bar-col">
            ${months.map(m => `<div class="timeline-month" style="left:${m.pct}%">${m.label}</div>`).join('')}
            <div class="timeline-today" style="left:${todayPct}%"><span>Hoje</span></div>
          </div>
        </div>
    `;

    sortedAnimais.forEach(animal => {
      const meds = medByAnimal[animal.id] || [];
      meds.sort((a, b) => a.data_aplicacao.localeCompare(b.data_aplicacao));

      html += `
        <div class="timeline-row" onclick="App.navigate('ficha', '${animal.id}')">
          <div class="timeline-label-col">
            <div class="timeline-animal-code">${animal.codigo}</div>
            <div class="timeline-animal-name">${animal.nome}</div>
          </div>
          <div class="timeline-bar-col">
            <div class="timeline-today-line" style="left:${todayPct}%"></div>
      `;

      meds.forEach(m => {
        const startPct = dateToPercent(m.data_aplicacao);
        const color = typeColors[m.tipo] || typeColors.outro;
        const hasProxima = m.proxima_aplicacao && m.proxima_aplicacao.length > 0;
        const isOverdue = hasProxima && m.proxima_aplicacao < today;

        if (hasProxima) {
          const endPct = dateToPercent(m.proxima_aplicacao);
          const width = Math.max(endPct - startPct, 0.5);
          html += `
            <div class="timeline-med-bar ${isOverdue ? 'overdue' : ''}"
                 style="left:${startPct}%;width:${width}%;background:${color.bg};border-color:${color.border}"
                 title="${m.nome_medicacao}: ${Utils.formatDate(m.data_aplicacao)} → ${Utils.formatDate(m.proxima_aplicacao)}${isOverdue ? ' (ATRASADA!)' : ''}">
            </div>
          `;
        } else {
          html += `
            <div class="timeline-med-dot"
                 style="left:${startPct}%;background:${color.border}"
                 title="${m.nome_medicacao}: ${Utils.formatDate(m.data_aplicacao)}">
            </div>
          `;
        }
      });

      html += `
          </div>
        </div>
      `;
    });

    html += '</div>';
    document.getElementById('timelineContainer').innerHTML = html;
  }
};
