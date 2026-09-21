import { ToroidalFBM, ToroidalWorley, createGrid, getWrapped, setWrapped } from '../noise.js';
import { applyDirectionalLighting, normalizeAndMapToPalette } from '../shading.js';

/**
 * Шаблон для плотных и магматических пород (Камень, Андезит, Гранит, Диорит).
 * Попиксельное распределение: зернистая структура с естественным чередованием
 * соседних оттенков, тонкими трещинами и минеральными кристаллами.
 */
export function generateStone(blockDef, prng, w = 16, h = 16) {
  const isDiorite = blockDef.id === 'diorite';
  const isGranite = blockDef.id === 'granite';
  const isAndesite = blockDef.id === 'andesite';

  // 1. Макро-форма: мягкий FBM рельеф
  const fbm = new ToroidalFBM(prng, [
    { period: 2, weight: 0.35 },
    { period: 4, weight: 0.35 },
    { period: 8, weight: 0.30 }
  ]);

  // 2. Угловатые микро-сколы через тороидальный Worley
  const cellCount = isDiorite ? 12 : (isGranite ? 10 : 8);
  const worley = new ToroidalWorley(prng, cellCount, 16);

  const heightMap = createGrid(w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const macro = fbm.sample(x, y, 16);
      const cell = worley.sample(x, y, 'manhattan');

      // Высокочастотный попиксельный шум для разрушения островков
      const pixelNoise = prng.range(-0.32, 0.32);
      const microPattern = ((x * 5 + y * 11) % 7 - 3) * 0.04;

      // Трещины на стыках ячеек
      const edgeDepth = Math.min(1.0, cell.edge * 0.6);

      const combined = macro * 0.35 + cell.val * 0.25 + edgeDepth * 0.15 + (pixelNoise + microPattern) * 0.25;
      heightMap[y][x] = combined;
    }
  }

  // 3. Тонкие направленные трещины (1-2 пикселя толщиной)
  const crackCount = prng.int(2, 4);
  for (let c = 0; c < crackCount; c++) {
    let cx = prng.int(0, w - 1);
    let cy = prng.int(0, h - 1);
    const len = prng.int(4, 8);
    const dirX = prng.choice([-1, 1]);
    const dirY = prng.choice([0, 1]);

    for (let step = 0; step < len; step++) {
      const curr = getWrapped(heightMap, cx, cy, w, h);
      // Углубление трещины
      setWrapped(heightMap, cx, cy, curr - 0.35, w, h);

      // Верхняя грань трещины ловит свет
      const above = getWrapped(heightMap, cx, cy - 1, w, h);
      setWrapped(heightMap, cx, cy - 1, above + 0.20, w, h);

      cx += dirX;
      cy += dirY;
    }
  }

  // 4. Освещение сверху-слева
  const litMap = applyDirectionalLighting(heightMap, 0.32, w, h);

  // 5. Попиксельная нормализация палитры с дизерингом
  const pixels = normalizeAndMapToPalette(litMap, blockDef.palette, {
    w,
    h,
    prng,
    pixelJitter: isAndesite ? 0.16 : 0.12,
    ditherStrength: isAndesite ? 0.18 : 0.14,
    contrast: 1.10
  });

  // 6. Попиксельное распределение минеральных кристаллов (Диорит и Гранит)
  if (isDiorite && blockDef.accentPalette) {
    // У диорита отдельные темные кристаллы амфибола хаотично рассеяны попиксельно
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (prng.chance(0.24)) {
          const darkTone = prng.choice(blockDef.accentPalette);
          pixels[y][x] = { ...darkTone };
        }
      }
    }
  } else if (isGranite && blockDef.accentPalette) {
    // У гранита чередуются светлые зерна кварца и темная слюда
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const roll = prng.next();
        if (roll < 0.14) {
          // Светлый кварцевый пиксель
          pixels[y][x] = { ...blockDef.accentPalette[1] };
        } else if (roll > 0.88) {
          // Темный пиксель слюды
          pixels[y][x] = { ...blockDef.accentPalette[0] };
        }
      }
    }
  }

  return pixels;
}
