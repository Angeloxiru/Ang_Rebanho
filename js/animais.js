/* ========================================
   animais.js — CRUD de Animais
   ======================================== */

const Animais = {
  currentAnimalId: null, // Animal being viewed/edited
  photos: { cad: [], edit: [] }, // Stores up to 3 photos per form

  /**
   * Abre a câmera para tirar foto
   */
  tirarFoto(prefix) {
    if (Animais.photos[prefix].length >= 3) {
      Utils.toast('Máximo de 3 fotos atingido', 'error');
      return;
    }
    document.getElementById(prefix + 'FotoFile').click();
  },

  /**
   * Abre a galeria para escolher foto
   */
  escolherFoto(prefix) {
    if (Animais.photos[prefix].length >= 3) {
      Utils.toast('Máximo de 3 fotos atingido', 'error');
      return;
    }
    document.getElementById(prefix + 'FotoGaleria').click();
  },

  /**
   * Toggle do campo de URL
   */
  toggleUrlInput(prefix) {
    const urlDiv = document.getElementById(prefix + 'UrlInput');
    urlDiv.style.display = urlDiv.style.display === 'none' ? 'block' : 'none';
  },

  /**
   * Adiciona foto via URL
   */
  addUrlPhoto(prefix) {
    if (Animais.photos[prefix].length >= 3) {
      Utils.toast('Máximo de 3 fotos atingido', 'error');
      return;
    }
    const urlInput = document.getElementById(prefix + 'Foto');
    const url = urlInput.value.trim();
    if (!url) return;
    Animais.photos[prefix].push(url);
    urlInput.value = '';
    Animais.renderPhotoThumbs(prefix);
  },

  /**
   * Quando uma foto é selecionada (câmera ou galeria)
   */
  onFotoSelected(input, prefix) {
    const file = input.files[0];
    if (!file) return;
    if (Animais.photos[prefix].length >= 3) {
      Utils.toast('Máximo de 3 fotos atingido', 'error');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        const MAX = 800;
        let w = img.width;
        let h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        Animais.photos[prefix].push(dataUrl);
        Animais.renderPhotoThumbs(prefix);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    input.value = '';
  },

  /**
   * Renderiza as thumbnails de fotos no formulário
   */
  renderPhotoThumbs(prefix) {
    const container = document.getElementById(prefix + 'PhotoThumbs');
    const photos = Animais.photos[prefix];

    if (photos.length === 0) {
      container.innerHTML = '<div class="photo-empty-hint">Nenhuma foto adicionada</div>';
    } else {
      container.innerHTML = photos.map((src, i) => `
        <div class="photo-thumb">
          <img src="${src}" alt="Foto ${i + 1}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22/>'">
          <button type="button" class="photo-thumb-remove" onclick="Animais.removerFoto('${prefix}', ${i})">X</button>
          <span class="photo-thumb-num">${i + 1}</span>
        </div>
      `).join('');
    }

    // Hide capture buttons if 3 photos reached
    const captureEl = document.getElementById(prefix + 'PhotoCapture');
    captureEl.style.display = photos.length >= 3 ? 'none' : '';
  },

  /**
   * Remove uma foto pelo índice
   */
  removerFoto(prefix, index) {
    Animais.photos[prefix].splice(index, 1);
    Animais.renderPhotoThumbs(prefix);
  },

  /**
   * Retorna array de fotos do formulário (para salvar)
   */
  getPhotosArray(prefix) {
    return Animais.photos[prefix].slice(0, 3);
  },

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
  async onCategoriaChange() {
    await Animais.populateParentSelects('cadMae', 'cadPai');
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
    const campo = document.getElementById('cadCampo').value;
    const fotos = Animais.getPhotosArray('cad');
    const obs = document.getElementById('cadObs').value.trim();

    if (!nome) {
      Utils.toast('Informe o nome do animal', 'error');
      return;
    }
    if (!categoria) {
      Utils.toast('Selecione a categoria', 'error');
      return;
    }
    if (!campo) {
      Utils.toast('Selecione o campo (localização)', 'error');
      return;
    }

    const animais = await DB.getAnimaisAtivos();
    const codigo = Utils.generateAnimalCode(categoria, codigoMae, codigoPai, animais);
    const today = Utils.today();

    const animal = {
      id: Utils.generateId(),
      codigo,
      codigo_origem: '',
      nome,
      categoria,
      data_nascimento: nascimento || '',
      codigo_mae: codigoMae || '',
      codigo_pai: codigoPai || '',
      campo: campo,
      campo_desde: today,
      foto_url: fotos[0] || '',
      foto_url2: fotos[1] || '',
      foto_url3: fotos[2] || '',
      data_cadastro: today,
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
    document.getElementById('cadCampo').value = '';
    document.getElementById('cadMae').value = '';
    document.getElementById('cadPai').value = '';
    document.getElementById('cadFoto').value = '';
    Animais.photos.cad = [];
    Animais.renderPhotoThumbs('cad');
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
    const campo = document.getElementById('filterCampo').value;

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
    if (campo) {
      animais = animais.filter(a => a.campo === campo);
    }

    // Sort: Campo de Cima first, then Campo de Baixo, then no campo; within each group by código
    animais.sort((a, b) => {
      const campoOrder = { campo_cima: 0, campo_baixo: 1 };
      const ca = campoOrder[a.campo] !== undefined ? campoOrder[a.campo] : 2;
      const cb = campoOrder[b.campo] !== undefined ? campoOrder[b.campo] : 2;
      if (ca !== cb) return ca - cb;
      return a.codigo.localeCompare(b.codigo, undefined, { numeric: true });
    });

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

    // Group by campo with headers
    let html = '';
    let lastCampo = null;
    const today = Utils.today();

    animais.forEach(a => {
      if (a.campo !== lastCampo) {
        lastCampo = a.campo;
        const campoLabel = Utils.campoLabel(a.campo);
        html += `<div class="campo-group-header">${campoLabel}</div>`;
      }

      const diasNoCampo = a.campo_desde ? Utils.diffDays(a.campo_desde, today) : null;
      const diasLabel = diasNoCampo !== null ? `${diasNoCampo}d no campo` : '';

      html += `
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
              <div class="card-category">
                ${Utils.categoryLabel(a.categoria)}
                ${a.campo ? `<span class="badge-campo badge-${a.campo}">${Utils.campoLabel(a.campo)}</span>` : ''}
                ${diasLabel ? `<span class="badge-dias">${diasLabel}</span>` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
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

    // Header — photo gallery
    const photoEl = document.getElementById('fichaPhoto');
    const allPhotos = [animal.foto_url, animal.foto_url2, animal.foto_url3].filter(u => u);
    if (allPhotos.length > 0) {
      photoEl.innerHTML = `<img src="${allPhotos[0]}" alt="${animal.nome}" onerror="this.parentElement.innerHTML='${Utils.categoryEmoji(animal.categoria)}'">`;
      if (allPhotos.length > 1) {
        photoEl.innerHTML += `<div class="ficha-photo-dots">${allPhotos.map((_, i) => `<span class="ficha-dot${i === 0 ? ' active' : ''}" onclick="Animais.showFichaPhoto(${i})"></span>`).join('')}</div>`;
        Animais._fichaPhotos = allPhotos;
        Animais._fichaPhotoIndex = 0;
      }
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
    if (animal.campo) {
      const diasNoCampo = animal.campo_desde ? Utils.diffDays(animal.campo_desde, Utils.today()) : null;
      infoHtml += `<div class="info-row"><span class="info-label">Campo</span><span class="info-value">${Utils.campoLabel(animal.campo)}${diasNoCampo !== null ? ` (${diasNoCampo} dias)` : ''}</span></div>`;
      if (animal.campo_desde) {
        infoHtml += `<div class="info-row"><span class="info-label">No campo desde</span><span class="info-value">${Utils.formatDate(animal.campo_desde)}</span></div>`;
      }
    }
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
   * Alterna foto na ficha do animal
   */
  showFichaPhoto(index) {
    const photos = Animais._fichaPhotos;
    if (!photos || !photos[index]) return;
    Animais._fichaPhotoIndex = index;
    const photoEl = document.getElementById('fichaPhoto');
    const img = photoEl.querySelector('img');
    if (img) img.src = photos[index];
    photoEl.querySelectorAll('.ficha-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
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
    document.getElementById('editCampo').value = animal.campo || '';
    document.getElementById('editMae').value = animal.codigo_mae || '';
    document.getElementById('editPai').value = animal.codigo_pai || '';
    // Load existing photos
    Animais.photos.edit = [animal.foto_url, animal.foto_url2, animal.foto_url3].filter(u => u);
    Animais.renderPhotoThumbs('edit');
    document.getElementById('editFoto').value = '';
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
    const novoCampo = document.getElementById('editCampo').value || '';
    // If campo changed, update campo_desde
    if (novoCampo !== (animal.campo || '')) {
      animal.campo = novoCampo;
      animal.campo_desde = Utils.today();
    }
    animal.codigo_mae = document.getElementById('editMae').value || '';
    animal.codigo_pai = document.getElementById('editPai').value || '';
    const editPhotos = Animais.getPhotosArray('edit');
    animal.foto_url = editPhotos[0] || '';
    animal.foto_url2 = editPhotos[1] || '';
    animal.foto_url3 = editPhotos[2] || '';
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
   * Move o animal para outro campo
   */
  async moverCampo() {
    const animal = await DB.getAnimal(Animais.currentAnimalId);
    if (!animal) return;

    const campoAtual = animal.campo || '';
    const novoCampo = campoAtual === 'campo_cima' ? 'campo_baixo' : 'campo_cima';
    const novoLabel = Utils.campoLabel(novoCampo);

    const confirmed = await Utils.confirm(
      'Mover Campo',
      `Mover "${animal.nome}" (${animal.codigo}) para ${novoLabel}?`
    );
    if (!confirmed) return;

    animal.campo = novoCampo;
    animal.campo_desde = Utils.today();

    await DB.saveAnimal(animal);
    await Sync.queueOperation('updateAnimal', animal);

    Utils.toast(`"${animal.nome}" movido para ${novoLabel}!`, 'success');
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
