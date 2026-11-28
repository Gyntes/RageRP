(function () {
  const stations = [
    {
      id: 'russianGold',
      name: 'RUSSIAN GOLD',
      type: 'hls',
      url: 'https://hls-01-radiorecord.hostingradio.ru/record-russiangold/playlist.m3u8'
    },
    {
      id: 'europaPlus',
      name: 'ЕВРОПА ПЛЮС',
      type: 'mp3',
      url: 'https://ep256.hostingradio.ru:8052/europaplus256.mp3'
    },
    {
      id: 'dfm',
      name: 'DFM',
      type: 'mp3',
      url: 'https://dfm.hostingradio.ru/dfm128.mp3'
    },
    {
      id: 'retroFm',
      name: 'RETRO FM',
      type: 'hls',
      url: 'https://hls-01-retro.emgsound.ru/12/128/playlist.m3u8'
    },
    {
      id: 'russkoeRadio',
      name: 'РУССКОЕ РАДИО',
      type: 'mp3',
      url: 'https://rusradio.hostingradio.ru/rusradio128.mp3'
    },
    {
      id: 'radioRecord',
      name: 'РАДИО РЕКОРД',
      type: 'hls',
      url: 'https://hls-01-radiorecord.hostingradio.ru/record/playlist.m3u8'
    },
    {
      id: 'chanson',
      name: 'РАДИО ШАНСОН',
      type: 'mp3',
      url: 'https://chanson.hostingradio.ru:8041/chanson256.mp3'
    },
    {
      id: 'nasheRadio',
      name: 'НАШЕ РАДИО',
      type: 'mp3',
      url: 'http://87.244.47.90:8000/NASHE'
    }
  ];
  const audio = document.getElementById('radio-audio');
  const overlay = document.getElementById('radio-overlay');
  const stationList = document.getElementById('station-list');
  const currentStationLabel = document.getElementById('current-station');
  const statusLabel = document.getElementById('radio-status');
  let activeStation = null;
  let hlsInstance = null;
  let hlsLoadPromise = null;
  let audioContext = null;
  let inVehicle = false;
  let radioVolume = 1;
  let lastReportedError = null;

  function triggerClient(eventName, first, second) {
    if (typeof mp === 'undefined' || !mp || typeof mp.trigger !== 'function') return;
    mp.trigger(eventName, first, second);
  }

  function setStatus(message, visible) {
    statusLabel.textContent = message;
    statusLabel.classList.toggle('is-visible', visible === true);
  }

  function renderActiveStation() {
    const activeId = activeStation && activeStation.id;
    currentStationLabel.textContent = activeStation ? activeStation.name : 'ВЫБЕРИ СТАНЦИЮ';
    stationList.querySelectorAll('[data-station]').forEach(function (button) {
      button.classList.toggle('is-playing', button.dataset.station === activeId);
    });
  }

  function reportPlaybackError(station, message) {
    if (!station || activeStation !== station || lastReportedError === station.id) return;
    lastReportedError = station.id;
    const safeMessage = String(message || 'Ошибка аудиопотока').slice(0, 180);
    setStatus(`${station.name} · ${safeMessage}`, true);
    console.error(`[RageRP radio] ${station.name}: ${safeMessage}`);
    triggerClient('ragerp:radio:error', station.id, safeMessage);
  }

  function clearStream() {
    activeStation = null;
    audio.pause();
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }
    audio.removeAttribute('src');
    audio.load();
    lastReportedError = null;
  }

  function unlockAudioOutput() {
    audio.muted = false;
    audio.volume = radioVolume;
    if (!window.AudioContext && !window.webkitAudioContext) return;

    try {
      if (!audioContext) {
        const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContextConstructor();
      }
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(function (error) {
          console.error('[RageRP radio] Could not resume audio output:', error);
        });
      }
    } catch (error) {
      console.error('[RageRP radio] Could not initialize audio output:', error);
    }
  }

  function playAudio(station) {
    if (activeStation !== station || !inVehicle) return;
    audio.muted = false;
    audio.volume = radioVolume;
    const playRequest = audio.play();
    if (playRequest && typeof playRequest.catch === 'function') {
      playRequest.catch(function (error) {
        if (error && error.name === 'AbortError') return;
        reportPlaybackError(station, error && error.message
          ? error.message
          : 'Браузер запретил запуск аудио');
      });
    }
  }

  function loadHlsLibrary() {
    if (window.Hls) return Promise.resolve(window.Hls);
    if (hlsLoadPromise) return hlsLoadPromise;

    hlsLoadPromise = new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      const timeout = window.setTimeout(function () {
        script.remove();
        reject(new Error('Не удалось загрузить HLS-плеер.'));
      }, 12000);
      script.src = 'hls.min.js';
      script.onload = function () {
        window.clearTimeout(timeout);
        if (window.Hls) resolve(window.Hls);
        else reject(new Error('HLS-плеер не запустился.'));
      };
      script.onerror = function () {
        window.clearTimeout(timeout);
        reject(new Error('Не удалось загрузить HLS-плеер.'));
      };
      document.head.appendChild(script);
    }).then(function (Hls) {
      hlsLoadPromise = null;
      return Hls;
    }, function (error) {
      hlsLoadPromise = null;
      throw error;
    });
    return hlsLoadPromise;
  }

  function playHlsStation(station) {
    loadHlsLibrary().then(function (Hls) {
      if (activeStation !== station || !inVehicle) return;
      if (!Hls.isSupported()) {
        if (audio.canPlayType('application/vnd.apple.mpegurl')) {
          audio.src = station.url;
          playAudio(station);
          return;
        }
        throw new Error('В этом браузере нет поддержки HLS.');
      }

      const instance = new Hls({
        enableWorker: false,
        autoStartLoad: true,
        xhrSetup: function (xhr) {
          xhr.withCredentials = false;
        }
      });
      hlsInstance = instance;
      instance.on(Hls.Events.MEDIA_ATTACHED, function () {
        if (hlsInstance === instance) instance.loadSource(station.url);
      });
      instance.on(Hls.Events.MANIFEST_PARSED, function () {
        playAudio(station);
      });
      instance.on(Hls.Events.ERROR, function (event, data) {
        if (!data || !data.fatal || hlsInstance !== instance) return;
        instance.destroy();
        hlsInstance = null;
        reportPlaybackError(station, 'Не удалось прочитать HLS-поток.');
      });
      instance.attachMedia(audio);
    }).catch(function (error) {
      reportPlaybackError(station, error && error.message
        ? error.message
        : 'Не удалось запустить HLS-поток.');
    });
  }

  function startStation(station) {
    if (!station || !inVehicle) return;
    setStatus(`Подключение · ${station.name}`, true);
    if (station.type === 'hls') {
      playHlsStation(station);
      return;
    }
    audio.src = station.url;
    playAudio(station);
  }

  function selectStation(stationId) {
    unlockAudioOutput();
    clearStream();
    if (stationId === 'off') {
      renderActiveStation();
      setStatus('Автомобильное радио выключено.', true);
      triggerClient('ragerp:radio:select', 'off');
      return;
    }

    const station = stations.find(function (item) {
      return item.id === stationId;
    });
    if (!station) {
      console.error('[RageRP radio] The selected station is not configured.');
      return;
    }

    activeStation = station;
    lastReportedError = null;
    renderActiveStation();
    startStation(station);
    triggerClient('ragerp:radio:select', station.id);
  }

  stations.forEach(function (station, index) {
    const button = document.createElement('button');
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / stations.length;
    const radius = 32;
    button.type = 'button';
    button.className = 'station-button';
    button.dataset.station = station.id;
    button.textContent = station.name;
    button.setAttribute('aria-label', station.name);
    button.style.left = `${50 + Math.cos(angle) * radius}%`;
    button.style.top = `${50 + Math.sin(angle) * radius}%`;
    button.addEventListener('click', function () {
      stationList.querySelectorAll('.station-button').forEach(function (item) {
        item.classList.remove('is-selected');
      });
      button.classList.add('is-selected');
      selectStation(station.id);
    });
    stationList.appendChild(button);
  });

  document.getElementById('radio-off').addEventListener('click', function () {
    selectStation('off');
  });

  audio.addEventListener('playing', function () {
    if (activeStation && inVehicle) setStatus(`В эфире · ${activeStation.name}`, true);
  });
  audio.addEventListener('waiting', function () {
    if (activeStation && inVehicle) setStatus(`Загрузка · ${activeStation.name}`, true);
  });
  audio.addEventListener('error', function () {
    if (!activeStation || !inVehicle) return;
    const code = audio.error ? audio.error.code : 0;
    reportPlaybackError(activeStation, `Ошибка аудиопотока (${code}).`);
  });

  window.ragerpRadio = {
    setVolume: function (value) {
      const volume = Number(value);
      if (!Number.isFinite(volume)) {
        console.error('[RageRP radio] Received an invalid volume.');
        return;
      }
      radioVolume = Math.max(0, Math.min(1, volume));
      audio.volume = radioVolume;
    },
    setVisible: function (visible) {
      overlay.classList.toggle('is-open', visible === true);
      overlay.setAttribute('aria-hidden', visible === true ? 'false' : 'true');
      if (visible === true) {
        stationList.querySelectorAll('.station-button').forEach(function (button) {
          button.classList.remove('is-selected');
        });
        setStatus('', false);
      }
    },
    setInVehicle: function (value) {
      const wasInVehicle = inVehicle;
      inVehicle = value === true;
      if (!inVehicle) {
        audio.pause();
        if (hlsInstance) hlsInstance.stopLoad();
        if (activeStation) setStatus('Радио приостановлено вне автомобиля.', false);
      } else if (activeStation && !wasInVehicle) {
        if (hlsInstance) {
          hlsInstance.startLoad();
          playAudio(activeStation);
        } else {
          startStation(activeStation);
        }
      }
    },
    setActiveStation: function (stationId) {
      activeStation = stations.find(function (station) {
        return station.id === stationId;
      }) || null;
      renderActiveStation();
    }
  };

  loadHlsLibrary().catch(function (error) {
    console.error('[RageRP radio] Could not preload HLS support:', error);
  });
})();
