# Gestao de Rebanho — PWA

Sistema web (PWA) para gestao de pequeno rebanho de gado (20 a 50 cabecas). Funciona offline, roda no celular e usa Google Sheets como banco de dados.

## Arquitetura

```
[PWA no GitHub Pages] <--fetch/POST--> [Google Apps Script (API)] <--le/escreve--> [Google Sheets]
```

- **Frontend:** HTML, CSS e JavaScript puro (sem frameworks)
- **Backend:** Google Apps Script (Web App publica)
- **Banco de dados:** Google Sheets (planilha com multiplas abas)
- **Hospedagem:** GitHub Pages
- **Offline:** Service Worker + IndexedDB para cache local

## Funcionalidades

- **Dashboard** com resumo do rebanho por categoria e alertas
- **Cadastro de animais** com geracao automatica de codigo
  - Vacas: numeros sequenciais (1, 2, 3...)
  - Touros: letras sequenciais (A, B, C...)
  - Filhotes: codigo da mae + codigo do pai (ex: 3B)
- **Ficha do animal** com todas as informacoes, historico e arvore genealogica
- **Registro de medicacoes** (vacinas, vermifugos, antibioticos)
- **Registro de cios** com calculo automatico de previsao de parto (283 dias)
- **Alertas** de partos proximos e medicacoes atrasadas
- **Mudanca de categoria** (terneira -> novilha -> vaca) com novo codigo
- **Venda de animais** com arquivo historico
- **Modo offline completo** com sincronizacao automatica
- **Configuracoes** editaveis (dias de alerta, URL da API)

## Como Configurar (Passo a Passo)

### 1. Criar a Planilha Google Sheets

