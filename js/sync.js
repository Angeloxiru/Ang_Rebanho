/* ========================================
   sync.js — Sincronização online/offline
   ======================================== */

const Sync = {
  syncInterval: null,
  isSyncing: false,

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
    await DB.addToSyncQueue({ action, data, retries: 0 });
    await Sync.updateSyncBar();

    if (navigator.onLine) {
      // Try to sync immediately
      Sync.syncNow();
    }
  },

  /**
   * Remove base64 photo data from animal objects before syncing.
   * Base64 photos are too large for Google Sheets cells (~50KB limit).
   * Photos remain in IndexedDB locally.
   */
  stripBase64Photos(data) {
    const cleaned = Object.assign({}, data);
    ['foto_url', 'foto_url2', 'foto_url3'].forEach(key => {
      if (cleaned[key] && cleaned[key].startsWith('data:')) {
        cleaned[key] = ''; // Remove base64, keep URL photos
      }
    });
    return cleaned;
  },

  /**
   * Tenta sincronizar todas as operações pendentes
   */
  async syncNow() {
    if (Sync.isSyncing) return; // Prevent concurrent syncs

    const configured = await API.isConfigured();
    if (!configured || !navigator.onLine) return;

    const queue = await DB.getSyncQueue();
    if (queue.length === 0) {
      // No pending operations — try full sync from server
      await Sync.pullFromServer();
      return;
    }

    Sync.isSyncing = true;
    const bar = document.getElementById('syncBar');
    bar.classList.add('visible', 'syncing');
    bar.textContent = '🔄 Sincronizando...';

    let synced = 0;
    let failed = 0;
    const MAX_RETRIES = 5;

    try {
      // Send operations one by one
      for (const item of queue) {
        let result = null;
        let syncData = item.data;

        // Strip base64 photos from animal data before sending
        if (item.action === 'addAnimal' || item.action === 'updateAnimal') {
          syncData = Sync.stripBase64Photos(syncData);
        }

        try {
          switch (item.action) {
            case 'addAnimal':
              result = await API.addAnimal(syncData);
              break;
            case 'updateAnimal':
              result = await API.updateAnimal(syncData);
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
        } catch (err) {
          console.error(`Sync item ${item.action} error:`, err);
        }

        if (result !== null) {
          await DB.removeSyncItem(item.id);
          synced++;
        } else {
          // Increment retry count
          const retries = (item.retries || 0) + 1;
          if (retries >= MAX_RETRIES) {
            // Too many retries — remove from queue to prevent permanent blocking
            console.warn(`Sync item ${item.action} exceeded ${MAX_RETRIES} retries, removing`);
            await DB.removeSyncItem(item.id);
            failed++;
          } else {
            // Update retry count
            item.retries = retries;
            await DB.put('syncQueue', item);
            failed++;
          }
        }
      }

      // After sending all pending ops, pull fresh data
      await Sync.pullFromServer();

      bar.classList.remove('syncing');
      await Sync.updateSyncBar();

      if (failed === 0) {
        Utils.toast('Sincronização concluída!', 'success');
      } else if (synced > 0) {
        Utils.toast(`${synced} sincronizado(s), ${failed} com erro — tentará novamente`, 'error');
      } else {
        Utils.toast('Erro na sincronização — tentará novamente', 'error');
      }

      // Refresh current screen
      App.refreshCurrentScreen();

    } catch (err) {
      console.error('Sync error:', err);
      bar.classList.remove('syncing');
      bar.classList.add('error');
      bar.textContent = '❌ Erro na sincronização — toque para tentar novamente';
    } finally {
      Sync.isSyncing = false;
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
