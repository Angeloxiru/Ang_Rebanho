/* ========================================
   cios.js — CRUD de Cios
   ======================================== */

const Cios = {
  /**
   * Inicializa o formulário de cio
   */
  async initForm() {
    // Populate vacas select
    await Animais.populateAnimalSelect('cioVaca', a => a.categoria === 'vaca');

    // Populate touros select
    const animais = await DB.getAnimaisAtivos();
    const touroSelect = document.getElementById('cioTouro');
    touroSelect.innerHTML = '<option value="">Desconhecido</option>';
    animais
      .filter(a => a.categoria === 'touro')
      .sort((a, b) => a.codigo.localeCompare(b.codigo))
      .forEach(a => {
        touroSelect.innerHTML += `<option value="${a.codigo}">${a.codigo} — ${a.nome}</option>`;
      });

    document.getElementById('cioData').value = Utils.today();

    // If coming from a ficha of a vaca, pre-select
    if (Animais.currentAnimalId) {
      const animal = await DB.getAnimal(Animais.currentAnimalId);
      if (animal && animal.categoria === 'vaca') {
        document.getElementById('cioVaca').value = Animais.currentAnimalId;
      }
    }

    document.getElementById('cioObs').value = '';
    Cios.calcPrevisao();
  },

  /**
   * Calcula e exibe a previsão de parto
   */
  calcPrevisao() {
    const dataCio = document.getElementById('cioData').value;
    const preview = document.getElementById('previsaoPartoPreview');
    const value = document.getElementById('previsaoPartoValue');

    if (!dataCio) {
      preview.style.display = 'none';
      return;
    }

    const previsao = Utils.calcPrevisaoParto(dataCio);
    value.textContent = Utils.formatDate(previsao);
    preview.style.display = 'block';
  },

  /**
   * Salva um novo registro de cio
   */
  async salvar() {
    const vacaId = document.getElementById('cioVaca').value;
    const dataCio = document.getElementById('cioData').value;
    const codigoTouro = document.getElementById('cioTouro').value;
    const obs = document.getElementById('cioObs').value.trim();

    if (!vacaId) {
      Utils.toast('Selecione a vaca', 'error');
      return;
    }
    if (!dataCio) {
      Utils.toast('Informe a data do cio', 'error');
      return;
    }

    const vaca = await DB.getAnimal(vacaId);
    if (!vaca) {
      Utils.toast('Vaca não encontrada', 'error');
      return;
    }

    const cio = {
      id: Utils.generateId(),
      animal_id: vacaId,
      codigo_vaca: vaca.codigo,
      data_cio: dataCio,
      codigo_touro: codigoTouro || '',
      previsao_parto: Utils.calcPrevisaoParto(dataCio),
      status: 'aguardando',
      observacoes: obs
    };

    await DB.saveCio(cio);
    await Sync.queueOperation('addCio', cio);

    Utils.toast(`Cio registrado para ${vaca.nome}! Previsão de parto: ${Utils.formatDate(cio.previsao_parto)}`, 'success');

    if (Animais.currentAnimalId) {
      App.navigate('ficha', Animais.currentAnimalId);
    } else {
      App.navigate('dashboard');
    }
  },

  /**
   * Atualiza o status de um cio
   */
  async updateStatus(cioId, novoStatus) {
    const cio = await DB.get('cios', cioId);
    if (!cio) return;

    const confirmed = await Utils.confirm(
      'Atualizar Status',
      `Alterar status do cio para "${novoStatus}"?`
    );
    if (!confirmed) return;

    cio.status = novoStatus;
    await DB.saveCio(cio);
    await Sync.queueOperation('updateCio', cio);

    Utils.toast(`Status atualizado para "${novoStatus}"`, 'success');

    // Refresh the ficha
    if (Animais.currentAnimalId) {
      Animais.showFicha(Animais.currentAnimalId);
    }
  }
};
