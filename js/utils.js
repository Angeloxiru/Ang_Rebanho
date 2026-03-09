/* ========================================
   utils.js — Funções utilitárias
   ======================================== */

const Utils = {
  /**
   * Gera um UUID v4 simples
   */
  generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  /**
   * Retorna a data de hoje no formato ISO (YYYY-MM-DD)
   */
  today() {
    return new Date().toISOString().split('T')[0];
  },

  /**
   * Formata data ISO para formato brasileiro DD/MM/AAAA
   */
  formatDate(isoDate) {
    if (!isoDate) return '—';
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  },

  /**
   * Calcula previsão de parto (data do cio + 283 dias)
   */
  calcPrevisaoParto(dataCio) {
    const date = new Date(dataCio + 'T00:00:00');
    date.setDate(date.getDate() + 283);
    return date.toISOString().split('T')[0];
  },

  /**
   * Calcula diferença em dias entre duas datas
   */
  diffDays(date1, date2) {
    const d1 = new Date(date1 + 'T00:00:00');
    const d2 = new Date(date2 + 'T00:00:00');
    return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
  },

  /**
   * Gera o próximo código de vaca (numérico sequencial)
   */
  getNextCowCode(animais) {
    let max = 0;
    animais.forEach(a => {
      if ((a.categoria === 'vaca') && /^\d+$/.test(a.codigo)) {
        const num = parseInt(a.codigo, 10);
        if (num > max) max = num;
      }
    });
    return String(max + 1);
  },

  /**
   * Gera o próximo código de touro (letra sequencial A, B, ... Z, AA, AB, ...)
   */
  getNextBullCode(animais) {
    let codes = [];
    animais.forEach(a => {
      if ((a.categoria === 'touro') && /^[A-Z]+$/.test(a.codigo)) {
        codes.push(a.codigo);
      }
    });

    if (codes.length === 0) return 'A';

    // Sort by length then alphabetically
    codes.sort((a, b) => a.length - b.length || a.localeCompare(b));
    const last = codes[codes.length - 1];
    return Utils.incrementLetterCode(last);
  },

  /**
   * Incrementa código de letras: A->B, Z->AA, AZ->BA
   */
  incrementLetterCode(code) {
    let chars = code.split('');
    let i = chars.length - 1;
    while (i >= 0) {
      if (chars[i] === 'Z') {
        chars[i] = 'A';
        i--;
      } else {
        chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
        return chars.join('');
      }
    }
    return 'A' + chars.join('');
  },

  /**
   * Gera código de filhote baseado nos pais
   * código_mãe + código_pai, com sufixo se duplicado
   */
  getOffspringCode(codigoMae, codigoPai, animais) {
    const mae = codigoMae || '?';
    const pai = codigoPai || '?';
    const base = mae + pai;

    // Check for existing animals with the same base code
    let count = 0;
    animais.forEach(a => {
      if (a.codigo === base || (a.codigo.startsWith(base + '-') && /^\d+$/.test(a.codigo.slice(base.length + 1)))) {
        count++;
      }
    });

    if (count === 0) return base;
    return base + '-' + (count + 1);
  },

  /**
   * Gera o código de um animal com base na categoria e nos pais
   */
  generateAnimalCode(categoria, codigoMae, codigoPai, animais) {
    if (categoria === 'vaca') {
      return Utils.getNextCowCode(animais);
    }
    if (categoria === 'touro') {
      return Utils.getNextBullCode(animais);
    }
    // terneiro, terneira, novilho, novilha → código de filhote
    return Utils.getOffspringCode(codigoMae, codigoPai, animais);
  },

  /**
   * Retorna emoji para a categoria
   */
  categoryEmoji(categoria) {
    const emojis = {
      vaca: '🐄',
      touro: '🐂',
      novilha: '🐄',
      novilho: '🐂',
      terneira: '🐮',
      terneiro: '🐮'
    };
    return emojis[categoria] || '🐾';
  },

  /**
   * Retorna label traduzido da categoria
   */
  categoryLabel(categoria) {
    const labels = {
      vaca: 'Vaca',
      touro: 'Touro',
      novilha: 'Novilha',
      novilho: 'Novilho',
      terneira: 'Terneira',
      terneiro: 'Terneiro'
    };
    return labels[categoria] || categoria;
  },

  /**
   * Exibe uma mensagem toast
   */
  toast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  /**
   * Exibe modal de confirmação
   * Returns a promise that resolves to true/false
   */
  confirm(title, message) {
    return new Promise(resolve => {
      const container = document.getElementById('modalContainer');
      container.innerHTML = `
        <div class="modal-overlay" onclick="this.remove()">
          <div class="modal-content" onclick="event.stopPropagation()">
            <h3>${title}</h3>
            <p>${message}</p>
            <div class="btn-group">
              <button class="btn btn-secondary btn-sm" id="modalCancel">Cancelar</button>
              <button class="btn btn-primary btn-sm" id="modalConfirm">Confirmar</button>
            </div>
          </div>
        </div>
      `;
      document.getElementById('modalCancel').onclick = () => {
        container.innerHTML = '';
        resolve(false);
      };
      document.getElementById('modalConfirm').onclick = () => {
        container.innerHTML = '';
        resolve(true);
      };
    });
  },

  /**
   * Exibe modal com select
   * Returns promise with selected value or null
   */
  promptSelect(title, message, options) {
    return new Promise(resolve => {
      const container = document.getElementById('modalContainer');
      const optionsHtml = options.map(o =>
        `<option value="${o.value}">${o.label}</option>`
      ).join('');

      container.innerHTML = `
        <div class="modal-overlay" onclick="this.remove()">
          <div class="modal-content" onclick="event.stopPropagation()">
            <h3>${title}</h3>
            <p>${message}</p>
            <div class="form-group">
              <select id="modalSelect">${optionsHtml}</select>
            </div>
            <div class="btn-group">
              <button class="btn btn-secondary btn-sm" id="modalCancel">Cancelar</button>
              <button class="btn btn-primary btn-sm" id="modalConfirm">Confirmar</button>
            </div>
          </div>
        </div>
      `;
      document.getElementById('modalCancel').onclick = () => {
        container.innerHTML = '';
        resolve(null);
      };
      document.getElementById('modalConfirm').onclick = () => {
        const val = document.getElementById('modalSelect').value;
        container.innerHTML = '';
        resolve(val);
      };
    });
  },

  /**
   * Monta a árvore genealógica recursiva para um animal
   */
  buildGenealogyTree(animal, animais, depth = 0, maxDepth = 4) {
    if (!animal || depth > maxDepth) return null;

    const node = {
      codigo: animal.codigo,
      nome: animal.nome || '',
      children: []
    };

    if (animal.codigo_mae) {
      const mae = animais.find(a => a.codigo === animal.codigo_mae);
      if (mae) {
        node.children[0] = Utils.buildGenealogyTree(mae, animais, depth + 1, maxDepth);
      } else {
        node.children[0] = { codigo: animal.codigo_mae, nome: '(?)', children: [] };
      }
    }

    if (animal.codigo_pai) {
      const pai = animais.find(a => a.codigo === animal.codigo_pai);
      if (pai) {
        node.children[1] = Utils.buildGenealogyTree(pai, animais, depth + 1, maxDepth);
      } else {
        node.children[1] = { codigo: animal.codigo_pai, nome: '(?)', children: [] };
      }
    }

    return node;
  },

  /**
   * Renderiza a árvore genealógica como texto
   */
  renderGenealogyText(node, prefix = '', isLeft = true, isRoot = true) {
    if (!node) return '';

    let result = '';
    const label = `${node.codigo}${node.nome ? ' (' + node.nome + ')' : ''}`;

    if (isRoot) {
      result += label + '\n';
    } else {
      result += prefix + (isLeft ? '├── Mãe: ' : '└── Pai: ') + label + '\n';
    }

    const newPrefix = isRoot ? '' : prefix + (isLeft ? '│   ' : '    ');

    if (node.children[0]) {
      result += Utils.renderGenealogyText(node.children[0], newPrefix, true, false);
    }
    if (node.children[1]) {
      result += Utils.renderGenealogyText(node.children[1], newPrefix, false, false);
    }

    return result;
  }
};
