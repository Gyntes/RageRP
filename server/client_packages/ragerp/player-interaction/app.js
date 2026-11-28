(function () {
  const targetName = document.getElementById('target-name');
  const interactionType = document.getElementById('interaction-type');
  const playerAction = document.getElementById('show-passport');
  const vehicleActions = Array.from(document.querySelectorAll('.vehicle-action'));

  function triggerClient(eventName, value) {
    if (typeof mp === 'undefined' || !mp || typeof mp.trigger !== 'function') return;
    mp.trigger(eventName, value);
  }

  function closeMenu() {
    triggerClient('ragerp:player-interaction:close-request');
  }

  document.querySelectorAll('[data-interaction-action]').forEach(function (button) {
    button.addEventListener('click', function () {
      triggerClient('ragerp:player-interaction:action', button.dataset.interactionAction);
    });
  });
  document.getElementById('close-menu').addEventListener('click', closeMenu);
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeMenu();
  });

  window.ragerpPlayerInteraction = {
    setTargetName: function (name) {
      targetName.textContent = String(name || 'Игрок').slice(0, 48);
    },
    setPlayerMode: function (name) {
      targetName.textContent = String(name || 'Игрок').slice(0, 48);
      interactionType.textContent = 'ВЗАИМОДЕЙСТВИЕ';
      playerAction.hidden = false;
      vehicleActions.forEach(function (button) { button.hidden = true; });
    },
    setVehicleMode: function (name) {
      targetName.textContent = String(name || 'Автомобиль').slice(0, 48);
      interactionType.textContent = 'АВТОМОБИЛЬ';
      playerAction.hidden = true;
      vehicleActions.forEach(function (button) { button.hidden = false; });
    }
  };
})();
