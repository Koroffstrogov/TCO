(function (TCO) {
  'use strict';

  let state = TCO.storage.loadState();
  let ui;

  function calculate() {
    return TCO.calculations.calculateAllScenarios(state.settings, state.scenarios, state.depreciationProfiles);
  }

  function refresh(save) {
    if (save && !TCO.storage.saveState(state)) {
      ui.showMessage("La sauvegarde locale est indisponible ; l'application reste utilisable pour cette session.", 'error');
    }
    ui.renderDynamic(calculate());
  }

  ui = TCO.ui.initUi({
    state: state,
    onChange: function () { refresh(true); }
  });
  ui.renderAll(calculate());

  document.getElementById('save-button').addEventListener('click', function () {
    if (TCO.storage.saveState(state)) ui.showMessage('Données sauvegardées dans ce navigateur.', 'success');
    else ui.showMessage('Impossible d’utiliser le stockage local de ce navigateur.', 'error');
  });

  document.getElementById('export-button').addEventListener('click', function () {
    const json = TCO.storage.exportState(state);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tco-export-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    ui.showMessage('Export JSON préparé.', 'success');
  });

  const importFile = document.getElementById('import-file');
  document.getElementById('import-button').addEventListener('click', function () {
    importFile.value = '';
    importFile.click();
  });
  importFile.addEventListener('change', function () {
    const file = importFile.files && importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener('load', function () {
      try {
        state = TCO.storage.importState(String(reader.result));
        TCO.storage.saveState(state);
        ui.setState(state);
        ui.renderAll(calculate());
        ui.showMessage('Import terminé et sauvegardé.', 'success');
      } catch (error) {
        ui.showMessage(error.message || "L'import a échoué.", 'error');
      }
    });
    reader.addEventListener('error', function () { ui.showMessage('Impossible de lire ce fichier.', 'error'); });
    reader.readAsText(file, 'utf-8');
  });

  document.getElementById('reset-button').addEventListener('click', function () {
    if (!window.confirm('Réinitialiser tous les paramètres, scénarios et profils ?')) return;
    state = TCO.storage.resetState();
    TCO.storage.saveState(state);
    ui.setState(state);
    ui.renderAll(calculate());
    ui.showMessage('Application réinitialisée.', 'success');
  });
}(window.TCO = window.TCO || {}));
