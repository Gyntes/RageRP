let registrationBrowser = null;
let registrationCamera = null;
let registrationOpen = false;
let registrationStaticId = '';
let settingsBrowser = null;
let settingsOpen = false;
let settingsBrowserReady = false;
let settingsCloseInputLockUntil = 0;
let adminBrowser = null;
let adminOpen = false;
let adminBootstrap = null;
let phoneBrowser = null;
let phoneOpen = false;
let phoneBootstrap = null;
let phoneBrowserReady = false;
let queuedPassportShareRequest;
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
const playerInteractionRadius = 3;
let dealershipMarker = null;
let dealershipBlip = null;
let playerInteractionBrowser = null;
let playerInteractionOpen = false;
let playerInteractionBrowserReady = false;
let playerInteractionTargetId = null;
let playerInteractionTargetName = '';
let playerInteractionTargetType = 'player';
let radioBrowser = null;
let radioBrowserReady = false;
let radioOpen = false;
let radioInVehicle = null;
let radioVehicleHandle = null;
let currentRadioStationId = null;
let emoteBrowser = null;
let emoteBrowserReady = false;
let emoteMenuOpen = false;
let activeLocalEmote = null;
let localEmoteRequestId = 0;
let vehicleLockAnimationRequestId = 0;
let hudBrowser = null;
let hudBootstrap = null;
let hudBrowserReady = false;
let hudVisible = false;
let hudNotificationOpen = false;
let hudNotificationId = '';
let hudNotificationPayload = null;
let dashboardBrowser = null;
let dashboardBrowserReady = false;
let dashboardVisible = false;
let dashboardVehicleId = null;
let dashboardLastRenderAt = 0;
let dashboardSignalLastPressedAt = 0;
const dashboardFuelStates = new Map();
const dashboardSignalStates = new Map();
const dashboardNativeErrors = new Set();
function joaatHash(value) {
  const text = String(value).toLowerCase();
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash += text.charCodeAt(index);
    hash += hash << 10;
    hash ^= hash >>> 6;
  }
  hash += hash << 3;
  hash ^= hash >>> 11;
  hash += hash << 15;
  return hash >>> 0;
}
const dashboardSupportedModels = new Set([
  joaatHash('blista'),
  joaatHash('bmwm5g90')
]);
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
    inventory: 0x49,
    settings: 0x79,
    adminMenu: 0x7B,
    interaction: 0x45,
    radio: 0x51,
    voiceTransmit: 0x5A,
    voiceToggle: 0x75,
    vehicleLock: 0x4C,
    engine: 0x32,
    hudToggle: 0x7A,
    holster: 0x58,
    crouch: 0x11,
    animationMenu: 0x55,
    stopAnimation: 0x20,
    showFinger: 0x42,
    quickSlot1: 0x31,
    quickSlot2: 0x32,
    quickSlot3: 0x33,
    quickSlot4: 0x34,
    hudAccept: 0x59,
    hudDecline: 0x4E
  },
  alternateBindings: {
    phoneUp: 0x09,
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
let activeKeyBindings = [];
let keyBindingsInstalled = false;
let settingsStorageFlushTimer = null;
let mediaSettingsSyncTimer = null;
const quickSlotActions = ['quickSlot1', 'quickSlot2', 'quickSlot3', 'quickSlot4'];
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
const localEmotes = {
  wave: {
    name: 'Помахать',
    dictionary: 'friends@frj@ig_1',
    animation: 'wave_a'
  },
  salute: {
    name: 'Отдать честь',
    dictionary: 'anim@mp_player_intcelebrationmale@salute',
    animation: 'salute'
  },
  point: {
    name: 'Указать',
    dictionary: 'gestures@m@standing@casual',
    animation: 'gesture_point'
  },
  finger: {
    name: 'Показать жест',
    dictionary: 'anim@mp_player_intcelebrationmale@finger',
    animation: 'finger'
  }
};
let voiceChatEnabled = true;
let voiceKeyPressed = false;
let voiceTransmitKeysDown = new Set();
let stealthMovementEnabled = false;

function executeHud(method, payload) {
  if (!hudBrowser || !hudBrowserReady) return;
  hudBrowser.execute(
    `window.ragerpHud && window.ragerpHud.${method}(${JSON.stringify(payload)})`
  );
}

function executeDashboard(method, payload) {
  if (!dashboardBrowser || !dashboardBrowserReady) return;
  dashboardBrowser.execute(
    `window.ragerpDashboard && window.ragerpDashboard.${method}(${JSON.stringify(payload)})`
  );
}

function dashboardModelSupported(vehicle) {
  return Boolean(vehicle && dashboardSupportedModels.has(Number(vehicle.model) >>> 0));
}

function dashboardVehicleRemoteId(vehicle) {
  const remoteId = Number(vehicle && vehicle.remoteId);
  if (Number.isInteger(remoteId)) return remoteId;
  const id = Number(vehicle && vehicle.id);
  return Number.isInteger(id) ? id : null;
}

function dashboardVehicleIsTracked(vehicle) {
  const vehicleId = dashboardVehicleRemoteId(vehicle);
  return dashboardModelSupported(vehicle) &&
    vehicleId !== null && dashboardFuelStates.has(vehicleId);
}

function setDashboardVisible(visible) {
  dashboardVisible = visible === true;
  if (dashboardVisible && !dashboardBrowser) {
    dashboardBrowserReady = false;
    dashboardBrowser = mp.browsers.new('package://ragerp/dashboard/index.html');
  }
  executeDashboard('setVisible', dashboardVisible);
}

function getDashboardNativeValue(hash, handle, fallback) {
  try {
    const value = Number(mp.game.invoke(hash, handle));
    return Number.isFinite(value) ? value : fallback;
  } catch (error) {
    if (!dashboardNativeErrors.has(hash)) {
      dashboardNativeErrors.add(hash);
      console.error('[RageRP dashboard] Could not read vehicle telemetry:', error);
    }
    return fallback;
  }
}

function syncVehicleDashboard() {
  const player = mp.players.local;
  const vehicle = player && player.vehicle;
  if (!dashboardModelSupported(vehicle)) {
    if (dashboardVisible) setDashboardVisible(false);
    if (dashboardVehicleId !== null) {
      dashboardFuelStates.delete(dashboardVehicleId);
      dashboardSignalStates.delete(dashboardVehicleId);
    }
    dashboardVehicleId = null;
    return;
  }

  const vehicleId = dashboardVehicleRemoteId(vehicle);
  if (vehicleId === null) return;
  if (!dashboardFuelStates.has(vehicleId)) {
    if (dashboardVisible) setDashboardVisible(false);
    if (dashboardVehicleId !== null && dashboardVehicleId !== vehicleId) {
      dashboardFuelStates.delete(dashboardVehicleId);
      dashboardSignalStates.delete(dashboardVehicleId);
    }
    dashboardVehicleId = null;
    return;
  }
  if (!dashboardVisible || dashboardVehicleId !== vehicleId) {
    if (dashboardVehicleId !== null && dashboardVehicleId !== vehicleId) {
      dashboardFuelStates.delete(dashboardVehicleId);
      dashboardSignalStates.delete(dashboardVehicleId);
    }
    dashboardVehicleId = vehicleId;
    setDashboardVisible(true);
    dashboardLastRenderAt = 0;
  }
  if (!dashboardBrowserReady || Date.now() - dashboardLastRenderAt < 100) return;
  dashboardLastRenderAt = Date.now();

  const metersPerSecond = getDashboardNativeValue(
    '0xD4C4642CB7F50B5D',
    vehicle.handle,
    0
  );
  const rpm = getDashboardNativeValue('0xE7B12B54', vehicle.handle, 0);
  const currentGear = Math.round(getDashboardNativeValue('0xB4F4E566', vehicle.handle, 0));
  const engineHealth = getDashboardNativeValue('0xC45D23BAF168AAB8', vehicle.handle, 1000);
  const engineOn = getDashboardNativeValue('0xAE31E7DF9B5B132E', vehicle.handle, 0) === 1;
  const fuelState = dashboardFuelStates.get(vehicleId) || {};
  const indicators = dashboardSignalStates.get(vehicleId) || {};
  executeDashboard('update', {
    speed: Math.max(0, metersPerSecond * 3.6),
    rpm: Math.max(0, Math.min(1, rpm)),
    gear: currentGear > 0 ? String(currentGear) : engineOn ? 'N' : 'P',
    engineHealth,
    engineOn,
    fuel: fuelState.fuel,
    model: fuelState.model,
    odometerKm: fuelState.odometerKm,
    dirtLevel: fuelState.dirtLevel,
    indicators
  });
}

function requestDashboardSignal(signal) {
  if (!dashboardVisible || !mp.players.local || !mp.players.local.vehicle ||
      !dashboardVehicleIsTracked(mp.players.local.vehicle) ||
      mp.players.local.seat !== -1 ||
      radioOpen || phoneOpen || inventoryOpen || dealershipOpen ||
      registrationOpen || settingsOpen || hudNotificationOpen) return;
  const now = Date.now();
  if (now - dashboardSignalLastPressedAt < 250) return;
  dashboardSignalLastPressedAt = now;
  mp.events.callRemote('ragerp:vehicle:signals:set', signal);
}

function applyVehicleSignalState(vehicle, state) {
  if (!vehicle || !state || typeof state !== 'object') return;
  const left = state.left === true || state.hazards === true;
  const right = state.right === true || state.hazards === true;
  try {
    mp.game.invoke('0xB5D45264751B7DF0', vehicle.handle, 0, left);
    mp.game.invoke('0xB5D45264751B7DF0', vehicle.handle, 1, right);
  } catch (error) {
    console.error('[RageRP dashboard] Could not apply vehicle indicators:', error);
  }
}

function applyVehicleDirtLevel(vehicle, value) {
  const dirtLevel = Number(value);
  if (!dashboardModelSupported(vehicle) || !Number.isFinite(dirtLevel) ||
      dirtLevel < 0 || dirtLevel > 15) return;
  try {
    mp.game.invoke('0x79D3B596FE44EE8B', vehicle.handle, dirtLevel);
  } catch (error) {
    const nativeHash = '0x79D3B596FE44EE8B';
    if (!dashboardNativeErrors.has(nativeHash)) {
      dashboardNativeErrors.add(nativeHash);
      console.error('[RageRP vehicle] Could not apply vehicle dirt level:', error);
    }
  }
}

function updateHudCombatOptions() {
  executeHud('setCombatOptions', Object.assign({}, clientSettings.combat, {
    showCrosshair: clientSettings.combat.showCrosshair &&
      Date.now() >= settingsCloseInputLockUntil
  }));
}

function updateHudVoiceTransmit(active) {
  executeHud('setVoiceTransmit', active === true);
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
  updateVoiceChatMute();
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
  if (emoteMenuOpen) closeEmoteMenu();
  if (playerInteractionOpen) closePlayerInteraction();
  if (radioOpen || registrationOpen || phoneOpen || inventoryOpen || dealershipOpen ||
      hudNotificationOpen) return;

  phoneBootstrap = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
  phoneBrowserReady = false;
  queuedPassportShareRequest = undefined;
  phoneBrowser = mp.browsers.new('package://ragerp/phone/index.html');
  phoneOpen = true;
  setHudVisible(false);
  mp.gui.cursor.show(true, true);
  mp.gui.chat.show(false);
  mp.game.ui.displayRadar(false);
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
  phoneBrowserReady = false;
  queuedPassportShareRequest = undefined;
  mp.gui.cursor.show(false, false);
  mp.gui.chat.show(clientSettings.media.showChat);
  updateVoiceChatMute();
  mp.game.ui.displayHud(true);
  mp.game.ui.displayRadar(true);
  if (hudBrowser) setHudVisible(true);
  if (notifyServer !== false) mp.events.callRemote('ragerp:phone:close');
}

function openPlayerInteraction(target) {
  if (playerInteractionOpen || !target ||
      typeof target.remoteId !== 'number' || !Number.isSafeInteger(target.remoteId)) return;

  playerInteractionTargetId = target.remoteId;
  playerInteractionTargetType = 'player';
  const nametag = typeof target.getVariable === 'function'
    ? target.getVariable('ragerp:nametag')
    : '';
  playerInteractionTargetName = String(nametag || '')
    .split('\n').slice(1).join(' ') || 'Игрок';
  playerInteractionBrowserReady = false;
  playerInteractionBrowser = mp.browsers.new(
    'package://ragerp/player-interaction/index.html'
  );
  playerInteractionOpen = true;
  setHudVisible(false);
  mp.gui.cursor.show(true, true);
  mp.gui.chat.show(false);
  updateVoiceChatMute();
  mp.game.ui.displayHud(false);
  mp.game.ui.displayRadar(false);
}

function openVehicleInteraction(target) {
  if (playerInteractionOpen || !target ||
      typeof target.remoteId !== 'number' || !Number.isSafeInteger(target.remoteId)) return;

  playerInteractionTargetId = target.remoteId;
  playerInteractionTargetType = 'vehicle';
  playerInteractionTargetName = String(target.numberPlate || 'Автомобиль').slice(0, 48);
  playerInteractionBrowserReady = false;
  playerInteractionBrowser = mp.browsers.new(
    'package://ragerp/player-interaction/index.html'
  );
  playerInteractionOpen = true;
  setHudVisible(false);
  mp.gui.cursor.show(true, true);
  mp.gui.chat.show(false);
  updateVoiceChatMute();
  mp.game.ui.displayHud(false);
  mp.game.ui.displayRadar(false);
}

function closePlayerInteraction() {
  if (!playerInteractionOpen) return;

  if (playerInteractionBrowser) {
    playerInteractionBrowser.destroy();
    playerInteractionBrowser = null;
  }
  playerInteractionOpen = false;
  playerInteractionBrowserReady = false;
  playerInteractionTargetId = null;
  playerInteractionTargetName = '';
  playerInteractionTargetType = 'player';
  mp.gui.cursor.show(false, false);
  mp.gui.chat.show(clientSettings.media.showChat);
  updateVoiceChatMute();
  mp.game.ui.displayHud(true);
  mp.game.ui.displayRadar(clientSettings.general.showRadar);
  if (hudBrowser) setHudVisible(true);
}

function executePlayerInteraction(method, payload) {
  if (!playerInteractionBrowser || !playerInteractionOpen ||
      !playerInteractionBrowserReady) return;
  playerInteractionBrowser.execute(
    `window.ragerpPlayerInteraction && window.ragerpPlayerInteraction.${method}(${JSON.stringify(payload)})`
  );
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
    settingsOpen || hudNotificationOpen || playerInteractionOpen;
  mp.gui.cursor.show(anotherUiOpen, anotherUiOpen);
}

function showPhoneCallUi(payload) {
  if (!payload || typeof payload !== 'object' ||
      typeof payload.callId !== 'string' || typeof payload.state !== 'string') {
    console.error('[RageRP phone] Received invalid call state.');
    return;
  }

  if (radioOpen) closeRadioWheel();
  if (playerInteractionOpen) closePlayerInteraction();
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
  if (emoteMenuOpen) closeEmoteMenu();
  if (radioOpen || registrationOpen || phoneOpen || inventoryOpen || dealershipOpen ||
      hudNotificationOpen || playerInteractionOpen) return;

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
  if (emoteMenuOpen) closeEmoteMenu();
  if (radioOpen || registrationOpen || phoneOpen || inventoryOpen || dealershipOpen ||
      hudNotificationOpen || playerInteractionOpen) return;

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

function ensureEmoteBrowser() {
  if (emoteBrowser) return;
  emoteBrowserReady = false;
  emoteBrowser = mp.browsers.new('package://ragerp/emotes/index.html');
}

function executeEmotes(method, payload) {
  if (!emoteBrowser || !emoteBrowserReady) return;
  emoteBrowser.execute(
    `window.ragerpEmotes && window.ragerpEmotes.${method}(${JSON.stringify(payload)})`
  );
}

function openEmoteMenu() {
  if (!canUseLocalAction()) return;
  if (!mp.players.local || mp.players.local.vehicle) {
    mp.game.graphics.notify('Меню анимаций доступно только вне автомобиля.');
    return;
  }
  ensureEmoteBrowser();
  emoteMenuOpen = true;
  executeEmotes('setVisible', true);
  setHudVisible(false);
  mp.gui.cursor.show(true, true);
  mp.gui.chat.show(false);
  updateVoiceChatMute();
}

function closeEmoteMenu() {
  if (!emoteMenuOpen) return;
  emoteMenuOpen = false;
  executeEmotes('setVisible', false);
  mp.gui.cursor.show(false, false);
  mp.gui.chat.show(clientSettings.media.showChat);
  setHudVisible(true);
  mp.game.ui.displayRadar(clientSettings.general.showRadar);
  updateVoiceChatMute();
}

function playLocalEmote(emoteId) {
  const emote = localEmotes[emoteId];
  if (!emote) {
    console.error('[RageRP emotes] Received an unknown emote.');
    return;
  }
  if (!canUseLocalAction() || !mp.players.local || mp.players.local.vehicle) {
    mp.game.graphics.notify('Жесты доступны только вне автомобиля.');
    return;
  }

  localEmoteRequestId += 1;
  const requestId = localEmoteRequestId;
  const timeoutAt = Date.now() + 5000;
  mp.game.streaming.requestAnimDict(emote.dictionary);
  const playWhenReady = () => {
    if (requestId !== localEmoteRequestId) return;
    if (!mp.players.local || mp.players.local.vehicle) {
      mp.game.graphics.notify('Не удалось выполнить жест вне автомобиля.');
      return;
    }
    if (mp.game.streaming.hasAnimDictLoaded(emote.dictionary)) {
      mp.game.invoke(
        '0xEA47FE3719165B94',
        mp.players.local.handle,
        emote.dictionary,
        emote.animation,
        8.0,
        -8.0,
        -1,
        49,
        0.0,
        false,
        false,
        false
      );
      activeLocalEmote = emoteId;
      return;
    }
    if (Date.now() >= timeoutAt) {
      console.error(`[RageRP emotes] Could not load animation ${emote.dictionary}.`);
      mp.game.graphics.notify(`Не удалось загрузить анимацию «${emote.name}».`);
      return;
    }
    setTimeout(playWhenReady, 50);
  };
  playWhenReady();
}

function stopLocalAnimation() {
  localEmoteRequestId += 1;
  if (!activeLocalEmote || !mp.players.local) return;
  mp.game.invoke('0x176CECF6F920D707', mp.players.local.handle);
  activeLocalEmote = null;
}

function playVehicleLockAnimation(locked) {
  if (typeof locked !== 'boolean') {
    console.error('[RageRP vehicle] Received an invalid lock animation state.');
    return;
  }
  if (!canUseLocalAction() || !mp.players.local || mp.players.local.vehicle) return;

  const dictionary = 'anim@mp_player_intmenu@key_fob@';
  const animation = 'fob_click';
  const requestId = ++vehicleLockAnimationRequestId;
  const timeoutAt = Date.now() + 5000;
  mp.game.streaming.requestAnimDict(dictionary);

  const playWhenReady = () => {
    if (requestId !== vehicleLockAnimationRequestId) return;
    if (!canUseLocalAction() || !mp.players.local || mp.players.local.vehicle) return;
    if (mp.game.streaming.hasAnimDictLoaded(dictionary)) {
      mp.game.invoke(
        '0xEA47FE3719165B94',
        mp.players.local.handle,
        dictionary,
        animation,
        4.0,
        -4.0,
        1000,
        48,
        0.0,
        false,
        false,
        false
      );
      return;
    }
    if (Date.now() >= timeoutAt) {
      console.error('[RageRP vehicle] Could not load the key fob animation.');
      return;
    }
    setTimeout(playWhenReady, 50);
  };
  playWhenReady();
}

function handleEmoteSelection(emoteId) {
  closeEmoteMenu();
  if (typeof emoteId !== 'string' ||
      !Object.prototype.hasOwnProperty.call(localEmotes, emoteId)) {
    console.error('[RageRP emotes] Received an invalid emote selection.');
    return;
  }
  playLocalEmote(emoteId);
}

function canOpenRadioWheel() {
  return Boolean(mp.players.local && mp.players.local.vehicle) &&
    !radioOpen && !registrationOpen && !phoneOpen && !inventoryOpen &&
    !dealershipOpen && !settingsOpen && !hudNotificationOpen &&
    !playerInteractionOpen && !currentPhoneCall;
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
  const vehicle = mp.players.local && mp.players.local.vehicle;
  const inVehicle = Boolean(vehicle);
  if (radioInVehicle !== inVehicle) {
    radioInVehicle = inVehicle;
    if (!inVehicle && radioOpen) closeRadioWheel();
    mp.game.audio.setUserRadioControlEnabled(false);
    mp.game.audio.setRadioToStationName('OFF');
    executeRadio('setInVehicle', inVehicle);
  }

  if (!vehicle) {
    radioVehicleHandle = null;
    return;
  }
  if (radioVehicleHandle === vehicle.handle) return;

  radioVehicleHandle = vehicle.handle;
  mp.game.audio.setVehicleRadioEnabled(vehicle.handle, false);
  mp.game.audio.setVehRadioStation(vehicle.handle, 'OFF');
  mp.game.audio.setRadioToStationName('OFF');
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
  closeRadioWheel();
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
      settingsOpen || hudNotificationOpen || playerInteractionOpen ||
      currentPhoneCall || radioOpen || emoteMenuOpen) return;
  if (mp.players.local && mp.players.local.vehicle) {
    if (dashboardVehicleIsTracked(mp.players.local.vehicle)) {
      mp.events.callRemote('ragerp:vehicle:service');
    }
    return;
  }
  if (!dealershipIsNearby(dealershipInteractionRadius)) return;
  mp.events.callRemote('ragerp:dealership:request-open');
}

function distanceSquaredBetween(first, second) {
  const dx = Number(first.x) - Number(second.x);
  const dy = Number(first.y) - Number(second.y);
  const dz = Number(first.z) - Number(second.z);
  return dx * dx + dy * dy + dz * dz;
}

function entityHandleUnderCameraCrosshair() {
  if (!mp.players.local) return null;

  const cameraPosition = mp.game.invokeVector3('0x14D6F5678D8F1B37');
  const cameraRotation = mp.game.cam.getGameplayCamRot(2);
  const pitch = cameraRotation.x * Math.PI / 180;
  const yaw = cameraRotation.z * Math.PI / 180;
  const distance = 30;
  const direction = new mp.Vector3(
    -Math.sin(yaw) * Math.abs(Math.cos(pitch)),
    Math.cos(yaw) * Math.abs(Math.cos(pitch)),
    Math.sin(pitch)
  );
  const rayEnd = new mp.Vector3(
    cameraPosition.x + direction.x * distance,
    cameraPosition.y + direction.y * distance,
    cameraPosition.z + direction.z * distance
  );
  const ignoredEntities = [mp.players.local];
  if (mp.players.local.vehicle) ignoredEntities.push(mp.players.local.vehicle);
  const raycast = mp.raycasting.testPointToPoint(
    cameraPosition,
    rayEnd,
    ignoredEntities,
    -1
  );
  if (!raycast || !raycast.entity) return null;

  const entityHandle = typeof raycast.entity === 'number'
    ? raycast.entity
    : raycast.entity.handle;
  return Number.isSafeInteger(entityHandle) ? entityHandle : null;
}

function getPlayerUnderCameraCrosshair(entityHandle) {
  const handle = entityHandle === undefined
    ? entityHandleUnderCameraCrosshair()
    : entityHandle;
  if (handle === null) return null;
  const target = mp.players.atHandle(handle);
  if (!target || target === mp.players.local ||
      target.dimension !== mp.players.local.dimension) return null;

  const localPosition = mp.players.local.position;
  const targetPosition = target.position;
  const dx = localPosition.x - targetPosition.x;
  const dy = localPosition.y - targetPosition.y;
  const dz = localPosition.z - targetPosition.z;
  return dx * dx + dy * dy + dz * dz <= playerInteractionRadius * playerInteractionRadius
    ? target
    : null;
}

function getVehicleUnderCameraCrosshair(entityHandle) {
  const handle = entityHandle === undefined
    ? entityHandleUnderCameraCrosshair()
    : entityHandle;
  if (handle === null) return null;
  const target = mp.vehicles.atHandle(handle);
  if (!target || target.dimension !== mp.players.local.dimension) return null;

  return distanceSquaredBetween(mp.players.local.position, target.position) <= 4.5 * 4.5
    ? target
    : null;
}

function requestPlayerInteraction() {
  if (radioOpen || registrationOpen || phoneOpen || inventoryOpen || dealershipOpen ||
      settingsOpen || hudNotificationOpen || playerInteractionOpen || emoteMenuOpen ||
      currentPhoneCall) return;

  const entityHandle = entityHandleUnderCameraCrosshair();
  const target = getPlayerUnderCameraCrosshair(entityHandle);
  if (target && typeof target.remoteId === 'number' &&
      Number.isSafeInteger(target.remoteId)) {
    openPlayerInteraction(target);
    return;
  }
  const vehicle = getVehicleUnderCameraCrosshair(entityHandle);
  if (vehicle && typeof vehicle.remoteId === 'number' &&
      Number.isSafeInteger(vehicle.remoteId)) {
    openVehicleInteraction(vehicle);
    return;
  }
  requestDealershipOpen();
}

function settingsBindingValues(bindings, alternateBindings) {
  const actions = Object.keys(clientSettings.bindings);
  const primary = {};
  const alternate = {};
  const usedCodes = [];
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index];
    const storedCode = bindings && bindings[action];
    const primaryCode = storedCode === undefined
      ? clientSettings.bindings[action]
      : Number(storedCode);
    const hasAlternate = alternateBindings &&
      Object.prototype.hasOwnProperty.call(alternateBindings, action);
    const legacyPhoneAlternate = action === 'phoneUp' && bindings &&
      Object.prototype.hasOwnProperty.call(bindings, 'phoneTab');
    const storedAlternate = hasAlternate
      ? alternateBindings[action]
      : legacyPhoneAlternate
        ? bindings.phoneTab
        : clientSettings.alternateBindings[action];
    const alternateCode = storedAlternate === null || storedAlternate === undefined ||
      storedAlternate === ''
      ? null
      : Number(storedAlternate);
    if (!Number.isInteger(primaryCode) || primaryCode < 1 || primaryCode > 255 ||
        primaryCode === 0x1B ||
        (alternateCode !== null &&
          (!Number.isInteger(alternateCode) || alternateCode < 1 || alternateCode > 255 ||
            alternateCode === 0x1B))) {
      return null;
    }
    primary[action] = primaryCode;
    alternate[action] = alternateCode;
    [primaryCode, alternateCode].forEach((code) => {
      if (code === null) return;
      const conflict = usedCodes.some((used) => used.code === code &&
        !((action === 'engine' && used.action === 'quickSlot2') ||
          (action === 'quickSlot2' && used.action === 'engine')));
      if (conflict) usedCodes.push({ action, code, conflict: true });
      else usedCodes.push({ action, code, conflict: false });
    });
  }
  if (usedCodes.some((used) => used.conflict)) return null;
  return { primary, alternate };
}

