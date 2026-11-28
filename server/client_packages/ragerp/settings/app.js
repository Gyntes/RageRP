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
      inventory: 73,
      settings: 121,
      adminMenu: 123,
      interaction: 69,
      radio: 81,
      voiceTransmit: 90,
      voiceToggle: 117,
      vehicleLock: 76,
      engine: 50,
      hudToggle: 122,
      holster: 88,
      crouch: 17,
      animationMenu: 85,
      stopAnimation: 32,
      showFinger: 66,
      quickSlot1: 49,
      quickSlot2: 50,
      quickSlot3: 51,
      quickSlot4: 52,
      hudAccept: 89,
      hudDecline: 78
    },
    alternateBindings: {
      phoneUp: 9,
      inventory: null,
      settings: null,
      adminMenu: null,
      interaction: null,
      radio: null,
      voiceTransmit: null,
      voiceToggle: null,
      vehicleLock: null,
      engine: null,
      hudToggle: null,
      holster: null,
      crouch: null,
      animationMenu: null,
      stopAnimation: null,
      showFinger: null,
      quickSlot1: null,
      quickSlot2: null,
      quickSlot3: null,
      quickSlot4: null,
      hudAccept: null,
      hudDecline: null
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
      radioVolume: 100,
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
    'media.voiceMuteUnderHours': [0, 200],
    'media.radioVolume': [0, 100]
  };
  const keyLabels = {
    9: 'TAB',
    16: 'SHIFT',
    17: 'CTRL',
    18: 'ALT',
    13: 'ENTER',
    27: 'ESC',
    32: 'SPACE',
    37: '←',
    38: '↑',
    39: '→',
    40: '↓',
    33: 'PAGE UP',
    34: 'PAGE DOWN',
    35: 'END',
    36: 'HOME',
    45: 'INSERT',
    46: 'DELETE',
    186: ';',
    187: '=',
    188: ',',
    189: '-',
    190: '.',
    191: '/',
    192: '`',
    219: '[',
    220: '\\',
    221: ']',
    222: "'"
  };
  let state = null;
  let capturing = null;
  let toastTimer = null;

  function canShareKey(firstAction, secondAction) {
    return (firstAction === 'engine' && secondAction === 'quickSlot2') ||
      (firstAction === 'quickSlot2' && secondAction === 'engine');
  }

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
      normalized[parts[0]][parts[1]] =
        path === 'media.voiceMuteUnderHours' || path === 'media.radioVolume'
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
      const candidate = Object.assign({}, defaultSettings.bindings);
      const alternateCandidate = Object.assign({}, defaultSettings.alternateBindings);
      let valid = true;
      actions.forEach(function (action) {
        if (!Object.prototype.hasOwnProperty.call(value.bindings, action)) return;
        const code = Number(value.bindings[action]);
        if (!Number.isInteger(code) || code < 1 || code > 255 || code === 27) {
          valid = false;
          return;
        }
        candidate[action] = code;
      });
      if (value.alternateBindings && typeof value.alternateBindings === 'object' &&
          !Array.isArray(value.alternateBindings)) {
        actions.forEach(function (action) {
          if (!Object.prototype.hasOwnProperty.call(value.alternateBindings, action)) return;
          const valueForAction = value.alternateBindings[action];
          if (valueForAction === null || valueForAction === '') {
            alternateCandidate[action] = null;
            return;
          }
          const code = Number(valueForAction);
          if (!Number.isInteger(code) || code < 1 || code > 255 || code === 27) {
            valid = false;
            return;
          }
          alternateCandidate[action] = code;
        });
      } else if (Object.prototype.hasOwnProperty.call(value.bindings, 'phoneTab')) {
        const legacyPhoneKey = Number(value.bindings.phoneTab);
        if (!Number.isInteger(legacyPhoneKey) || legacyPhoneKey < 1 ||
            legacyPhoneKey > 255 || legacyPhoneKey === 27) {
          valid = false;
        } else {
          alternateCandidate.phoneUp = legacyPhoneKey;
        }
      }

      const usedCodes = [];
      actions.forEach(function (action) {
        [candidate[action], alternateCandidate[action]].forEach(function (code) {
          if (code === null || code === undefined) return;
          const conflict = usedCodes.some(function (used) {
            return used.code === code && !canShareKey(action, used.action);
          });
          if (conflict) valid = false;
          usedCodes.push({ action, code });
        });
      });
      if (valid) {
        normalized.bindings = candidate;
        normalized.alternateBindings = alternateCandidate;
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
      const action = button.dataset.bind;
      const code = button.hasAttribute('data-bind-alternate')
        ? state.alternateBindings[action]
        : state.bindings[action];
      button.textContent = code === null || code === undefined ? '+' : keyLabel(code);
      button.classList.remove('is-capturing');
      button.setAttribute('aria-label',
        `${button.hasAttribute('data-bind-alternate') ? 'Дополнительная' : 'Основная'} клавиша: ${
          code === null || code === undefined ? 'не назначена' : keyLabel(code)
        }`);
    });
    document.querySelectorAll('[data-bind-clear]').forEach(function (button) {
      button.disabled = state.alternateBindings[button.dataset.bindClear] === null;
    });
    document.getElementById('settings-key-label').textContent =
      keyLabel(state.bindings.settings);
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
    renderSettings();
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
        const previous = document.querySelector(
          `[data-bind="${capturing.action}"]${capturing.alternate ? '[data-bind-alternate]' : ':not([data-bind-alternate])'}`
        );
        if (previous) previous.classList.remove('is-capturing');
      }
      capturing = {
        action: button.dataset.bind,
        alternate: button.hasAttribute('data-bind-alternate')
      };
      button.classList.add('is-capturing');
      button.textContent = 'НАЖМИ КЛАВИШУ';
      footerMessage.textContent = 'Нажми новую клавишу или Escape для отмены';
      footerMessage.classList.remove('is-error');
    });
  });

  document.querySelectorAll('[data-bind-clear]').forEach(function (button) {
    button.addEventListener('click', function () {
      state.alternateBindings[button.dataset.bindClear] = null;
      renderSettings();
      persistAndApply();
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
      const standaloneModifier = ['Shift', 'Control', 'Alt'].includes(event.key);
      const combinedModifier = (event.shiftKey && event.key !== 'Shift') ||
        (event.ctrlKey && event.key !== 'Control') ||
        (event.altKey && event.key !== 'Alt') ||
        event.metaKey;
      if (!Number.isInteger(code) || code < 1 || code > 255 || code === 27 ||
          combinedModifier || (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key) &&
            !standaloneModifier)) {
        showToast('Эту клавишу нельзя назначить.');
        return;
      }
      let conflict = null;
      Object.keys(state.bindings).some(function (action) {
        const candidates = [
          { alternate: false, code: state.bindings[action] },
          { alternate: true, code: state.alternateBindings[action] }
        ];
        return candidates.some(function (candidate) {
          if (candidate.code !== code ||
              (action === capturing.action && candidate.alternate === capturing.alternate)) {
            return false;
          }
          if (action === capturing.action || !canShareKey(capturing.action, action)) {
            conflict = action;
            return true;
          }
          return false;
        });
      });
      if (conflict !== null) {
        showToast(conflict === capturing.action
          ? 'У этого действия уже назначена такая клавиша.'
          : `Клавиша уже назначена: ${keyLabel(code)}.`);
        return;
      }

      if (capturing.alternate) state.alternateBindings[capturing.action] = code;
      else state.bindings[capturing.action] = code;
      capturing = null;
      renderSettings();
      persistAndApply();
      return;
    }

    const keyCode = Number(event.keyCode || event.which);
    if (event.key === 'Escape' || state.bindings.settings === keyCode ||
        state.alternateBindings.settings === keyCode) {
      event.preventDefault();
      event.stopPropagation();
      closeSettings();
    }
  });

  document.getElementById('close-settings').addEventListener('click', closeSettings);
  document.getElementById('reset-settings').addEventListener('click', function () {
    capturing = null;
    state = cloneDefaults();
    renderSettings();
    persistAndApply();
    showToast('Настройки сброшены.');
  });

  window.ragerpSettings = {
    focus: function () {
      document.getElementById('close-settings').focus();
    },
    syncHudPreference: function (visible) {
      if (typeof visible !== 'boolean') return;
      state.general.showHud = visible;
      renderSettings();
      persistAndApply();
    }
  };

  loadSettings();
})();
