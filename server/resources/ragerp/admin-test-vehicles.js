const vehicles = Object.freeze({
  blista: Object.freeze({ name: 'Blista', plate: 'TESTBLI' }),
  bmwm5g90: Object.freeze({ name: 'BMW M5 G90', plate: 'TESTM5' }),
  ragerp_vaz2106: Object.freeze({ name: 'ВАЗ-2106', plate: 'TEST2106' }),
  ragerp_vaz2114: Object.freeze({ name: 'ВАЗ-2114', plate: 'TEST2114' })
});

function getVehicle(modelId) {
  if (typeof modelId !== 'string') return null;
  const normalizedModelId = modelId.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(vehicles, normalizedModelId)
    ? vehicles[normalizedModelId]
    : null;
}

function getSupportedModelIds() {
  return Object.keys(vehicles);
}

function spawnPosition(position, heading, distance) {
  const x = Number(position && position.x);
  const y = Number(position && position.y);
  const z = Number(position && position.z);
  const angle = Number(heading);
  const offset = distance === undefined ? 5 : Number(distance);
  if (![x, y, z, angle, offset].every(Number.isFinite) || offset < 0) return null;

  const radians = angle * Math.PI / 180;
  return {
    x: x - Math.sin(radians) * offset,
    y: y + Math.cos(radians) * offset,
    z: z + 0.3
  };
}

module.exports = {
  getVehicle,
  getSupportedModelIds,
  spawnPosition
};
