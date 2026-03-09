/* ========================================
   medicacoes.js — CRUD de Medicações
   ======================================== */

const Medicacoes = {
  /**
   * Inicializa o formulário de medicação
   */
  async initForm() {
    await Animais.populateAnimalSelect('medAnimal');
    document.getElementById('medData').value = Utils.today();

    // If coming from a ficha, pre-select the animal
    if (Animais.currentAnimalId) {
      document.getElementById('medAnimal').value = Animais.currentAnimalId;
    }

    document.getElementById('medNome').value = '';
    document.getElementById('medTipo').value = '';
    document.getElementById('medProxima').value = '';
    document.getElementById('medDose').value = '';
    document.getElementById('medObs').value = '';
  },

  /**
   * Salva uma nova medicação
   */
  async salvar() {
    const animalId = document.getElementById('medAnimal').value;
    const nome = document.getElementById('medNome').value.trim();
    const tipo = document.getElementById('medTipo').value;
    const data = document.getElementById('medData').value;
    const proxima = document.getElementById('medProxima').value;
    const dose = document.getElementById('medDose').value.trim();
    const obs = document.getElementById('medObs').value.trim();

    if (!animalId) {
      Utils.toast('Selecione o animal', 'error');
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

    const animal = await DB.getAnimal(animalId);
    if (!animal) {
      Utils.toast('Animal não encontrado', 'error');
      return;
    }

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

    Utils.toast(`Medicação registrada para ${animal.nome}!`, 'success');

    // Navigate back to ficha if we came from one
    if (Animais.currentAnimalId) {
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

      App.navigate('dashboard');
    }
  }
};
