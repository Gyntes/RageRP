(function (root, factory) {
  const logic = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = logic;
  if (root) root.ragerpDashboardLogic = logic;
})(typeof window !== 'undefined' ? window : null, function () {
  function formatOdometer(value) {
    const kilometers = Number(value);
    if (!Number.isFinite(kilometers)) return '0000000.0';
    const [whole, fraction] = Math.max(0, Math.min(1000000000, kilometers))
      .toFixed(1)
      .split('.');
    return `${whole.padStart(7, '0')}.${fraction}`;
  }

  return {
    isCheckEngineRequired: function (engineHealth) {
      const health = Number(engineHealth);
      return Number.isFinite(health) && health <= 500;
    },
    formatOdometer
  };
});