function isClientKeyBound(action, keyCode) {
  return clientSettings.bindings[action] === keyCode ||
    clientSettings.alternateBindings[action] === keyCode;
}

function canUseLocalAction() {
  return !radioOpen && !registrationOpen && !settingsOpen && !adminOpen &&
    !phoneOpen && !inventoryOpen && !dealershipOpen && !playerInteractionOpen &&
    !hudNotificationOpen && !emoteMenuOpen;
}

function toggleHudVisibility() {
  if (!canUseLocalAction()) return;
  clientSettings.general.showHud = !clientSettings.general.showHud;
  setHudVisible(clientSettings.general.showHud);
  persistClientSettings();
  mp.game.graphics.notify(clientSettings.general.showHud ? 'HUD включён.' : 'HUD скрыт.');
}

function holsterWeapon() {
  if (!canUseLocalAction() || !mp.players.local) return;
  mp.game.invoke('0xADF692B254977C0C', mp.players.local.handle, 0xA2719263, true);
}

function toggleStealthMovement() {
  if (!canUseLocalAction() || !mp.players.local) return;
  if (mp.players.local.vehicle) {
    mp.game.graphics.notify('Присесть можно только вне автомобиля.');
    return;
  }
  stealthMovementEnabled = !stealthMovementEnabled;
  mp.game.invoke(
    '0x88CBB5CEB96B7BD2',
    mp.players.local.handle,
    stealthMovementEnabled,
    'DEFAULT_ACTION'
  );
}

