import { ToroidalFBM, ToroidalDomainWarp, createGrid, getWrapped, setWrapped } from '../noise.js';
import { applyDirectionalLighting, normalizeAndMapToPalette } from '../shading.js';

/**
 * Шаблон для слоистых пород (Песчаник, Красный песчаник, Глубинный сланец).
 * Использует:
 * 1. fBm (октавы) для микро-фактуры слоев.
 * 2. Domain Warping для волнообразного изгиба пластов (сланцеватость, складчатость).
 * 3. Теневые швы и направленное освещение полос.
 */
export function generateLayered(blockDef, prng, w = 16, h = 16, params = {}) {
  const {
    octaves = 3,
    warpStrength = 0.5,
    scale = 1.0,
    ditherStrength = 1.0,
    lightStrength = 1.0
  } = params;

  const isDeepslate = blockDef.id === 'deepslate';

  // 1. Частота слоев
  const layerFreq = isDeepslate ? 4 : 3;
  const heightMap = createGrid(w, h);

  // 2. Искажение пространства (Domain Warping)
  const warp = new ToroidalDomainWarp(prng);
  const warpNoise = new ToroidalFBM(prng, octaves, 4, 0.5);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const warpedCoord = warp.warp(x * scale, y * scale, warpStrength, 16);
      const warpVal = (warpNoise.sample(warpedCoord.x, warpedCoord.y, 16) - 0.5) * 1.8;
      const effectiveY = (y + warpVal + h) % h;

      // Периодическая синусоида пласта
      const phase = (effectiveY / h) * (Math.PI * 2 * layerFreq);
      const layerWave = Math.sin(phase) * 0.5 + 0.5;

      // Высокочастотный зернистый шум вдоль пласта
      const grain = prng.range(-0.25, 0.25);
      const horizontalChatter = ((x % 2 === 0 ? 0.08 : -0.08) + (y % 2 === 0 ? 0.04 : -0.04));

      heightMap[y][x] = layerWave * 0.5 + 0.25 + (grain + horizontalChatter) * 0.35;
    }
  }

  // 3. Горизонтальные теневые швы
  for (let l = 0; l < layerFreq; l++) {
    const baseRow = Math.floor((l / layerFreq) * h);
    for (let x = 0; x < w; x++) {
      const warpVal = Math.round((warpNoise.sample(x, baseRow, 16) - 0.5) * 1.2 * warpStrength);
      const seamY = ((baseRow + warpVal) % h + h) % h;

      const curr = getWrapped(heightMap, x, seamY, w, h);
      setWrapped(heightMap, x, seamY, curr - 0.25, w, h);

      const upperY = ((seamY - 1) % h + h) % h;
      const upperCurr = getWrapped(heightMap, x, upperY, w, h);
      setWrapped(heightMap, x, upperY, upperCurr + 0.18, w, h);
    }
  }

  // 4. Освещение сверху-слева
  const baseLight = isDeepslate ? 0.35 : 0.25;
  const litMap = applyDirectionalLighting(heightMap, baseLight * lightStrength, w, h);

  // 5. Попиксельная нормализация с дизерингом Байера
  const pixels = normalizeAndMapToPalette(litMap, blockDef.palette, {
    w,
    h,
    prng,
    pixelJitter: 0.12 * ditherStrength,
    ditherStrength: 0.15 * ditherStrength,
    contrast: 1.10
  });

  // 6. Точечные прослойки для песчаника
  if (!isDeepslate && blockDef.accentPalette) {
    for (let x = 0; x < w; x++) {
      if (prng.chance(0.55)) {
        const seamY = (Math.floor(h * 0.62) + Math.floor(prng.range(-1, 1)) + h) % h;
        const color = prng.choice(blockDef.accentPalette);
        pixels[seamY][x] = { ...color };
      }
    }
  }

  return pixels;
}
