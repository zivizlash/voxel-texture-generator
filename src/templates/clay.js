import { ToroidalFBM, ToroidalDomainWarp, createGrid } from '../noise.js';
import { applyDirectionalLighting, normalizeAndMapToPalette } from '../shading.js';

/**
 * Шаблон для природной глины (Clay).
 * Создает мягкую, плотную, пластичную осадочную фактуру с плавными
 * разводами от деформации (Domain Warping), мягким шелковистым рельефом
 * и отсутствием грубых песчаных крупиц.
 */
export function generateClay(blockDef, prng, w = 16, h = 16, params = {}) {
  const {
    octaves = 3,
    warpStrength = 0.5,
    scale = 1.0,
    ditherStrength = 1.0,
    lightStrength = 1.0
  } = params;

  const warp = new ToroidalDomainWarp(prng);
  const fbm = new ToroidalFBM(prng, octaves, 2, 0.5);
  const heightMap = createGrid(w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Плавное искажение координат для эффекта пластичной, мятой глины
      const warped = warp.warp(x * scale, y * scale, warpStrength * 0.7, 16);
      const smoothWave = fbm.sample(warped.x, warped.y, 16);

      // Очень тонкий микро-шум (глина гладкая, без грубых песчинок)
      const fineGrain = prng.range(-0.10, 0.10);

      heightMap[y][x] = smoothWave * 0.7 + fineGrain * 0.3 + 0.5;
    }
  }

  // Мягкое освещение с эффектом шелковистого полуматового отблеска влажной глины
  const litMap = applyDirectionalLighting(heightMap, 0.20 * lightStrength, w, h);

  return normalizeAndMapToPalette(litMap, blockDef.palette, {
    w,
    h,
    prng,
    pixelJitter: 0.05 * ditherStrength,
    ditherStrength: 0.08 * ditherStrength,
    contrast: 1.02
  });
}

/**
 * Шаблон для терракоты (Terracotta / Hardened Baked Clay).
 * Создает теплую фактуру обожженной керамической глины:
 * - Плавные керамические слои и следы формовки;
 * - Матовая фактура с мелкой пористостью обжига;
 * - Легкие печные цветовые переливы и акцентные минеральные крапинки.
 */
export function generateTerracotta(blockDef, prng, w = 16, h = 16, params = {}) {
  const {
    octaves = 3,
    warpStrength = 0.5,
    scale = 1.0,
    ditherStrength = 1.0,
    lightStrength = 1.0
  } = params;

  const warp = new ToroidalDomainWarp(prng);
  const fbm = new ToroidalFBM(prng, octaves, 3, 0.5);
  const heightMap = createGrid(w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Искаженные керамические полосы обжига
      const warped = warp.warp(x * scale * 0.9, y * scale * 1.3, warpStrength * 0.6, 16);
      const macro = fbm.sample(warped.x, warped.y, 16);

      // Легкие следы формования глины
      const pugWave = Math.sin((warped.y / 16) * Math.PI * 4) * 0.12;
      const fineDust = prng.range(-0.14, 0.14);

      heightMap[y][x] = macro * 0.6 + pugWave + fineDust * 0.28 + 0.5;
    }
  }

  // Матовое керамическое освещение
  const litMap = applyDirectionalLighting(heightMap, 0.25 * lightStrength, w, h);

  const pixels = normalizeAndMapToPalette(litMap, blockDef.palette, {
    w,
    h,
    prng,
    pixelJitter: 0.08 * ditherStrength,
    ditherStrength: 0.12 * ditherStrength,
    contrast: 1.06
  });

  // Редкие минеральные крапинки и следы запекания железа
  if (blockDef.accentPalette && blockDef.accentPalette.length > 0) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (prng.chance(0.025)) {
          const fleck = prng.choice(blockDef.accentPalette);
          pixels[y][x] = { ...fleck };
        }
      }
    }
  }

  return pixels;
}