function dispatchClientKey(keyCode) {
  if (isClientKeyBound('adminMenu', keyCode)) {
    if (adminOpen) {
      closeAdmin(true);
    } else if (!radioOpen && !registrationOpen && !settingsOpen && !dealershipOpen &&
        !emoteMenuOpen && !phoneOpen && !inventoryOpen && !playerInteractionOpen &&
        !hudNotificationOpen && !currentPhoneCall) {
      mp.events.callRemote('ragerp:admin:request-open');
    }
    return;
  }
  if (radioOpen || registrationOpen || settingsOpen || dealershipOpen ||
      emoteMenuOpen || adminOpen) return;

  if (isClientKeyBound('settings', keyCode)) {
    toggleSettings();
    return;
  }
  if (isClientKeyBound('interaction', keyCode)) {
    requestPlayerInteraction();
    return;
  }
  if (isClientKeyBound('radio', keyCode)) {
    openRadioWheel();
    return;
  }
  if (isClientKeyBound('voiceTransmit', keyCode)) {
    startVoiceTransmit(keyCode);
    return;
  }
  if (isClientKeyBound('voiceToggle', keyCode)) {
    toggleVoiceChat();
    return;
  }
  if (isClientKeyBound('hudAccept', keyCode)) {
    answerHudNotification('accept');
    return;
  }
  if (isClientKeyBound('hudDecline', keyCode)) {
    answerHudNotification('decline');
    return;
  }
  if (isClientKeyBound('hudToggle', keyCode)) {
    toggleHudVisibility();
    return;
  }
  if (isClientKeyBound('holster', keyCode)) {
    holsterWeapon();
    return;
  }
  if (isClientKeyBound('crouch', keyCode)) {
    toggleStealthMovement();
    return;
  }
  if (isClientKeyBound('animationMenu', keyCode)) {
    openEmoteMenu();
    return;
  }
  if (isClientKeyBound('stopAnimation', keyCode)) {
    if (canUseLocalAction()) stopLocalAnimation();
    return;
  }
  if (isClientKeyBound('showFinger', keyCode)) {
    playLocalEmote('finger');
    return;
  }

  if (isClientKeyBound('phoneUp', keyCode)) {
    togglePhone();
    return;
  }
  if (isClientKeyBound('inventory', keyCode)) {
    toggleInventory();
    return;
  }
  if (phoneOpen || inventoryOpen || playerInteractionOpen) return;
  if (isClientKeyBound('vehicleLock', keyCode)) {
    mp.events.callRemote('ragerp:vehicle:toggle-lock');
    return;
  }
  if (isClientKeyBound('engine', keyCode) &&
      mp.players.local && mp.players.local.vehicle) {
    mp.events.callRemote('ragerp:vehicle:toggle-engine');
    return;
  }

  const quickSlot = quickSlotActions.findIndex((action) =>
    isClientKeyBound(action, keyCode));
  if (quickSlot !== -1) {
    mp.events.callRemote('ragerp:inventory:quick-use', quickSlot);
  }
}

