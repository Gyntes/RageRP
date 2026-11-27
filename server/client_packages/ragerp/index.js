let registrationBrowser = null;
let registrationCamera = null;
let registrationOpen = false;
let registrationStaticId = '';
let settingsBrowser = null;
let settingsOpen = false;
let phoneBrowser = null;
let phoneOpen = false;
let phoneBootstrap = null;
let phoneScenarioStarted = false;
let callBrowser = null;
let callBrowserReady = false;
let currentPhoneCall = null;
let callCloseTimer = null;
let phoneCallVoiceTargetId = null;
let previousPhoneCallVoice3d = null;
let phoneCallVoice3dCaptured = false;
let inventoryBrowser = null;
let inventoryOpen = false;
let inventoryBootstrap = null;
let dealershipBrowser = null;
let dealershipOpen = false;
let dealershipBootstrap = null;
let dealershipPosition = null;
let dealershipInteractionRadius = 5;
let dealershipMarker = null;
let dealershipBlip = null;
let radioBrowser = null;
let radioBrowserReady = false;
let radioOpen = false;
let radioInVehicle = null;
let currentRadioStationId = null;
let hudBrowser = null;
let hudBootstrap = null;
let hudBrowserReady = false;
let hudVisible = false;
let hudNotificationOpen = false;
let hudNotificationId = '';
let hudNotificationPayload = null;
const clientSettings = {
  general: {
    showHud: true,
    showRadar: true,
    hudOpacity: 100,
    nametagDistance: 100,
    phoneScale: 100,
    phoneRight: 0,
    phoneBottom: 0
  },
  bindings: {
    phoneUp: 0x26,
    phoneTab: 0x09,
    inventory: 0x49,
    vehicleLock: 0x4C,
    engine: 0x32
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
let activeKeyBindings = [];
let keyBindingsInstalled = false;
let settingsStorageFlushTimer = null;
let mediaSettingsSyncTimer = null;
const quickSlotKeyCodes = [0x31, 0x32, 0x33, 0x34];
const radioStationNames = {
  russianGold: 'Russian Gold',
  europaPlus: 'Европа Плюс',
  dfm: 'DFM',
  retroFm: 'Retro FM',
  russkoeRadio: 'Русское Радио',
  radioRecord: 'Радио Рекорд',
  chanson: 'Радио Шансон',
  nasheRadio: 'Наше Радио'
};
let voiceChatEnabled = true;
let voiceKeyPressed = false;

function executeHud(method, payload) {
  if (!hudBrowser || !hudBrowserReady) return;
  hudBrowser.execute(
    `window.ragerpHud && window.ragerpHud.${method}(${JSON.stringify(payload)})`
  );
}

function mergeHudState(update) {
  let state = {};
  try {
    state = JSON.parse(hudBootstrap || '{}');
  } catch (error) {
    console.error('[RageRP HUD] Could not parse the HUD state:', error);
    state = {};
  }
  if (!state || typeof state !== 'object' || Array.isArray(state)) state = {};
  hudBootstrap = JSON.stringify(Object.assign(state, update));
}

function setHudVisible(visible) {
  hudVisible = Boolean(visible) && clientSettings.general.showHud;
  executeHud('setVisible', hudVisible);
  if (phoneOpen || inventoryOpen || dealershipOpen || registrationOpen || settingsOpen) return;

  if (hudVisible) {
    mp.game.ui.displayHud(false);
    mp.game.ui.displayRadar(clientSettings.general.showRadar);
  } else if (hudBrowser) {
    mp.game.ui.displayHud(true);
    mp.game.ui.displayRadar(clientSettings.general.showRadar);
  }
}

function openHud(payload) {
  hudBootstrap = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
  if (hudBrowser) {
    executeHud('setBootstrap', hudBootstrap);
    setHudVisible(true);
    return;
  }

  hudBrowserReady = false;
  hudBrowser = mp.browsers.new('package://ragerp/hud/index.html');
  hudVisible = true;
  setHudVisible(true);
}

function answerHudNotification(answer) {
  if (!hudNotificationOpen || radioOpen || phoneOpen || inventoryOpen || dealershipOpen ||
      registrationOpen) return;
  const notificationId = hudNotificationId;
  hudNotificationOpen = false;
  hudNotificationId = '';
  hudNotificationPayload = null;
  mp.gui.cursor.show(false, false);
  executeHud('closeNotification');
  mp.events.callRemote('ragerp:hud:answer', notificationId, answer === 'accept');
}

function setRegistrationControls(enabled) {
  mp.gui.cursor.show(enabled, enabled);
  mp.gui.chat.show(!enabled && clientSettings.media.showChat);
  mp.game.ui.displayHud(!enabled);
  mp.game.ui.displayRadar(!enabled);
  updateVoiceChatMute();

  if (mp.players.local) {
    mp.players.local.freezePosition(enabled);
  }
}

function setRegistrationCamera(enabled) {
  if (enabled && mp.players.local) {
    const position = mp.players.local.position;
    registrationCamera = mp.cameras.new(
      'ragerp:registration',
      new mp.Vector3(position.x, position.y - 2.8, position.z + 0.9),
      new mp.Vector3(0, 0, 0),
      40
    );
    registrationCamera.pointAtCoord(position.x, position.y, position.z + 0.85);
    registrationCamera.setActive(true);
    mp.game.cam.renderScriptCams(true, false, 0, true, false);
    return;
  }

  if (registrationCamera) {
    mp.game.cam.renderScriptCams(false, false, 0, true, false);
    registrationCamera.destroy();
    registrationCamera = null;
  }
}

function getDrawableLimits() {
  const player = mp.players.local;
  const count = function (component) {
    return Math.max(1, mp.game.ped.getNumberOfDrawableVariations(player.handle, component));
  };

  return {
    hair: count(2),
    torso: count(3),
    legs: count(4),
    shoes: count(6),
    undershirt: count(8),
    top: count(11)
  };
}

function syncRegistrationBrowser() {
  if (!registrationBrowser || !registrationOpen) return;

  registrationBrowser.execute(
    `window.ragerpRegistration && window.ragerpRegistration.setStaticId(${JSON.stringify(registrationStaticId)})`
  );
  registrationBrowser.execute(
    `window.ragerpRegistration && window.ragerpRegistration.setDrawableLimits(${JSON.stringify(getDrawableLimits())})`
  );
  registrationBrowser.execute(
    'window.ragerpRegistration && window.ragerpRegistration.requestPreview()'
  );
}

function closeRegistration() {
  if (registrationBrowser) {
    registrationBrowser.destroy();
    registrationBrowser = null;
  }

  setRegistrationCamera(false);
  registrationOpen = false;
  setRegistrationControls(false);
  if (hudBrowser) setHudVisible(true);
}

function openPhone(payload) {
  if (radioOpen || registrationOpen || phoneOpen || inventoryOpen || dealershipOpen ||
      hudNotificationOpen) return;

  phoneBootstrap = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
  phoneBrowser = mp.browsers.new('package://ragerp/phone/index.html');
  phoneOpen = true;
  setHudVisible(false);
  mp.gui.cursor.show(true, true);
  mp.gui.chat.show(false);
  updateVoiceChatMute();
  mp.game.ui.displayHud(false);
  mp.game.ui.displayRadar(false);

  if (mp.players.local) {
    phoneScenarioStarted = !mp.players.local.vehicle;
    if (phoneScenarioStarted) {
      mp.players.local.freezePosition(true);
      mp.game.ai.taskStartScenarioInPlace(
        mp.players.local.handle,
        'WORLD_HUMAN_STAND_MOBILE',
        0,
        true
      );
    }
  }
}

function closePhone(notifyServer) {
  if (phoneBrowser) {
    phoneBrowser.destroy();
    phoneBrowser = null;
  }

  if (mp.players.local) {
    const pedHandle = mp.players.local.handle;
    if (phoneScenarioStarted) {
      if (typeof mp.game.ai.clearPedTasksImmediately === 'function') {
        mp.game.ai.clearPedTasksImmediately(pedHandle);
      } else if (typeof mp.game.invoke === 'function') {
        mp.game.invoke('0xAAA34F8A7CB32098', pedHandle);
      }
      mp.players.local.freezePosition(false);
    }
  }

  phoneScenarioStarted = false;
  phoneOpen = false;
  phoneBootstrap = null;
  mp.gui.cursor.show(false, false);
  mp.gui.chat.show(clientSettings.media.showChat);
  updateVoiceChatMute();
  mp.game.ui.displayHud(true);
  mp.game.ui.displayRadar(true);
  if (hudBrowser) setHudVisible(true);
  if (notifyServer !== false) mp.events.callRemote('ragerp:phone:close');
}

function executePhone(method, payload) {
  if (!phoneBrowser || !phoneOpen) return;
  phoneBrowser.execute(
    `window.ragerpPhone && window.ragerpPhone.${method}(${JSON.stringify(payload)})`
  );
}

function executePhoneCall(payload) {
  if (!callBrowser || !callBrowserReady) return;
  callBrowser.execute(
    `window.ragerpCall && window.ragerpCall.setState(${JSON.stringify(payload)})`
  );
}

function closePhoneCallUi() {
  if (callCloseTimer !== null) {
    clearTimeout(callCloseTimer);
    callCloseTimer = null;
  }
  if (callBrowser) {
    callBrowser.destroy();
    callBrowser = null;
  }
  callBrowserReady = false;
  currentPhoneCall = null;
  updatePhoneCallVoiceTarget();
  updateVoiceChatMute();

  const anotherUiOpen = radioOpen || registrationOpen || phoneOpen || inventoryOpen || dealershipOpen ||
    settingsOpen || hudNotificationOpen;
  mp.gui.cursor.show(anotherUiOpen, anotherUiOpen);
}

function showPhoneCallUi(payload) {
  if (!payload || typeof payload !== 'object' ||
      typeof payload.callId !== 'string' || typeof payload.state !== 'string') {
    console.error('[RageRP phone] Received invalid call state.');
    return;
  }

  if (radioOpen) closeRadioWheel();
  currentPhoneCall = payload;
  updatePhoneCallVoiceTarget();
  updateVoiceChatMute();
  if (callCloseTimer !== null) {
    clearTimeout(callCloseTimer);
    callCloseTimer = null;
  }
  if (!callBrowser) {
    callBrowserReady = false;
    callBrowser = mp.browsers.new('package://ragerp/phone/call.html');
  }
  if (payload.state === 'incoming' && clientSettings.media.callNotificationSound) {
    mp.game.audio.playSoundFrontend(-1, 'NAV_UP_DOWN', 'HUD_FRONTEND_DEFAULT_SOUNDSET', true);
  }
  mp.gui.cursor.show(true, true);
  executePhoneCall(payload);

  if (payload.state === 'ended') {
    callCloseTimer = setTimeout(closePhoneCallUi, 2500);
  }
}

function updatePhoneCallVoiceTarget() {
  const targetId = currentPhoneCall && currentPhoneCall.state === 'active' &&
    Number.isInteger(currentPhoneCall.partnerId)
    ? currentPhoneCall.partnerId
    : null;

  if (phoneCallVoiceTargetId !== targetId) {
    if (phoneCallVoice3dCaptured && phoneCallVoiceTargetId !== null) {
      const previousTarget = mp.players.atRemoteId(phoneCallVoiceTargetId);
      if (previousTarget && mp.players.exists(previousTarget)) {
        previousTarget.voice3d = previousPhoneCallVoice3d;
      }
    }
    phoneCallVoiceTargetId = targetId;
    previousPhoneCallVoice3d = null;
    phoneCallVoice3dCaptured = false;
  }

  if (targetId === null) return;
  const target = mp.players.atRemoteId(targetId);
  if (!target || !mp.players.exists(target)) return;
  if (!phoneCallVoice3dCaptured) {
    previousPhoneCallVoice3d = target.voice3d;
    phoneCallVoice3dCaptured = true;
  }
  target.voice3d = false;
}

function openInventory(payload) {
  if (radioOpen || registrationOpen || phoneOpen || inventoryOpen || dealershipOpen ||
      hudNotificationOpen) return;

  inventoryBootstrap = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
  inventoryBrowser = mp.browsers.new('package://ragerp/inventory/index.html');
  inventoryOpen = true;
  setHudVisible(false);
  mp.gui.cursor.show(true, true);
  mp.gui.chat.show(false);
  updateVoiceChatMute();
  mp.game.ui.displayHud(false);
  mp.game.ui.displayRadar(false);
  if (mp.players.local) mp.players.local.freezePosition(true);
}

function closeInventory(notifyServer) {
  if (inventoryBrowser) {
    inventoryBrowser.destroy();
    inventoryBrowser = null;
  }

  if (mp.players.local) mp.players.local.freezePosition(false);
  inventoryOpen = false;
  inventoryBootstrap = null;
  mp.gui.cursor.show(false, false);
  mp.gui.chat.show(clientSettings.media.showChat);
  updateVoiceChatMute();
  mp.game.ui.displayHud(true);
  mp.game.ui.displayRadar(true);
  if (hudBrowser) setHudVisible(true);
  if (hudNotificationOpen && hudNotificationPayload) {
    mp.gui.cursor.show(true, true);
    executeHud('showNotification', hudNotificationPayload);
  }
  if (notifyServer !== false) mp.events.callRemote('ragerp:inventory:close');
}

function executeInventory(method, payload) {
  if (!inventoryBrowser || !inventoryOpen) return;
  inventoryBrowser.execute(
    `window.ragerpInventory && window.ragerpInventory.${method}(${JSON.stringify(payload)})`
  );
}

function openDealership(payload) {
  if (radioOpen || registrationOpen || phoneOpen || inventoryOpen || dealershipOpen ||
      hudNotificationOpen) return;

  let catalog = payload;
  if (typeof payload === 'string') {
    if (payload.length > 20000) {
      console.error('[RageRP dealership] Catalog payload is too large.');
      return;
    }
    try {
      catalog = JSON.parse(payload);
    } catch (error) {
      console.error('[RageRP dealership] Could not parse vehicle catalog:', error);
      return;
    }
  }
  if (!Array.isArray(catalog) || catalog.length !== 21) {
    console.error('[RageRP dealership] Invalid vehicle catalog payload.');
    return;
  }
  dealershipBootstrap = catalog;
  dealershipBrowser = mp.browsers.new('package://ragerp/dealership/index.html');
  dealershipOpen = true;
  setHudVisible(false);
  mp.gui.cursor.show(true, true);
  mp.gui.chat.show(false);
  updateVoiceChatMute();
  mp.game.ui.displayHud(false);
  mp.game.ui.displayRadar(false);
  if (mp.players.local) mp.players.local.freezePosition(true);
}

function closeDealership(notifyServer) {
  if (dealershipBrowser) {
    dealershipBrowser.destroy();
    dealershipBrowser = null;
  }

  if (mp.players.local) mp.players.local.freezePosition(false);
  dealershipOpen = false;
  dealershipBootstrap = null;
  mp.gui.cursor.show(false, false);
  mp.gui.chat.show(clientSettings.media.showChat);
  updateVoiceChatMute();
  mp.game.ui.displayHud(true);
  mp.game.ui.displayRadar(clientSettings.general.showRadar);
  if (hudBrowser) setHudVisible(true);
  if (hudNotificationOpen && hudNotificationPayload) {
    mp.gui.cursor.show(true, true);
    executeHud('showNotification', hudNotificationPayload);
  }
  if (notifyServer !== false) mp.events.callRemote('ragerp:dealership:close');
}

function executeDealership(method, payload) {
  if (!dealershipBrowser || !dealershipOpen) return;
  dealershipBrowser.execute(
    `window.ragerpDealership && window.ragerpDealership.${method}(${JSON.stringify(payload)})`
  );
}

function ensureRadioBrowser() {
  if (radioBrowser) return;
  radioBrowserReady = false;
  radioBrowser = mp.browsers.new('package://ragerp/radio/index.html');
}

function executeRadio(method, payload) {
  if (!radioBrowser || !radioBrowserReady) return;
  radioBrowser.execute(
    `window.ragerpRadio && window.ragerpRadio.${method}(${JSON.stringify(payload)})`
  );
}

function canOpenRadioWheel() {
  return Boolean(mp.players.local && mp.players.local.vehicle) &&
    !radioOpen && !registrationOpen && !phoneOpen && !inventoryOpen &&
    !dealershipOpen && !settingsOpen && !hudNotificationOpen && !currentPhoneCall;
}

function openRadioWheel() {
  if (!canOpenRadioWheel()) return;

  ensureRadioBrowser();
  radioOpen = true;
  mp.gui.cursor.show(true, true);
  mp.gui.chat.show(false);
  updateVoiceChatMute();
  executeRadio('setVisible', true);
}

function closeRadioWheel() {
  if (!radioOpen) return;

  radioOpen = false;
  executeRadio('setVisible', false);
  mp.gui.cursor.show(false, false);
  mp.gui.chat.show(clientSettings.media.showChat);
  updateVoiceChatMute();
}

function syncRadioVehicleState() {
  const inVehicle = Boolean(mp.players.local && mp.players.local.vehicle);
  if (radioInVehicle === inVehicle) return;

  radioInVehicle = inVehicle;
  if (!inVehicle && radioOpen) closeRadioWheel();
  mp.game.audio.setUserRadioControlEnabled(!inVehicle);
  if (inVehicle) mp.game.audio.setRadioToStationName('OFF');
  executeRadio('setInVehicle', inVehicle);
}

function handleRadioSelection(stationId) {
  if (stationId !== 'off' &&
      !Object.prototype.hasOwnProperty.call(radioStationNames, stationId)) {
    console.error('[RageRP radio] An unknown station was selected.');
    return;
  }
  if (!mp.players.local || !mp.players.local.vehicle) {
    closeRadioWheel();
    return;
  }

  currentRadioStationId = stationId === 'off' ? null : stationId;
  executeRadio('setActiveStation', currentRadioStationId);
  mp.game.graphics.notify(stationId === 'off'
    ? 'Автомобильное радио выключено.'
    : `Радио: ${radioStationNames[stationId]}`);
}

function handleRadioError(stationId, message) {
  const stationName = radioStationNames[stationId];
  if (!stationName || typeof message !== 'string' || !message || message.length > 200) {
    console.error('[RageRP radio] Received an invalid playback error.');
    return;
  }
  console.error(`[RageRP radio] ${stationName}: ${message}`);
  mp.game.graphics.notify(`Не удалось включить ${stationName}. Проверь подключение.`);
}

function setDealershipLocation(payload) {
  if (typeof payload !== 'string' || payload.length > 512) {
    console.error('[RageRP dealership] Invalid dealership location payload.');
    return;
  }

  let location;
  try {
    location = JSON.parse(payload);
  } catch (error) {
    console.error('[RageRP dealership] Could not parse dealership location:', error);
    return;
  }

  const position = location && location.position;
  const x = Number(position && position.x);
  const y = Number(position && position.y);
  const z = Number(position && position.z);
  const radius = Number(location && location.radius);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) ||
      !Number.isFinite(radius) || radius <= 0 || radius > 20) {
    console.error('[RageRP dealership] Invalid dealership location or interaction radius.');
    return;
  }

  if (dealershipMarker) dealershipMarker.destroy();
  if (dealershipBlip) dealershipBlip.destroy();
  dealershipPosition = { x, y, z };
  dealershipInteractionRadius = radius;
  const worldPosition = new mp.Vector3(x, y, z);
  dealershipMarker = mp.markers.new(1, worldPosition, 1.15, {
    bobUpAndDown: true,
    color: [201, 243, 107, 190],
    dimension: 0,
    visible: true
  });
  dealershipBlip = mp.blips.new(326, worldPosition, {
    color: 2,
    dimension: 0,
    name: 'Автосалон',
    scale: 0.8,
    shortRange: true
  });
}

