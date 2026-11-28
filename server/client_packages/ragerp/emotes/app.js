(function () {
  const overlay = document.getElementById('emote-overlay');

  function triggerClient(eventName, payload) {
    if (typeof mp === 'undefined' || !mp || typeof mp.trigger !== 'function') {
      console.error('[RageRP emotes] The client bridge is unavailable.');
      return;
    }
    mp.trigger(eventName, payload);
  }

  function closeMenu() {
    triggerClient('ragerp:emotes:close');
  }

  document.querySelectorAll('[data-emote]').forEach(function (button) {
    button.addEventListener('click', function () {
      triggerClient('ragerp:emotes:select', button.dataset.emote);
    });
  });

  document.getElementById('close-emotes').addEventListener('click', closeMenu);
  overlay.addEventListener('click', function (event) {
    if (event.target === overlay) closeMenu();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
    }
  });

  window.ragerpEmotes = {
    setVisible: function (visible) {
      const isVisible = visible === true;
      overlay.classList.toggle('is-open', isVisible);
      overlay.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
      if (isVisible) document.querySelector('[data-emote]').focus();
    }
  };
})();