function releaseClientKey(keyCode) {
  if (isClientKeyBound('radio', keyCode)) closeRadioWheel();
  if (voiceTransmitKeysDown.delete(keyCode) && voiceTransmitKeysDown.size === 0) {
    stopVoiceTransmit();
  }
}

function updateVoiceChatMute() {
  const phoneCallActive = currentPhoneCall && currentPhoneCall.state === 'active';
  const uiOpen = radioOpen || registrationOpen || settingsOpen || adminOpen || emoteMenuOpen ||
    inventoryOpen || dealershipOpen || hudNotificationOpen || playerInteractionOpen ||
    (phoneOpen && !phoneCallActive);
  if (uiOpen) {
    voiceKeyPressed = false;
    voiceTransmitKeysDown.clear();
    updateHudVoiceTransmit(false);
  }
  if (!mp.voiceChat || typeof mp.voiceChat.muted !== 'boolean') return;
  mp.voiceChat.muted = !voiceChatEnabled || !voiceKeyPressed || uiOpen;
}

function toggleVoiceChat() {
  const phoneCallActive = currentPhoneCall && currentPhoneCall.state === 'active';
  if (radioOpen || registrationOpen || settingsOpen || adminOpen || emoteMenuOpen || inventoryOpen ||
      dealershipOpen || hudNotificationOpen || playerInteractionOpen ||
      (phoneOpen && !phoneCallActive)) return;
  if (!mp.voiceChat || mp.voiceChat.isAllowed === false) {
    mp.game.graphics.notify('Голосовой чат недоступен. Проверь микрофон и настройки сервера.');
    return;
  }
  voiceChatEnabled = !voiceChatEnabled;
  stopVoiceTransmit();
  updateVoiceChatMute();
  mp.game.graphics.notify(voiceChatEnabled
    ? 'Голосовой чат включён. Удерживай назначенную клавишу, чтобы говорить.'
    : 'Голосовой чат выключен.');
}