function dealershipIsNearby(maxDistance) {
  if (!dealershipPosition || !mp.players.local || mp.players.local.dimension !== 0) return false;

  const position = mp.players.local.position;
  const dx = position.x - dealershipPosition.x;
  const dy = position.y - dealershipPosition.y;
  const dz = position.z - dealershipPosition.z;
  return dx * dx + dy * dy + dz * dz <= maxDistance * maxDistance;
}

function requestDealershipOpen() {
  if (dealershipOpen || phoneOpen || inventoryOpen || registrationOpen ||
      settingsOpen || hudNotificationOpen ||
      !dealershipIsNearby(dealershipInteractionRadius) ||
      (mp.players.local && mp.players.local.vehicle)) return;
  mp.events.callRemote('ragerp:dealership:request-open');
}

function settingsBindingValues(bindings) {
  const actions = ['phoneUp', 'phoneTab', 'inventory', 'vehicleLock', 'engine'];
  const normalized = {};
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index];
    const keyCode = Number(bindings && bindings[action]);
    if (!Number.isInteger(keyCode) || keyCode < 1 || keyCode > 255 ||
        keyCode === 0x1B || keyCode === 0x45 || keyCode === 0x79 ||
        keyCode === 0x51 ||
        Object.keys(normalized).some((key) => normalized[key] === keyCode)) {
      return null;
    }
    if (action !== 'engine' && quickSlotKeyCodes.indexOf(keyCode) !== -1) return null;
    normalized[action] = keyCode;
  }
  return normalized;
}

