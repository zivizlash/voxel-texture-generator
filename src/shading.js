import { getWrapped } from './noise.js';

/**
 * 4x4 Матрица упорядоченного дизеринга Байера.
 * Размывает монолитные границы квантования в естественный попиксельный узор пиксель-арта.
 */
const BAYER_4X4 = [
  [ 0/16,  8/16,  2/16, 10/16],
  [12/16,  4/16, 14/16,  6/16],
  [ 3/16, 11/16,  1/16,  9/16],
  [15/16,  7/16, 13/16,  5/16]
];

/**
 * Применение верхнего/диагонального освещения (свет сверху-слева) с тороидальным тайлингом.
 * @param {Array<Float32Array>} heightMap
 * @param {number} lightStrength
 * @param {number} w
 * @param {number} h
 * @returns {Array<Float32Array>}
 */
export function applyDirectionalLighting(heightMap, lightStrength = 0.25, w = 16, h = 16) {
  const litMap = [];

  for (let y = 0; y < h; y++) {
    const row = new Float32Array(w);
    for (let x = 0; x < w; x++) {
      const center = heightMap[y][x];

      const up = getWrapped(heightMap, x, y - 1, w, h);
      const down = getWrapped(heightMap, x, y + 1, w, h);
      const left = getWrapped(heightMap, x - 1, y, w, h);
      const right = getWrapped(heightMap, x + 1, y, w, h);

      // Верхний наклон ловит свет, нижний — в тени
      const slopeY = (center - up) - (down - center);
      const slopeX = (center - left) - (right - center);

      const lighting = (slopeY * 0.7 + slopeX * 0.3) * lightStrength;
      row[x] = center + lighting;
    }
    litMap.push(row);
  }

  return litMap;
}

/**
 * Продвинутая нормализация и попиксельное распределение цветов палитры:
 * 1. Растяжение динамического диапазона (Min-Max растяжка) на всю палитру.
 * 2. Добавление высокочастотного попиксельного шума (chatter).
 * 3. Легкий упорядоченный дизеринг (Bayer) для ликвидации монолитных островков.
 * 4. Предотвращение "ловушек ярких пикселей".
 *
 * @param {Array<Float32Array>} valueMap
 * @param {Array<{r:number, g:number, b:number}>} palette
 * @param {object} options
 * @returns {Array<Array<{r:number, g:number, b:number}>>}
 */
export function normalizeAndMapToPalette(valueMap, palette, options = {}) {
  const {
    w = 16,
    h = 16,
    ditherStrength = 0.12,
    pixelJitter = 0.08,
    contrast = 1.0,
    prng = null
  } = options;

  // 1. Поиск min и max для нормализации диапазона
  let minVal = Infinity;
  let maxVal = -Infinity;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = valueMap[y][x];
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }
  }

  const range = maxVal - minVal || 1.0;
  const paletteLen = palette.length;
  const result = [];

  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      // Базовая нормализация [0..1]
      let norm = (valueMap[y][x] - minVal) / range;

      // Контраст
      if (contrast !== 1.0) {
        norm = Math.pow(norm, contrast);
      }

      // Попиксельный микро-шум (микро-колебание для каждого пикселя)
      if (pixelJitter > 0 && prng) {
        norm += prng.range(-pixelJitter, pixelJitter);
      }

      // Дизеринг Байера для разрушения плоских островков
      if (ditherStrength > 0) {
        const bayerVal = BAYER_4X4[y % 4][x % 4] - 0.5;
        norm += bayerVal * ditherStrength;
      }

      // Мягкое отсечение
      norm = Math.max(0.001, Math.min(0.999, norm));

      // Квантование в индекс палитры
      const index = Math.floor(norm * paletteLen);
      const safeIndex = Math.max(0, Math.min(paletteLen - 1, index));

      row.push({ ...palette[safeIndex] });
    }
    result.push(row);
  }

  return result;
}

// Обратная совместимость для прямого маппинга
export function mapToPalette(valueMap, palette, w = 16, h = 16) {
  return normalizeAndMapToPalette(valueMap, palette, { w, h, ditherStrength: 0, pixelJitter: 0 });
}