function startVoiceTransmit(keyCode) {
  const phoneCallActive = currentPhoneCall && currentPhoneCall.state === 'active';
  if (!voiceChatEnabled || radioOpen || registrationOpen || settingsOpen || adminOpen ||
      emoteMenuOpen ||
      inventoryOpen || dealershipOpen || hudNotificationOpen || playerInteractionOpen ||
      (phoneOpen && !phoneCallActive)) return;
  if (!mp.voiceChat || mp.voiceChat.isAllowed === false) {
    mp.game.graphics.notify('Голосовой чат недоступен. Проверь микрофон и настройки сервера.');
    return;
  }
  voiceKeyPressed = true;
  voiceTransmitKeysDown.add(keyCode);
  updateVoiceChatMute();
  updateHudVoiceTransmit(true);
}

function stopVoiceTransmit() {
  voiceKeyPressed = false;
  voiceTransmitKeysDown.clear();
  updateVoiceChatMute();
  updateHudVoiceTransmit(false);
}

function applyKeyBindings(bindings, alternateBindings) {
  const normalized = settingsBindingValues(bindings, alternateBindings);
  if (!normalized) {
    console.error('[RageRP settings] Invalid key bindings were rejected.');
    return false;
  }
  if (keyBindingsInstalled && Object.keys(normalized.primary).every((action) =>
    normalized.primary[action] === clientSettings.bindings[action] &&
    normalized.alternate[action] === clientSettings.alternateBindings[action])) {
    return true;
  }
  if (keyBindingsInstalled && typeof mp.keys.unbind !== 'function') {
    console.error('[RageRP settings] This client cannot safely rebind keys.');
    return false;
  }

  if (voiceKeyPressed &&
      (normalized.primary.voiceTransmit !== clientSettings.bindings.voiceTransmit ||
        normalized.alternate.voiceTransmit !== clientSettings.alternateBindings.voiceTransmit)) {
    stopVoiceTransmit();
  }
  if (keyBindingsInstalled) {
    activeKeyBindings.forEach((keyCode) => {
      mp.keys.unbind(keyCode, false);
      mp.keys.unbind(keyCode, true);
    });
  }
  clientSettings.bindings = normalized.primary;
  clientSettings.alternateBindings = normalized.alternate;
  activeKeyBindings = Array.from(new Set(Object.keys(normalized.primary).reduce((keys, action) => {
    keys.push(normalized.primary[action]);
    if (normalized.alternate[action] !== null) keys.push(normalized.alternate[action]);
    return keys;
  }, [])));
  activeKeyBindings.forEach((keyCode) => {
    mp.keys.bind(keyCode, false, () => dispatchClientKey(keyCode));
    mp.keys.bind(keyCode, true, () => releaseClientKey(keyCode));
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
  if (typeof general.showHud === 'boolean' &&
      (!settingsOpen || settingsBrowserReady)) {
    clientSettings.general.showHud = general.showHud;
  }
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
    if (typeof settings.media.radioVolume === 'number' &&
        Number.isFinite(settings.media.radioVolume)) {
      clientSettings.media.radioVolume = Math.max(0, Math.min(100, settings.media.radioVolume));
    }
    ['showCallNotifications', 'callNotificationSound', 'showChat'].forEach((key) => {
      if (typeof settings.media[key] === 'boolean') {
        clientSettings.media[key] = settings.media[key];
      }
    });
  }
  executeRadio('setVolume', clientSettings.media.radioVolume / 100);
  applyKeyBindings(settings.bindings, settings.alternateBindings);
  syncMediaSettings();

  if (hudBrowser) {
    executeHud('setOpacity', clientSettings.general.hudOpacity / 100);
    updateHudCombatOptions();
    executeHud('setNotificationKeys', {
      accept: clientSettings.bindings.hudAccept,
      acceptAlternate: clientSettings.alternateBindings.hudAccept,
      decline: clientSettings.bindings.hudDecline,
      declineAlternate: clientSettings.alternateBindings.hudDecline
    });
    updateHudVoiceTransmit(voiceKeyPressed);
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

function openAdmin(payload) {
  if (emoteMenuOpen) closeEmoteMenu();
  if (playerInteractionOpen) closePlayerInteraction();
  if (radioOpen || registrationOpen || phoneOpen || inventoryOpen || dealershipOpen ||
      settingsOpen || adminOpen || hudNotificationOpen || currentPhoneCall) return;
  let bootstrap = payload;
  if (typeof payload === 'string') {
    if (payload.length > 20000) return;
    try {
      bootstrap = JSON.parse(payload);
    } catch (error) {
      console.error('[RageRP admin] Could not parse admin menu state:', error);
      return;
    }
  }
  adminBootstrap = bootstrap;
  adminBrowser = mp.browsers.new('package://ragerp/admin/index.html');
  adminOpen = true;
  setHudVisible(false);
  mp.gui.cursor.show(true, true);
  mp.gui.chat.show(false);
  updateVoiceChatMute();
  mp.game.ui.displayHud(false);
  mp.game.ui.displayRadar(false);
  if (mp.players.local) mp.players.local.freezePosition(true);
}

function closeAdmin(notifyServer) {
  if (adminBrowser) {
    adminBrowser.destroy();
    adminBrowser = null;
  }
  adminOpen = false;
  adminBootstrap = null;
  mp.gui.cursor.show(false, false);
  mp.gui.chat.show(clientSettings.media.showChat);
  updateVoiceChatMute();
  mp.game.ui.displayHud(true);
  mp.game.ui.displayRadar(clientSettings.general.showRadar);
  if (mp.players.local) mp.players.local.freezePosition(false);
  if (hudBrowser) setHudVisible(true);
  if (notifyServer !== false) mp.events.callRemote('ragerp:admin:close');
}

function executeAdmin(method, payload) {
  if (!adminBrowser || !adminOpen) return;
  adminBrowser.execute(
    `window.ragerpAdmin && window.ragerpAdmin.${method}(${JSON.stringify(payload)})`
  );
}

function openSettings() {
  if (radioOpen || registrationOpen || phoneOpen || inventoryOpen || emoteMenuOpen ||
      hudNotificationOpen || settingsOpen || playerInteractionOpen) return;

  settingsBrowserReady = false;
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
  settingsBrowserReady = false;

  if (mp.players.local) mp.players.local.freezePosition(false);
  settingsOpen = false;
  settingsCloseInputLockUntil = Date.now() + 250;
  mp.gui.cursor.show(false, false);
  mp.gui.chat.show(clientSettings.media.showChat);
  updateVoiceChatMute();
  mp.game.ui.displayHud(true);
  mp.game.ui.displayRadar(clientSettings.general.showRadar);
  persistClientSettings(true);
  if (hudBrowser) setHudVisible(true);
  updateHudCombatOptions();
  setTimeout(() => {
    if (!settingsOpen) updateHudCombatOptions();
  }, 250);
  setTimeout(() => {
    if (!radioOpen && !registrationOpen && !phoneOpen && !inventoryOpen &&
        !dealershipOpen && !settingsOpen && !adminOpen && !hudNotificationOpen &&
        !playerInteractionOpen && !currentPhoneCall) {
      mp.gui.cursor.show(false, false);
    }
  }, 0);
}

mp.nametags.enabled = false;

function togglePhone() {
  if (radioOpen || registrationOpen || inventoryOpen || dealershipOpen || playerInteractionOpen ||
      emoteMenuOpen ||
      settingsOpen || hudNotificationOpen) return;
  if (phoneOpen) {
    closePhone(true);
    return;
  }
  mp.events.callRemote('ragerp:phone:request-open');
}

function toggleInventory() {
  if (radioOpen || registrationOpen || phoneOpen || dealershipOpen || playerInteractionOpen ||
      emoteMenuOpen ||
      settingsOpen || hudNotificationOpen) return;
  if (inventoryOpen) {
    closeInventory(true);
    return;
  }
  mp.events.callRemote('ragerp:inventory:request-open');
}

function toggleSettings() {
  if (radioOpen || dealershipOpen || playerInteractionOpen || emoteMenuOpen) return;
  if (settingsOpen) {
    closeSettings();
    return;
  }
  openSettings();
}

restoreClientSettings();
applyKeyBindings(clientSettings.bindings, clientSettings.alternateBindings);
updateVoiceChatMute();
mp.keys.bind(0x1B, false, () => {
  if (playerInteractionOpen) closePlayerInteraction();
});
mp.keys.bind(0xDB, false, () => requestDashboardSignal('left'));
mp.keys.bind(0xDD, false, () => requestDashboardSignal('right'));
mp.keys.bind(0xDC, false, () => requestDashboardSignal('hazards'));
mp.keys.bind(0x51, false, openRadioWheel);
mp.keys.bind(0x51, true, closeRadioWheel);

mp.keys.bind(0x59, false, () => answerHudNotification('accept'));
mp.keys.bind(0x4E, false, () => answerHudNotification('decline'));

mp.events.add('ragerp:registration:show', (staticId) => {
  if (registrationOpen) return;
  if (emoteMenuOpen) closeEmoteMenu();
  if (radioOpen) closeRadioWheel();
  if (playerInteractionOpen) closePlayerInteraction();

  registrationStaticId = String(staticId || '');
  registrationBrowser = mp.browsers.new('package://ragerp/registration/index.html');
  registrationOpen = true;
  setHudVisible(false);
  setRegistrationControls(true);
  setRegistrationCamera(true);
});

mp.events.add('browserDomReady', (browser) => {
  if (browser === playerInteractionBrowser) {
    playerInteractionBrowserReady = true;
    if (playerInteractionTargetType === 'vehicle') {
      executePlayerInteraction('setVehicleMode', playerInteractionTargetName);
    } else {
      executePlayerInteraction('setPlayerMode', playerInteractionTargetName);
    }
  } else if (browser === emoteBrowser) {
    emoteBrowserReady = true;
    executeEmotes('setVisible', emoteMenuOpen);
  } else if (browser === radioBrowser) {
    radioBrowserReady = true;
    executeRadio('setVisible', radioOpen);
    executeRadio('setInVehicle', Boolean(mp.players.local && mp.players.local.vehicle));
    executeRadio('setActiveStation', currentRadioStationId);
    executeRadio('setVolume', clientSettings.media.radioVolume / 100);
  } else if (browser === adminBrowser) {
    adminBrowser.active = true;
    mp.gui.cursor.show(true, true);
    mp.gui.chat.show(false);
    executeAdmin('setState', adminBootstrap);
  } else if (browser === registrationBrowser) {
    syncRegistrationBrowser();
  } else if (browser === phoneBrowser) {
    phoneBrowserReady = true;
    executePhone('setBootstrap', phoneBootstrap);
    if (queuedPassportShareRequest !== undefined) {
      executePhone('setPassportShareRequest', queuedPassportShareRequest);
      queuedPassportShareRequest = undefined;
    }
    applyPhonePreferences();
  } else if (browser === inventoryBrowser) {
    executeInventory('setBootstrap', inventoryBootstrap);
  } else if (browser === dealershipBrowser) {
    executeDealership('setCatalog', dealershipBootstrap);
  } else if (browser === settingsBrowser) {
    settingsBrowserReady = true;
    settingsBrowser.execute(
      `window.ragerpSettings && window.ragerpSettings.syncHudPreference(${JSON.stringify(clientSettings.general.showHud)})`
    );
    settingsBrowser.execute('window.ragerpSettings && window.ragerpSettings.focus()');
  } else if (browser === callBrowser) {
    callBrowserReady = true;
    if (currentPhoneCall) executePhoneCall(currentPhoneCall);
  } else if (browser === hudBrowser) {
    hudBrowserReady = true;
    executeHud('setBootstrap', hudBootstrap);
    setHudVisible(hudVisible);
    executeHud('setOpacity', clientSettings.general.hudOpacity / 100);
    updateHudCombatOptions();
    executeHud('setNotificationKeys', {
      accept: clientSettings.bindings.hudAccept,
      acceptAlternate: clientSettings.alternateBindings.hudAccept,
      decline: clientSettings.bindings.hudDecline,
      declineAlternate: clientSettings.alternateBindings.hudDecline
    });
    updateHudVoiceTransmit(voiceKeyPressed);
    if (hudNotificationPayload) {
      executeHud('showNotification', hudNotificationPayload);
    }
  } else if (browser === dashboardBrowser) {
    dashboardBrowserReady = true;
    executeDashboard('setVisible', dashboardVisible);
    syncVehicleDashboard();
  }
});

mp.events.add('ragerp:settings:apply', applyClientSettings);

mp.events.add('ragerp:settings:close-request', () => {
  if (settingsOpen) closeSettings();
});

mp.events.add('ragerp:admin:open', (payload) => {
  openAdmin(payload);
});

mp.events.add('ragerp:admin:close', () => {
  if (adminOpen) closeAdmin(true);
});

mp.events.add('ragerp:admin:logs', (payload) => {
  mp.events.callRemote('ragerp:admin:logs', typeof payload === 'string'
    ? payload
    : JSON.stringify(payload));
});

mp.events.add('ragerp:admin:logs-response', (payload) => {
  executeAdmin('setLogs', payload);
});

mp.events.add('ragerp:admin:action', (payload) => {
  mp.events.callRemote('ragerp:admin:action', typeof payload === 'string'
    ? payload
    : JSON.stringify(payload));
});

mp.events.add('ragerp:admin:player-info', (payload) => {
  executeAdmin('setPlayerInfo', payload);
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

  if (emoteMenuOpen) closeEmoteMenu();
  if (radioOpen) closeRadioWheel();
  if (playerInteractionOpen) closePlayerInteraction();
  if (!hudBrowser) openHud({});
  hudNotificationPayload = notification;
  hudNotificationId = notification.id;
  hudNotificationOpen = true;
  updateVoiceChatMute();
  if (inventoryOpen || dealershipOpen) return;
  mp.gui.cursor.show(true, true);
  executeHud('showNotification', notification);
});

mp.events.add('ragerp:hud:answer', (answer) => {
  if (answer === 'accept' || answer === 'decline') answerHudNotification(answer);
});

mp.events.add('ragerp:vehicle:fuel:update', (vehicleIdValue, payload) => {
  const vehicleId = Number(vehicleIdValue);
  if (!Number.isInteger(vehicleId) || typeof payload !== 'string' || payload.length > 256) return;
  let state;
  try {
    state = JSON.parse(payload);
  } catch (error) {
    console.error('[RageRP dashboard] Could not parse fuel state:', error);
    return;
  }
  if (!state || typeof state !== 'object' ||
      typeof state.fuel !== 'number' || !Number.isFinite(state.fuel) ||
      state.fuel < 0 || state.fuel > 100 ||
      typeof state.odometerKm !== 'number' || !Number.isFinite(state.odometerKm) ||
      state.odometerKm < 0 ||
      typeof state.dirtLevel !== 'number' || !Number.isFinite(state.dirtLevel) ||
      state.dirtLevel < 0 || state.dirtLevel > 15 ||
      typeof state.engineOn !== 'boolean' ||
      !['blista', 'bmwm5g90'].includes(state.model)) return;
  dashboardFuelStates.set(vehicleId, state);
  const vehicle = mp.players.local && mp.players.local.vehicle;
  if (dashboardVehicleRemoteId(vehicle) === vehicleId) {
    applyVehicleDirtLevel(vehicle, state.dirtLevel);
  }
});

mp.events.add('ragerp:vehicle:dirt:update', (vehicleIdValue, dirtLevelValue) => {
  const vehicleId = Number(vehicleIdValue);
  const dirtLevel = Number(dirtLevelValue);
  if (!Number.isInteger(vehicleId) || !Number.isFinite(dirtLevel) ||
      dirtLevel < 0 || dirtLevel > 15 ||
      !mp.vehicles || typeof mp.vehicles.atRemoteId !== 'function') return;
  const vehicle = mp.vehicles.atRemoteId(vehicleId);
  if (vehicle) applyVehicleDirtLevel(vehicle, dirtLevel);
  const fuelState = dashboardFuelStates.get(vehicleId);
  if (fuelState) fuelState.dirtLevel = dirtLevel;
});

mp.events.add('ragerp:vehicle:signals:update', (vehicleIdValue, payload) => {
  const vehicleId = Number(vehicleIdValue);
  if (!Number.isInteger(vehicleId) || typeof payload !== 'string' || payload.length > 128) return;
  let state;
  try {
    state = JSON.parse(payload);
  } catch (error) {
    console.error('[RageRP dashboard] Could not parse indicator state:', error);
    return;
  }
  if (!state || typeof state !== 'object' ||
      typeof state.left !== 'boolean' || typeof state.right !== 'boolean' ||
      typeof state.hazards !== 'boolean') return;

  dashboardSignalStates.set(vehicleId, state);
  if (dashboardSignalStates.size > 128) {
    const oldestVehicleId = dashboardSignalStates.keys().next().value;
    dashboardSignalStates.delete(oldestVehicleId);
  }
  if (!mp.vehicles || typeof mp.vehicles.atRemoteId !== 'function') return;
  const vehicle = mp.vehicles.atRemoteId(vehicleId);
  if (vehicle) applyVehicleSignalState(vehicle, state);
});

mp.events.add('ragerp:dashboard:signal', (signal) => {
  if (['left', 'right', 'hazards'].includes(signal)) requestDashboardSignal(signal);
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

mp.events.add('ragerp:phone:passport:request', (payload) => {
  let request = null;
  try {
    request = typeof payload === 'string' ? JSON.parse(payload) : payload;
  } catch (error) {
    console.error('[RageRP phone] Could not parse PTS share request:', error);
    return;
  }
  if (!request || typeof request !== 'object') {
    if (phoneOpen) {
      if (phoneBrowserReady) executePhone('setPassportShareRequest', null);
      else queuedPassportShareRequest = null;
    }
    return;
  }
  if (!phoneOpen) {
    if (playerInteractionOpen) closePlayerInteraction();
    mp.events.callRemote('ragerp:phone:request-open');
  } else if (phoneBrowserReady) {
    executePhone('setPassportShareRequest', request);
  } else {
    queuedPassportShareRequest = request;
  }
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

mp.events.add('entityStreamIn', (entity) => {
  updatePhoneCallVoiceTarget();
  const vehicleId = dashboardVehicleRemoteId(entity);
  if (vehicleId === null || !mp.vehicles ||
      typeof mp.vehicles.atRemoteId !== 'function') return;
  const vehicle = mp.vehicles.atRemoteId(vehicleId);
  if (!vehicle || vehicle !== entity) return;
  if (dashboardModelSupported(vehicle)) {
    mp.events.callRemote('ragerp:vehicle:stats:request', vehicleId);
    const fuelState = dashboardFuelStates.get(vehicleId);
    if (fuelState) applyVehicleDirtLevel(vehicle, fuelState.dirtLevel);
  }
  const signalState = dashboardSignalStates.get(vehicleId);
  if (signalState) applyVehicleSignalState(vehicle, signalState);
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

mp.events.add('ragerp:player-interaction:close-request', () => {
  closePlayerInteraction();
});

mp.events.add('ragerp:player-interaction:action', (action) => {
  if (!playerInteractionOpen || typeof action !== 'string') return;
  const targetId = playerInteractionTargetId;
  const targetType = playerInteractionTargetType;
  closePlayerInteraction();
  if (!Number.isSafeInteger(targetId)) return;
  if (targetType === 'player' && action === 'vehicle-passport') {
    mp.events.callRemote('ragerp:vehicle-passport:share-to', targetId);
    return;
  }
  if (targetType === 'vehicle' &&
      ['trunk', 'hood', 'lock', 'lockpick'].includes(action)) {
    mp.events.callRemote('ragerp:vehicle:interaction', action, targetId);
  }
});

mp.events.add('ragerp:vehicle:lock-animation', playVehicleLockAnimation);

mp.events.add('ragerp:vehicle:door', (remoteId, doorIndex, open) => {
  if (!Number.isSafeInteger(remoteId) || !Number.isInteger(doorIndex) ||
      ![4, 5].includes(doorIndex) || typeof open !== 'boolean') return;
  const vehicle = mp.vehicles.at(remoteId);
  if (!vehicle) return;
  if (open) {
    mp.game.vehicle.setVehicleDoorOpen(vehicle.handle, doorIndex, false, false);
  } else {
    mp.game.vehicle.setVehicleDoorShut(vehicle.handle, doorIndex, false);
  }
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

mp.events.add('ragerp:inventory:close', () => {
  if (inventoryOpen) closeInventory(false);
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
mp.events.add('ragerp:emotes:select', handleEmoteSelection);
mp.events.add('ragerp:emotes:close', closeEmoteMenu);

mp.events.add('render', () => {
  syncRadioVehicleState();
  syncVehicleDashboard();
  mp.game.ui.hideHudComponentThisFrame(16);
  mp.game.controls.disableControlAction(0, 36, true);
  if (stealthMovementEnabled) {
    if (mp.players.local && mp.players.local.vehicle) {
      stealthMovementEnabled = false;
      mp.game.invoke('0x88CBB5CEB96B7BD2', mp.players.local.handle, false, 'DEFAULT_ACTION');
    }
  }

  if (phoneOpen || inventoryOpen || dealershipOpen || settingsOpen || adminOpen || emoteMenuOpen ||
      hudNotificationOpen || playerInteractionOpen) {
    mp.game.controls.disableAllControlActions(0);
  }
  if (radioInVehicle) {
    [81, 82, 83, 84, 85].forEach((control) => {
      mp.game.controls.disableControlAction(0, control, true);
    });
  }
  if (Date.now() < settingsCloseInputLockUntil) {
    [24, 25, 37].forEach((control) => {
      mp.game.controls.disableControlAction(0, control, true);
    });
  }
  if (radioOpen) {
    mp.game.controls.disableControlAction(0, 24, true);
    mp.game.controls.disableControlAction(0, 25, true);
    mp.game.controls.disableControlAction(0, 37, true);
  }

  if (!phoneOpen && !inventoryOpen && !dealershipOpen && !registrationOpen && !adminOpen &&
      !emoteMenuOpen &&
      !settingsOpen && !playerInteractionOpen) {
    mp.game.ui.displayRadar(clientSettings.general.showRadar);
  }
  if (!dealershipOpen && !phoneOpen && !inventoryOpen && !playerInteractionOpen &&
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
  const hideNativeCrosshair = Date.now() < settingsCloseInputLockUntil ||
    !clientSettings.combat.showCrosshair ||
    (clientSettings.general.showHud && hudVisible && !adminOpen &&
      !phoneOpen && !inventoryOpen && !dealershipOpen && !settingsOpen &&
      !registrationOpen && !playerInteractionOpen);
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