function dispatchClientKey(keyCode) {
  if (radioOpen || registrationOpen || settingsOpen ||
      hudNotificationOpen || dealershipOpen) return;

  if (keyCode === clientSettings.bindings.phoneUp ||
      keyCode === clientSettings.bindings.phoneTab) {
    togglePhone();
    return;
  }
  if (keyCode === clientSettings.bindings.inventory) {
    toggleInventory();
    return;
  }
  if (phoneOpen || inventoryOpen) return;
  if (keyCode === clientSettings.bindings.vehicleLock) {
    mp.events.callRemote('ragerp:vehicle:toggle-lock');
    return;
  }
  if (keyCode === clientSettings.bindings.engine &&
      mp.players.local && mp.players.local.vehicle) {
    mp.events.callRemote('ragerp:vehicle:toggle-engine');
    return;
  }

  const quickSlot = quickSlotKeyCodes.indexOf(keyCode);
  if (quickSlot !== -1) {
    mp.events.callRemote('ragerp:inventory:quick-use', quickSlot);
  }
}

function updateVoiceChatMute() {
  if (!mp.voiceChat || typeof mp.voiceChat.muted !== 'boolean') return;
  const phoneCallActive = currentPhoneCall && currentPhoneCall.state === 'active';
  const uiOpen = radioOpen || registrationOpen || settingsOpen || inventoryOpen || dealershipOpen ||
    (phoneOpen && !phoneCallActive);
  mp.voiceChat.muted = !voiceChatEnabled || !voiceKeyPressed || uiOpen;
}

