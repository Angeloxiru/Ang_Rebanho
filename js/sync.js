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
   * After sync, if the server returned Drive URLs for photos,
   * update the local IndexedDB record so we don't re-upload next time.
   */
  async updateLocalPhotos(animalId, photoUrls) {
    if (!photoUrls || Object.keys(photoUrls).length === 0) return;
    const animal = await DB.getAnimal(animalId);
    if (!animal) return;
    let changed = false;
    ['foto_url', 'foto_url2', 'foto_url3'].forEach(key => {
      if (photoUrls[key] && photoUrls[key] !== '') {
        animal[key] = photoUrls[key];
        changed = true;
      }
    });
    if (changed) {
      await DB.saveAnimal(animal);
    }
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

        try {
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
        } catch (err) {
          console.error(`Sync item ${item.action} error:`, err);
        }

        if (result !== null) {
          // If server returned Drive photo URLs, update local record
          if (result.photoUrls && item.data.id) {
            await Sync.updateLocalPhotos(item.data.id, result.photoUrls);
          }
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
   * Re-enfileira todos os animais que ainda têm fotos base64 locais
   * para que sejam enviados ao Google Drive
   */
  async resyncPhotos() {
    const animais = await DB.getAnimais();
    let queued = 0;

    for (const animal of animais) {
      const hasBase64 = ['foto_url', 'foto_url2', 'foto_url3'].some(
        key => animal[key] && animal[key].startsWith('data:')
      );
      if (hasBase64) {
        await DB.addToSyncQueue({ action: 'updateAnimal', data: animal, retries: 0 });
        queued++;
      }
    }

    await Sync.updateSyncBar();

    if (queued === 0) {
      Utils.toast('Todas as fotos já estão sincronizadas!', 'success');
    } else {
      Utils.toast(`${queued} animal(is) com fotos para enviar`, 'success');
      Sync.syncNow();
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
