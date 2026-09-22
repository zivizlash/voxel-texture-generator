import { ToroidalFBM, ToroidalDomainWarp, createGrid, getWrapped, setWrapped } from '../noise.js';
import { applyDirectionalLighting, normalizeAndMapToPalette } from '../shading.js';

/**
 * Шаблон для деревянных досок (Planks).
 * Создает 4 горизонтальные половицы с теневыми продольными стыками,
 * волокнами древесины (с легким Domain Warping) и акцентными гвоздями/дюбелями.
 */
export function generateWoodPlanks(blockDef, prng, w = 16, h = 16, params = {}) {
  const {
    octaves = 3,
    warpStrength = 0.5,
    scale = 1.0,
    ditherStrength = 1.0,
    lightStrength = 1.0
  } = params;

  const warp = new ToroidalDomainWarp(prng);
  const fbm = new ToroidalFBM(prng, octaves, 4, 0.5);
  const heightMap = createGrid(w, h);

  const plankCount = 4;
  const plankHeight = h / plankCount; // 4 пикселя на каждую доску

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const localY = y % plankHeight;

      // Горизонтальные древесные волокна с небольшим искривлением
      const warped = warp.warp(x * scale * 0.8, y * scale * 1.8, warpStrength * 0.4, 16);
      const fiber = fbm.sample(warped.x, warped.y, 16);

      // Легкий дугообразный профиль каждой доски
      const plankBevel = Math.sin((localY / plankHeight) * Math.PI) * 0.15;
      const grain = prng.range(-0.15, 0.15);

      heightMap[y][x] = fiber * 0.55 + plankBevel + grain * 0.3 + 0.35;
    }
  }

  // Прорезаем глубокие теневые швы между досками (y = 0, 4, 8, 12)
  for (let p = 0; p < plankCount; p++) {
    const seamY = Math.floor(p * plankHeight);
    for (let x = 0; x < w; x++) {
      // Теневой паз
      setWrapped(heightMap, x, seamY, getWrapped(heightMap, x, seamY, w, h) - 0.45, w, h);
      // Верхняя фаска следующей доски ловит свет
      const lowerSeam = (seamY + 1) % h;
      setWrapped(heightMap, x, lowerSeam, getWrapped(heightMap, x, lowerSeam, w, h) + 0.18, w, h);
    }
  }

  const litMap = applyDirectionalLighting(heightMap, 0.28 * lightStrength, w, h);

  const pixels = normalizeAndMapToPalette(litMap, blockDef.palette, {
    w,
    h,
    prng,
    pixelJitter: 0.08 * ditherStrength,
    ditherStrength: 0.10 * ditherStrength,
    contrast: 1.05
  });

  // Акцентные темные гвозди/крепежи по краям досок
  if (blockDef.accentPalette) {
    for (let p = 0; p < plankCount; p++) {
      const seamY = Math.floor(p * plankHeight) + 1;
      const nailX1 = (p * 5 + 2) % w;
      const nailX2 = (nailX1 + 8) % w;
      const nailColor = blockDef.accentPalette[0];
      pixels[seamY % h][nailX1] = { ...nailColor };
      pixels[seamY % h][nailX2] = { ...nailColor };
    }
  }

  return pixels;
}

/**
 * Шаблон для боковой коры дерева (Log Side).
 * Вертикальные желобки коры, продольные волокна с волнообразным Domain Warping.
 */
