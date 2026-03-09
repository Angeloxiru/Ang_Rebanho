/* ========================================
   db.js — IndexedDB — Cache local e fila offline
   ======================================== */

const DB = {
  db: null,
  DB_NAME: 'GestaoRebanho',
  DB_VERSION: 1,

  /**
   * Inicializa o IndexedDB
   */
  init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB.DB_NAME, DB.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store para animais
        if (!db.objectStoreNames.contains('animais')) {
          db.createObjectStore('animais', { keyPath: 'id' });
        }

        // Store para medicações
        if (!db.objectStoreNames.contains('medicacoes')) {
          const medStore = db.createObjectStore('medicacoes', { keyPath: 'id' });
          medStore.createIndex('animal_id', 'animal_id', { unique: false });
        }

        // Store para cios
        if (!db.objectStoreNames.contains('cios')) {
          const cioStore = db.createObjectStore('cios', { keyPath: 'id' });
          cioStore.createIndex('animal_id', 'animal_id', { unique: false });
        }

        // Store para configurações
        if (!db.objectStoreNames.contains('configuracoes')) {
          db.createObjectStore('configuracoes', { keyPath: 'chave' });
        }

        // Store para fila de sincronização offline
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = (event) => {
        DB.db = event.target.result;
        resolve();
      };

      request.onerror = (event) => {
        console.error('Erro ao abrir IndexedDB:', event.target.error);
        reject(event.target.error);
      };
    });
  },

  // ---- Operações genéricas ----

  /**
   * Retorna todos os registros de uma store
   */
  getAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = DB.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Retorna um registro pelo ID
   */
  get(storeName, id) {
    return new Promise((resolve, reject) => {
      const tx = DB.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Adiciona ou atualiza um registro
   */
  put(storeName, data) {
    return new Promise((resolve, reject) => {
      const tx = DB.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Remove um registro pelo ID
   */
  delete(storeName, id) {
    return new Promise((resolve, reject) => {
      const tx = DB.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Limpa todos os registros de uma store
   */
  clear(storeName) {
    return new Promise((resolve, reject) => {
      const tx = DB.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Busca registros por índice
   */
  getByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const tx = DB.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  // ---- Animais ----

  async getAnimais() {
    return DB.getAll('animais');
  },

  async getAnimaisAtivos() {
    const all = await DB.getAll('animais');
    return all.filter(a => a.status === 'ativo');
  },

  async getAnimaisVendidos() {
    const all = await DB.getAll('animais');
    return all.filter(a => a.status === 'vendido');
  },

  async getAnimal(id) {
    return DB.get('animais', id);
  },

  async saveAnimal(animal) {
    return DB.put('animais', animal);
  },

  // ---- Medicações ----

  async getMedicacoes() {
    return DB.getAll('medicacoes');
  },

  async getMedicacoesByAnimal(animalId) {
    return DB.getByIndex('medicacoes', 'animal_id', animalId);
  },

  async saveMedicacao(med) {
    return DB.put('medicacoes', med);
  },

  // ---- Cios ----

  async getCios() {
    return DB.getAll('cios');
  },

  async getCiosByAnimal(animalId) {
    return DB.getByIndex('cios', 'animal_id', animalId);
  },

  async saveCio(cio) {
    return DB.put('cios', cio);
  },

  // ---- Configurações ----

  async getConfig(chave) {
    const result = await DB.get('configuracoes', chave);
    return result ? result.valor : null;
  },

  async setConfig(chave, valor) {
    return DB.put('configuracoes', { chave, valor });
  },

  async getAllConfigs() {
    return DB.getAll('configuracoes');
  },

  /**
   * Inicializa configurações padrão se não existirem
   */
  async initDefaults() {
    const alertaDias = await DB.getConfig('alerta_medicacao_dias');
    if (alertaDias === null) {
      await DB.setConfig('alerta_medicacao_dias', '60');
    }
  },

  // ---- Fila de sincronização ----

  async addToSyncQueue(operation) {
    operation.timestamp = new Date().toISOString();
    return DB.put('syncQueue', operation);
  },

  async getSyncQueue() {
    return DB.getAll('syncQueue');
  },

  async clearSyncQueue() {
    return DB.clear('syncQueue');
  },

  async removeSyncItem(id) {
    return DB.delete('syncQueue', id);
  },

  /**
   * Substitui todos os dados locais com dados do servidor
   */
  async replaceAllData(animais, medicacoes, cios, configuracoes) {
    if (animais) {
      await DB.clear('animais');
      for (const a of animais) {
        await DB.put('animais', a);
      }
    }
    if (medicacoes) {
      await DB.clear('medicacoes');
      for (const m of medicacoes) {
        await DB.put('medicacoes', m);
      }
    }
    if (cios) {
      await DB.clear('cios');
      for (const c of cios) {
        await DB.put('cios', c);
      }
    }
    if (configuracoes) {
      // Don't clear all configs — preserve local-only ones like API URL
      for (const c of configuracoes) {
        await DB.put('configuracoes', { chave: c.chave, valor: c.valor });
      }
    }
  }
};
