let registrationBrowser = null;
let registrationCamera = null;
let registrationOpen = false;
let registrationStaticId = '';

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
}

mp.nametags.enabled = false;

mp.events.add('ragerp:registration:show', (staticId) => {
  if (registrationOpen) return;

  registrationStaticId = String(staticId || '');
  registrationBrowser = mp.browsers.new('package://ragerp/registration/index.html');
  registrationOpen = true;
  setRegistrationControls(true);
  setRegistrationCamera(true);
});

mp.events.add('browserDomReady', (browser) => {
  if (browser === registrationBrowser) {
    syncRegistrationBrowser();
  }
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

mp.events.add('render', () => {
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
