/* ========================================
   Code.gs — Google Apps Script (Backend API)
   Deploy como Web App com acesso "Qualquer pessoa"
   ======================================== */

// ---- Configuração ----
// A planilha será obtida automaticamente (vinculada ao script)
// Ou defina o ID manualmente:
// const SPREADSHEET_ID = 'SEU_ID_AQUI';

function getSpreadsheet() {
  // Se vinculado à planilha:
  return SpreadsheetApp.getActiveSpreadsheet();
  // Se independente, use:
  // return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet(name) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // Add headers
    const headers = {
      'Animais': ['id', 'codigo', 'codigo_origem', 'nome', 'categoria', 'data_nascimento', 'codigo_mae', 'codigo_pai', 'foto_url', 'data_cadastro', 'status', 'data_venda', 'observacoes'],
      'Medicacoes': ['id', 'animal_id', 'codigo_animal', 'nome_medicacao', 'tipo', 'data_aplicacao', 'proxima_aplicacao', 'dose', 'observacoes'],
      'Cios': ['id', 'animal_id', 'codigo_vaca', 'data_cio', 'codigo_touro', 'previsao_parto', 'status', 'observacoes'],
      'Configuracoes': ['chave', 'valor']
    };
    if (headers[name]) {
      sheet.getRange(1, 1, 1, headers[name].length).setValues([headers[name]]);
      sheet.getRange(1, 1, 1, headers[name].length).setFontWeight('bold');
    }
  }
  return sheet;
}

// ---- Inicialização ----
function initSheets() {
  getSheet('Animais');
  getSheet('Medicacoes');
  getSheet('Cios');
  const configSheet = getSheet('Configuracoes');

  // Add default configs if empty
  const data = configSheet.getDataRange().getValues();
  if (data.length <= 1) {
    configSheet.appendRow(['alerta_medicacao_dias', '60']);
    configSheet.appendRow(['proximo_codigo_vaca', '1']);
    configSheet.appendRow(['proximo_codigo_touro', 'A']);
  }
}

// ---- Helpers ----
function sheetToArray(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = {};
    headers.forEach((h, j) => {
      row[h] = data[i][j] !== undefined && data[i][j] !== null ? String(data[i][j]) : '';
    });
    rows.push(row);
  }
  return rows;
}

function findRowIndex(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      return i + 1; // 1-based row number
    }
  }
  return -1;
}

function objectToRow(obj, headers) {
  return headers.map(h => obj[h] !== undefined && obj[h] !== null ? String(obj[h]) : '');
}

function response(success, data, error) {
  const output = JSON.stringify({ success, data, error });
  return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JSON);
}

// ---- GET Handler ----
function doGet(e) {
  try {
    const action = e.parameter.action;

    switch (action) {
      case 'getAnimais':
        return response(true, sheetToArray(getSheet('Animais')), null);

      case 'getAnimal': {
        const id = e.parameter.id;
        const animais = sheetToArray(getSheet('Animais'));
        const animal = animais.find(a => a.id === id);
        return response(!!animal, animal || null, animal ? null : 'Animal não encontrado');
      }

      case 'getMedicacoes': {
        let meds = sheetToArray(getSheet('Medicacoes'));
        const animalId = e.parameter.animal_id;
        if (animalId) {
          meds = meds.filter(m => m.animal_id === animalId);
        }
        return response(true, meds, null);
      }

      case 'getCios': {
        let cios = sheetToArray(getSheet('Cios'));
        const animalId = e.parameter.animal_id;
        if (animalId) {
          cios = cios.filter(c => c.animal_id === animalId);
        }
        return response(true, cios, null);
      }

      case 'getConfiguracoes': {
        const configs = sheetToArray(getSheet('Configuracoes'));
        return response(true, configs, null);
      }

      default:
        return response(false, null, 'Ação não reconhecida: ' + action);
    }
  } catch (err) {
    return response(false, null, err.toString());
  }
}

