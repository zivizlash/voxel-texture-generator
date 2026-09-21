import { ToroidalFBM, createGrid, getWrapped, setWrapped } from '../noise.js';
import { applyDirectionalLighting, normalizeAndMapToPalette } from '../shading.js';

/**
 * Шаблон для органических материалов (Грязь, Каменистая земля, Укоренившаяся земля, Подзол, Мицелий).
 * Обеспечивает попиксельное варьирование оттенков рыхлой почвы вместо крупных монолитных пятен.
 */
export function generateOrganic(blockDef, prng, w = 16, h = 16) {
  const isMud = blockDef.id === 'mud';
  const isCoarse = blockDef.id === 'coarse_dirt';
  const isRooted = blockDef.id === 'rooted_dirt';
  const isPodzol = blockDef.id === 'podzol';
  const isMycelium = blockDef.id === 'mycelium';

  // 1. Плавный органический градиент плотности почвы
  const fbm = new ToroidalFBM(prng, [
    { period: 2, weight: 0.35 },
    { period: 4, weight: 0.35 },
    { period: 8, weight: 0.30 }
  ]);

  const heightMap = createGrid(w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const macro = fbm.sample(x, y, 16);

      // Высокочастотный попиксельный шум рыхлой земли
      const grain = prng.range(-0.28, 0.28);
      // Шахматный микро-сдвиг для предотвращения сплошных заливок
      const checker = ((x + y) % 2 === 0 ? 0.06 : -0.06);

      heightMap[y][x] = macro * 0.55 + (grain + checker) * 0.45 + 0.5;
    }
  }

  // 2. Освещение сверху-слева
  const litMap = applyDirectionalLighting(heightMap, 0.28, w, h);

  // 3. Попиксельная нормализация базовой почвы
  const pixels = normalizeAndMapToPalette(litMap, blockDef.palette, {
    w,
    h,
    prng,
    pixelJitter: 0.12,
    ditherStrength: 0.14,
    contrast: 1.05
  });

  // 4. Попиксельные акценты специфических блоков

  // 4.1. Укоренившаяся земля: тонкие 1-пиксельные прожилки светлых корней
  if (isRooted && blockDef.accentPalette) {
    const rootCount = prng.int(4, 6);
    for (let r = 0; r < rootCount; r++) {
      let rx = prng.int(0, w - 1);
      let ry = prng.int(0, h - 1);
      const length = prng.int(5, 10);
      for (let s = 0; s < length; s++) {
        const wx = ((rx % w) + w) % w;
        const wy = ((ry % h) + h) % h;
        // Чередование оттенков корней попиксельно
        const rootColor = blockDef.accentPalette[s % blockDef.accentPalette.length];
        pixels[wy][wx] = { ...rootColor };

        rx += prng.choice([-1, 0, 1]);
        ry += prng.choice([0, 1, 1]);
      }
    }
  }

  // 4.2. Каменистая земля: отдельные каменистые пиксели и мини-пары
  if (isCoarse && blockDef.accentPalette) {
    const pebbleCount = prng.int(16, 24);
    for (let p = 0; p < pebbleCount; p++) {
      const px = prng.int(0, w - 1);
      const py = prng.int(0, h - 1);
      const pColor = prng.choice(blockDef.accentPalette);
      pixels[py][px] = { ...pColor };
    }
  }

  // 4.3. Подзол: хвойный перегной с попиксельным чередованием темной хвои
  if (isPodzol && blockDef.accentPalette) {
    const needleNoise = new ToroidalFBM(prng, [
      { period: 4, weight: 0.5 },
      { period: 8, weight: 0.5 }
    ]);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nVal = needleNoise.sample(x, y, 16) + prng.range(-0.18, 0.18);
        if (nVal > 0.50) {
          const idx = Math.floor(prng.range(0, blockDef.accentPalette.length));
          pixels[y][x] = { ...blockDef.accentPalette[idx] };
        }
      }
    }
  }

  // 4.4. Мицелий: фиолетово-серые споры с выраженным попиксельным зерном
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
