import { ToroidalFBM, ToroidalDomainWarp, createGrid } from '../noise.js';
import { applyDirectionalLighting, normalizeAndMapToPalette } from '../shading.js';

/**
 * Шаблон для сыпучих материалов (Песок, Красный песок, Гравий, Глина).
 * Использует:
 * 1. fBm (октавы) для формирования макро-дюн и микро-ряби.
 * 2. Domain Warping для создания естественных волнообразных потеков песка и дюнных гребней.
 * 3. Попиксельное распределение микро-гранул и дизеринг.
 */
export function generateGranular(blockDef, prng, w = 16, h = 16, params = {}) {
  const {
    octaves = 3,
    warpStrength = 0.5,
    scale = 1.0,
    ditherStrength = 1.0,
    lightStrength = 1.0
  } = params;

  const isGravel = blockDef.id === 'gravel';
  const isClay = blockDef.id === 'clay';

  // 1. Искажение пространства (Domain Warping)
  const warp = new ToroidalDomainWarp(prng);

  // 2. Фрактальный тороидальный шум (fBm)
  const baseFbm = new ToroidalFBM(prng, octaves, 2, 0.5);

  const heightMap = createGrid(w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Искажаем координаты тороидально
      const warped = warp.warp(x * scale, y * scale, warpStrength, 16);
      const macro = baseFbm.sample(warped.x, warped.y, 16);

      // Высокочастотный попиксельный шум для каждого пикселя
      let pixelNoise = 0;
      if (isGravel) {
        pixelNoise = prng.range(-0.35, 0.35) + ((x + y) % 2 === 0 ? 0.08 : -0.08);
      } else if (isClay) {
        pixelNoise = prng.range(-0.12, 0.12);
      } else {
        pixelNoise = prng.range(-0.25, 0.25) + ((x * 3 + y * 7) % 5 - 2) * 0.04;
      }

      heightMap[y][x] = macro * 0.6 + pixelNoise * 0.4 + 0.5;
    }
  }

  // 3. Верхнее освещение гранул
  const baseLight = isClay ? 0.18 : (isGravel ? 0.35 : 0.25);
  const litMap = applyDirectionalLighting(heightMap, baseLight * lightStrength, w, h);

  // 4. Продвинутая нормализация с дизерингом Байера
  const baseDither = isGravel ? 0.16 : 0.12;
  return normalizeAndMapToPalette(litMap, blockDef.palette, {
    w,
    h,
    prng,
    pixelJitter: (isGravel ? 0.14 : (isClay ? 0.06 : 0.10)) * ditherStrength,
    ditherStrength: baseDither * ditherStrength,
    contrast: isGravel ? 1.15 : 1.0
  });
}