// ---- POST Handler ----
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    switch (action) {
      case 'addAnimal': {
        const sheet = getSheet('Animais');
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const row = objectToRow(body, headers);
        sheet.appendRow(row);
        return response(true, { id: body.id }, null);
      }

      case 'updateAnimal': {
        const sheet = getSheet('Animais');
        const rowIndex = findRowIndex(sheet, body.id);
        if (rowIndex === -1) return response(false, null, 'Animal não encontrado');

        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const row = objectToRow(body, headers);
        sheet.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
        return response(true, { id: body.id }, null);
      }

      case 'venderAnimal': {
        const sheet = getSheet('Animais');
        const rowIndex = findRowIndex(sheet, body.id);
        if (rowIndex === -1) return response(false, null, 'Animal não encontrado');

        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const statusCol = headers.indexOf('status') + 1;
        const vendaCol = headers.indexOf('data_venda') + 1;

        sheet.getRange(rowIndex, statusCol).setValue('vendido');
        sheet.getRange(rowIndex, vendaCol).setValue(body.data_venda);
        return response(true, { id: body.id }, null);
      }

      case 'mudarCategoria': {
        const sheet = getSheet('Animais');
        const rowIndex = findRowIndex(sheet, body.id);
        if (rowIndex === -1) return response(false, null, 'Animal não encontrado');

        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const catCol = headers.indexOf('categoria') + 1;
        const codCol = headers.indexOf('codigo') + 1;
        const origCol = headers.indexOf('codigo_origem') + 1;

        sheet.getRange(rowIndex, catCol).setValue(body.nova_categoria);
        sheet.getRange(rowIndex, codCol).setValue(body.novo_codigo);
        sheet.getRange(rowIndex, origCol).setValue(body.codigo_origem || '');
        return response(true, { id: body.id }, null);
      }

      case 'addMedicacao': {
        const sheet = getSheet('Medicacoes');
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const row = objectToRow(body, headers);
        sheet.appendRow(row);
        return response(true, { id: body.id }, null);
      }

      case 'addCio': {
        const sheet = getSheet('Cios');
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const row = objectToRow(body, headers);
        sheet.appendRow(row);
        return response(true, { id: body.id }, null);
      }

      case 'updateCio': {
        const sheet = getSheet('Cios');
        const rowIndex = findRowIndex(sheet, body.id);
        if (rowIndex === -1) return response(false, null, 'Cio não encontrado');

        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const row = objectToRow(body, headers);
        sheet.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
        return response(true, { id: body.id }, null);
      }

      case 'updateConfiguracao': {
        const sheet = getSheet('Configuracoes');
        const data = sheet.getDataRange().getValues();
        let found = false;
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][0]) === String(body.chave)) {
            sheet.getRange(i + 1, 2).setValue(body.valor);
            found = true;
            break;
          }
        }
        if (!found) {
          sheet.appendRow([body.chave, body.valor]);
        }
        return response(true, { chave: body.chave }, null);
      }

      case 'syncBatch': {
        // Process a batch of operations
        const operations = body.operations || [];
        const results = [];

        for (const op of operations) {
          try {
            // Recursively process each operation
            const fakeEvent = {
              postData: { contents: JSON.stringify(op) }
            };
            // We call doPost recursively — each op has its own action
            const opBody = op;
            switch (opBody.action) {
              case 'addAnimal':
              case 'updateAnimal':
              case 'venderAnimal':
              case 'mudarCategoria':
              case 'addMedicacao':
              case 'addCio':
              case 'updateCio':
              case 'updateConfiguracao':
                // Process inline
                const innerE = { postData: { contents: JSON.stringify(opBody) } };
                doPost(innerE);
                results.push({ success: true, action: opBody.action });
                break;
              default:
                results.push({ success: false, action: opBody.action, error: 'Ação desconhecida' });
            }
          } catch (opErr) {
            results.push({ success: false, error: opErr.toString() });
          }
        }

        return response(true, { results }, null);
      }

      default:
        return response(false, null, 'Ação não reconhecida: ' + action);
    }
  } catch (err) {
    return response(false, null, err.toString());
  }
}
