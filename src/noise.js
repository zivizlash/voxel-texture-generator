/**
 * Модуль бесшовного тороидального шума и процедурных паттернов для сетки 16x16.
 * Все функции гарантируют идеальный тайлинг:
 * левый край бесшовно стыкуется с правым, а верхний — с нижним.
 */

function quintic(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Тороидальный градиентный/значенческий шум с интерполяцией
 */
export class ToroidalNoise {
  constructor(prng, period = 4) {
    this.period = Math.max(1, Math.round(period));
    this.grid = [];
    for (let y = 0; y < this.period; y++) {
      const row = [];
      for (let x = 0; x < this.period; x++) {
        row.push(prng.next());
      }
      this.grid.push(row);
    }
  }

  sample(x, y, size = 16) {
    const u = (((x % size) + size) % size) / size * this.period;
    const v = (((y % size) + size) % size) / size * this.period;

    const x0 = Math.floor(u) % this.period;
    const y0 = Math.floor(v) % this.period;
    const x1 = (x0 + 1) % this.period;
    const y1 = (y0 + 1) % this.period;

    const fx = quintic(u - Math.floor(u));
    const fy = quintic(v - Math.floor(v));

    const top = (1 - fx) * this.grid[y0][x0] + fx * this.grid[y0][x1];
    const bottom = (1 - fx) * this.grid[y1][x0] + fx * this.grid[y1][x1];

    return (1 - fy) * top + fy * bottom;
  }
}

/**
 * Фрактальное броуновское движение (fBm / Октавы) с тороидальной бесшовностью.
 * Складывает несколько октав шума с разным масштабом (Frequency) и амплитудой (Amplitude):
 * - Октава 1: крупные макро-пятна (основа рельефа)
 * - Октава 2: средние вмятины (в 2 раза мельче, в 2 раза прозрачнее)
 * - Октава 3: мелкая рябь (естественная пористость блоков)
 * - Октавы 4+: микро-детали
 */
export class ToroidalFBM {
  constructor(prng, octavesOrCount = 3, basePeriod = 2, persistence = 0.5) {
    if (Array.isArray(octavesOrCount)) {
      this.layers = octavesOrCount.map(oct => ({
        noise: new ToroidalNoise(prng, oct.period),
        weight: oct.weight
      }));
    } else {
      const count = Math.max(1, Math.min(6, Math.round(octavesOrCount || 3)));
      this.layers = [];
      let period = basePeriod;
      let weight = 1.0;
      for (let i = 0; i < count; i++) {
        this.layers.push({
          noise: new ToroidalNoise(prng.fork(i * 101), Math.min(16, period)),
          weight
        });
        weight *= persistence;
        period *= 2;
      }
    }
    const totalWeight = this.layers.reduce((sum, l) => sum + l.weight, 0);
    this.layers.forEach(l => l.weight /= totalWeight);
  }

  sample(x, y, size = 16) {
    let val = 0;
    for (const layer of this.layers) {
      val += layer.noise.sample(x, y, size) * layer.weight;
    }
    return val;
  }
}

/**
 * Искажение пространства (Domain Warping) с тороидальным зацикливанием.
 * Пропускает координаты (x, y) через пару ортогональных тороидальных шумов
 * перед выборкой основного рельефа. Создает завихрения, потеки, кольца и мраморные разводы.
 * За счет модульного зацикливания гарантирует 100% математическую бесшовность.
 */
export class ToroidalDomainWarp {
  constructor(prng) {
    this.noiseX = new ToroidalFBM(prng.fork(211), [
      { period: 4, weight: 0.65 },
      { period: 8, weight: 0.35 }
    ]);
    this.noiseY = new ToroidalFBM(prng.fork(313), [
      { period: 4, weight: 0.65 },
      { period: 8, weight: 0.35 }
    ]);
  }

  warp(x, y, strength = 0.5, size = 16) {
    if (strength <= 0) return { x, y };
    const maxOffset = strength * size * 0.28;
    const dx = (this.noiseX.sample(x, y, size) - 0.5) * 2 * maxOffset;
    const dy = (this.noiseY.sample(x, y, size) - 0.5) * 2 * maxOffset;
    return {
      x: ((x + dx) % size + size) % size,
      y: ((y + dy) % size + size) % size
    };
  }
}

/**
 * Тороидальный клеточный шум (Worley/Cellular) для камней, трещин и минеральных сколов.
 * Поддерживает Евклидово и Манхэттенское расстояние.
 */
export class ToroidalWorley {
  /**
   * @param {import('./prng.js').PRNG} prng
   * @param {number} pointCount
   * @param {number} size
   */
  constructor(prng, pointCount = 6, size = 16) {
    this.size = size;
    this.points = [];
    for (let i = 0; i < pointCount; i++) {
      this.points.push({
        x: prng.range(0, size),
        y: prng.range(0, size),
        val: prng.next()
      });
    }
  }

  /**
   * Расчет расстояния с тороидальным сворачиванием
   */
  sample(x, y, metric = 'euclidean') {
    let d1 = Infinity;
    let d2 = Infinity;
    let closestVal = 0;

    for (const pt of this.points) {
      let dx = Math.abs(x - pt.x);
      if (dx > this.size / 2) dx = this.size - dx;

      let dy = Math.abs(y - pt.y);
      if (dy > this.size / 2) dy = this.size - dy;

      const dist = metric === 'manhattan' ? (dx + dy) : Math.sqrt(dx * dx + dy * dy);

      if (dist < d1) {
        d2 = d1;
        d1 = dist;
        closestVal = pt.val;
      } else if (dist < d2) {
        d2 = dist;
      }
    }

    return { d1, d2, edge: d2 - d1, val: closestVal };
  }
}

/**
 * Создает пустую 2D матрицу 16x16
 */
export function createGrid(w = 16, h = 16, fill = 0) {
  const grid = [];
  for (let y = 0; y < h; y++) {
    grid.push(new Float32Array(w).fill(fill));
  }
  return grid;
}

/**
 * Тороидальное получение пикселя из сетки
 */
export function getWrapped(grid, x, y, w = 16, h = 16) {
  const wx = ((x % w) + w) % w;
  const wy = ((y % h) + h) % h;
  return grid[wy][wx];
}

/**
 * Тороидальная установка пикселя в сетку
 */
export function setWrapped(grid, x, y, val, w = 16, h = 16) {
  const wx = ((x % w) + w) % w;
  const wy = ((y % h) + h) % h;
  grid[wy][wx] = val;
}
