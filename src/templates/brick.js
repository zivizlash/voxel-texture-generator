import { ToroidalFBM, ToroidalDomainWarp, createGrid, getWrapped, setWrapped } from '../noise.js';
import { applyDirectionalLighting, normalizeAndMapToPalette } from '../shading.js';

/**
 * Шаблон для кирпича (Bricks).
 * Формирует четкую, классическую перевязку кирпичной кладки (running bond) 16x16:
 * - 4 горизонтальных ряда (по 4 пикселя высотой);
 * - Смещение швов на 4 пикселя в шахматном порядке между рядами;
 * - Глубокие цементные швы (раствор);
 * - Верхние и левые фаски каждого кирпича, ловящие направленный свет;
 * - Тонкие цветовые вариации между отдельными кирпичами (обжиг в печи);
 * - 100% тороидальная бесшовность.
 */
export function generateBrick(blockDef, prng, w = 16, h = 16, params = {}) {
  const {
    octaves = 3,
    warpStrength = 0.5,
    scale = 1.0,
    ditherStrength = 1.0,
    lightStrength = 1.0
  } = params;

  const warp = new ToroidalDomainWarp(prng);
  const fbm = new ToroidalFBM(prng, Math.min(3, octaves), 4, 0.5);
  const heightMap = createGrid(w, h);

  // Предварительно генерируем индивидуальные вариации оттенков для каждого из 8 кирпичей
  const brickShifts = [];
  for (let b = 0; b < 8; b++) {
    brickShifts.push(prng.range(-0.16, 0.16));
  }

  const isMortarMap = [];
  for (let y = 0; y < h; y++) {
    isMortarMap.push(new Uint8Array(w));
  }

  for (let y = 0; y < h; y++) {
    const row = Math.floor(y / 4); // 0, 1, 2, 3
    const localY = y % 4;
    const isMortarH = (localY === 3);

    // Смещение нечетных рядов на 4 пикселя (шахматная перевязка)
    const colShift = (row % 2 === 1) ? 4 : 0;

    for (let x = 0; x < w; x++) {
      const shiftedX = (x - colShift + w) % w;
      const localX = shiftedX % 8;
      const isMortarV = (localX === 7);

      const isMortar = isMortarH || isMortarV;
      isMortarMap[y][x] = isMortar ? 1 : 0;

      if (isMortar) {
        // Углубленный теневой шов раствора
        const mortarGrain = prng.range(-0.06, 0.06);
        heightMap[y][x] = 0.12 + mortarGrain;
      } else {
        const brickCol = Math.floor(shiftedX / 8); // 0 или 1
        const brickIdx = (row * 2 + brickCol) % 8;
        const brickShift = brickShifts[brickIdx];

        // Легкое микро-искривление для текстуры обожженной глины
        const warped = warp.warp(x * scale, y * scale, warpStrength * 0.25, 16);
        const surfaceNoise = (fbm.sample(warped.x, warped.y, 16) - 0.5) * 0.25;
        const grain = prng.range(-0.08, 0.08);

        // Фаски: верхний и левый край кирпича ловят свет
        let bevel = 0;
        if (localY === 0) bevel += 0.22;
        if (localX === 0) bevel += 0.18;
        if (localY === 2) bevel -= 0.14;
        if (localX === 6) bevel -= 0.14;

        heightMap[y][x] = 0.62 + brickShift + bevel + surfaceNoise + grain;
      }
    }
  }

  // Направленное освещение подчеркивает выпуклость каждого кирпича над швами
  const litMap = applyDirectionalLighting(heightMap, 0.35 * lightStrength, w, h);

  const pixels = normalizeAndMapToPalette(litMap, blockDef.palette, {
    w,
    h,
    prng,
    pixelJitter: 0.08 * ditherStrength,
    ditherStrength: 0.10 * ditherStrength,
    contrast: 1.15
  });

  // Если задана акцентная палитра для раствора, окрашиваем швы
  if (blockDef.accentPalette && blockDef.accentPalette.length > 0) {
    const mortarBase = blockDef.accentPalette[0];
    const mortarLight = blockDef.accentPalette[1] || mortarBase;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (isMortarMap[y][x]) {
          const isFleck = prng.chance(0.25);
          pixels[y][x] = { ...(isFleck ? mortarLight : mortarBase) };
        }
      }
    }
  }

  return pixels;
}
