import { ToroidalFBM, ToroidalWorley, ToroidalDomainWarp, createGrid, getWrapped, setWrapped } from '../noise.js';
import { applyDirectionalLighting, normalizeAndMapToPalette } from '../shading.js';

/**
 * Шаблон для булыжника (Cobblestone).
 * Формирует плотную кладку округлых булыжников с глубокими теневыми швами (раствором)
 * и направленными бликами на верхних сколах каждого отдельного камня.
 */
export function generateCobblestone(blockDef, prng, w = 16, h = 16, params = {}) {
  const {
    octaves = 3,
    warpStrength = 0.5,
    scale = 1.0,
    ditherStrength = 1.0,
    lightStrength = 1.0
  } = params;

  // 1. Искажение пространства для неровных органичных сколов камней
  const warp = new ToroidalDomainWarp(prng);
  const fbm = new ToroidalFBM(prng, octaves, 4, 0.5);

  // 2. Клеточный шум Вороного для разбиения на 9-11 отдельных булыжников
  const worley = new ToroidalWorley(prng, 9, 16);
  const heightMap = createGrid(w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const warped = warp.warp(x * scale, y * scale, warpStrength * 0.7, 16);
      const cell = worley.sample(warped.x, warped.y, 'euclidean');
      const macro = fbm.sample(warped.x, warped.y, 16);

      // edge = (d2 - d1) показывает расстояние до границы ячейки (шва между камнями)
      // Куполообразный профиль камня: выпуклый в центре, резкий спад к швам
      const stoneDome = Math.min(1.0, cell.edge * 1.1);
      const isMortarSeam = cell.edge < 0.85 ? 0.35 : 0;

      const pixelNoise = prng.range(-0.25, 0.25);
      heightMap[y][x] = stoneDome * 0.65 + macro * 0.20 + pixelNoise * 0.15 - isMortarSeam;
    }
  }

  // 3. Выразительное направленное освещение выступов каждого булыжника
  const litMap = applyDirectionalLighting(heightMap, 0.38 * lightStrength, w, h);

  // 4. Нормализация и дизеринг Байера для каменной зернистости
  return normalizeAndMapToPalette(litMap, blockDef.palette, {
    w,
    h,
    prng,
    pixelJitter: 0.14 * ditherStrength,
    ditherStrength: 0.15 * ditherStrength,
    contrast: 1.15
  });
}
