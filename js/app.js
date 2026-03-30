/* ========================================
   app.js — Lógica principal e roteamento
   ======================================== */

const APP_VERSION = '1.5.0';

const App = {
  currentScreen: 'dashboard',
  history: [],

  /**
   * Inicializa o aplicativo
   */
  async init() {
    try {
      // Show version in header
      document.getElementById('appVersion').textContent = 'v' + APP_VERSION;

      // Init IndexedDB
      await DB.init();
      await DB.initDefaults();

      // Init sync
      Sync.init();

      // Check auto-promotion of terneiros
      await App.checkAutoPromotion();

      // Render initial screen
      await Dashboard.render();

      // Try initial sync if configured
      if (navigator.onLine) {
        const configured = await API.isConfigured();
        if (configured) {
          Sync.syncNow();
        }
      }

      // Register Service Worker
      if ('serviceWorker' in navigator) {
        try {
          await navigator.serviceWorker.register('./sw.js');
          console.log('Service Worker registrado com sucesso');
        } catch (err) {
          console.log('Falha ao registrar Service Worker:', err);
        }
      }

    } catch (err) {
      console.error('Erro ao inicializar app:', err);
      Utils.toast('Erro ao inicializar o aplicativo', 'error');
    }
  },

  /**
   * Verifica se há terneiros/terneiras que devem ser promovidos automaticamente
   */
  async checkAutoPromotion() {
    const meses = parseInt(await DB.getConfig('auto_promocao_meses') || '12', 10);
    const animais = await DB.getAnimaisAtivos();
    const today = Utils.today();
    let promoted = 0;

    for (const animal of animais) {
      if (!['terneira', 'terneiro'].includes(animal.categoria)) continue;
      if (!animal.data_nascimento) continue;

      const nascimento = new Date(animal.data_nascimento + 'T00:00:00');
      const limite = new Date(nascimento);
      limite.setMonth(limite.getMonth() + meses);
      const limiteStr = limite.toISOString().split('T')[0];

      if (today >= limiteStr) {
        const novaCategoria = animal.categoria === 'terneira' ? 'novilha' : 'novilho';
        animal.categoria = novaCategoria;
        await DB.saveAnimal(animal);
        await Sync.queueOperation('updateAnimal', animal);
        promoted++;
      }
    }

    if (promoted > 0) {
      Utils.toast(`${promoted} animal(is) promovido(s) automaticamente!`, 'success');
    }
  },

  /**
   * Navega para uma tela
   */
  async navigate(screen, param) {
    // Save current screen to history
    if (screen !== App.currentScreen) {
      App.history.push({ screen: App.currentScreen, param: null });
    }

    App.currentScreen = screen;

    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    // Update nav buttons
    document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.remove('active'));

    // Map screen to nav button and section
    const screenMap = {
      dashboard: { section: 'screenDashboard', nav: 'navDashboard', title: 'Gestão de Rebanho', back: false },
      animais: { section: 'screenAnimais', nav: 'navAnimais', title: 'Animais', back: false },
      cadastroAnimal: { section: 'screenCadastroAnimal', nav: null, title: 'Cadastrar Animal', back: true },
      editarAnimal: { section: 'screenEditarAnimal', nav: null, title: 'Editar Animal', back: true },
      ficha: { section: 'screenFicha', nav: 'navAnimais', title: 'Ficha do Animal', back: true },
      registrarMedicacao: { section: 'screenRegistrarMedicacao', nav: 'navMedicacao', title: 'Registrar Medicação', back: true },
      registrarCio: { section: 'screenRegistrarCio', nav: 'navCio', title: 'Registrar Cio', back: true },
      configuracoes: { section: 'screenConfiguracoes', nav: 'navConfig', title: 'Configurações', back: false },
      vendidos: { section: 'screenVendidos', nav: null, title: 'Animais Vendidos', back: true },
      mudarCategoria: { section: 'screenMudarCategoria', nav: null, title: 'Mudar Categoria', back: true },
      timeline: { section: 'screenTimeline', nav: null, title: 'Timeline Medicações', back: true }
    };

    const config = screenMap[screen];
    if (!config) return;

    // Show the screen
    document.getElementById(config.section).classList.add('active');

    // Update header
    document.getElementById('headerTitle').textContent = config.title;
    const backBtn = document.getElementById('btnBack');
    backBtn.classList.toggle('visible', config.back);

    // Update nav
    if (config.nav) {
      document.getElementById(config.nav).classList.add('active');
    }

    // Screen-specific initialization
    switch (screen) {
      case 'dashboard':
        await Dashboard.render();
        break;
      case 'animais':
        await Animais.renderList();
        break;
      case 'cadastroAnimal':
        await Animais.populateParentSelects('cadMae', 'cadPai');
        document.getElementById('cadCategoria').value = '';
        document.getElementById('codePreview').style.display = 'none';
        break;
      case 'ficha':
        if (param) await Animais.showFicha(param);
        break;
      case 'registrarMedicacao':
        await Medicacoes.initForm();
        break;
      case 'registrarCio':
        await Cios.initForm();
        break;
      case 'configuracoes':
        await Config.init();
        break;
      case 'vendidos':
        await Animais.renderVendidos();
        break;
      case 'timeline':
        await Medicacoes.renderTimeline();
        break;
    }

    // Scroll to top
    window.scrollTo(0, 0);
  },

  /**
   * Volta para a tela anterior
   */
  goBack() {
    if (App.history.length > 0) {
      const prev = App.history.pop();
      App.currentScreen = ''; // Reset to allow navigation
      App.navigate(prev.screen, prev.param);
      // Remove the duplicate history entry added by navigate
      App.history.pop();
    } else {
      App.navigate('dashboard');
    }
  },

  /**
   * Recarrega a tela atual (usado após sync)
   * Não recarrega telas de formulário para não perder dados do usuário
   */
  refreshCurrentScreen() {
    const formScreens = ['cadastroAnimal', 'editarAnimal', 'registrarMedicacao', 'registrarCio', 'mudarCategoria'];
    if (formScreens.includes(App.currentScreen)) {
      return; // Don't refresh form screens — would wipe user input
    }
    App.navigate(App.currentScreen, Animais.currentAnimalId);
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