1. Acesse [Google Sheets](https://sheets.google.com)
2. Crie uma nova planilha chamada **"Gestao Rebanho"**
3. As abas serao criadas automaticamente pelo script, mas voce pode criar manualmente:
   - `Animais` — dados dos animais
   - `Medicacoes` — registros de medicacoes
   - `Cios` — registros de cios e gestacoes
   - `Configuracoes` — configuracoes do sistema

### 2. Criar o Google Apps Script

1. Na planilha, va em **Extensoes > Apps Script**
2. Apague o codigo existente
3. Copie todo o conteudo do arquivo `google-apps-script/Code.gs` deste repositorio
4. Cole no editor do Apps Script
5. Salve o projeto (Ctrl+S)
6. Execute a funcao `initSheets` uma vez (selecione no menu e clique em Executar)
7. Autorize o script quando solicitado

### 3. Publicar o Google Apps Script como Web App

1. No Apps Script, clique em **Implantar > Nova implantacao**
2. Selecione o tipo **App da Web**
3. Configure:
   - **Descricao:** API Gestao Rebanho
   - **Executar como:** Eu mesmo
   - **Quem tem acesso:** Qualquer pessoa
4. Clique em **Implantar**
5. Copie a **URL do app da web** gerada
6. **IMPORTANTE:** Sempre que alterar o codigo do Apps Script, faca uma nova implantacao

### 4. Configurar a URL da API no App

1. Abra o app (GitHub Pages ou localmente)
2. Va em **Configuracoes** (icone de engrenagem)
3. Cole a URL do Web App no campo "URL da API"
4. Clique em **Salvar URL da API**
5. O app tentara sincronizar automaticamente

### 5. Ativar o GitHub Pages

1. No repositorio GitHub, va em **Settings > Pages**
2. Em "Source", selecione **Deploy from a branch**
3. Selecione a branch **main** e pasta **/ (root)**
4. Clique em **Save**
5. Aguarde alguns minutos e acesse a URL gerada

## Como Usar

### Tela Inicial (Dashboard)
- Veja o resumo do rebanho (total por categoria)
- Confira alertas de partos proximos e medicacoes atrasadas
- Use os botoes rapidos para cadastrar animal, registrar medicacao ou cio

### Cadastrar Animal
1. Toque em "Cadastrar Animal"
2. Preencha nome e categoria
3. Selecione mae e pai se conhecidos
4. O codigo sera gerado automaticamente e mostrado antes de salvar
5. Toque em "Salvar Animal"

### Registrar Medicacao
1. Toque em "Registrar Medicacao" (ou na ficha do animal)
2. Selecione o animal, nome do remedio, tipo e data
3. Opcionalmente informe dose e proxima aplicacao

### Registrar Cio
1. Toque em "Registrar Cio"
2. Selecione a vaca e a data do cio observado
3. A previsao de parto (283 dias) e calculada automaticamente
4. Atualize o status conforme o acompanhamento (confirmada, nasceu, perdeu)

### Mudar Categoria
1. Na ficha do animal, toque em "Mudar Categoria"
2. Selecione a nova categoria
3. Se for promovido a vaca ou touro, um novo codigo sera gerado automaticamente

## Como Funciona o Modo Offline

1. **Com internet:** o app carrega dados do Google Sheets e salva no cache local (IndexedDB)
2. **Sem internet:** o app funciona normalmente lendo do cache local
3. **Edicoes offline:** sao salvas em uma fila de sincronizacao local
4. **Indicador visual:** mostra quantas alteracoes estao pendentes
5. **Ao voltar online:** as alteracoes sao enviadas automaticamente ao Google Sheets

## Estrutura de Arquivos

```
/
├── index.html                    # Pagina principal (SPA)
├── manifest.json                 # Configuracao da PWA
├── sw.js                         # Service Worker
├── css/
│   └── style.css                 # Estilos (mobile-first, verde)
├── js/
│   ├── app.js                    # Logica principal e roteamento
│   ├── api.js                    # Comunicacao com Google Apps Script
│   ├── db.js                     # IndexedDB — cache local e fila offline
│   ├── sync.js                   # Sincronizacao online/offline
│   ├── animais.js                # CRUD de animais
│   ├── medicacoes.js             # CRUD de medicacoes
│   ├── cios.js                   # CRUD de cios
│   ├── dashboard.js              # Dashboard e alertas
│   ├── config.js                 # Tela de configuracoes
│   └── utils.js                  # Funcoes utilitarias
├── icons/
│   ├── icon-192.png              # Icone PWA 192x192
│   └── icon-512.png              # Icone PWA 512x512
├── google-apps-script/
│   └── Code.gs                   # Codigo do Google Apps Script
└── README.md                     # Esta documentacao
```

## Estrutura do Google Sheets

### Aba: Animais
| Coluna | Descricao |
|--------|-----------|
| id | ID unico (UUID) |
| codigo | Codigo do animal (gerado automaticamente) |
| codigo_origem | Codigo anterior (se foi filhote promovido) |
| nome | Nome do animal |
| categoria | vaca, touro, novilha, novilho, terneiro, terneira |
| data_nascimento | Data de nascimento |
| codigo_mae | Codigo da mae |
| codigo_pai | Codigo do pai |
| foto_url | Link da foto |
| data_cadastro | Data de cadastro |
| status | ativo ou vendido |
| data_venda | Data da venda |
| observacoes | Anotacoes |

### Aba: Medicacoes
| Coluna | Descricao |
|--------|-----------|
| id | ID unico |
| animal_id | ID do animal |
| codigo_animal | Codigo do animal |
| nome_medicacao | Nome do remedio |
| tipo | vacina, vermifugo, antibiotico, outro |
| data_aplicacao | Data de aplicacao |
| proxima_aplicacao | Proxima aplicacao prevista |
| dose | Dosagem |
| observacoes | Notas |

### Aba: Cios
| Coluna | Descricao |
|--------|-----------|
| id | ID unico |
| animal_id | ID da vaca |
| codigo_vaca | Codigo da vaca |
| data_cio | Data do cio observado |
| codigo_touro | Codigo do touro |
| previsao_parto | Data prevista do parto (cio + 283 dias) |
| status | aguardando, confirmada, nasceu, perdeu |
| observacoes | Notas |

### Aba: Configuracoes
| Chave | Descricao |
|-------|-----------|
| alerta_medicacao_dias | Dias para alerta de medicacao (padrao: 60) |
| proximo_codigo_vaca | Proximo numero para vacas |
| proximo_codigo_touro | Proxima letra para touros |

## Regras de Codigo dos Animais

- **Vacas:** numeros sequenciais (1, 2, 3...)
- **Touros:** letras sequenciais (A, B, C... Z, AA, AB...)
- **Filhotes:** codigo da mae + codigo do pai (ex: vaca 3 + touro B = 3B)
- **Duplicatas:** sufixo incremental (3B, 3B-2, 3B-3...)
- **Pais desconhecidos:** usa ? (ex: 3? ou ?B)
- **Promocao:** ao virar vaca/touro, ganha novo codigo e o antigo fica em "codigo_origem"

## Licenca

Este projeto e de uso livre. Faca o que quiser com ele.
