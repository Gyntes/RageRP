const PARKING_SPOTS = Object.freeze([
  { id: '479219415', x: 227.83, y: -810.16, heading: 0 },
  { id: '441737523', x: 240.18, y: -741.99, heading: 90 },
  { id: '173305024', x: 189.82, y: -918.58, heading: 0 },
  { id: '240138270', x: 57.27, y: -794.93, heading: 90 },
  { id: '441737398', x: 377.35, y: -801.74, heading: 0 },
  { id: '240138312', x: 56.48, y: -839.4, heading: 0 },
  { id: '542039159', x: 274.67, y: -962.77, heading: 0 },
  { id: '599098360', x: 282.99, y: -1038.9, heading: 0 },
  { id: '515859535', x: 44.01, y: -985.93, heading: 0 },
  { id: '409347764', x: 443.41, y: -919.35, heading: 0 },
  { id: '484540244', x: 462.64, y: -904.25, heading: 90 },
  { id: '479605522', x: 448.38, y: -947.01, heading: 0 },
  { id: '370778497', x: 432.96, y: -979.15, heading: 90 },
  { id: '1309944821', x: 497.37, y: -928.94, heading: 90 },
  { id: '370778501', x: 472.49, y: -1016.53, heading: 0 },
  { id: '479605523', x: 489.23, y: -973.88, heading: 90 },
  { id: '442728062', x: 143.52, y: -491.29, heading: 0 },
  { id: '499512238', x: 108.83, y: -1120.24, heading: 0 },
  { id: '500483822', x: -42.33, y: -1033.66, heading: 90 },
  { id: '499512258', x: -55.25, y: -1048.19, heading: 0 },
  { id: '499520572', x: 145.12, y: -1178.49, heading: 0 },
  { id: '515823897', x: 26.57, y: -1138.03, heading: 90 },
  { id: '1148423786', x: 104.89, y: -1207.02, heading: 90 },
  { id: '1308287489', x: 51.63, y: -1223.31, heading: 90 },
  { id: '476099531', x: -209.96, y: -668.45, heading: 90 },
  { id: '528712424', x: 75.48, y: -383.31, heading: 90 },
  { id: '515823901', x: -10.32, y: -1206.49, heading: 90 },
  { id: '499466962', x: 630.07, y: -609.97, heading: 90 },
  { id: '515820215', x: 41.44, y: -1236.54, heading: 90 },
  { id: '515820217', x: 72.36, y: -1263.55, heading: 90 },
  { id: '499964302', x: -244.05, y: -949.38, heading: 90 },
  { id: '617069744', x: 628.97, y: -1063.76, heading: 0 },
  { id: '482184236', x: -267.41, y: -900.96, heading: 0 },
  { id: '619292977', x: 726.9, y: -777.17, heading: 90 },
  { id: '619292978', x: 730.21, y: -771.58, heading: 90 },
  { id: '1469612216', x: -35.25, y: -353.58, heading: 90 },
  { id: '1370841752', x: -103.8, y: -1229.87, heading: 0 },
  { id: '482182215', x: -325.34, y: -894.24, heading: 90 },
  { id: '475261453', x: -325.46, y: -937.13, heading: 0 },
  { id: '357562754', x: 531.08, y: -340.41, heading: 90 },
  { id: '533793297', x: -193.41, y: -414.69, heading: 90 },
  { id: '481251118', x: -350.99, y: -906.26, heading: 90 },
  { id: '195866943', x: 372.27, y: -252.06, heading: 90 },
  { id: '384087434', x: 169.8, y: -226.6, heading: 90 },
  { id: '1272152739', x: -243.78, y: -431.4, heading: 90 },
  { id: '439977286', x: 108.25, y: -207.95, heading: 90 },
  { id: '357562746', x: 641.47, y: -368.22, heading: 90 },
  { id: '968127495', x: 412.32, y: -1406.22, heading: 90 },
  { id: '1307351119', x: 14.62, y: -1405.04, heading: 90 },
  { id: '1272152742', x: -297.9, y: -448.38, heading: 0 },
  { id: '439977281', x: 102.41, y: -191.06, heading: 90 },
  { id: '164036849', x: -266.45, y: -356.38, heading: 0 },
  { id: '397005593', x: 882.99, y: -837.38, heading: 90 },
  { id: '1272152662', x: -360.82, y: -438.95, heading: 0 },
  { id: '797465631', x: 871.37, y: -502.78, heading: 90 },
  { id: '797465630', x: 861.33, y: -356.03, heading: 0 },
  { id: '171364138', x: 551.24, y: -1561.65, heading: 0 },
  { id: '775607820', x: 948.34, y: -200.23, heading: 0 },
  { id: '1056850494', x: 973.56, y: -1438.76, heading: 90 }
].map((spot) => Object.freeze({
  id: spot.id,
  x: spot.x,
  y: spot.y,
  z: 30.73,
  heading: spot.heading
})));

const PARKING_CLEARANCE_SQUARED = 25;

function isValidPosition(position) {
  return position &&
    Number.isFinite(position.x) &&
    Number.isFinite(position.y) &&
    Number.isFinite(position.z);
}

function nearestFreeParkingSpot(position, occupants, dimension) {
  if (!isValidPosition(position)) return null;
  const nearbyOccupants = Array.isArray(occupants) ? occupants : [];
  const availableSpots = PARKING_SPOTS.map((spot) => {
    const dx = spot.x - position.x;
    const dy = spot.y - position.y;
    return { spot, distanceSquared: dx * dx + dy * dy };
  }).sort((left, right) => left.distanceSquared - right.distanceSquared);

  for (const candidate of availableSpots) {
    const occupied = nearbyOccupants.some((occupant) => {
      if (!isValidPosition(occupant) ||
          (occupant.dimension !== undefined && occupant.dimension !== dimension) ||
          Math.abs(occupant.z - candidate.spot.z) >= 3) {
        return false;
      }

      const dx = occupant.x - candidate.spot.x;
      const dy = occupant.y - candidate.spot.y;
      return dx * dx + dy * dy < PARKING_CLEARANCE_SQUARED;
    });
    if (!occupied) return candidate.spot;
  }

  return null;
}

module.exports = {
  PARKING_SPOTS,
  nearestFreeParkingSpot
};
