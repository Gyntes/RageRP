const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

function canReceiveVoice(options) {
  const speakerPlaytimeMs = Number(options.speakerPlaytimeMs);
  const muteUnderHours = Number(options.muteUnderHours);
  if (!Number.isFinite(speakerPlaytimeMs) || speakerPlaytimeMs < 0 ||
      !Number.isFinite(muteUnderHours) || muteUnderHours < 0 ||
      speakerPlaytimeMs < muteUnderHours * MILLISECONDS_PER_HOUR) {
    return false;
  }

  if (options.phoneCall === true) return true;
  if (options.listenerDimension !== options.speakerDimension) return false;

  const distanceSquared = Number(options.distanceSquared);
  const range = Number(options.range);
  return Number.isFinite(distanceSquared) && distanceSquared >= 0 &&
    Number.isFinite(range) && range >= 0 && distanceSquared <= range * range;
}

module.exports = { canReceiveVoice };
