/* ========================================
   sync.js — Sincronização online/offline
   ======================================== */

const Sync = {
  syncInterval: null,

  /**
   * Inicializa o sistema de sincronização
   */
  init() {
    // Monitor connectivity
    window.addEventListener('online', () => {
      Sync.updateOfflineBar();
      Sync.syncNow();
    });
    window.addEventListener('offline', () => {
      Sync.updateOfflineBar();
    });

    Sync.updateOfflineBar();
    Sync.updateSyncBar();

    // Try syncing every 2 minutes when online
    Sync.syncInterval = setInterval(() => {
      if (navigator.onLine) {
        Sync.syncNow();
      }
    }, 120000);
  },

  /**
   * Atualiza a barra de offline
   */
  updateOfflineBar() {
    const bar = document.getElementById('offlineBar');
    if (navigator.onLine) {
      bar.classList.remove('visible');
    } else {
      bar.classList.add('visible');
    }
  },

  /**
   * Atualiza a barra de sincronização pendente
   */
  async updateSyncBar() {
    const bar = document.getElementById('syncBar');
    const queue = await DB.getSyncQueue();

    if (queue.length === 0) {
      bar.classList.remove('visible');
      bar.textContent = '';
    } else {
      bar.classList.add('visible');
      bar.classList.remove('syncing', 'error');
      bar.textContent = `⏳ ${queue.length} alteração(ões) pendente(s) de envio — toque para sincronizar`;
    }
  },

  /**
   * Adiciona uma operação à fila de sincronização
   * e tenta enviar imediatamente se online
   */
  async queueOperation(action, data) {
    await DB.addToSyncQueue({ action, data });
    await Sync.updateSyncBar();

    if (navigator.onLine) {
      // Try to sync immediately
      Sync.syncNow();
    }
  },

  /**
   * Tenta sincronizar todas as operações pendentes
   */
  async syncNow() {
    const configured = await API.isConfigured();
    if (!configured || !navigator.onLine) return;

    const queue = await DB.getSyncQueue();
    if (queue.length === 0) {
      // No pending operations — try full sync from server
      await Sync.pullFromServer();
      return;
    }

    const bar = document.getElementById('syncBar');
    bar.classList.add('visible', 'syncing');
    bar.textContent = '🔄 Sincronizando...';

    try {
      // Send operations one by one
      for (const item of queue) {
        let result = null;
        switch (item.action) {
          case 'addAnimal':
            result = await API.addAnimal(item.data);
            break;
          case 'updateAnimal':
            result = await API.updateAnimal(item.data);
            break;
          case 'venderAnimal':
            result = await API.venderAnimal(item.data.id, item.data.data_venda);
            break;
          case 'mudarCategoria':
            result = await API.mudarCategoria(
              item.data.id, item.data.nova_categoria,
              item.data.novo_codigo, item.data.codigo_origem
            );
            break;
          case 'addMedicacao':
            result = await API.addMedicacao(item.data);
            break;
          case 'addCio':
            result = await API.addCio(item.data);
            break;
          case 'updateCio':
            result = await API.updateCio(item.data);
            break;
          case 'updateConfiguracao':
            result = await API.updateConfiguracao(item.data.chave, item.data.valor);
            break;
        }

        if (result !== null) {
          await DB.removeSyncItem(item.id);
        }
      }

      // After sending all pending ops, pull fresh data
      await Sync.pullFromServer();

      bar.classList.remove('syncing');
      await Sync.updateSyncBar();
      Utils.toast('Sincronização concluída!', 'success');

      // Refresh current screen
      App.refreshCurrentScreen();

    } catch (err) {
      console.error('Sync error:', err);
      bar.classList.remove('syncing');
      bar.classList.add('error');
      bar.textContent = '❌ Erro na sincronização — toque para tentar novamente';
    }
  },

  /**
   * Puxa dados frescos do servidor
   */
  async pullFromServer() {
    try {
      await API.fullSync();
    } catch (err) {
      console.error('Pull error:', err);
    }
  }
};
