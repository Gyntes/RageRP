(function () {
  const targetName = document.getElementById('target-name');

  function triggerClient(eventName, value) {
    if (typeof mp === 'undefined' || !mp || typeof mp.trigger !== 'function') return;
    mp.trigger(eventName, value);
  }

  function closeMenu() {
    triggerClient('ragerp:player-interaction:close-request');
  }

  document.getElementById('show-passport').addEventListener('click', function () {
    triggerClient('ragerp:player-interaction:action', 'vehicle-passport');
  });
  document.getElementById('close-menu').addEventListener('click', closeMenu);
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeMenu();
  });

  window.ragerpPlayerInteraction = {
    setTargetName: function (name) {
      targetName.textContent = String(name || 'Игрок').slice(0, 48);
    }
  };
})();