function toggleVoiceChat() {
  const phoneCallActive = currentPhoneCall && currentPhoneCall.state === 'active';
  if (radioOpen || registrationOpen || settingsOpen || inventoryOpen || dealershipOpen ||
      (phoneOpen && !phoneCallActive)) return;
  if (!mp.voiceChat || mp.voiceChat.isAllowed === false) {
    mp.game.graphics.notify('Голосовой чат недоступен. Проверь микрофон и настройки сервера.');
    return;
  }
  voiceChatEnabled = !voiceChatEnabled;
  voiceKeyPressed = false;
  updateVoiceChatMute();
  mp.game.graphics.notify(voiceChatEnabled
    ? 'Голосовой чат включён. Удерживай Z, чтобы говорить.'
    : 'Голосовой чат выключен.');
}

function startVoiceTransmit() {
  const phoneCallActive = currentPhoneCall && currentPhoneCall.state === 'active';
  if (!voiceChatEnabled || radioOpen || registrationOpen || settingsOpen || inventoryOpen ||
      dealershipOpen ||
      (phoneOpen && !phoneCallActive)) return;
  voiceKeyPressed = true;
  updateVoiceChatMute();
}

function stopVoiceTransmit() {
  voiceKeyPressed = false;
  updateVoiceChatMute();
}

