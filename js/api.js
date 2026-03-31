/* ========================================
   api.js — Comunicação com Google Apps Script
   ======================================== */

const API = {
  /**
   * Retorna a URL da API configurada
   */
  async getBaseUrl() {
    const url = await DB.getConfig('api_url');
    return url || '';
  },

  /**
   * Verifica se a API está configurada
   */
  async isConfigured() {
    const url = await API.getBaseUrl();
    return url && url.length > 0;
  },

  /**
   * Faz uma requisição GET para a API
   */
  async get(action, params = {}) {
    const baseUrl = await API.getBaseUrl();
    if (!baseUrl) return null;

    const url = new URL(baseUrl);
    url.searchParams.set('action', action);
    Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));

    try {
      const response = await fetch(url.toString());
      const data = await response.json();
      if (data.success) return data.data;
      console.error('API error:', data.error);
      return null;
    } catch (err) {
      console.error('API fetch error:', err);
      return null;
    }
  },

  /**
   * Faz uma requisição POST para a API
   */
  async post(action, body = {}) {
    const baseUrl = await API.getBaseUrl();
    if (!baseUrl) return null;

    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action, ...body })
      });
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.error('API response not JSON:', text.substring(0, 200));
        return null;
      }
      if (data.success) return data.data;
      console.error('API error:', data.error);
      return null;
    } catch (err) {
      console.error('API post error:', err);
      return null;
    }
  },

  // ---- Endpoints específicos ----

  async fetchAnimais() {
    return API.get('getAnimais');
  },

  async fetchAnimal(id) {
    return API.get('getAnimal', { id });
  },

  async addAnimal(animal) {
    return API.post('addAnimal', animal);
  },

  async updateAnimal(animal) {
    return API.post('updateAnimal', animal);
  },

  async venderAnimal(id, dataVenda) {
    return API.post('venderAnimal', { id, data_venda: dataVenda });
  },

  async mudarCategoria(id, novaCategoria, novoCodigo, codigoOrigem) {
    return API.post('mudarCategoria', {
      id,
      nova_categoria: novaCategoria,
      novo_codigo: novoCodigo,
      codigo_origem: codigoOrigem
    });
  },

  async fetchMedicacoes(animalId) {
    const params = animalId ? { animal_id: animalId } : {};
    return API.get('getMedicacoes', params);
  },

  async addMedicacao(med) {
    return API.post('addMedicacao', med);
  },

  async fetchCios(animalId) {
    const params = animalId ? { animal_id: animalId } : {};
    return API.get('getCios', params);
  },

  async addCio(cio) {
    return API.post('addCio', cio);
  },

  async updateCio(cio) {
    return API.post('updateCio', cio);
  },

  async fetchConfiguracoes() {
    return API.get('getConfiguracoes');
  },

  async updateConfiguracao(chave, valor) {
    return API.post('updateConfiguracao', { chave, valor });
  },

  /**
   * Envia lote de operações pendentes
   */
  async syncBatch(operations) {
    return API.post('syncBatch', { operations });
  },

  /**
   * Baixa todos os dados do servidor e salva localmente
   */
  async fullSync() {
    const configured = await API.isConfigured();
    if (!configured) return false;

    try {
      const [animais, medicacoes, cios, configs] = await Promise.all([
        API.fetchAnimais(),
        API.fetchMedicacoes(),
        API.fetchCios(),
        API.fetchConfiguracoes()
      ]);

      if (animais) {
        await DB.replaceAllData(animais, medicacoes, cios, configs);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Full sync error:', err);
      return false;
    }
  }
};
