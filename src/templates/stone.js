import { ToroidalFBM, ToroidalWorley, ToroidalDomainWarp, createGrid, getWrapped, setWrapped } from '../noise.js';
import { applyDirectionalLighting, normalizeAndMapToPalette } from '../shading.js';

/**
 * Шаблон для плотных и магматических пород (Камень, Андезит, Гранит, Диорит).
 * Использует:
 * 1. fBm (октавы) для формирования макро-структуры породы.
 * 2. Domain Warping для искривления трещин и минеральных пластов (эффект магматических складок/мрамора).
 * 3. Тороидальный клеточный шум Worley для сколов и граней.
 */
export function generateStone(blockDef, prng, w = 16, h = 16, params = {}) {
  const {
    octaves = 3,
    warpStrength = 0.5,
    scale = 1.0,
    ditherStrength = 1.0,
    lightStrength = 1.0
  } = params;

  const isDiorite = blockDef.id === 'diorite';
  const isGranite = blockDef.id === 'granite';
  const isAndesite = blockDef.id === 'andesite';

  // 1. Искажение пространства (Domain Warping)
  const warp = new ToroidalDomainWarp(prng);

  // 2. Макро-форма: многослойный fBm
  const fbm = new ToroidalFBM(prng, octaves, 2, 0.5);

  // 3. Угловатые сколы Worley
  const cellCount = isDiorite ? 12 : (isGranite ? 10 : 8);
  const worley = new ToroidalWorley(prng, cellCount, 16);

  const heightMap = createGrid(w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Искаженные координаты для волнистости кристаллов и трещин
      const warped = warp.warp(x * scale, y * scale, warpStrength, 16);

      const macro = fbm.sample(warped.x, warped.y, 16);
      const cell = worley.sample(warped.x, warped.y, 'manhattan');

      const pixelNoise = prng.range(-0.32, 0.32);
      const microPattern = ((x * 5 + y * 11) % 7 - 3) * 0.04;
      const edgeDepth = Math.min(1.0, cell.edge * 0.6);

      heightMap[y][x] = macro * 0.35 + cell.val * 0.25 + edgeDepth * 0.15 + (pixelNoise + microPattern) * 0.25;
    }
  }

  // 4. Тонкие трещины (следуют с учетом деформации)
  const crackCount = prng.int(2, 4);
  for (let c = 0; c < crackCount; c++) {
    let cx = prng.int(0, w - 1);
    let cy = prng.int(0, h - 1);
    const len = prng.int(4, 8);
    const dirX = prng.choice([-1, 1]);
    const dirY = prng.choice([0, 1]);

    for (let step = 0; step < len; step++) {
      const curr = getWrapped(heightMap, cx, cy, w, h);
      setWrapped(heightMap, cx, cy, curr - 0.35, w, h);

      const above = getWrapped(heightMap, cx, cy - 1, w, h);
      setWrapped(heightMap, cx, cy - 1, above + 0.20, w, h);

      cx += dirX;
      cy += dirY;
    }
  }

  // 5. Освещение сверху-слева
  const litMap = applyDirectionalLighting(heightMap, 0.32 * lightStrength, w, h);

  // 6. Попиксельная нормализация с дизерингом Байера
  const pixels = normalizeAndMapToPalette(litMap, blockDef.palette, {
    w,
    h,
    prng,
    pixelJitter: (isAndesite ? 0.16 : 0.12) * ditherStrength,
    ditherStrength: (isAndesite ? 0.18 : 0.14) * ditherStrength,
    contrast: 1.10
  });

  // 7. Попиксельное распределение минеральных кристаллов
  if (isDiorite && blockDef.accentPalette) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (prng.chance(0.24)) {
          const darkTone = prng.choice(blockDef.accentPalette);
          pixels[y][x] = { ...darkTone };
        }
      }
    }
  } else if (isGranite && blockDef.accentPalette) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const roll = prng.next();
        if (roll < 0.14) {
          pixels[y][x] = { ...blockDef.accentPalette[1] };
        } else if (roll > 0.88) {
          pixels[y][x] = { ...blockDef.accentPalette[0] };
        }
      }
    }
  }

  return pixels;
}