function applyKeyBindings(bindings) {
  const normalized = settingsBindingValues(bindings);
  if (!normalized) {
    console.error('[RageRP settings] Invalid key bindings were rejected.');
    return false;
  }
  if (keyBindingsInstalled && Object.keys(normalized).every((action) =>
    normalized[action] === clientSettings.bindings[action])) {
    return true;
  }
  if (keyBindingsInstalled && typeof mp.keys.unbind !== 'function') {
    console.error('[RageRP settings] This client cannot safely rebind keys.');
    return false;
  }

  if (keyBindingsInstalled) {
    activeKeyBindings.forEach((keyCode) => mp.keys.unbind(keyCode, false));
  }
  clientSettings.bindings = normalized;
  activeKeyBindings = Array.from(new Set(
    Object.keys(normalized).map((action) => normalized[action]).concat(quickSlotKeyCodes)
  ));
  activeKeyBindings.forEach((keyCode) => {
    mp.keys.bind(keyCode, false, () => dispatchClientKey(keyCode));
  });
  keyBindingsInstalled = true;
  return true;
}

function applyPhonePreferences() {
  if (!phoneBrowser || !phoneOpen) return;
  const preferences = {
    scale: clientSettings.general.phoneScale,
    right: clientSettings.general.phoneRight,
    bottom: clientSettings.general.phoneBottom
  };
  phoneBrowser.execute(
    `window.ragerpPhone && window.ragerpPhone.setPreferences(${JSON.stringify(preferences)})`
  );
}

function syncMediaSettings() {
  if (mediaSettingsSyncTimer !== null) clearTimeout(mediaSettingsSyncTimer);
  mediaSettingsSyncTimer = setTimeout(() => {
    mediaSettingsSyncTimer = null;
    mp.events.callRemote('ragerp:media:settings', JSON.stringify({
      voiceMuteUnderHours: clientSettings.media.voiceMuteUnderHours,
      showCallNotifications: clientSettings.media.showCallNotifications
    }));
  }, 400);
}

function applyClientSettings(payload, fromStorage) {
  if (!settingsOpen && fromStorage !== true) return;
  if (typeof payload !== 'string' || payload.length > 4096) return;
  let settings;
  try {
    settings = JSON.parse(payload);
  } catch (error) {
    console.error('[RageRP settings] Could not parse settings:', error);
    return;
  }
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    console.error('[RageRP settings] Received invalid settings.');
    return;
  }

  const general = settings.general;
  const graphics = settings.graphics;
  const combat = settings.combat;
  if (!general || !graphics || !combat || !settings.bindings) {
    console.error('[RageRP settings] Settings are missing required sections.');
    return;
  }
  if (typeof general.showHud === 'boolean') clientSettings.general.showHud = general.showHud;
  if (typeof general.showRadar === 'boolean') clientSettings.general.showRadar = general.showRadar;
  if (typeof general.hudOpacity === 'number' && Number.isFinite(general.hudOpacity)) {
    clientSettings.general.hudOpacity = Math.max(20, Math.min(100, general.hudOpacity));
  }
  if (typeof general.nametagDistance === 'number' && Number.isFinite(general.nametagDistance)) {
    clientSettings.general.nametagDistance = Math.max(50, Math.min(170, general.nametagDistance));
  }
  ['phoneScale', 'phoneRight', 'phoneBottom'].forEach((key) => {
    if (typeof general[key] === 'number' && Number.isFinite(general[key])) {
      const bounds = key === 'phoneScale' ? [75, 130] : [0, 15];
      clientSettings.general[key] = Math.max(bounds[0], Math.min(bounds[1], general[key]));
    }
  });
  if (typeof graphics.lodScale === 'number' && Number.isFinite(graphics.lodScale)) {
    clientSettings.graphics.lodScale = Math.max(50, Math.min(150, graphics.lodScale));
  }
  if (typeof combat.showCrosshair === 'boolean') {
    clientSettings.combat.showCrosshair = combat.showCrosshair;
  }
  if (typeof combat.showAmmo === 'boolean') clientSettings.combat.showAmmo = combat.showAmmo;
  if (typeof combat.crosshairScale === 'number' && Number.isFinite(combat.crosshairScale)) {
    clientSettings.combat.crosshairScale = Math.max(60, Math.min(150, combat.crosshairScale));
  }
  if (typeof combat.crosshairColor === 'string' &&
      /^#[0-9a-f]{6}$/i.test(combat.crosshairColor)) {
    clientSettings.combat.crosshairColor = combat.crosshairColor;
  }
  if (settings.media) {
    if (typeof settings.media.voiceMuteUnderHours === 'number' &&
        Number.isFinite(settings.media.voiceMuteUnderHours)) {
      clientSettings.media.voiceMuteUnderHours = Math.round(Math.max(
        0,
        Math.min(200, settings.media.voiceMuteUnderHours)
      ));
    }
    ['showCallNotifications', 'callNotificationSound', 'showChat'].forEach((key) => {
      if (typeof settings.media[key] === 'boolean') {
        clientSettings.media[key] = settings.media[key];
      }
    });
  }
  applyKeyBindings(settings.bindings);
  syncMediaSettings();

  if (hudBrowser) {
    executeHud('setOpacity', clientSettings.general.hudOpacity / 100);
    executeHud('setCombatOptions', clientSettings.combat);
  }
  applyPhonePreferences();
  setHudVisible(hudVisible);
  if (!phoneOpen && !inventoryOpen && !registrationOpen && !settingsOpen) {
    mp.game.ui.displayRadar(clientSettings.general.showRadar);
    mp.gui.chat.show(clientSettings.media.showChat);
  }
  if (fromStorage !== true) persistClientSettings();
}

