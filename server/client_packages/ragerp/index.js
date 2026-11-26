let registrationBrowser = null;
let registrationCamera = null;
let registrationOpen = false;
let registrationStaticId = '';
let phoneBrowser = null;
let phoneOpen = false;
let phoneBootstrap = null;
let hudBrowser = null;
let hudBootstrap = null;
let hudBrowserReady = false;
let hudVisible = false;
let hudNotificationOpen = false;
let hudNotificationId = '';
let hudNotificationPayload = null;

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
  hudVisible = Boolean(visible);
  executeHud('setVisible', hudVisible);
  if (phoneOpen || registrationOpen) return;

  if (hudVisible) {
    mp.game.ui.displayHud(false);
    mp.game.ui.displayRadar(true);
  } else if (hudBrowser) {
    mp.game.ui.displayHud(true);
    mp.game.ui.displayRadar(true);
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
  if (!hudNotificationOpen || phoneOpen || registrationOpen) return;
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
  mp.gui.chat.show(!enabled);
  mp.game.ui.displayHud(!enabled);
  mp.game.ui.displayRadar(!enabled);

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
  if (registrationOpen || phoneOpen || hudNotificationOpen) return;

  phoneBootstrap = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
  phoneBrowser = mp.browsers.new('package://ragerp/phone/index.html');
  phoneOpen = true;
  setHudVisible(false);
  mp.gui.cursor.show(true, true);
  mp.gui.chat.show(false);
  mp.game.ui.displayHud(false);
  mp.game.ui.displayRadar(false);

  if (mp.players.local) {
    mp.players.local.freezePosition(true);
    mp.game.ai.taskStartScenarioInPlace(
      mp.players.local.handle,
      'WORLD_HUMAN_STAND_MOBILE',
      0,
      true
    );
  }
}

function closePhone(notifyServer) {
  if (phoneBrowser) {
    phoneBrowser.destroy();
    phoneBrowser = null;
  }

  if (mp.players.local) {
    mp.game.ai.clearPedTasks(mp.players.local.handle);
    mp.players.local.freezePosition(false);
  }

  phoneOpen = false;
  phoneBootstrap = null;
  mp.gui.cursor.show(false, false);
  mp.gui.chat.show(true);
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

mp.nametags.enabled = false;

mp.keys.bind(0x50, false, () => {
  if (registrationOpen || hudNotificationOpen) return;
  if (phoneOpen) {
    closePhone(true);
    return;
  }
  mp.events.callRemote('ragerp:phone:request-open');
});

mp.keys.bind(0x59, false, () => answerHudNotification('accept'));
mp.keys.bind(0x4E, false, () => answerHudNotification('decline'));

mp.events.add('ragerp:registration:show', (staticId) => {
  if (registrationOpen) return;

  registrationStaticId = String(staticId || '');
  registrationBrowser = mp.browsers.new('package://ragerp/registration/index.html');
  registrationOpen = true;
  setHudVisible(false);
  setRegistrationControls(true);
  setRegistrationCamera(true);
});

mp.events.add('browserDomReady', (browser) => {
  if (browser === registrationBrowser) {
    syncRegistrationBrowser();
  } else if (browser === phoneBrowser) {
    executePhone('setBootstrap', phoneBootstrap);
  } else if (browser === hudBrowser) {
    hudBrowserReady = true;
    executeHud('setBootstrap', hudBootstrap);
    setHudVisible(hudVisible);
    if (hudNotificationPayload) {
      executeHud('showNotification', hudNotificationPayload);
    }
  }
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

  if (!hudBrowser) openHud({});
  hudNotificationPayload = notification;
  hudNotificationId = notification.id;
  hudNotificationOpen = true;
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

mp.events.add('render', () => {
  if (phoneOpen || hudNotificationOpen) {
    mp.game.controls.disableAllControlActions(0);
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
    if (dx * dx + dy * dy + dz * dz > 35 * 35) return;

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
