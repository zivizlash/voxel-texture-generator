import { ToroidalFBM, createGrid, getWrapped, setWrapped } from '../noise.js';
import { applyDirectionalLighting, normalizeAndMapToPalette } from '../shading.js';

/**
 * Шаблон для слоистых пород (Песчаник, Красный песчаник, Глубинный сланец).
 * Попиксельное распределение: горизонтальная сланцеватость с богатой зернистостью
 * и попиксельным чередованием оттенков вдоль слоев (без плоских полос).
 */
export function generateLayered(blockDef, prng, w = 16, h = 16) {
  const isDeepslate = blockDef.id === 'deepslate';

  // 1. Частота слоев
  const layerFreq = isDeepslate ? 4 : 3;
  const heightMap = createGrid(w, h);

  // Волнообразный сдвиг пластов
  const warpNoise = new ToroidalFBM(prng, [
    { period: 4, weight: 0.6 },
    { period: 8, weight: 0.4 }
  ]);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const warp = (warpNoise.sample(x, y, 16) - 0.5) * 1.5;
      const effectiveY = (y + warp + h) % h;

      // Слоистая периодическая синусоида
      const phase = (effectiveY / h) * (Math.PI * 2 * layerFreq);
      const layerWave = Math.sin(phase) * 0.5 + 0.5;

      // Высокочастотный попиксельный шум вдоль пласта
      const grain = prng.range(-0.25, 0.25);
      const horizontalChatter = ((x % 2 === 0 ? 0.08 : -0.08) + (y % 2 === 0 ? 0.04 : -0.04));

      heightMap[y][x] = layerWave * 0.5 + 0.25 + (grain + horizontalChatter) * 0.35;
    }
  }

  // 2. Тонкие горизонтальные трещины на стыках пластов
  for (let l = 0; l < layerFreq; l++) {
    const baseRow = Math.floor((l / layerFreq) * h);
    for (let x = 0; x < w; x++) {
      const warp = Math.round((warpNoise.sample(x, baseRow, 16) - 0.5) * 1.2);
      const seamY = ((baseRow + warp) % h + h) % h;

      // Теневой шов
      const curr = getWrapped(heightMap, x, seamY, w, h);
      setWrapped(heightMap, x, seamY, curr - 0.25, w, h);

      // Верхняя кромка ловит свет
      const upperY = ((seamY - 1) % h + h) % h;
      const upperCurr = getWrapped(heightMap, x, upperY, w, h);
      setWrapped(heightMap, x, upperY, upperCurr + 0.18, w, h);
    }
  }

  // 3. Освещение сверху-слева
  const litMap = applyDirectionalLighting(heightMap, isDeepslate ? 0.35 : 0.25, w, h);

  // 4. Попиксельная нормализация с дизерингом
  const pixels = normalizeAndMapToPalette(litMap, blockDef.palette, {
    w,
    h,
    prng,
    pixelJitter: 0.12,
    ditherStrength: 0.15,
    contrast: 1.10
  });

  // 5. Для песчаника — отдельные точечные минеральные прослойки
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