function persistClientSettings(immediate) {
  if (!mp.storage || !mp.storage.data || typeof mp.storage.flush !== 'function') {
    console.error('[RageRP settings] Local client storage is unavailable.');
    return;
  }
  try {
    mp.storage.data.ragerpSettings = JSON.stringify(clientSettings);
    if (settingsStorageFlushTimer !== null) {
      clearTimeout(settingsStorageFlushTimer);
      settingsStorageFlushTimer = null;
    }

    const flush = () => {
      settingsStorageFlushTimer = null;
      try {
        mp.storage.flush();
      } catch (error) {
        console.error('[RageRP settings] Could not flush local client storage:', error);
      }
    };
    if (immediate === true) flush();
    else settingsStorageFlushTimer = setTimeout(flush, 500);
  } catch (error) {
    console.error('[RageRP settings] Could not store local client settings:', error);
  }
}

function restoreClientSettings() {
  if (!mp.storage || !mp.storage.data) return;
  try {
    const stored = mp.storage.data.ragerpSettings;
    if (stored === undefined || stored === null) return;
    const payload = typeof stored === 'string' ? stored : JSON.stringify(stored);
    applyClientSettings(payload, true);
  } catch (error) {
    console.error('[RageRP settings] Could not restore local client settings:', error);
  }
}

function openSettings() {
  if (radioOpen || registrationOpen || phoneOpen || inventoryOpen ||
      hudNotificationOpen || settingsOpen) return;

  settingsBrowser = mp.browsers.new('package://ragerp/settings/index.html');
  settingsOpen = true;
  setHudVisible(false);
  mp.gui.cursor.show(true, true);
  mp.gui.chat.show(false);
  updateVoiceChatMute();
  mp.game.ui.displayHud(false);
  mp.game.ui.displayRadar(false);
  if (mp.players.local) mp.players.local.freezePosition(true);
}

function closeSettings() {
  if (settingsBrowser) {
    settingsBrowser.destroy();
    settingsBrowser = null;
  }

  if (mp.players.local) mp.players.local.freezePosition(false);
  settingsOpen = false;
  mp.gui.cursor.show(false, false);
  mp.gui.chat.show(clientSettings.media.showChat);
  updateVoiceChatMute();
  mp.game.ui.displayHud(true);
  mp.game.ui.displayRadar(clientSettings.general.showRadar);
  persistClientSettings(true);
  if (hudBrowser) setHudVisible(true);
}

mp.nametags.enabled = false;

function togglePhone() {
  if (radioOpen || registrationOpen || inventoryOpen || dealershipOpen ||
      settingsOpen || hudNotificationOpen) return;
  if (phoneOpen) {
    closePhone(true);
    return;
  }
  mp.events.callRemote('ragerp:phone:request-open');
}

function toggleInventory() {
  if (radioOpen || registrationOpen || phoneOpen || dealershipOpen ||
      settingsOpen || hudNotificationOpen) return;
  if (inventoryOpen) {
    closeInventory(true);
    return;
  }
  mp.events.callRemote('ragerp:inventory:request-open');
}

function toggleSettings() {
  if (radioOpen || dealershipOpen) return;
  if (settingsOpen) {
    closeSettings();
    return;
  }
  openSettings();
}

restoreClientSettings();
applyKeyBindings(clientSettings.bindings);
updateVoiceChatMute();
mp.keys.bind(0x79, false, toggleSettings);
mp.keys.bind(0x5A, false, startVoiceTransmit);
mp.keys.bind(0x5A, true, stopVoiceTransmit);
mp.keys.bind(0x75, false, toggleVoiceChat);
mp.keys.bind(0x45, false, requestDealershipOpen);
mp.keys.bind(0x51, false, openRadioWheel);
mp.keys.bind(0x51, true, closeRadioWheel);

mp.keys.bind(0x59, false, () => answerHudNotification('accept'));
mp.keys.bind(0x4E, false, () => answerHudNotification('decline'));

