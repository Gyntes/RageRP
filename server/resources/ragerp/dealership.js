const PersonalVehicles = require('./personal-vehicles');

const DEALERSHIP_POSITION = Object.freeze({ x: -56.0, y: -1096.5, z: 26.4 });
const INTERACTION_RADIUS = 5;

const VEHICLES = Object.freeze([
  {
    id: PersonalVehicles.VEHICLE_ID,
    name: PersonalVehicles.NAME,
    model: PersonalVehicles.MODEL,
    price: PersonalVehicles.PRICE,
    seats: 4,
    maxSpeed: 143,
    acceleration: 0.14,
    braking: 0.9,
    handling: 2.45,
    fuelType: 'Бензин'
  },
  {
    id: 'vosmerka-retro',
    name: 'Восьмёрка «Ретро»',
    price: 315000,
    seats: 4,
    maxSpeed: 158,
    acceleration: 0.2,
    braking: 0.5,
    handling: 1.7,
    fuelType: 'Бензин'
  },
  {
    id: 'vaz2114',
    name: 'ВАЗ-2114 «Самара»',
    model: 'ragerp_vaz2114',
    price: 502000,
    seats: 4,
    maxSpeed: 164,
    acceleration: 0.17,
    braking: 0.6,
    handling: 2.1,
    fuelType: 'Бензин'
  },
  {
    id: 'kalina-1-hatch',
    name: 'Калина 1 Хэтч',
    price: 620000,
    seats: 4,
    maxSpeed: 168,
    acceleration: 0.2,
    braking: 0.6,
    handling: 2.1,
    fuelType: 'Бензин'
  },
  {
    id: 'priora',
    name: 'Приора',
    price: 650000,
    seats: 4,
    maxSpeed: 171,
    acceleration: 0.14,
    braking: 0.4,
    handling: 2.05,
    fuelType: 'Бензин'
  },
  {
    id: 'granta-facelift-2018',
    name: 'Гранта Фейс Лифт 2018',
    price: 856000,
    seats: 4,
    maxSpeed: 157,
    acceleration: 0.19,
    braking: 0.9,
    handling: 2.25,
    fuelType: 'Бензин'
  },
  {
    id: 'mb-cla-45',
    name: 'МБ ЦЛА 45',
    price: 11800000,
    seats: 4,
    maxSpeed: 211,
    acceleration: 0.22,
    braking: 0.9,
    handling: 2.55,
    fuelType: 'Бензин'
  },
  {
    id: 'bmw-e34',
    name: 'Бумер «Ёшка» 34',
    price: 1330000,
    seats: 4,
    maxSpeed: 186,
    acceleration: 0.2,
    braking: 0.9,
    handling: 2.25,
    fuelType: 'Бензин'
  },
  {
    id: 'toyota-v50-camry',
    name: 'Тойота V-50 «Камрюха»',
    price: 2330000,
    seats: 4,
    maxSpeed: 182,
    acceleration: 0.18,
    braking: 0.9,
    handling: 2.35,
    fuelType: 'Бензин'
  },
  {
    id: 'bmw-e38',
    name: 'Бумер «Ёшка» 38',
    price: 2890000,
    seats: 4,
    maxSpeed: 199,
    acceleration: 0.2,
    braking: 0.9,
    handling: 2.45,
    fuelType: 'Бензин'
  },
  {
    id: 'auditor-c8',
    name: 'Аудитор C8',
    price: 2910000,
    seats: 4,
    maxSpeed: 210,
    acceleration: 0.18,
    braking: 0.3,
    handling: 1.88,
    fuelType: 'Бензин'
  },
  {
    id: 'skoda-octavia-vrs-2022',
    name: 'Шкода Октавия ВРС 2022',
    price: 10710000,
    seats: 4,
    maxSpeed: 225,
    acceleration: 0.33,
    braking: 1,
    handling: 2.8
  },
  {
    id: 'mb-63-cls',
    name: 'МБ 63 ЦЛС',
    price: 22690000,
    seats: 4,
    maxSpeed: 238,
    acceleration: 0.3,
    braking: 0.57,
    handling: 2.2,
    fuelType: 'Бензин'
  },
  {
    id: 'mb-c-b222',
    name: 'МБ С-B222',
    price: 22910000,
    seats: 4,
    maxSpeed: 261,
    acceleration: 0.38,
    braking: 1.15,
    handling: 2.75,
    fuelType: 'Бензин'
  },
  {
    id: 'bmw-m3-touring',
    name: 'Бумер M3 Туринг',
    price: 31870000,
    seats: 4,
    maxSpeed: 256,
    acceleration: 0.25,
    braking: 1,
    handling: 3.5,
    fuelType: 'Бензин'
  },
  {
    id: 'bmw-m5-f90',
    name: 'Бумер M5 F90',
    price: 37190000,
    seats: 4,
    maxSpeed: 276,
    acceleration: 0.26,
    braking: 1,
    handling: 3.5,
    fuelType: 'Бензин'
  },
  {
    id: 'mb-gt-63c',
    name: 'МБ ГТ 63C',
    price: 41240000,
    seats: 4,
    maxSpeed: 263,
    acceleration: 0.37,
    braking: 0.9,
    handling: 2.55,
    fuelType: 'Бензин'
  },
  {
    id: 'aventa-ultimate',
    name: 'Авента-Ультимейт',
    price: 46720000,
    seats: 2,
    maxSpeed: 303,
    acceleration: 0.36,
    braking: 1,
    handling: 2.65,
    fuelType: 'Бензин'
  },
  {
    id: 'mclaren-765-lt',
    name: 'Мак 765-й ЛТ',
    price: 51080000,
    seats: 2,
    maxSpeed: 302,
    acceleration: 0.38,
    braking: 1.2,
    handling: 2.95,
    fuelType: 'Бензин'
  },
  {
    id: 'evo-9',
    name: 'Эво-9',
    price: 3900000,
    seats: 4,
    maxSpeed: 211,
    acceleration: 0.22,
    braking: 0.6,
    handling: 2.05,
    fuelType: 'Бензин'
  },
  {
    id: 'golf',
    name: 'Гольф',
    price: 8860000,
    seats: 4,
    maxSpeed: 213,
    acceleration: 0.25,
    braking: 0.9,
    handling: 2.45,
    fuelType: 'Бензин'
  }
]);

function isNearDealership(position, dimension) {
  if (dimension !== 0 || !position) return false;

  const x = Number(position.x);
  const y = Number(position.y);
  const z = Number(position.z);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return false;

  const dx = x - DEALERSHIP_POSITION.x;
  const dy = y - DEALERSHIP_POSITION.y;
  const dz = z - DEALERSHIP_POSITION.z;
  return dx * dx + dy * dy + dz * dz <= INTERACTION_RADIUS * INTERACTION_RADIUS;
}

module.exports = {
  DEALERSHIP_POSITION,
  INTERACTION_RADIUS,
  VEHICLES,
  isNearDealership
};
