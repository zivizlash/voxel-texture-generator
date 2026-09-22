import { ToroidalFBM, ToroidalDomainWarp, createGrid } from '../noise.js';
import { applyDirectionalLighting, normalizeAndMapToPalette } from '../shading.js';

/**
 * Шаблон для органических материалов (Грязь, Каменистая земля, Укоренившаяся земля, Подзол, Мицелий).
 * Использует:
 * 1. fBm (октавы) для сложной пористой структуры рыхлой земли.
 * 2. Domain Warping для завихрений органики и изгибания древесных/корневых прожилок.
 * 3. Контролируемый шум и акцентные попиксельные вкрапления.
 */
export function generateOrganic(blockDef, prng, w = 16, h = 16, params = {}) {
  const {
    octaves = 3,
    warpStrength = 0.5,
    scale = 1.0,
    ditherStrength = 1.0,
    lightStrength = 1.0
  } = params;

  const isCoarse = blockDef.id === 'coarse_dirt';
  const isRooted = blockDef.id === 'rooted_dirt';
  const isPodzol = blockDef.id === 'podzol';
  const isMycelium = blockDef.id === 'mycelium';

  // 1. Искажение пространства
  const warp = new ToroidalDomainWarp(prng);

  // 2. Многослойный fBm
  const fbm = new ToroidalFBM(prng, octaves, 2, 0.5);

  const heightMap = createGrid(w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const warped = warp.warp(x * scale, y * scale, warpStrength, 16);
      const macro = fbm.sample(warped.x, warped.y, 16);

      const grain = prng.range(-0.28, 0.28);
      const checker = ((x + y) % 2 === 0 ? 0.06 : -0.06);

      heightMap[y][x] = macro * 0.55 + (grain + checker) * 0.45 + 0.5;
    }
  }

  // 3. Освещение сверху-слева
  const litMap = applyDirectionalLighting(heightMap, 0.28 * lightStrength, w, h);

  // 4. Попиксельная нормализация базовой почвы
  const pixels = normalizeAndMapToPalette(litMap, blockDef.palette, {
    w,
    h,
    prng,
    pixelJitter: 0.12 * ditherStrength,
    ditherStrength: 0.14 * ditherStrength,
    contrast: 1.05
  });

  // 5. Попиксельные акценты со сдвигом по искаженному полю
  if (isRooted && blockDef.accentPalette) {
    const rootCount = prng.int(4, 6);
    for (let r = 0; r < rootCount; r++) {
      let rx = prng.int(0, w - 1);
      let ry = prng.int(0, h - 1);
      const length = prng.int(5, 10);
      for (let s = 0; s < length; s++) {
        const warped = warp.warp(rx, ry, warpStrength * 0.5, 16);
        const wx = Math.floor(((warped.x % w) + w) % w);
        const wy = Math.floor(((warped.y % h) + h) % h);
        const rootColor = blockDef.accentPalette[s % blockDef.accentPalette.length];
        pixels[wy][wx] = { ...rootColor };

        rx += prng.choice([-1, 0, 1]);
        ry += prng.choice([0, 1, 1]);
      }
    }
  }

  if (isCoarse && blockDef.accentPalette) {
    const pebbleCount = prng.int(16, 24);
    for (let p = 0; p < pebbleCount; p++) {
      const px = prng.int(0, w - 1);
      const py = prng.int(0, h - 1);
      const pColor = prng.choice(blockDef.accentPalette);
      pixels[py][px] = { ...pColor };
    }
  }

  if (isPodzol && blockDef.accentPalette) {
    const needleNoise = new ToroidalFBM(prng, Math.max(2, octaves), 4, 0.5);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const warped = warp.warp(x, y, warpStrength * 0.7, 16);
        const nVal = needleNoise.sample(warped.x, warped.y, 16) + prng.range(-0.18, 0.18);
        if (nVal > 0.50) {
          const idx = Math.floor(prng.range(0, blockDef.accentPalette.length));
          pixels[y][x] = { ...blockDef.accentPalette[idx] };
        }
      }
    }
  }

  if (isMycelium && blockDef.accentPalette) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (prng.chance(0.42)) {
          const idx = prng.int(0, blockDef.accentPalette.length - 1);
          pixels[y][x] = { ...blockDef.accentPalette[idx] };
        }
      }
    }
  }

  return pixels;
}