mp.events.add('ragerp:registration:show', (staticId) => {
  if (registrationOpen) return;
  if (radioOpen) closeRadioWheel();

  registrationStaticId = String(staticId || '');
  registrationBrowser = mp.browsers.new('package://ragerp/registration/index.html');
  registrationOpen = true;
  setHudVisible(false);
  setRegistrationControls(true);
  setRegistrationCamera(true);
});

mp.events.add('browserDomReady', (browser) => {
  if (browser === radioBrowser) {
    radioBrowserReady = true;
    executeRadio('setVisible', radioOpen);
    executeRadio('setInVehicle', Boolean(mp.players.local && mp.players.local.vehicle));
    executeRadio('setActiveStation', currentRadioStationId);
  } else if (browser === registrationBrowser) {
    syncRegistrationBrowser();
  } else if (browser === phoneBrowser) {
    executePhone('setBootstrap', phoneBootstrap);
    applyPhonePreferences();
  } else if (browser === inventoryBrowser) {
    executeInventory('setBootstrap', inventoryBootstrap);
  } else if (browser === dealershipBrowser) {
    executeDealership('setCatalog', dealershipBootstrap);
  } else if (browser === settingsBrowser) {
    settingsBrowser.execute('window.ragerpSettings && window.ragerpSettings.focus()');
  } else if (browser === callBrowser) {
    callBrowserReady = true;
    if (currentPhoneCall) executePhoneCall(currentPhoneCall);
  } else if (browser === hudBrowser) {
    hudBrowserReady = true;
    executeHud('setBootstrap', hudBootstrap);
    setHudVisible(hudVisible);
    executeHud('setOpacity', clientSettings.general.hudOpacity / 100);
    executeHud('setCombatOptions', clientSettings.combat);
    if (hudNotificationPayload) {
      executeHud('showNotification', hudNotificationPayload);
    }
  }
});

mp.events.add('ragerp:settings:apply', applyClientSettings);

mp.events.add('ragerp:settings:close-request', () => {
  if (settingsOpen) closeSettings();
});

mp.events.add('ragerp:hud:show', (payload) => {
  openHud(payload);
});

mp.events.add('ragerp:hud:update', (payload) => {
  if (typeof payload !== 'string' || payload.length > 2048) return;
  let state;
  try {
    state = JSON.parse(payload);
  } catch (error) {
    console.error('[RageRP HUD] Could not parse the HUD update:', error);
    return;
  }
  if (!state || typeof state !== 'object' || Array.isArray(state)) return;
  mergeHudState(state);
  executeHud('update', state);
});

mp.events.add('ragerp:hud:notification', (payload) => {
  if (typeof payload !== 'string' || payload.length > 2048) return;
  let notification;
  try {
    notification = JSON.parse(payload);
  } catch (error) {
    console.error('[RageRP HUD] Could not parse the HUD notification:', error);
    return;
  }
  if (!notification || typeof notification !== 'object' ||
      typeof notification.id !== 'string' ||
      typeof notification.message !== 'string') return;

  if (radioOpen) closeRadioWheel();
  if (!hudBrowser) openHud({});
  hudNotificationPayload = notification;
  hudNotificationId = notification.id;
  hudNotificationOpen = true;
  if (inventoryOpen || dealershipOpen) return;
  mp.gui.cursor.show(true, true);
  executeHud('showNotification', notification);
});

mp.events.add('ragerp:hud:answer', (answer) => {
  if (answer === 'accept' || answer === 'decline') answerHudNotification(answer);
});

mp.events.add('ragerp:registration:request-drawables', () => {
  if (!registrationBrowser || !registrationOpen) return;
  setTimeout(syncRegistrationBrowser, 250);
});

mp.events.add('ragerp:registration:refresh-drawables', () => {
  if (!registrationBrowser || !registrationOpen) return;
  setTimeout(syncRegistrationBrowser, 250);
});

mp.events.add('ragerp:registration:submit', (payload) => {
  if (!registrationOpen || typeof payload !== 'string') return;

  mp.events.callRemote('ragerp:registration:submit', payload);
});

mp.events.add('ragerp:registration:preview', (payload) => {
  if (!registrationOpen || typeof payload !== 'string') return;

  mp.events.callRemote('ragerp:registration:preview', payload);
});

mp.events.add('ragerp:registration:rotate', (direction) => {
  if (!registrationOpen) return;
  mp.events.callRemote('ragerp:registration:rotate', Number(direction));
});

mp.events.add('ragerp:registration:feedback', (text) => {
  if (!registrationBrowser) return;

  registrationBrowser.execute(
    `window.ragerpRegistration && window.ragerpRegistration.setFeedback(${JSON.stringify(String(text))})`
  );
});

mp.events.add('ragerp:registration:success', () => {
  closeRegistration();
});

mp.events.add('ragerp:phone:open', (payload) => {
  openPhone(payload);
});

mp.events.add('ragerp:phone:update', (payload) => {
  executePhone('update', payload);
});

mp.events.add('ragerp:phone:notice', (text) => {
  executePhone('setNotice', String(text || ''));
});

mp.events.add('ragerp:phone:call:state', (payload) => {
  let state;
  try {
    state = typeof payload === 'string' ? JSON.parse(payload) : payload;
  } catch (error) {
    console.error('[RageRP phone] Could not parse call state:', error);
    return;
  }
  showPhoneCallUi(state);
});

mp.events.add('entityStreamIn', () => {
  updatePhoneCallVoiceTarget();
});

mp.events.add('ragerp:phone:call:answer-request', (callId, accepted) => {
  if (typeof callId !== 'string' || typeof accepted !== 'boolean') return;
  mp.events.callRemote('ragerp:phone:call:answer', callId, accepted);
});

mp.events.add('ragerp:phone:call:end-request', () => {
  mp.events.callRemote('ragerp:phone:call:end');
});

