import { ToroidalFBM, createGrid } from '../noise.js';
import { applyDirectionalLighting, normalizeAndMapToPalette } from '../shading.js';

/**
 * Шаблон для сыпучих материалов (Песок, Красный песок, Гравий, Глина).
 * Попиксельное распределение: каждый пиксель имеет микро-колебание яркости,
 * создающее эффект отдельных песчинок и гранул без монолитных пятен.
 */
export function generateGranular(blockDef, prng, w = 16, h = 16) {
  const isGravel = blockDef.id === 'gravel';
  const isClay = blockDef.id === 'clay';

  // 1. Базовые макро-волны (дюны или пласты)
  const baseFbm = new ToroidalFBM(prng, [
    { period: 2, weight: 0.35 },
    { period: 4, weight: 0.35 },
    { period: 8, weight: 0.30 }
  ]);

  const heightMap = createGrid(w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const macro = baseFbm.sample(x, y, 16);

      // Высокочастотный попиксельный шум для каждого пикселя
      let pixelNoise = 0;
      if (isGravel) {
        // У гравия резкие контрастные камешки (соседние пиксели сильно варьируются)
        pixelNoise = prng.range(-0.35, 0.35) + ((x + y) % 2 === 0 ? 0.08 : -0.08);
      } else if (isClay) {
        // У глины микро-переходы без резких скачков
        pixelNoise = prng.range(-0.12, 0.12);
      } else {
        // Песок: зернистый шум песчинок
        pixelNoise = prng.range(-0.25, 0.25) + ((x * 3 + y * 7) % 5 - 2) * 0.04;
      }

      heightMap[y][x] = macro * 0.6 + pixelNoise * 0.4 + 0.5;
    }
  }

  // 2. Верхнее освещение гранул
  const litMap = applyDirectionalLighting(heightMap, isClay ? 0.18 : (isGravel ? 0.35 : 0.25), w, h);

  // 3. Продвинутая нормализация с дизерингом и попиксельным распределением
  return normalizeAndMapToPalette(litMap, blockDef.palette, {
    w,
    h,
    prng,
    pixelJitter: isGravel ? 0.14 : (isClay ? 0.06 : 0.10),
    ditherStrength: isGravel ? 0.16 : 0.12,
    contrast: isGravel ? 1.15 : 1.0
  });
}
