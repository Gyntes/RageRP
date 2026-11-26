(function () {
  const steps = Array.from(document.querySelectorAll('[data-step]'));
  const progress = Array.from(document.querySelectorAll('[data-progress]'));
  const firstName = document.getElementById('first-name');
  const lastName = document.getElementById('last-name');
  const ageInput = document.getElementById('age');
  const nextButton = document.getElementById('next-button');
  const backButton = document.getElementById('back-button');
  const feedback = document.getElementById('feedback');
  const genderCards = Array.from(document.querySelectorAll('[data-gender]'));
  const tabs = Array.from(document.querySelectorAll('[data-tab]'));
  const panels = Array.from(document.querySelectorAll('[data-panel]'));
  const russianNamePattern = /^[А-ЯЁа-яё]{2,20}$/;
  const featureNames = [
    'Ширина носа', 'Высота носа', 'Длина носа', 'Переносица', 'Кончик носа',
    'Смещение носа', 'Высота бровей', 'Глубина бровей', 'Высота скул',
    'Ширина скул', 'Полнота щёк', 'Глаза', 'Губы', 'Ширина челюсти',
    'Форма челюсти', 'Высота подбородка', 'Длина подбородка', 'Ширина подбородка',
    'Ямка на подбородке', 'Шея'
  ];
  const state = {
    gender: 'male',
    mother: 21,
    father: 0,
    shapeMix: 0.5,
    skinMix: 0.5,
    eyeColor: 0,
    hairColor: 0,
    highlightColor: 0,
    hairStyle: 0,
    eyebrows: 0,
    beard: 255,
    faceFeatures: new Array(20).fill(0),
    clothing: {
      torso: 0,
      legs: 0,
      shoes: 0,
      undershirt: 0,
      top: 0
    }
  };
  const stepTitles = ['Личные данные', 'Образ персонажа', 'Проверь данные'];
  let step = 1;
  let previewTimer = null;

  function setFeedback(message) {
    feedback.textContent = message || '';
    if (message) nextButton.disabled = false;
  }

  function sendClientEvent(name) {
    if (typeof mp !== 'undefined' && typeof mp.trigger === 'function') {
      mp.trigger(name);
    }
  }

  function queuePreview() {
    if (previewTimer !== null) window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(function () {
      previewTimer = null;
      if (typeof mp !== 'undefined' && typeof mp.trigger === 'function') {
        mp.trigger('ragerp:registration:preview', JSON.stringify(state));
      }
    }, 120);
  }

  function showStep(nextStep) {
    step = nextStep;
    steps.forEach(function (section) {
      const active = Number(section.dataset.step) === step;
      section.hidden = !active;
      section.classList.toggle('active', active);
    });
    progress.forEach(function (segment) {
      segment.classList.toggle('active', Number(segment.dataset.progress) <= step);
    });

    document.getElementById('step-count').textContent = `0${step} / 03`;
    document.getElementById('step-title').textContent = stepTitles[step - 1];
    document.getElementById('step-hint').textContent =
      step === 1 ? 'ШАГ 1 ИЗ 3 · ДАННЫЕ ПЕРСОНАЖА' :
      step === 2 ? 'ШАГ 2 ИЗ 3 · НАСТРОЙКА ВНЕШНОСТИ' :
      'ШАГ 3 ИЗ 3 · ПОДТВЕРЖДЕНИЕ';
    document.getElementById('next-label').textContent =
      step === 3 ? 'СОЗДАТЬ ПЕРСОНАЖА' : 'ПРОДОЛЖИТЬ';
    backButton.hidden = step === 1;
    nextButton.disabled = false;
    setFeedback('');
  }

  function setOutput(id, value) {
    const output = document.getElementById(`value-${id}`);
    if (output) output.textContent = value;
  }

  function bindRange(id, setter, formatter) {
    const input = document.getElementById(id);
    const outputId = id.replace(/-/g, '-');
    input.addEventListener('input', function () {
      const value = Number(input.value);
      setter(value);
      setOutput(outputId, formatter ? formatter(value) : String(value));
      queuePreview();
    });
  }

  function addFeatureSliders() {
    const container = document.getElementById('face-features');
    featureNames.forEach(function (name, index) {
      const id = `face-feature-${index}`;
      const label = document.createElement('label');
      label.className = 'range-control';
      label.innerHTML =
        `<span>${name}<output id="value-${id}">0</output></span>` +
        `<input id="${id}" type="range" min="-1" max="1" step="0.01" value="0">`;
      container.appendChild(label);
      bindRange(id, function (value) {
        state.faceFeatures[index] = value;
      }, function (value) {
        return value.toFixed(2);
      });
    });
  }

  function populateParents() {
    ['mother', 'father'].forEach(function (parent) {
      const select = document.getElementById(parent);
      for (let id = 0; id <= 45; id += 1) {
        const option = document.createElement('option');
        option.value = String(id);
        option.textContent = `Вариант ${id + 1}`;
        select.appendChild(option);
      }
      select.value = String(state[parent]);
      select.addEventListener('change', function () {
        state[parent] = Number(select.value);
        queuePreview();
      });
    });
  }

  function setRangeLimit(id, count) {
    const input = document.getElementById(id);
    if (!input || !Number.isFinite(Number(count))) return;
    const maximum = Math.max(0, Math.min(255, Math.floor(Number(count)) - 1));
    input.max = String(maximum);
    if (Number(input.value) > maximum) {
      input.value = String(maximum);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function setDrawableLimits(limits) {
    if (!limits || typeof limits !== 'object') return;
    setRangeLimit('hair-style', limits.hair);
    setRangeLimit('torso', limits.torso);
    setRangeLimit('legs', limits.legs);
    setRangeLimit('shoes', limits.shoes);
    setRangeLimit('undershirt', limits.undershirt);
    setRangeLimit('top', limits.top);
  }

  function validateIdentity() {
    const first = firstName.value.trim();
    const last = lastName.value.trim();
    const age = Number(ageInput.value);
    if (!russianNamePattern.test(first) || !russianNamePattern.test(last)) {
      setFeedback('Имя и фамилия: 2–20 русских букв, без пробелов и дефисов.');
      return false;
    }

    if (!Number.isInteger(age) || age < 18 || age > 100) {
      setFeedback('Укажи возраст от 18 до 100 лет.');
      return false;
    }

    return true;
  }

  function updateSummary() {
    const age = Number(ageInput.value);
    document.getElementById('summary-name').textContent =
      `${firstName.value.trim()} ${lastName.value.trim()}`;
    document.getElementById('summary-details').textContent =
      `${age} лет · ${state.gender === 'male' ? 'мужчина' : 'женщина'}`;
    document.getElementById('summary-avatar').textContent =
      state.gender === 'male' ? 'М' : 'Ж';
  }

  genderCards.forEach(function (card) {
    card.addEventListener('click', function () {
      state.gender = card.dataset.gender;
      state.beard = 255;
      genderCards.forEach(function (option) {
        const selected = option === card;
        option.classList.toggle('selected', selected);
        option.setAttribute('aria-pressed', String(selected));
      });

      const beard = document.getElementById('beard');
      beard.disabled = state.gender === 'female';
      beard.value = '-1';
      setOutput('beard', 'Нет');
      setFeedback('');
      queuePreview();
      sendClientEvent('ragerp:registration:request-drawables');
    });
  });

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      const selected = tab.dataset.tab;
      tabs.forEach(function (item) {
        item.classList.toggle('active', item === tab);
      });
      panels.forEach(function (panel) {
        const active = panel.dataset.panel === selected;
        panel.hidden = !active;
        panel.classList.toggle('active', active);
      });
    });
  });

  document.querySelectorAll('[data-rotate]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (typeof mp !== 'undefined' && typeof mp.trigger === 'function') {
        mp.trigger('ragerp:registration:rotate', Number(button.dataset.rotate));
      }
    });
  });

  bindRange('shape-mix', function (value) {
    state.shapeMix = value;
  }, function (value) {
    return `${Math.round(value * 100)}%`;
  });
  bindRange('skin-mix', function (value) {
    state.skinMix = value;
  }, function (value) {
    return `${Math.round(value * 100)}%`;
  });
  bindRange('hair-style', function (value) {
    state.hairStyle = value;
  });
  bindRange('hair-color', function (value) {
    state.hairColor = value;
  });
  bindRange('highlight-color', function (value) {
    state.highlightColor = value;
  });
  bindRange('eye-color', function (value) {
    state.eyeColor = value;
  });
  bindRange('eyebrows', function (value) {
    state.eyebrows = value;
  });
  bindRange('beard', function (value) {
    state.beard = value < 0 ? 255 : value;
  }, function (value) {
    return value < 0 ? 'Нет' : String(value);
  });
  ['top', 'legs', 'shoes', 'undershirt', 'torso'].forEach(function (item) {
    bindRange(item, function (value) {
      state.clothing[item] = value;
    });
  });

  addFeatureSliders();
  populateParents();
  document.getElementById('mother').value = String(state.mother);
  document.getElementById('father').value = String(state.father);
  document.getElementById('beard').value = '-1';
  document.getElementById('beard').disabled = true;

  backButton.addEventListener('click', function () {
    showStep(Math.max(1, step - 1));
  });

  nextButton.addEventListener('click', function () {
    if (step === 1) {
      if (!validateIdentity()) return;
      showStep(2);
      return;
    }

    if (step === 2) {
      if (!validateIdentity()) {
        showStep(1);
        validateIdentity();
        return;
      }
      updateSummary();
      showStep(3);
      return;
    }

    nextButton.disabled = true;
    setFeedback('');
    if (typeof mp === 'undefined' || typeof mp.trigger !== 'function') {
      setFeedback('Форма доступна только при подключении к серверу.');
      return;
    }

    mp.trigger('ragerp:registration:submit', JSON.stringify({
      firstName: firstName.value.trim(),
      lastName: lastName.value.trim(),
      age: Number(ageInput.value),
      appearance: state
    }));
  });

  window.ragerpRegistration = {
    setFeedback: setFeedback,
    setStaticId: function (value) {
      const id = String(value || '');
      const safeId = /^\d{3}-\d{3}$/.test(id) ? id : '--- ---';
      document.getElementById('static-id').textContent = safeId;
      document.getElementById('summary-id').textContent = safeId;
    },
    setDrawableLimits: setDrawableLimits,
    requestPreview: queuePreview
  };
  showStep(1);
  sendClientEvent('ragerp:registration:request-drawables');
  queuePreview();
})();
