const test = require('node:test');
const assert = require('node:assert/strict');
const voice = require('../server/resources/ragerp/voice');

const oneHour = 60 * 60 * 1000;

test('proximity voice requires same dimension and configured range', () => {
  const nearby = {
    listenerDimension: 0,
    speakerDimension: 0,
    distanceSquared: 100,
    range: 15,
    speakerPlaytimeMs: oneHour,
    muteUnderHours: 0
  };

  assert.equal(voice.canReceiveVoice(nearby), true);
  assert.equal(voice.canReceiveVoice({ ...nearby, distanceSquared: 256 }), false);
  assert.equal(voice.canReceiveVoice({ ...nearby, speakerDimension: 10 }), false);
});

test('playtime threshold mutes players below the selected hours', () => {
  const options = {
    listenerDimension: 0,
    speakerDimension: 0,
    distanceSquared: 1,
    range: 15,
    speakerPlaytimeMs: oneHour - 1,
    muteUnderHours: 1
  };

  assert.equal(voice.canReceiveVoice(options), false);
  assert.equal(voice.canReceiveVoice({ ...options, speakerPlaytimeMs: oneHour }), true);
});

test('phone calls bypass proximity but still respect the playtime threshold', () => {
  const options = {
    listenerDimension: 0,
    speakerDimension: 10,
    distanceSquared: 1000000,
    range: 15,
    speakerPlaytimeMs: oneHour,
    muteUnderHours: 1,
    phoneCall: true
  };

  assert.equal(voice.canReceiveVoice(options), true);
  assert.equal(voice.canReceiveVoice({ ...options, speakerPlaytimeMs: oneHour - 1 }), false);
});
