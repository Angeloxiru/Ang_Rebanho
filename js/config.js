/* ========================================
   config.js — Tela de Configurações
   ======================================== */

const Config = {
  /**
   * Inicializa a tela de configurações
   */
  async init() {
    // Load alerta dias
    const alertaDias = await DB.getConfig('alerta_medicacao_dias') || '60';
    document.getElementById('configAlertaDias').value = alertaDias;

    // Load API URL
    const apiUrl = await DB.getConfig('api_url') || '';
    document.getElementById('configApiUrl').value = apiUrl;

    // Show next codes
    const animais = await DB.getAnimaisAtivos();
    document.getElementById('configProxVaca').textContent = Utils.getNextCowCode(animais);
    document.getElementById('configProxTouro').textContent = Utils.getNextBullCode(animais);
  },

  /**
   * Salva as configurações
   */
  async salvar() {
    const alertaDias = document.getElementById('configAlertaDias').value;
    if (!alertaDias || parseInt(alertaDias) < 1) {
      Utils.toast('Informe um número válido de dias', 'error');
      return;
    }

    await DB.setConfig('alerta_medicacao_dias', alertaDias);
    await Sync.queueOperation('updateConfiguracao', {
      chave: 'alerta_medicacao_dias',
      valor: alertaDias
    });

    Utils.toast('Configurações salvas!', 'success');
  },

  /**
   * Salva a URL da API
   */
  async salvarApiUrl() {
    const url = document.getElementById('configApiUrl').value.trim();
    await DB.setConfig('api_url', url);

    if (url) {
      Utils.toast('URL da API salva! Tentando sincronizar...', 'success');
      Sync.syncNow();
    } else {
      Utils.toast('URL da API removida. O app funcionará apenas offline.', 'info');
    }
  }
};
