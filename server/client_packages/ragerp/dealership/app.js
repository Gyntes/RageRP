(function () {
  const grid = document.getElementById('vehicle-grid');
  const search = document.getElementById('vehicle-search');
  const count = document.getElementById('vehicle-count');
  const emptyState = document.getElementById('empty-state');
  const closeButton = document.getElementById('close-dealership');
  const currencyFormatter = new Intl.NumberFormat('ru-RU');
  let vehicles = [];

  const carIllustration = [
    '<svg viewBox="0 0 260 90" role="img" aria-label="Силуэт автомобиля">',
    '<path class="car-body" d="M25 57 38 43q7-8 20-10l26-4 18-16q5-5 15-5h42q11 0 19 8l19 18 28 7q9 2 11 11l2 11q1 6-7 6h-8a17 17 0 0 0-34 0H82a17 17 0 0 0-34 0h-17q-9 0-8-7l2-6q1-5 0-9z"/>',
    '<path class="car-window" d="m93 31 16-15q3-3 9-3h39q7 0 12 5l15 14z"/>',
    '<circle class="car-wheel" cx="65" cy="68" r="13"/><circle class="car-hub" cx="65" cy="68" r="5"/>',
    '<circle class="car-wheel" cx="206" cy="68" r="13"/><circle class="car-hub" cx="206" cy="68" r="5"/>',
    '</svg>'
  ].join('');

  function close() {
    if (typeof mp !== 'undefined' && mp && typeof mp.trigger === 'function') {
      mp.trigger('ragerp:dealership:close-request');
    }
  }

  function formatPrice(price) {
    if (price >= 1000000) {
      const millions = (price / 1000000).toFixed(2).replace(/\.?0+$/, '').replace('.', ',');
      return `${millions} млн ₽`;
    }
    return `${Math.round(price / 1000)} тыс. ₽`;
  }

  function makeSpec(label, value, suffix) {
    const row = document.createElement('div');
    row.className = 'spec-row';
    const name = document.createElement('span');
    name.textContent = label;
    const result = document.createElement('strong');
    result.textContent = `${value}${suffix || ''}`;
    row.append(name, result);
    return row;
  }

  function formatVehicleCount(amount) {
    const lastTwoDigits = amount % 100;
    const lastDigit = amount % 10;
    let word = 'моделей';
    if (lastTwoDigits < 11 || lastTwoDigits > 14) {
      if (lastDigit === 1) word = 'модель';
      else if (lastDigit >= 2 && lastDigit <= 4) word = 'модели';
    }
    return `${currencyFormatter.format(amount)} ${word}`;
  }

  function createCard(vehicle) {
    const card = document.createElement('article');
    card.className = 'vehicle-card';

    const heading = document.createElement('div');
    heading.className = 'vehicle-heading';
    const name = document.createElement('h3');
    name.textContent = vehicle.name;
    const price = document.createElement('span');
    price.className = 'vehicle-price';
    price.textContent = formatPrice(vehicle.price);
    heading.append(name, price);

    const art = document.createElement('div');
    art.className = 'vehicle-art';
    art.innerHTML = carIllustration;

    const specs = document.createElement('div');
    specs.className = 'vehicle-specs';
    specs.append(
      makeSpec('Вместимость', vehicle.seats, ' чел.'),
      makeSpec('Макс. скорость (сток)', vehicle.maxSpeed, ' км/ч'),
      makeSpec('Ускорение', vehicle.acceleration),
      makeSpec('Торможение', vehicle.braking),
      makeSpec('Управляемость', vehicle.handling)
    );
    if (vehicle.fuelType) specs.append(makeSpec('Тип топлива', vehicle.fuelType));

    const status = document.createElement('div');
    status.className = 'vehicle-status';
    status.textContent = 'Модель не подключена · просмотр';
    card.append(heading, art, specs, status);
    return card;
  }

  function render() {
    const query = search.value.trim().toLocaleLowerCase('ru-RU');
    const matching = vehicles.filter((vehicle) =>
      vehicle.name.toLocaleLowerCase('ru-RU').includes(query)
    );
    grid.replaceChildren(...matching.map(createCard));
    count.textContent = formatVehicleCount(matching.length);
    emptyState.hidden = matching.length > 0;
  }

  function setCatalog(payload) {
    if (!Array.isArray(payload) || payload.length !== 21 ||
        payload.some((vehicle) => !vehicle || typeof vehicle.id !== 'string' ||
          typeof vehicle.name !== 'string' || !Number.isSafeInteger(vehicle.price) ||
          !Number.isInteger(vehicle.seats) || !Number.isFinite(vehicle.maxSpeed) ||
          !Number.isFinite(vehicle.acceleration) || !Number.isFinite(vehicle.braking) ||
          !Number.isFinite(vehicle.handling))) {
      grid.replaceChildren();
      emptyState.hidden = false;
      emptyState.textContent = 'Не удалось загрузить каталог. Обнови подключение к серверу.';
      count.textContent = 'ошибка загрузки';
      console.error('[RageRP dealership] Invalid vehicle catalog payload.');
      return;
    }
    vehicles = payload;
    render();
  }

  closeButton.addEventListener('click', close);
  search.addEventListener('input', render);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  window.ragerpDealership = { setCatalog };
})();