mp.events.add('ragerp:phone:close', () => {
  if (phoneOpen) closePhone(false);
});

mp.events.add('ragerp:phone:close-request', () => {
  if (phoneOpen) closePhone(true);
});

mp.events.add('ragerp:phone:action', (action, payload) => {
  if (!phoneOpen || typeof action !== 'string' || typeof payload !== 'string') return;
  if (payload.length > 4096) return;
  mp.events.callRemote('ragerp:phone:action', action, payload);
});

mp.events.add('ragerp:inventory:open', (payload) => {
  openInventory(payload);
});

mp.events.add('ragerp:inventory:update', (payload) => {
  executeInventory('update', payload);
});

mp.events.add('ragerp:inventory:notice', (text) => {
  executeInventory('setNotice', String(text || ''));
});

mp.events.add('ragerp:inventory:close-request', () => {
  if (inventoryOpen) closeInventory(true);
});

mp.events.add('ragerp:inventory:action', (action, payload) => {
  if (!inventoryOpen || typeof action !== 'string' || typeof payload !== 'string' ||
      payload.length > 512) return;
  mp.events.callRemote('ragerp:inventory:action', action, payload);
});

mp.events.add('ragerp:dealership:location', setDealershipLocation);

mp.events.add('ragerp:dealership:open', (payload) => {
  openDealership(payload);
});

mp.events.add('ragerp:dealership:close-request', () => {
  if (dealershipOpen) closeDealership(true);
});

function setPhoneWaypoint(payload) {
  if (typeof payload !== 'string' || payload.length > 256) return;
  let destination;
  try {
    destination = JSON.parse(payload);
  } catch (error) {
    return;
  }

  const x = Number(destination && destination.x);
  const y = Number(destination && destination.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;

  mp.game.ui.setNewWaypoint(x, y);
  executePhone('setNotice', 'Маршрут отмечен на GPS.');
}

mp.events.add('ragerp:phone:set-waypoint', setPhoneWaypoint);
mp.events.add('ragerp:phone:waypoint', setPhoneWaypoint);

setTimeout(() => {
  ensureRadioBrowser();
  mp.events.callRemote('ragerp:client:ui-ready');
}, 1500);

mp.events.add('ragerp:radio:select', handleRadioSelection);
mp.events.add('ragerp:radio:error', handleRadioError);

mp.events.add('render', () => {
  syncRadioVehicleState();

  if (phoneOpen || inventoryOpen || dealershipOpen || settingsOpen || hudNotificationOpen) {
    mp.game.controls.disableAllControlActions(0);
  }
  if (radioInVehicle) {
    [81, 82, 83, 84, 85].forEach((control) => {
      mp.game.controls.disableControlAction(0, control, true);
    });
  }
  if (radioOpen) {
    mp.game.controls.disableControlAction(0, 24, true);
    mp.game.controls.disableControlAction(0, 25, true);
    mp.game.controls.disableControlAction(0, 37, true);
  }

  if (!phoneOpen && !inventoryOpen && !dealershipOpen && !registrationOpen && !settingsOpen) {
    mp.game.ui.displayRadar(clientSettings.general.showRadar);
  }
  if (!dealershipOpen && !phoneOpen && !inventoryOpen &&
      !(mp.players.local && mp.players.local.vehicle) &&
      dealershipIsNearby(dealershipInteractionRadius + 1)) {
    mp.game.graphics.drawText('АВТОСАЛОН  ·  НАЖМИ E', [0.5, 0.88], {
      font: 4,
      color: [201, 243, 107, 255],
      scale: [0.36, 0.36],
      outline: true,
      centre: true
    });
  }
  if (clientSettings.graphics.lodScale !== 100 && typeof mp.game.invoke === 'function') {
    mp.game.invoke('0xA76359FC80B2438E', clientSettings.graphics.lodScale / 100);
  }
  if (clientSettings.combat.showAmmo &&
      !phoneOpen && !inventoryOpen && !dealershipOpen && !settingsOpen && !registrationOpen &&
      typeof mp.game.ui.displayAmmoThisFrame === 'function') {
    mp.game.ui.displayAmmoThisFrame();
  }
  const hideNativeCrosshair = !clientSettings.combat.showCrosshair ||
    (clientSettings.general.showHud && hudVisible &&
      !phoneOpen && !inventoryOpen && !dealershipOpen && !settingsOpen && !registrationOpen);
  if (hideNativeCrosshair && typeof mp.game.ui.hideHudComponentThisFrame === 'function') {
    mp.game.ui.hideHudComponentThisFrame(14);
  }

  mp.players.forEach((player) => {
    if (player === mp.players.local) return;

    const tag = player.getVariable('ragerp:nametag');
    if (typeof tag !== 'string' || !tag) return;

    const position = player.position;
    const localPosition = mp.players.local.position;
    const dx = position.x - localPosition.x;
    const dy = position.y - localPosition.y;
    const dz = position.z - localPosition.z;
    const nametagDistance = 35 * clientSettings.general.nametagDistance / 100;
    if (dx * dx + dy * dy + dz * dz > nametagDistance * nametagDistance) return;

    const screen = mp.game.graphics.world3dToScreen2d(position.x, position.y, position.z + 1.15);
    if (!screen) return;

    const parts = tag.split('\n');
    mp.game.graphics.drawText(parts[0], [screen.x, screen.y - 0.018], {
      font: 4,
      color: [201, 243, 107, 255],
      scale: [0.3, 0.3],
      outline: true,
      centre: true
    });
    mp.game.graphics.drawText(parts.slice(1).join(' '), [screen.x, screen.y], {
      font: 4,
      color: [255, 255, 255, 240],
      scale: [0.32, 0.32],
      outline: true,
      centre: true
    });
  });
});
