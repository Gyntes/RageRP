(function () {
  const storageKey = 'ragerp:settings:v1';
  const footerMessage = document.getElementById('footer-message');
  const toast = document.getElementById('settings-toast');
  const bindingButtons = Array.from(document.querySelectorAll('[data-bind]'));
  const defaultSettings = {
    general: {
      showHud: true,
      showRadar: true,
      hudOpacity: 100,
      nametagDistance: 100,
      panelScale: 100,
      phoneScale: 100,
      phoneRight: 0,
      phoneBottom: 0
    },
    bindings: {
      phoneUp: 38,
      phoneTab: 9,
      inventory: 73,
      vehicleLock: 76,
      engine: 50
    },
    graphics: { lodScale: 100 },
    combat: {
      showCrosshair: true,
      crosshairScale: 100,
      crosshairColor: '#f0f6f2',
      showAmmo: true
    },
    media: {
      voiceMuteUnderHours: 0,
      showCallNotifications: true,
      callNotificationSound: true,
      showChat: true
    }
  };
  const settingBounds = {
    'general.hudOpacity': [20, 100],
    'general.nametagDistance': [50, 170],
    'general.panelScale': [90, 105],
    'general.phoneScale': [75, 130],
    'general.phoneRight': [0, 15],
    'general.phoneBottom': [0, 15],
    'graphics.lodScale': [50, 150],
    'combat.crosshairScale': [60, 150],
    'media.voiceMuteUnderHours': [0, 200]
  };
  const keyLabels = {
    9: 'TAB',
    13: 'ENTER',
    27: 'ESC',
    32: 'SPACE',
    37: '←',
    38: '↑',
    39: '→',
    40: '↓',
    45: 'INSERT',
    46: 'DELETE'
  };
  let state = null;
  let capturing = null;
  let toastTimer = null;

  function cloneDefaults() {
    return JSON.parse(JSON.stringify(defaultSettings));
  }

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function normalizeSettings(value) {
    const normalized = cloneDefaults();
    if (!value || typeof value !== 'object' || Array.isArray(value)) return normalized;

    Object.keys(settingBounds).forEach(function (path) {
      const parts = path.split('.');
      const source = value[parts[0]];
      if (!source || typeof source !== 'object') return;
      const fallback = parts.reduce(function (current, key) {
        return current && current[key];
      }, normalized);
      const bounded = clamp(
        source[parts[1]],
        settingBounds[path][0],
        settingBounds[path][1],
        fallback
      );
      normalized[parts[0]][parts[1]] = path === 'media.voiceMuteUnderHours'
        ? Math.round(bounded)
        : bounded;
    });

    ['showHud', 'showRadar'].forEach(function (key) {
      if (value.general && typeof value.general[key] === 'boolean') {
        normalized.general[key] = value.general[key];
      }
    });
    ['showCrosshair', 'showAmmo'].forEach(function (key) {
      if (value.combat && typeof value.combat[key] === 'boolean') {
        normalized.combat[key] = value.combat[key];
      }
    });
    ['showCallNotifications', 'callNotificationSound', 'showChat'].forEach(function (key) {
      if (value.media && typeof value.media[key] === 'boolean') {
        normalized.media[key] = value.media[key];
      }
    });
    if (value.combat && /^#[0-9a-f]{6}$/i.test(String(value.combat.crosshairColor || ''))) {
      normalized.combat.crosshairColor = String(value.combat.crosshairColor);
    }

    if (value.bindings && typeof value.bindings === 'object' && !Array.isArray(value.bindings)) {
      const actions = Object.keys(defaultSettings.bindings);
      const candidate = {};
      let valid = true;
      actions.forEach(function (action) {
        const code = Number(value.bindings[action]);
        if (!Number.isInteger(code) || code < 1 || code > 255 || code === 27 || code === 121 ||
            Object.keys(candidate).some(function (key) { return candidate[key] === code; })) {
          valid = false;
          return;
        }
        candidate[action] = code;
      });
      if (valid && actions.every(function (action) {
        return Object.prototype.hasOwnProperty.call(candidate, action);
      })) {
        normalized.bindings = candidate;
      }
    }
    return normalized;
  }

  function getPath(path) {
    return path.split('.').reduce(function (value, key) {
      return value && value[key];
    }, state);
  }

  function setPath(path, value) {
    const parts = path.split('.');
    let target = state;
    for (let index = 0; index < parts.length - 1; index += 1) {
      target = target[parts[index]];
    }
    target[parts[parts.length - 1]] = value;
  }

  function keyLabel(code) {
    const number = Number(code);
    if (keyLabels[number]) return keyLabels[number];
    if (number >= 48 && number <= 57) return String.fromCharCode(number);
    if (number >= 65 && number <= 90) return String.fromCharCode(number);
    if (number >= 112 && number <= 123) return `F${number - 111}`;
    return `KEY ${number}`;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    if (toastTimer !== null) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastTimer = null;
      toast.classList.remove('is-visible');
    }, 2600);
  }

  function sendToClient() {
    if (typeof mp === 'undefined' || !mp || typeof mp.trigger !== 'function') return;
    try {
      mp.trigger('ragerp:settings:apply', JSON.stringify(state));
    } catch (error) {
      console.error('[RageRP settings] Could not apply settings in game:', error);
      showToast('Не удалось применить настройки в игре.');
    }
  }

  function persistAndApply() {
    let saved = false;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      saved = true;
    } catch (error) {
      console.error('[RageRP settings] Could not save local settings:', error);
    }

    footerMessage.textContent = saved
      ? 'Изменения сохранены на этом устройстве'
      : 'Не удалось сохранить настройки локально';
    footerMessage.classList.toggle('is-error', !saved);
    sendToClient();
  }

  function renderSettings() {
    document.documentElement.style.setProperty(
      '--panel-scale',
      String(Number(state.general.panelScale) / 100)
    );

    document.querySelectorAll('[data-setting]').forEach(function (input) {
      const value = getPath(input.dataset.setting);
      if (input.type === 'checkbox') {
        input.checked = Boolean(value);
      } else {
        input.value = String(value);
        const output = document.querySelector(`[data-output="${input.dataset.setting}"]`);
        if (output) {
          output.textContent = input.dataset.setting === 'media.voiceMuteUnderHours'
            ? `${value}ч`
            : `${value}%`;
        }
      }
    });

    bindingButtons.forEach(function (button) {
      button.textContent = keyLabel(state.bindings[button.dataset.bind]);
      button.classList.remove('is-capturing');
    });
  }

  function loadSettings() {
    try {
      state = normalizeSettings(JSON.parse(localStorage.getItem(storageKey) || 'null'));
    } catch (error) {
      console.error('[RageRP settings] Could not read local settings:', error);
      state = cloneDefaults();
      showToast('Сохранённые настройки не прочитаны; загружены значения по умолчанию.');
    }
    renderSettings();
    persistAndApply();
  }

  function closeSettings() {
    capturing = null;
    if (typeof mp !== 'undefined' && mp && typeof mp.trigger === 'function') {
      mp.trigger('ragerp:settings:close-request');
    }
  }

  document.querySelectorAll('.tab-button').forEach(function (button) {
    button.addEventListener('click', function () {
      const tab = button.dataset.tab;
      document.querySelectorAll('.tab-button').forEach(function (candidate) {
        candidate.classList.toggle('is-active', candidate === button);
      });
      document.querySelectorAll('[data-tab-panel]').forEach(function (panel) {
        const active = panel.dataset.tabPanel === tab;
        panel.hidden = !active;
        panel.classList.toggle('is-active', active);
      });
    });
  });

  document.querySelectorAll('[data-setting]').forEach(function (input) {
    input.addEventListener(input.type === 'range' ? 'input' : 'change', function () {
      const value = input.type === 'checkbox'
        ? input.checked
        : input.type === 'color'
          ? input.value
          : Number(input.value);
      setPath(input.dataset.setting, value);
      renderSettings();
      persistAndApply();
    });
  });

  bindingButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      if (capturing) {
        const previous = document.querySelector(`[data-bind="${capturing}"]`);
        if (previous) previous.classList.remove('is-capturing');
      }
      capturing = button.dataset.bind;
      button.classList.add('is-capturing');
      button.textContent = 'НАЖМИ КЛАВИШУ';
      footerMessage.textContent = 'Нажми новую клавишу или Escape для отмены';
      footerMessage.classList.remove('is-error');
    });
  });

  document.addEventListener('keydown', function (event) {
    if (capturing) {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') {
        capturing = null;
        renderSettings();
        footerMessage.textContent = 'Изменения сохраняются на этом устройстве';
        return;
      }

      const code = Number(event.keyCode || event.which);
      if (!Number.isInteger(code) || code < 1 || code > 255 ||
          code === 27 || code === 121 || ['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) {
        showToast('Эту клавишу нельзя назначить.');
        return;
      }
      const conflict = Object.keys(state.bindings).find(function (action) {
        return action !== capturing && state.bindings[action] === code;
      });
      if (conflict) {
        showToast(`Клавиша уже назначена: ${keyLabel(code)}.`);
        return;
      }

      state.bindings[capturing] = code;
      capturing = null;
      renderSettings();
      persistAndApply();
      return;
    }

    if (event.key === 'Escape' || event.key === 'F10') {
      event.preventDefault();
      event.stopPropagation();
      closeSettings();
    }
  });

  document.getElementById('close-settings').addEventListener('click', closeSettings);
  document.getElementById('reset-settings').addEventListener('click', function () {
    state = cloneDefaults();
    renderSettings();
    persistAndApply();
    showToast('Настройки сброшены.');
  });

  window.ragerpSettings = {
    focus: function () {
      document.getElementById('close-settings').focus();
    }
  };

  loadSettings();
})();
