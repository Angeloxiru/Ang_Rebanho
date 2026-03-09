/* ========================================
   animais.js — CRUD de Animais
   ======================================== */

const Animais = {
  currentAnimalId: null, // Animal being viewed/edited

  /**
   * Popula selects de mãe e pai no formulário de cadastro
   */
  async populateParentSelects(maeSelectId, paiSelectId, excludeId) {
    const animais = await DB.getAnimaisAtivos();

    const maeSelect = document.getElementById(maeSelectId);
    const paiSelect = document.getElementById(paiSelectId);

    // Keep the first option (Desconhecida/Desconhecido)
    maeSelect.innerHTML = '<option value="">Desconhecida</option>';
    paiSelect.innerHTML = '<option value="">Desconhecido</option>';

    animais
      .filter(a => a.id !== excludeId)
      .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }))
      .forEach(a => {
        const label = `${a.codigo} — ${a.nome}`;
        if (['vaca', 'novilha', 'terneira'].includes(a.categoria)) {
          maeSelect.innerHTML += `<option value="${a.codigo}">${label}</option>`;
        }
        if (['touro', 'novilho', 'terneiro'].includes(a.categoria)) {
          paiSelect.innerHTML += `<option value="${a.codigo}">${label}</option>`;
        }
      });
  },

  /**
   * Popula select de animais (para medicação, etc.)
   */
  async populateAnimalSelect(selectId, filter) {
    const animais = await DB.getAnimaisAtivos();
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">Selecione o animal...</option>';

    let filtered = animais;
    if (filter) {
      filtered = animais.filter(filter);
    }

    filtered
      .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }))
      .forEach(a => {
        select.innerHTML += `<option value="${a.id}">${a.codigo} — ${a.nome}</option>`;
      });
  },

  /**
   * Chamado quando a categoria muda no formulário de cadastro
   */
  onCategoriaChange() {
    Animais.populateParentSelects('cadMae', 'cadPai');
    Animais.previewCode();
  },

  /**
   * Calcula e exibe preview do código que será gerado
   */
  async previewCode() {
    const categoria = document.getElementById('cadCategoria').value;
    const codigoMae = document.getElementById('cadMae').value;
    const codigoPai = document.getElementById('cadPai').value;
    const preview = document.getElementById('codePreview');
    const previewValue = document.getElementById('codePreviewValue');

    if (!categoria) {
      preview.style.display = 'none';
      return;
    }

    const animais = await DB.getAnimaisAtivos();
    const codigo = Utils.generateAnimalCode(categoria, codigoMae, codigoPai, animais);

    previewValue.textContent = codigo;
    preview.style.display = 'block';
  },

  /**
   * Salva um novo animal
   */
  async salvar() {
    const nome = document.getElementById('cadNome').value.trim();
    const categoria = document.getElementById('cadCategoria').value;
    const nascimento = document.getElementById('cadNascimento').value;
    const codigoMae = document.getElementById('cadMae').value;
    const codigoPai = document.getElementById('cadPai').value;
    const fotoUrl = document.getElementById('cadFoto').value.trim();
    const obs = document.getElementById('cadObs').value.trim();

    if (!nome) {
      Utils.toast('Informe o nome do animal', 'error');
      return;
    }
    if (!categoria) {
      Utils.toast('Selecione a categoria', 'error');
      return;
    }

    const animais = await DB.getAnimaisAtivos();
    const codigo = Utils.generateAnimalCode(categoria, codigoMae, codigoPai, animais);

    const animal = {
      id: Utils.generateId(),
      codigo,
      codigo_origem: '',
      nome,
      categoria,
      data_nascimento: nascimento || '',
      codigo_mae: codigoMae || '',
      codigo_pai: codigoPai || '',
      foto_url: fotoUrl || '',
      data_cadastro: Utils.today(),
      status: 'ativo',
      data_venda: '',
      observacoes: obs
    };

    // Save locally
    await DB.saveAnimal(animal);

    // Queue for sync
    await Sync.queueOperation('addAnimal', animal);

    Utils.toast(`Animal "${nome}" cadastrado com código ${codigo}!`, 'success');

    // Clear form
    document.getElementById('cadNome').value = '';
    document.getElementById('cadCategoria').value = '';
    document.getElementById('cadNascimento').value = '';
    document.getElementById('cadMae').value = '';
    document.getElementById('cadPai').value = '';
    document.getElementById('cadFoto').value = '';
    document.getElementById('cadObs').value = '';
    document.getElementById('codePreview').style.display = 'none';

    // Navigate to the animal's ficha
    App.navigate('ficha', animal.id);
  },

  /**
   * Renderiza a lista de animais
   */
  async renderList() {
    await Animais.applyFilters();
  },

  /**
   * Aplica filtros e renderiza a lista
   */
  async applyFilters() {
    const busca = document.getElementById('filterBusca').value.toLowerCase().trim();
    const categoria = document.getElementById('filterCategoria').value;

    let animais = await DB.getAnimaisAtivos();

    if (busca) {
      animais = animais.filter(a =>
        a.nome.toLowerCase().includes(busca) ||
        a.codigo.toLowerCase().includes(busca)
      );
    }
    if (categoria) {
      animais = animais.filter(a => a.categoria === categoria);
    }

    animais.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));

    const container = document.getElementById('animaisList');

    if (animais.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🐄</div>
          <p>Nenhum animal encontrado</p>
        </div>
      `;
      return;
    }

    container.innerHTML = animais.map(a => `
      <div class="card" onclick="App.navigate('ficha', '${a.id}')">
        <div class="card-header">
          <div class="card-photo">
            ${a.foto_url
              ? `<img src="${a.foto_url}" alt="${a.nome}" onerror="this.parentElement.innerHTML='${Utils.categoryEmoji(a.categoria)}'">`
              : Utils.categoryEmoji(a.categoria)
            }
          </div>
          <div class="card-info">
            <div class="card-code">${a.codigo}</div>
            <div class="card-name">${a.nome}</div>
            <div class="card-category">${Utils.categoryLabel(a.categoria)}</div>
          </div>
        </div>
      </div>
    `).join('');
  },

  /**
   * Mostra a ficha completa de um animal
   */
  async showFicha(animalId) {
    Animais.currentAnimalId = animalId;
    const animal = await DB.getAnimal(animalId);
    if (!animal) {
      Utils.toast('Animal não encontrado', 'error');
      App.navigate('animais');
      return;
    }

    // Header
    const photoEl = document.getElementById('fichaPhoto');
    if (animal.foto_url) {
      photoEl.innerHTML = `<img src="${animal.foto_url}" alt="${animal.nome}" onerror="this.parentElement.innerHTML='${Utils.categoryEmoji(animal.categoria)}'">`;
    } else {
      photoEl.innerHTML = Utils.categoryEmoji(animal.categoria);
    }

    document.getElementById('fichaCode').textContent = animal.codigo;
    document.getElementById('fichaName').textContent = animal.nome;
    document.getElementById('fichaCategory').textContent = Utils.categoryLabel(animal.categoria);

    // Info rows
    const animais = await DB.getAnimaisAtivos();
    const allAnimais = await DB.getAnimais();
    const mae = animal.codigo_mae ? allAnimais.find(a => a.codigo === animal.codigo_mae) : null;
    const pai = animal.codigo_pai ? allAnimais.find(a => a.codigo === animal.codigo_pai) : null;

    let infoHtml = '';
    infoHtml += `<div class="info-row"><span class="info-label">Código</span><span class="info-value">${animal.codigo}</span></div>`;
    if (animal.codigo_origem) {
      infoHtml += `<div class="info-row"><span class="info-label">Código Anterior</span><span class="info-value">${animal.codigo_origem}</span></div>`;
    }
    infoHtml += `<div class="info-row"><span class="info-label">Categoria</span><span class="info-value">${Utils.categoryLabel(animal.categoria)}</span></div>`;
    infoHtml += `<div class="info-row"><span class="info-label">Nascimento</span><span class="info-value">${Utils.formatDate(animal.data_nascimento)}</span></div>`;
    infoHtml += `<div class="info-row"><span class="info-label">Mãe</span><span class="info-value">${mae ? mae.codigo + ' — ' + mae.nome : (animal.codigo_mae || '—')}</span></div>`;
    infoHtml += `<div class="info-row"><span class="info-label">Pai</span><span class="info-value">${pai ? pai.codigo + ' — ' + pai.nome : (animal.codigo_pai || '—')}</span></div>`;
    infoHtml += `<div class="info-row"><span class="info-label">Cadastro</span><span class="info-value">${Utils.formatDate(animal.data_cadastro)}</span></div>`;
    if (animal.observacoes) {
      infoHtml += `<div class="info-row"><span class="info-label">Observações</span><span class="info-value">${animal.observacoes}</span></div>`;
    }
    document.getElementById('fichaInfo').innerHTML = infoHtml;

    // Genealogy tree
    const tree = Utils.buildGenealogyTree(animal, allAnimais);
    if (tree && (tree.children[0] || tree.children[1])) {
      document.getElementById('fichaGenealogia').style.display = 'block';
      document.getElementById('genealogyTree').textContent = Utils.renderGenealogyText(tree);
    } else {
      document.getElementById('fichaGenealogia').style.display = 'none';
    }

    // Show/hide cio button (only for vacas)
    document.getElementById('btnFichaCio').style.display =
      animal.categoria === 'vaca' ? '' : 'none';

    // Medication history
    const medicacoes = await DB.getMedicacoesByAnimal(animalId);
    medicacoes.sort((a, b) => b.data_aplicacao.localeCompare(a.data_aplicacao));

    const medListEl = document.getElementById('fichaMedicacoesList');
    if (medicacoes.length === 0) {
      medListEl.innerHTML = '<p class="no-alerts">Nenhuma medicação registrada</p>';
    } else {
      medListEl.innerHTML = medicacoes.map(m => `
        <div class="history-item">
          <div class="history-title">${m.nome_medicacao} <span class="badge badge-${m.tipo}">${m.tipo}</span></div>
          <div class="history-date">${Utils.formatDate(m.data_aplicacao)}</div>
          ${m.dose ? `<div class="history-detail">Dose: ${m.dose}</div>` : ''}
          ${m.proxima_aplicacao ? `<div class="history-detail">Próxima: ${Utils.formatDate(m.proxima_aplicacao)}</div>` : ''}
          ${m.observacoes ? `<div class="history-detail">${m.observacoes}</div>` : ''}
        </div>
      `).join('');
    }

    // Cio history (only for vacas)
    const fichaHistCios = document.getElementById('fichaHistCios');
    if (animal.categoria === 'vaca') {
      fichaHistCios.style.display = 'block';
      const cios = await DB.getCiosByAnimal(animalId);
      cios.sort((a, b) => b.data_cio.localeCompare(a.data_cio));

      const cioListEl = document.getElementById('fichaCiosList');
      if (cios.length === 0) {
        cioListEl.innerHTML = '<p class="no-alerts">Nenhum cio registrado</p>';
      } else {
        cioListEl.innerHTML = cios.map(c => `
          <div class="history-item">
            <div class="history-title">
              Cio em ${Utils.formatDate(c.data_cio)}
              <span class="badge badge-${c.status}">${c.status}</span>
            </div>
            ${c.codigo_touro ? `<div class="history-detail">Touro: ${c.codigo_touro}</div>` : ''}
            <div class="history-detail">Previsão parto: ${Utils.formatDate(c.previsao_parto)}</div>
            ${c.observacoes ? `<div class="history-detail">${c.observacoes}</div>` : ''}
            ${c.status === 'aguardando' || c.status === 'confirmada' ? `
              <div class="btn-group" style="margin-top: 8px;">
                ${c.status === 'aguardando' ? `<button class="btn btn-outline btn-sm" onclick="Cios.updateStatus('${c.id}', 'confirmada'); event.stopPropagation();">Confirmar</button>` : ''}
                <button class="btn btn-outline btn-sm" onclick="Cios.updateStatus('${c.id}', 'nasceu'); event.stopPropagation();">Nasceu</button>
                <button class="btn btn-danger btn-sm" onclick="Cios.updateStatus('${c.id}', 'perdeu'); event.stopPropagation();">Perdeu</button>
              </div>
            ` : ''}
          </div>
        `).join('');
      }
    } else {
      fichaHistCios.style.display = 'none';
    }
  },

  /**
   * Abre a tela de edição do animal atual
   */
  async editarAnimal() {
    const animal = await DB.getAnimal(Animais.currentAnimalId);
    if (!animal) return;

    await Animais.populateParentSelects('editMae', 'editPai', animal.id);

    document.getElementById('editNome').value = animal.nome;
    document.getElementById('editNascimento').value = animal.data_nascimento || '';
    document.getElementById('editMae').value = animal.codigo_mae || '';
    document.getElementById('editPai').value = animal.codigo_pai || '';
    document.getElementById('editFoto').value = animal.foto_url || '';
    document.getElementById('editObs').value = animal.observacoes || '';

    App.navigate('editarAnimal');
  },

  /**
   * Salva a edição do animal
   */
  async salvarEdicao() {
    const animal = await DB.getAnimal(Animais.currentAnimalId);
    if (!animal) return;

    const nome = document.getElementById('editNome').value.trim();
    if (!nome) {
      Utils.toast('Informe o nome do animal', 'error');
      return;
    }

    animal.nome = nome;
    animal.data_nascimento = document.getElementById('editNascimento').value || '';
    animal.codigo_mae = document.getElementById('editMae').value || '';
    animal.codigo_pai = document.getElementById('editPai').value || '';
    animal.foto_url = document.getElementById('editFoto').value.trim() || '';
    animal.observacoes = document.getElementById('editObs').value.trim() || '';

    await DB.saveAnimal(animal);
    await Sync.queueOperation('updateAnimal', animal);

    Utils.toast('Animal atualizado!', 'success');
    App.navigate('ficha', animal.id);
  },

  /**
   * Marca um animal como vendido
   */
  async venderAnimal() {
    const animal = await DB.getAnimal(Animais.currentAnimalId);
    if (!animal) return;

    const confirmed = await Utils.confirm(
      'Vender Animal',
      `Tem certeza que deseja marcar "${animal.nome}" (${animal.codigo}) como vendido? O animal será removido da lista principal.`
    );

    if (!confirmed) return;

    animal.status = 'vendido';
    animal.data_venda = Utils.today();

    await DB.saveAnimal(animal);
    await Sync.queueOperation('venderAnimal', { id: animal.id, data_venda: animal.data_venda });

    Utils.toast(`"${animal.nome}" marcado como vendido`, 'success');
    App.navigate('animais');
  },

  /**
   * Inicia o processo de mudança de categoria
   */
  async mudarCategoria() {
    const animal = await DB.getAnimal(Animais.currentAnimalId);
    if (!animal) return;

    const infoDiv = document.getElementById('mudarCategoriaInfo');
    infoDiv.innerHTML = `
      <div class="card" style="cursor:default;">
        <div class="card-header">
          <div class="card-photo">${Utils.categoryEmoji(animal.categoria)}</div>
          <div class="card-info">
            <div class="card-code">${animal.codigo}</div>
            <div class="card-name">${animal.nome}</div>
            <div class="card-category">Atual: ${Utils.categoryLabel(animal.categoria)}</div>
          </div>
        </div>
      </div>
    `;

    // Build valid category transitions
    const select = document.getElementById('novaCategoria');
    select.innerHTML = '<option value="">Selecione...</option>';

    const transitions = {
      terneira: ['novilha', 'vaca'],
      terneiro: ['novilho', 'touro'],
      novilha: ['vaca'],
      novilho: ['touro']
    };

    const opts = transitions[animal.categoria] || [];
    opts.forEach(cat => {
      select.innerHTML += `<option value="${cat}">${Utils.categoryLabel(cat)}</option>`;
    });

    if (opts.length === 0) {
      infoDiv.innerHTML += '<p style="color: var(--gray-500); margin-top: 8px;">Este animal já está na categoria final.</p>';
    }

    document.getElementById('novoCodPreview').style.display = 'none';
    App.navigate('mudarCategoria');
  },

  /**
   * Preview do novo código ao mudar categoria
   */
  async previewNovaCategoria() {
    const novaCategoria = document.getElementById('novaCategoria').value;
    const preview = document.getElementById('novoCodPreview');

    if (!novaCategoria) {
      preview.style.display = 'none';
      return;
    }

    if (novaCategoria === 'vaca' || novaCategoria === 'touro') {
      const animais = await DB.getAnimaisAtivos();
      const novoCodigo = novaCategoria === 'vaca'
        ? Utils.getNextCowCode(animais)
        : Utils.getNextBullCode(animais);
      document.getElementById('novoCodValue').textContent = novoCodigo;
      preview.style.display = 'block';
    } else {
      // novilha/novilho keep their offspring code
      preview.style.display = 'none';
    }
  },

  /**
   * Confirma a mudança de categoria
   */
  async confirmarMudarCategoria() {
    const novaCategoria = document.getElementById('novaCategoria').value;
    if (!novaCategoria) {
      Utils.toast('Selecione a nova categoria', 'error');
      return;
    }

    const animal = await DB.getAnimal(Animais.currentAnimalId);
    if (!animal) return;

    const animais = await DB.getAnimaisAtivos();
    let novoCodigo = animal.codigo;
    let codigoOrigem = animal.codigo_origem || '';

    // If promoting to vaca/touro, generate new code
    if (novaCategoria === 'vaca' || novaCategoria === 'touro') {
      novoCodigo = novaCategoria === 'vaca'
        ? Utils.getNextCowCode(animais)
        : Utils.getNextBullCode(animais);
      codigoOrigem = animal.codigo; // Store old offspring code
    }

    const confirmed = await Utils.confirm(
      'Confirmar Mudança',
      `Mudar "${animal.nome}" de ${Utils.categoryLabel(animal.categoria)} para ${Utils.categoryLabel(novaCategoria)}${novoCodigo !== animal.codigo ? `. Novo código: ${novoCodigo}` : ''}?`
    );

    if (!confirmed) return;

    animal.categoria = novaCategoria;
    animal.codigo = novoCodigo;
    animal.codigo_origem = codigoOrigem;

    await DB.saveAnimal(animal);
    await Sync.queueOperation('mudarCategoria', {
      id: animal.id,
      nova_categoria: novaCategoria,
      novo_codigo: novoCodigo,
      codigo_origem: codigoOrigem
    });

    Utils.toast(`"${animal.nome}" agora é ${Utils.categoryLabel(novaCategoria)} com código ${novoCodigo}!`, 'success');
    App.navigate('ficha', animal.id);
  },

  /**
   * Renderiza a lista de animais vendidos
   */
  async renderVendidos() {
    const vendidos = await DB.getAnimaisVendidos();
    const container = document.getElementById('vendidosList');

    if (vendidos.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📦</div>
          <p>Nenhum animal vendido</p>
        </div>
      `;
      return;
    }

    container.innerHTML = vendidos.map(a => `
      <div class="card" style="cursor:default; opacity: 0.8;">
        <div class="card-header">
          <div class="card-photo">${Utils.categoryEmoji(a.categoria)}</div>
          <div class="card-info">
            <div class="card-code">${a.codigo}</div>
            <div class="card-name">${a.nome}</div>
            <div class="card-category">${Utils.categoryLabel(a.categoria)} — Vendido em ${Utils.formatDate(a.data_venda)}</div>
          </div>
        </div>
      </div>
    `).join('');
  }
};
