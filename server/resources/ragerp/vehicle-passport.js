const SHARE_RANGE_METERS = 3;
const STATIC_ID_PATTERN = /^\d{3}-\d{3}$/;

function isValidPosition(position) {
  return position &&
    Number.isFinite(position.x) &&
    Number.isFinite(position.y) &&
    Number.isFinite(position.z);
}

function targetsWithinShareRange(origin, candidates) {
  if (!isValidPosition(origin) || !Array.isArray(candidates)) return [];

  const rangeSquared = SHARE_RANGE_METERS * SHARE_RANGE_METERS;
  return candidates.map((candidate) => {
    if (!candidate || candidate.staticId === origin.staticId ||
        candidate.dimension !== origin.dimension || !STATIC_ID_PATTERN.test(String(candidate.staticId || '')) ||
        !isValidPosition(candidate)) {
      return null;
    }

    const dx = Number(candidate.x) - Number(origin.x);
    const dy = Number(candidate.y) - Number(origin.y);
    const dz = Number(candidate.z) - Number(origin.z);
    const distanceSquared = dx * dx + dy * dy + dz * dz;
    if (distanceSquared > rangeSquared) return null;

    return {
      staticId: candidate.staticId,
      name: String(candidate.name || 'Без имени').slice(0, 60),
      distance: Math.sqrt(distanceSquared)
    };
  }).filter(Boolean).sort((left, right) => left.distance - right.distance);
}

module.exports = {
  SHARE_RANGE_METERS,
  targetsWithinShareRange
};