export function generateLogSide(blockDef, prng, w = 16, h = 16, params = {}) {
  const {
    octaves = 3,
    warpStrength = 0.5,
    scale = 1.0,
    ditherStrength = 1.0,
    lightStrength = 1.0
  } = params;

  const warp = new ToroidalDomainWarp(prng);
  const fbm = new ToroidalFBM(prng, octaves, 4, 0.5);
  const heightMap = createGrid(w, h);

  // Вертикально вытянутые гребни коры
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Растягиваем координаты по вертикали (волокна коры идут вдоль оси Y)
      const warped = warp.warp(x * scale * 1.5, y * scale * 0.35, warpStrength * 0.6, 16);
      const barkWave = fbm.sample(warped.x, warped.y, 16);

      // Периодические вертикальные полосы коры
      const verticalStripe = Math.sin(warped.x * (Math.PI * 2 / 16) * 3) * 0.25;
      const pixelNoise = prng.range(-0.25, 0.25);

      heightMap[y][x] = barkWave * 0.45 + verticalStripe + pixelNoise * 0.3 + 0.4;
    }
  }

  // Вертикальные трещины в коре
  const fissureCount = prng.int(2, 4);
  for (let f = 0; f < fissureCount; f++) {
    let fx = prng.int(0, w - 1);
    for (let y = 0; y < h; y++) {
      setWrapped(heightMap, fx, y, getWrapped(heightMap, fx, y, w, h) - 0.38, w, h);
      setWrapped(heightMap, fx - 1, y, getWrapped(heightMap, fx - 1, y, w, h) + 0.22, w, h);
      if (prng.chance(0.25)) fx += prng.choice([-1, 1]);
    }
  }

  const litMap = applyDirectionalLighting(heightMap, 0.35 * lightStrength, w, h);

  return normalizeAndMapToPalette(litMap, blockDef.palette, {
    w,
    h,
    prng,
    pixelJitter: 0.12 * ditherStrength,
    ditherStrength: 0.14 * ditherStrength,
    contrast: 1.10
  });
}

/**
 * Шаблон для среза ствола дерева (Log Top / Bottom).
 * Концентрические годичные кольца с искривлением Domain Warping,
 * сердцевина по центру и защитный ободок темной коры по периметру.
 */
export function generateLogTop(blockDef, prng, w = 16, h = 16, params = {}) {
  const {
    octaves = 3,
    warpStrength = 0.5,
    scale = 1.0,
    ditherStrength = 1.0,
    lightStrength = 1.0
  } = params;

  const warp = new ToroidalDomainWarp(prng);
  const fbm = new ToroidalFBM(prng, octaves, 4, 0.5);
  const heightMap = createGrid(w, h);

  const centerX = 7.5;
  const centerY = 7.5;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Искривление формы годичных колец через Domain Warping
      const warped = warp.warp(x * scale, y * scale, warpStrength * 0.7, 16);
      const ringNoise = (fbm.sample(warped.x, warped.y, 16) - 0.5) * 1.6;
      const ringDist = dist + ringNoise;

      // Концентрическая волна годичных колец
      const ringFreq = 2.4;
      const ringWave = Math.sin(ringDist * ringFreq) * 0.3;

      // Небольшое затемнение сердцевины в центре
      const coreDepth = dist < 2.2 ? (2.2 - dist) * 0.35 : 0;
      const grain = prng.range(-0.15, 0.15);

      heightMap[y][x] = 0.5 + ringWave - coreDepth + grain * 0.25;
    }
  }

  const litMap = applyDirectionalLighting(heightMap, 0.22 * lightStrength, w, h);

  const pixels = normalizeAndMapToPalette(litMap, blockDef.palette, {
    w,
    h,
    prng,
    pixelJitter: 0.08 * ditherStrength,
    ditherStrength: 0.10 * ditherStrength,
    contrast: 1.05
  });

  // Внешний ободок коры (1-2 пикселя по внешнему контуру)
  if (blockDef.accentPalette) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const isOuterBorder = (x === 0 || x === w - 1 || y === 0 || y === h - 1);
        const isInnerBorder = (x === 1 || x === w - 2 || y === 1 || y === h - 2);

        if (isOuterBorder) {
          const barkTone = prng.choice(blockDef.accentPalette);
          pixels[y][x] = { ...barkTone };
        } else if (isInnerBorder && prng.chance(0.45)) {
          const barkTone = blockDef.accentPalette[blockDef.accentPalette.length - 1];
          pixels[y][x] = { ...barkTone };
        }
      }
    }
  }

  return pixels;
}
