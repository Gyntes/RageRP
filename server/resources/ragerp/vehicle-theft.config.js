module.exports = Object.freeze({
  attemptDurationMs: 20000,
  successChance: 0.35,
  breakChanceOnFailure: 0.25,
  policeAlert: Object.freeze({
    enabled: true,
    stages: Object.freeze(['success']),
    chance: 0.35
  })
});
