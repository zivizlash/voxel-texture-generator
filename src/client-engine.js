/**
 * Полный автономный движок процедурной генерации текстур 16x16 для браузера.
 * Содержит PRNG, тороидальный шум, fBm с динамическими октавами, тороидальное
 * искажение пространства (Domain Warping), дизеринг Байера, шейдинг, палитры 16 блоков,
 * генератор текстурного атласа 8x8 и интерактивные элементы управления параметрами.
 */
export const CLIENT_ENGINE_SCRIPT = `
(function() {
  'use strict';

  // --- 1. Mulberry32 PRNG ---
  class PRNG {
    constructor(seed = 1337) {
      this.initialSeed = typeof seed === 'string' ? PRNG.hashString(seed) : (seed >>> 0);
      this.state = this.initialSeed;
    }
    static hashString(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = (Math.imul(31, hash) + str.charCodeAt(i)) >>> 0;
      }
      return hash;
    }
    reset() { this.state = this.initialSeed; }
    next() {
      let t = (this.state += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(min, max) { return min + this.next() * (max - min); }
    int(min, max) { return Math.floor(this.range(min, max + 1)); }
    choice(arr) { if (!arr || arr.length === 0) return null; return arr[this.int(0, arr.length - 1)]; }
    chance(p) { return this.next() < p; }
    fork(offset = 0) { return new PRNG((this.state + offset + 0x9E3779B9) >>> 0); }
  }

  // --- 2. Toroidal Noise, fBm & Domain Warping ---
  function quintic(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  class ToroidalNoise {
    constructor(prng, period = 4) {
      this.period = Math.max(1, Math.round(period));
      this.grid = [];
      for (let y = 0; y < this.period; y++) {
        const row = [];
        for (let x = 0; x < this.period; x++) {
          row.push(prng.next());
        }
        this.grid.push(row);
      }
    }
    sample(x, y, size = 16) {
      const u = (((x % size) + size) % size) / size * this.period;
      const v = (((y % size) + size) % size) / size * this.period;
      const x0 = Math.floor(u) % this.period;
      const y0 = Math.floor(v) % this.period;
      const x1 = (x0 + 1) % this.period;
      const y1 = (y0 + 1) % this.period;
      const fx = quintic(u - Math.floor(u));
      const fy = quintic(v - Math.floor(v));
      const top = (1 - fx) * this.grid[y0][x0] + fx * this.grid[y0][x1];
      const bottom = (1 - fx) * this.grid[y1][x0] + fx * this.grid[y1][x1];
      return (1 - fy) * top + fy * bottom;
    }
  }

  // Фрактальный шум fBm с поддержкой 1-6 октав
  class ToroidalFBM {
    constructor(prng, octavesOrCount = 3, basePeriod = 2, persistence = 0.5) {
      if (Array.isArray(octavesOrCount)) {
        this.layers = octavesOrCount.map(oct => ({
          noise: new ToroidalNoise(prng, oct.period),
          weight: oct.weight
        }));
      } else {
        const count = Math.max(1, Math.min(6, Math.round(octavesOrCount || 3)));
        this.layers = [];
        let period = basePeriod;
        let weight = 1.0;
        for (let i = 0; i < count; i++) {
          this.layers.push({
            noise: new ToroidalNoise(prng.fork(i * 101), Math.min(16, period)),
            weight
          });
          weight *= persistence;
          period *= 2;
        }
      }
      const totalWeight = this.layers.reduce((sum, l) => sum + l.weight, 0);
      this.layers.forEach(l => l.weight /= totalWeight);
    }
    sample(x, y, size = 16) {
      let val = 0;
      for (const layer of this.layers) {
        val += layer.noise.sample(x, y, size) * layer.weight;
      }
      return val;
    }
  }

  // Искажение пространства (Domain Warping) с тороидальной бесшовностью
  class ToroidalDomainWarp {
    constructor(prng) {
      this.noiseX = new ToroidalFBM(prng.fork(211), [
        { period: 4, weight: 0.65 },
        { period: 8, weight: 0.35 }
      ]);
      this.noiseY = new ToroidalFBM(prng.fork(313), [
        { period: 4, weight: 0.65 },
        { period: 8, weight: 0.35 }
      ]);
    }
    warp(x, y, strength = 0.5, size = 16) {
      if (strength <= 0) return { x, y };
      const maxOffset = strength * size * 0.28;
      const dx = (this.noiseX.sample(x, y, size) - 0.5) * 2 * maxOffset;
      const dy = (this.noiseY.sample(x, y, size) - 0.5) * 2 * maxOffset;
      return {
        x: ((x + dx) % size + size) % size,
        y: ((y + dy) % size + size) % size
      };
    }
  }

  class ToroidalWorley {
    constructor(prng, pointCount = 6, size = 16) {
      this.size = size;
      this.points = [];
      for (let i = 0; i < pointCount; i++) {
        this.points.push({
          x: prng.range(0, size),
          y: prng.range(0, size),
          val: prng.next()
        });
      }
    }
    sample(x, y, metric = 'euclidean') {
      let d1 = Infinity;
      let d2 = Infinity;
      let closestVal = 0;
      for (const pt of this.points) {
        let dx = Math.abs(x - pt.x);
        if (dx > this.size / 2) dx = this.size - dx;
        let dy = Math.abs(y - pt.y);
        if (dy > this.size / 2) dy = this.size - dy;
        const dist = metric === 'manhattan' ? (dx + dy) : Math.sqrt(dx * dx + dy * dy);
        if (dist < d1) {
          d2 = d1;
          d1 = dist;
          closestVal = pt.val;
        } else if (dist < d2) {
          d2 = dist;
        }
      }
      return { d1, d2, edge: d2 - d1, val: closestVal };
    }
  }

  function createGrid(w = 16, h = 16, fill = 0) {
    const grid = [];
    for (let y = 0; y < h; y++) {
      grid.push(new Float32Array(w).fill(fill));
    }
    return grid;
  }

  function getWrapped(grid, x, y, w = 16, h = 16) {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return grid[wy][wx];
  }

  function setWrapped(grid, x, y, val, w = 16, h = 16) {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    grid[wy][wx] = val;
  }

  // --- 3. Bayer Dithering, Directional Lighting & Palette Mapping ---
  const BAYER_4X4 = [
    [ 0/16,  8/16,  2/16, 10/16],
    [12/16,  4/16, 14/16,  6/16],
    [ 3/16, 11/16,  1/16,  9/16],
    [15/16,  7/16, 13/16,  5/16]
  ];

  function applyDirectionalLighting(heightMap, lightStrength = 0.25, w = 16, h = 16) {
    const litMap = [];
    for (let y = 0; y < h; y++) {
      const row = new Float32Array(w);
      for (let x = 0; x < w; x++) {
        const center = heightMap[y][x];
        const up = getWrapped(heightMap, x, y - 1, w, h);
        const down = getWrapped(heightMap, x, y + 1, w, h);
        const left = getWrapped(heightMap, x - 1, y, w, h);
        const right = getWrapped(heightMap, x + 1, y, w, h);

        const slopeY = (center - up) - (down - center);
        const slopeX = (center - left) - (right - center);
        const lighting = (slopeY * 0.7 + slopeX * 0.3) * lightStrength;
        row[x] = center + lighting;
      }
      litMap.push(row);
    }
    return litMap;
  }

  function normalizeAndMapToPalette(valueMap, palette, options = {}) {
    const {
      w = 16,
      h = 16,
      ditherStrength = 0.12,
      pixelJitter = 0.08,
      contrast = 1.0,
      prng = null
    } = options;

    let minVal = Infinity;
    let maxVal = -Infinity;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = valueMap[y][x];
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
    }

    const range = maxVal - minVal || 1.0;
    const paletteLen = palette.length;
    const result = [];

    for (let y = 0; y < h; y++) {
      const row = [];
      for (let x = 0; x < w; x++) {
        let norm = (valueMap[y][x] - minVal) / range;
        if (contrast !== 1.0) norm = Math.pow(norm, contrast);
        if (pixelJitter > 0 && prng) norm += prng.range(-pixelJitter, pixelJitter);
        if (ditherStrength > 0) {
          const bayerVal = BAYER_4X4[y % 4][x % 4] - 0.5;
          norm += bayerVal * ditherStrength;
        }
        norm = Math.max(0.001, Math.min(0.999, norm));
        const index = Math.floor(norm * paletteLen);
        const safeIndex = Math.max(0, Math.min(paletteLen - 1, index));
        row.push({ ...palette[safeIndex] });
      }
      result.push(row);
    }
    return result;
  }

  // --- 4. Blocks & Palettes ---
  function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
      a: 255
    };
  }
  function parsePalette(arr) { return arr.map(hexToRgb); }

  const BLOCKS = {
    sand: {
      id: 'sand',
      nameRu: 'Песок',
      template: 'granular',
      palette: parsePalette(['#bca874', '#cbba85', '#d7c996', '#dfd5a5', '#e8e0b5', '#f2ebd0'])
    },
    red_sand: {
      id: 'red_sand',
      nameRu: 'Красный песок',
      template: 'granular',
      palette: parsePalette(['#8f4019', '#a54d20', '#b85b28', '#c86c34', '#d57e44', '#e09257'])
    },
    gravel: {
      id: 'gravel',
      nameRu: 'Гравий',
      template: 'granular',
      palette: parsePalette(['#5c5757', '#6f6868', '#7e7776', '#8f8785', '#9f9794', '#b0a8a5'])
    },
    clay: {
      id: 'clay',
      nameRu: 'Глина',
      category: 'clay',
      template: 'clay',
      palette: parsePalette(['#6b7382', '#7c8494', '#8d96a6', '#9ea8b8', '#afb9c9', '#c2ccdb']),
      accentPalette: parsePalette(['#565e6c', '#d7e0ed'])
    },
    terracotta: {
      id: 'terracotta',
      nameRu: 'Терракота',
      category: 'clay',
      template: 'terracotta',
      palette: parsePalette(['#7a3726', '#8e432f', '#a35039', '#b85e45', '#cb6d52', '#dc7d62']),
      accentPalette: parsePalette(['#572418', '#ec9379'])
    },
    mud: {
      id: 'mud',
      nameRu: 'Грязь',
      template: 'organic',
      palette: parsePalette(['#302c2e', '#3c3639', '#473f43', '#564b50', '#64585e', '#72656c'])
    },
    coarse_dirt: {
      id: 'coarse_dirt',
      nameRu: 'Каменистая земля',
      template: 'organic',
      palette: parsePalette(['#4b3524', '#5b422e', '#6d4e36', '#7d5c41', '#8d6a4c', '#9d7756']),
      accentPalette: parsePalette(['#5f5954', '#756f68', '#898279'])
    },
    rooted_dirt: {
      id: 'rooted_dirt',
      nameRu: 'Укоренившаяся земля',
      template: 'organic',
      palette: parsePalette(['#4e3623', '#5e432c', '#705036', '#815d40', '#90694a', '#9f7553']),
      accentPalette: parsePalette(['#a58763', '#b89973', '#cbb08b'])
    },
    podzol: {
      id: 'podzol',
      nameRu: 'Подзол',
      template: 'organic',
      palette: parsePalette(['#3d281a', '#4d3322', '#5d3f2a', '#6b4931', '#7b563a', '#8d6344']),
      accentPalette: parsePalette(['#362215', '#55371c', '#6e4a29', '#8a6038'])
    },
    mycelium: {
      id: 'mycelium',
      nameRu: 'Мицелий',
      template: 'organic',
      palette: parsePalette(['#49434b', '#57515b', '#68616d', '#79707e', '#8c8292', '#9c92a2']),
      accentPalette: parsePalette(['#726279', '#86748f', '#9c88a6', '#b29fbc'])
    },
    stone: {
      id: 'stone',
      nameRu: 'Камень',
      template: 'stone',
      palette: parsePalette(['#474747', '#585858', '#6b6b6b', '#7d7d7d', '#8f8f8f', '#a1a1a1', '#b3b3b3'])
    },
    andesite: {
      id: 'andesite',
      nameRu: 'Андезит',
      template: 'stone',
      palette: parsePalette(['#505052', '#616164', '#737376', '#848488', '#96969a', '#a7a7ab'])
    },
    granite: {
      id: 'granite',
      nameRu: 'Гранит',
      template: 'stone',
      palette: parsePalette(['#66433a', '#7b5247', '#8f6256', '#a27266', '#b38175', '#c49286']),
      accentPalette: parsePalette(['#4a312a', '#d7aaa0', '#eed2cb'])
    },
    diorite: {
      id: 'diorite',
      nameRu: 'Диорит',
      template: 'stone',
      palette: parsePalette(['#868688', '#9c9c9f', '#b0b0b3', '#c5c5c8', '#d8d8db', '#ebebef']),
      accentPalette: parsePalette(['#3f3f42', '#525255', '#66666a'])
    },
    deepslate: {
      id: 'deepslate',
      nameRu: 'Глубинный сланец',
      template: 'layered',
      palette: parsePalette(['#212126', '#2d2d34', '#393941', '#474751', '#545460', '#636371'])
    },
    sandstone: {
      id: 'sandstone',
      nameRu: 'Песчаник',
      template: 'layered',
      palette: parsePalette(['#b8a472', '#c8b582', '#d5c392', '#dfd0a2', '#ebdcb3', '#f6e8c4']),
      accentPalette: parsePalette(['#a49163', '#907e54'])
    },
    red_sandstone: {
      id: 'red_sandstone',
      nameRu: 'Красный песчаник',
      template: 'layered',
      palette: parsePalette(['#873917', '#9c441c', '#b05022', '#bf5e2b', '#cd6e37', '#da7e46']),
      accentPalette: parsePalette(['#6f2d10', '#5a240c'])
    },
    cobblestone: {
      id: 'cobblestone',
      nameRu: 'Булыжник',
      category: 'stone',
      template: 'cobblestone',
      palette: parsePalette(['#37373a', '#49494d', '#5c5c61', '#717177', '#86868d', '#9d9da5']),
      accentPalette: parsePalette(['#262628', '#afafb8'])
    },
    bricks: {
      id: 'bricks',
      nameRu: 'Кирпич',
      category: 'stone',
      template: 'brick',
      palette: parsePalette(['#6d281e', '#823326', '#993f2f', '#af4e3b', '#c45f49', '#d8735c']),
      accentPalette: parsePalette(['#3a2824', '#7b6a65'])
    },
    planks: {
      id: 'planks',
      nameRu: 'Доски',
      category: 'wood',
      template: 'wood_planks',
      palette: parsePalette(['#5b3f29', '#715035', '#876242', '#9d744f', '#b3865d', '#c8996e']),
      accentPalette: parsePalette(['#3a2617', '#26190e'])
    },
    wood_log_side: {
      id: 'wood_log_side',
      nameRu: 'Дерево (бок)',
      category: 'wood',
      template: 'wood_log_side',
      palette: parsePalette(['#38291a', '#493724', '#5c462f', '#6f563a', '#826747', '#957854']),
      accentPalette: parsePalette(['#251a10', '#1b130b'])
    },
    wood_log_top: {
      id: 'wood_log_top',
      nameRu: 'Дерево (срез)',
      category: 'wood',
      template: 'wood_log_top',
      palette: parsePalette(['#795e3c', '#907148', '#a78456', '#bd9764', '#d2ab74', '#e5be85']),
      accentPalette: parsePalette(['#38291a', '#493724', '#251a10'])
    }
  };

  // --- 5. Template Generators with Dynamic fBm & Domain Warping ---
  function generateGranular(blockDef, prng, w = 16, h = 16, params = {}) {
    const {
      octaves = 3,
      warpStrength = 0.5,
      scale = 1.0,
      ditherStrength = 1.0,
      lightStrength = 1.0
    } = params;

    const isGravel = blockDef.id === 'gravel';
    const isClay = blockDef.id === 'clay';

    const warp = new ToroidalDomainWarp(prng);
    const baseFbm = new ToroidalFBM(prng, octaves, 2, 0.5);

    const heightMap = createGrid(w, h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const warped = warp.warp(x * scale, y * scale, warpStrength, 16);
        const macro = baseFbm.sample(warped.x, warped.y, 16);

        let pixelNoise = 0;
        if (isGravel) {
          pixelNoise = prng.range(-0.35, 0.35) + ((x + y) % 2 === 0 ? 0.08 : -0.08);
        } else if (isClay) {
          pixelNoise = prng.range(-0.12, 0.12);
        } else {
          pixelNoise = prng.range(-0.25, 0.25) + ((x * 3 + y * 7) % 5 - 2) * 0.04;
        }

        heightMap[y][x] = macro * 0.6 + pixelNoise * 0.4 + 0.5;
      }
    }

    const baseLight = isClay ? 0.18 : (isGravel ? 0.35 : 0.25);
    const litMap = applyDirectionalLighting(heightMap, baseLight * lightStrength, w, h);

    const baseDither = isGravel ? 0.16 : 0.12;
    return normalizeAndMapToPalette(litMap, blockDef.palette, {
      w,
      h,
      prng,
      pixelJitter: (isGravel ? 0.14 : (isClay ? 0.06 : 0.10)) * ditherStrength,
      ditherStrength: baseDither * ditherStrength,
      contrast: isGravel ? 1.15 : 1.0
    });
  }

  function generateOrganic(blockDef, prng, w = 16, h = 16, params = {}) {
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

    const warp = new ToroidalDomainWarp(prng);
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

    const litMap = applyDirectionalLighting(heightMap, 0.28 * lightStrength, w, h);

    const pixels = normalizeAndMapToPalette(litMap, blockDef.palette, {
      w,
      h,
      prng,
      pixelJitter: 0.12 * ditherStrength,
      ditherStrength: 0.14 * ditherStrength,
      contrast: 1.05
    });

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

  function generateStone(blockDef, prng, w = 16, h = 16, params = {}) {
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

    const warp = new ToroidalDomainWarp(prng);
    const fbm = new ToroidalFBM(prng, octaves, 2, 0.5);

    const cellCount = isDiorite ? 12 : (isGranite ? 10 : 8);
    const worley = new ToroidalWorley(prng, cellCount, 16);

    const heightMap = createGrid(w, h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const warped = warp.warp(x * scale, y * scale, warpStrength, 16);
        const macro = fbm.sample(warped.x, warped.y, 16);
        const cell = worley.sample(warped.x, warped.y, 'manhattan');

        const pixelNoise = prng.range(-0.32, 0.32);
        const microPattern = ((x * 5 + y * 11) % 7 - 3) * 0.04;
        const edgeDepth = Math.min(1.0, cell.edge * 0.6);

        heightMap[y][x] = macro * 0.35 + cell.val * 0.25 + edgeDepth * 0.15 + (pixelNoise + microPattern) * 0.25;
      }
    }

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

    const litMap = applyDirectionalLighting(heightMap, 0.32 * lightStrength, w, h);

    const pixels = normalizeAndMapToPalette(litMap, blockDef.palette, {
      w,
      h,
      prng,
      pixelJitter: (isAndesite ? 0.16 : 0.12) * ditherStrength,
      ditherStrength: (isAndesite ? 0.18 : 0.14) * ditherStrength,
      contrast: 1.10
    });

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

  function generateLayered(blockDef, prng, w = 16, h = 16, params = {}) {
    const {
      octaves = 3,
      warpStrength = 0.5,
      scale = 1.0,
      ditherStrength = 1.0,
      lightStrength = 1.0
    } = params;

    const isDeepslate = blockDef.id === 'deepslate';
    const layerFreq = isDeepslate ? 4 : 3;
    const heightMap = createGrid(w, h);

    const warp = new ToroidalDomainWarp(prng);
    const warpNoise = new ToroidalFBM(prng, octaves, 4, 0.5);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const warpedCoord = warp.warp(x * scale, y * scale, warpStrength, 16);
        const warpVal = (warpNoise.sample(warpedCoord.x, warpedCoord.y, 16) - 0.5) * 1.8;
        const effectiveY = (y + warpVal + h) % h;

        const phase = (effectiveY / h) * (Math.PI * 2 * layerFreq);
        const layerWave = Math.sin(phase) * 0.5 + 0.5;

        const grain = prng.range(-0.25, 0.25);
        const horizontalChatter = ((x % 2 === 0 ? 0.08 : -0.08) + (y % 2 === 0 ? 0.04 : -0.04));

        heightMap[y][x] = layerWave * 0.5 + 0.25 + (grain + horizontalChatter) * 0.35;
      }
    }

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

    const baseLight = isDeepslate ? 0.35 : 0.25;
    const litMap = applyDirectionalLighting(heightMap, baseLight * lightStrength, w, h);

    const pixels = normalizeAndMapToPalette(litMap, blockDef.palette, {
      w,
      h,
      prng,
      pixelJitter: 0.12 * ditherStrength,
      ditherStrength: 0.15 * ditherStrength,
      contrast: 1.10
    });

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

  function generateCobblestone(blockDef, prng, w = 16, h = 16, params = {}) {
    const {
      octaves = 3,
      warpStrength = 0.5,
      scale = 1.0,
      ditherStrength = 1.0,
      lightStrength = 1.0
    } = params;

    const warp = new ToroidalDomainWarp(prng);
    const fbm = new ToroidalFBM(prng, octaves, 4, 0.5);
    const worley = new ToroidalWorley(prng, 9, 16);
    const heightMap = createGrid(w, h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const warped = warp.warp(x * scale, y * scale, warpStrength * 0.7, 16);
        const cell = worley.sample(warped.x, warped.y, 'euclidean');
        const macro = fbm.sample(warped.x, warped.y, 16);

        const stoneDome = Math.min(1.0, cell.edge * 1.1);
        const isMortarSeam = cell.edge < 0.85 ? 0.35 : 0;

        const pixelNoise = prng.range(-0.25, 0.25);
        heightMap[y][x] = stoneDome * 0.65 + macro * 0.20 + pixelNoise * 0.15 - isMortarSeam;
      }
    }

    const litMap = applyDirectionalLighting(heightMap, 0.38 * lightStrength, w, h);

    return normalizeAndMapToPalette(litMap, blockDef.palette, {
      w,
      h,
      prng,
      pixelJitter: 0.14 * ditherStrength,
      ditherStrength: 0.15 * ditherStrength,
      contrast: 1.15
    });
  }

  function generateWoodPlanks(blockDef, prng, w = 16, h = 16, params = {}) {
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
    const plankHeight = h / plankCount;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const localY = y % plankHeight;
        const warped = warp.warp(x * scale * 0.8, y * scale * 1.8, warpStrength * 0.4, 16);
        const fiber = fbm.sample(warped.x, warped.y, 16);

        const plankBevel = Math.sin((localY / plankHeight) * Math.PI) * 0.15;
        const grain = prng.range(-0.15, 0.15);

        heightMap[y][x] = fiber * 0.55 + plankBevel + grain * 0.3 + 0.35;
      }
    }

    for (let p = 0; p < plankCount; p++) {
      const seamY = Math.floor(p * plankHeight);
      for (let x = 0; x < w; x++) {
        setWrapped(heightMap, x, seamY, getWrapped(heightMap, x, seamY, w, h) - 0.45, w, h);
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

  function generateLogSide(blockDef, prng, w = 16, h = 16, params = {}) {
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

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const warped = warp.warp(x * scale * 1.5, y * scale * 0.35, warpStrength * 0.6, 16);
        const barkWave = fbm.sample(warped.x, warped.y, 16);

        const verticalStripe = Math.sin(warped.x * (Math.PI * 2 / 16) * 3) * 0.25;
        const pixelNoise = prng.range(-0.25, 0.25);

        heightMap[y][x] = barkWave * 0.45 + verticalStripe + pixelNoise * 0.3 + 0.4;
      }
    }

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

  function generateLogTop(blockDef, prng, w = 16, h = 16, params = {}) {
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

        const warped = warp.warp(x * scale, y * scale, warpStrength * 0.7, 16);
        const ringNoise = (fbm.sample(warped.x, warped.y, 16) - 0.5) * 1.6;
        const ringDist = dist + ringNoise;

        const ringFreq = 2.4;
        const ringWave = Math.sin(ringDist * ringFreq) * 0.3;

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

  function generateBrick(blockDef, prng, w = 16, h = 16, params = {}) {
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

    const brickShifts = [];
    for (let b = 0; b < 8; b++) {
      brickShifts.push(prng.range(-0.16, 0.16));
    }

    const isMortarMap = [];
    for (let y = 0; y < h; y++) {
      isMortarMap.push(new Uint8Array(w));
    }

    for (let y = 0; y < h; y++) {
      const row = Math.floor(y / 4);
      const localY = y % 4;
      const isMortarH = (localY === 3);
      const colShift = (row % 2 === 1) ? 4 : 0;

      for (let x = 0; x < w; x++) {
        const shiftedX = (x - colShift + w) % w;
        const localX = shiftedX % 8;
        const isMortarV = (localX === 7);

        const isMortar = isMortarH || isMortarV;
        isMortarMap[y][x] = isMortar ? 1 : 0;

        if (isMortar) {
          const mortarGrain = prng.range(-0.06, 0.06);
          heightMap[y][x] = 0.12 + mortarGrain;
        } else {
          const brickCol = Math.floor(shiftedX / 8);
          const brickIdx = (row * 2 + brickCol) % 8;
          const brickShift = brickShifts[brickIdx];

          const warped = warp.warp(x * scale, y * scale, warpStrength * 0.25, 16);
          const surfaceNoise = (fbm.sample(warped.x, warped.y, 16) - 0.5) * 0.25;
          const grain = prng.range(-0.08, 0.08);

          let bevel = 0;
          if (localY === 0) bevel += 0.22;
          if (localX === 0) bevel += 0.18;
          if (localY === 2) bevel -= 0.14;
          if (localX === 6) bevel -= 0.14;

          heightMap[y][x] = 0.62 + brickShift + bevel + surfaceNoise + grain;
        }
      }
    }

    const litMap = applyDirectionalLighting(heightMap, 0.35 * lightStrength, w, h);

    const pixels = normalizeAndMapToPalette(litMap, blockDef.palette, {
      w,
      h,
      prng,
      pixelJitter: 0.08 * ditherStrength,
      ditherStrength: 0.10 * ditherStrength,
      contrast: 1.15
    });

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

  function generateClay(blockDef, prng, w = 16, h = 16, params = {}) {
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
        const warped = warp.warp(x * scale, y * scale, warpStrength * 0.7, 16);
        const smoothWave = fbm.sample(warped.x, warped.y, 16);
        const fineGrain = prng.range(-0.10, 0.10);

        heightMap[y][x] = smoothWave * 0.7 + fineGrain * 0.3 + 0.5;
      }
    }

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

  function generateTerracotta(blockDef, prng, w = 16, h = 16, params = {}) {
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
        const warped = warp.warp(x * scale * 0.9, y * scale * 1.3, warpStrength * 0.6, 16);
        const macro = fbm.sample(warped.x, warped.y, 16);
        const pugWave = Math.sin((warped.y / 16) * Math.PI * 4) * 0.12;
        const fineDust = prng.range(-0.14, 0.14);

        heightMap[y][x] = macro * 0.6 + pugWave + fineDust * 0.28 + 0.5;
      }
    }

    const litMap = applyDirectionalLighting(heightMap, 0.25 * lightStrength, w, h);

    const pixels = normalizeAndMapToPalette(litMap, blockDef.palette, {
      w,
      h,
      prng,
      pixelJitter: 0.08 * ditherStrength,
      ditherStrength: 0.12 * ditherStrength,
      contrast: 1.06
    });

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

  const TEMPLATE_GENERATORS = {
    granular: generateGranular,
    organic: generateOrganic,
    stone: generateStone,
    layered: generateLayered,
    cobblestone: generateCobblestone,
    brick: generateBrick,
    clay: generateClay,
    terracotta: generateTerracotta,
    wood_planks: generateWoodPlanks,
    wood_log_side: generateLogSide,
    wood_log_top: generateLogTop
  };

  // --- 6. Browser Canvas Renderer ---
  const sharedCanvas = document.createElement('canvas');
  sharedCanvas.width = 16;
  sharedCanvas.height = 16;
  const sharedCtx = sharedCanvas.getContext('2d');

  function renderGridToPngDataUrl(pixelGrid, w = 16, h = 16) {
    const imgData = sharedCtx.createImageData(w, h);
    let ptr = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = pixelGrid[y][x];
        imgData.data[ptr++] = p.r;
        imgData.data[ptr++] = p.g;
        imgData.data[ptr++] = p.b;
        imgData.data[ptr++] = p.a !== undefined ? p.a : 255;
      }
    }
    sharedCtx.putImageData(imgData, 0, 0);
    return sharedCanvas.toDataURL('image/png');
  }

  // --- 7. State & Noise Parameters Controller ---
  const generatedStore = new Map();
  let activeTileData = null;
  let currentAtlasTiles = [];

  // Текущие настраиваемые параметры генератора
  const currentParams = {
    octaves: 3,
    warpStrength: 0.5,
    scale: 1.0,
    ditherStrength: 1.0,
    lightStrength: 1.0
  };

  function parseSeedValue(input) {
    const trimmed = String(input).trim();
    if (/^-?\\d+$/.test(trimmed)) {
      return parseInt(trimmed, 10);
    }
    return PRNG.hashString(trimmed || '1337');
  }

  // Обновление счетчика выбранных чекбоксов для атласа
  window.updateAtlasCounter = function() {
    const allChecked = document.querySelectorAll('.variant-checkbox:checked');
    const totalSelected = allChecked.length;
    const badge = document.getElementById('atlasSelectedCount');
    if (badge) badge.textContent = totalSelected;
    
    const countBadge = document.getElementById('atlasCountBadge');
    if (countBadge) {
      if (totalSelected === 64) {
        countBadge.className = 'badge badge-success atlas-counter-pill';
        countBadge.title = 'Ровно 64 текстуры: идеально для сетки 8x8!';
      } else if (totalSelected > 64) {
        countBadge.className = 'badge badge-warning atlas-counter-pill';
        countBadge.title = 'Выбрано больше 64: в атлас 8x8 попадут первые 64';
      } else {
        countBadge.className = 'badge badge-accent atlas-counter-pill';
        countBadge.title = 'Сетка 8x8 вмещает до 64 блоков';
      }
    }
  };

  window.selectAllVariants = function(shouldSelect) {
    const checkboxes = document.querySelectorAll('.variant-checkbox');
    checkboxes.forEach(cb => { cb.checked = !!shouldSelect; });
    window.updateAtlasCounter();
    window.showToast(shouldSelect ? '✓ Отмечены все текстуры' : '✕ Все отметки сняты');
  };

  window.selectFirst64Variants = function() {
    const checkboxes = document.querySelectorAll('.variant-checkbox');
    checkboxes.forEach((cb, idx) => {
      cb.checked = idx < 64;
    });
    window.updateAtlasCounter();
    window.showToast('⭐ Выбрано ровно 64 текстуры (для сетки 8×8)');
  };

  window.selectOnePerBlock = function() {
    const checkboxes = document.querySelectorAll('.variant-checkbox');
    checkboxes.forEach(cb => {
      const v = cb.getAttribute('data-var');
      cb.checked = (v === '1');
    });
    window.updateAtlasCounter();
    window.showToast('1️⃣ Выбран первый вариант каждого материала (' + Object.keys(BLOCKS).length + ' блоков)');
  };

  window.toggleAllCategories = function(openState) {
    const sections = document.querySelectorAll('details.category-section');
    sections.forEach(s => { s.open = !!openState; });
    window.showToast(openState ? '⊞ Все категории развернуты' : '⊟ Все категории свернуты');
  };

  // Чтение параметров из UI ползунков
  function readParamsFromUi() {
    const oct = document.getElementById('paramOctaves');
    const warp = document.getElementById('paramWarp');
    const scale = document.getElementById('paramScale');
    const dither = document.getElementById('paramDither');
    const light = document.getElementById('paramLight');

    if (oct) currentParams.octaves = parseInt(oct.value, 10) || 3;
    if (warp) currentParams.warpStrength = parseFloat(warp.value) ?? 0.5;
    if (scale) currentParams.scale = parseFloat(scale.value) ?? 1.0;
    if (dither) currentParams.ditherStrength = parseFloat(dither.value) ?? 1.0;
    if (light) currentParams.lightStrength = parseFloat(light.value) ?? 1.0;

    // Обновляем текстовые значения возле ползунков
    const valOct = document.getElementById('valOctaves');
    if (valOct) valOct.textContent = currentParams.octaves;

    const valWarp = document.getElementById('valWarp');
    if (valWarp) valWarp.textContent = currentParams.warpStrength.toFixed(1);

    const valScale = document.getElementById('valScale');
    if (valScale) valScale.textContent = currentParams.scale.toFixed(1) + 'x';

    const valDither = document.getElementById('valDither');
    if (valDither) valDither.textContent = currentParams.ditherStrength.toFixed(1) + 'x';

    const valLight = document.getElementById('valLight');
    if (valLight) valLight.textContent = currentParams.lightStrength.toFixed(1) + 'x';
  }

  // Применение пресетов шума
  window.applyNoisePreset = function(name) {
    const presets = {
      balanced: { octaves: 3, warp: 0.5, scale: 1.0, dither: 1.0, light: 1.0, label: 'Стандартный (Balanced)' },
      warp:     { octaves: 4, warp: 1.5, scale: 1.2, dither: 0.8, light: 1.1, label: 'Завихрения (Warped Flow)' },
      sharp:    { octaves: 4, warp: 0.0, scale: 1.4, dither: 1.3, light: 1.3, label: 'Кристалл (Sharp / 0 Warp)' },
      smooth:   { octaves: 2, warp: 0.2, scale: 0.8, dither: 0.4, light: 0.7, label: 'Мягкий (Smooth)' },
      retro:    { octaves: 3, warp: 0.4, scale: 1.0, dither: 1.8, light: 1.2, label: 'Ретро 8-бит (Heavy Dither)' }
    };

    const p = presets[name] || presets.balanced;

    const elOct = document.getElementById('paramOctaves');
    const elWarp = document.getElementById('paramWarp');
    const elScale = document.getElementById('paramScale');
    const elDither = document.getElementById('paramDither');
    const elLight = document.getElementById('paramLight');

    if (elOct) elOct.value = p.octaves;
    if (elWarp) elWarp.value = p.warp;
    if (elScale) elScale.value = p.scale;
    if (elDither) elDither.value = p.dither;
    if (elLight) elLight.value = p.light;

    readParamsFromUi();
    window.triggerGenerate();
    window.showToast('Пресет применен: ' + p.label);
  };

  // Живое обновление при движении ползунка с дебаунсом
  let paramDebounceTimer = null;
  window.onNoiseParamChange = function() {
    readParamsFromUi();
    if (paramDebounceTimer) clearTimeout(paramDebounceTimer);
    paramDebounceTimer = setTimeout(() => {
      window.triggerGenerate();
    }, 45);
  };

  // Переключение панели настроек шума
  window.toggleSettingsPanel = function() {
    const panel = document.getElementById('advancedSettingsDrawer');
    const toggleBtn = document.getElementById('toggleSettingsBtn');
    if (!panel) return;
    const isHidden = panel.classList.contains('collapsed');
    if (isHidden) {
      panel.classList.remove('collapsed');
      if (toggleBtn) toggleBtn.classList.add('active');
    } else {
      panel.classList.add('collapsed');
      if (toggleBtn) toggleBtn.classList.remove('active');
    }
  };

  // Выполнение генерации
  function executeGeneration(seedInput, variantsCount = 5) {
    const startTime = performance.now();
    const seed = parseSeedValue(seedInput);
    const blocksList = Object.values(BLOCKS);

    readParamsFromUi();

    const previouslyChecked = new Set();
    document.querySelectorAll('.variant-checkbox:checked').forEach(cb => {
      previouslyChecked.add(cb.getAttribute('data-block-id') + '_' + cb.getAttribute('data-var'));
    });
    const hadAnySelections = previouslyChecked.size > 0;

    let totalTextures = 0;

    for (let bIndex = 0; bIndex < blocksList.length; bIndex++) {
      const block = blocksList[bIndex];
      const genFn = TEMPLATE_GENERATORS[block.template];
      if (!genFn) continue;

      const cardContainer = document.getElementById('variantsRow_' + block.id);
      if (!cardContainer) continue;

      if (cardContainer.children.length !== variantsCount) {
        cardContainer.innerHTML = '';
        for (let v = 1; v <= variantsCount; v++) {
          const item = document.createElement('div');
          item.className = 'variant-item';
          item.id = 'varItem_' + block.id + '_' + v;
          item.onclick = () => window.inspectTileByKey(block.id, v);

          const topBar = document.createElement('div');
          topBar.className = 'variant-top-bar';
          topBar.onclick = (e) => e.stopPropagation();

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'variant-checkbox';
          checkbox.id = 'chk_' + block.id + '_' + v;
          checkbox.setAttribute('data-block-id', block.id);
          checkbox.setAttribute('data-var', String(v));
          checkbox.checked = hadAnySelections ? previouslyChecked.has(block.id + '_' + v) : true;
          checkbox.onchange = () => window.updateAtlasCounter();
          checkbox.title = 'Включить этот вариант в текстурный атлас';

          const label = document.createElement('span');
          label.className = 'v-label';
          label.textContent = '#' + v;

          topBar.appendChild(checkbox);
          topBar.appendChild(label);

          const img = document.createElement('img');
          img.className = 'pixel-art';
          img.id = 'varImg_' + block.id + '_' + v;
          img.alt = block.nameRu + ' #' + v;

          item.appendChild(topBar);
          item.appendChild(img);
          cardContainer.appendChild(item);
        }
      }

      for (let v = 1; v <= variantsCount; v++) {
        const subSeed = (seed + bIndex * 1000 + v * 13) >>> 0;
        const prng = new PRNG(subSeed);

        // Генерация с учетом fBm октав, Domain Warping, дизеринга и освещения
        const grid = genFn(block, prng, 16, 16, currentParams);
        const dataUrl = renderGridToPngDataUrl(grid, 16, 16);

        const key = block.id + '_' + v;
        generatedStore.set(key, {
          grid,
          dataUrl,
          blockName: block.nameRu,
          blockId: block.id,
          varIndex: v
        });

        const imgEl = document.getElementById('varImg_' + block.id + '_' + v);
        if (imgEl) {
          imgEl.src = dataUrl;
        }

        totalTextures++;
      }
    }

    const elapsed = Math.round(performance.now() - startTime);

    const seedBadge = document.getElementById('activeSeedBadge');
    if (seedBadge) seedBadge.textContent = seedInput;

    const variantsBadge = document.getElementById('activeVariantsBadge');
    if (variantsBadge) variantsBadge.textContent = variantsCount;

    const totalBadge = document.getElementById('totalTexturesBadge');
    if (totalBadge) totalBadge.textContent = totalTextures;

    const statusBadge = document.getElementById('statusBadge');
    if (statusBadge) {
      statusBadge.textContent = '✓ ' + totalTextures + ' текстур (' + elapsed + ' мс)';
      statusBadge.className = 'badge badge-success';
    }

    window.updateAtlasCounter();

    if (activeTileData && document.getElementById('modalBackdrop').style.display === 'flex') {
      const refreshed = generatedStore.get(activeTileData.blockId + '_' + activeTileData.varIndex);
      if (refreshed) {
        window.inspectTile(refreshed.dataUrl, refreshed.blockName + ' (Вариант ' + refreshed.varIndex + ')', refreshed.blockId, refreshed.varIndex);
      }
    }

    const atlasModal = document.getElementById('atlasModalBackdrop');
    if (atlasModal && atlasModal.style.display === 'flex') {
      window.renderAtlasCanvas();
    }

    return { seed, totalTextures, elapsed };
  }

  // --- 8. Текстурный атлас 8x8 (128x128 px) ---
  window.renderAtlasCanvas = function() {
    const canvas = document.getElementById('atlasCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = 128;
    canvas.height = 128;

    ctx.clearRect(0, 0, 128, 128);

    const checkedCheckboxes = Array.from(document.querySelectorAll('.variant-checkbox:checked'));
    currentAtlasTiles = [];

    const maxSlots = 64;
    const tilesToRender = checkedCheckboxes.slice(0, maxSlots);

    tilesToRender.forEach((cb, idx) => {
      const blockId = cb.getAttribute('data-block-id');
      const varIndex = parseInt(cb.getAttribute('data-var'), 10);
      const key = blockId + '_' + varIndex;
      const item = generatedStore.get(key);

      if (item && item.grid) {
        const col = idx % 8;
        const row = Math.floor(idx / 8);
        const startX = col * 16;
        const startY = row * 16;

        const tileImgData = ctx.createImageData(16, 16);
        let ptr = 0;
        for (let ty = 0; ty < 16; ty++) {
          for (let tx = 0; tx < 16; tx++) {
            const px = item.grid[ty][tx];
            tileImgData.data[ptr++] = px.r;
            tileImgData.data[ptr++] = px.g;
            tileImgData.data[ptr++] = px.b;
            tileImgData.data[ptr++] = px.a !== undefined ? px.a : 255;
          }
        }
        ctx.putImageData(tileImgData, startX, startY);

        currentAtlasTiles.push({
          index: idx,
          col,
          row,
          blockId: item.blockId,
          blockName: item.blockName,
          varIndex: item.varIndex
        });
      }
    });

    const subtext = document.getElementById('atlasModalSubtext');
    if (subtext) {
      if (checkedCheckboxes.length > 64) {
        subtext.innerHTML = 'Заполнено <b>64 из 64</b> слотов (первые 64 из ' + checkedCheckboxes.length + ' отмеченных). Размер: <b>128×128 px</b>.';
      } else {
        subtext.innerHTML = 'Заполнено <b>' + tilesToRender.length + ' из 64</b> слотов сетки 8×8 (128×128 px).';
      }
    }
  };

  window.openAtlasModal = function() {
    const checkedCount = document.querySelectorAll('.variant-checkbox:checked').length;
    if (checkedCount === 0) {
      window.showToast('⚠️ Отметьте галочками хотя бы один вариант блока!');
      return;
    }

    window.renderAtlasCanvas();

    const backdrop = document.getElementById('atlasModalBackdrop');
    if (backdrop) backdrop.style.display = 'flex';
  };

  window.closeAtlasModal = function() {
    const backdrop = document.getElementById('atlasModalBackdrop');
    if (backdrop) backdrop.style.display = 'none';
  };

  window.toggleAtlasGrid = function(checked) {
    const overlay = document.getElementById('atlasGridOverlay');
    if (!overlay) return;
    if (checked) {
      overlay.classList.add('show-grid');
    } else {
      overlay.classList.remove('show-grid');
    }
  };

  window.changeAtlasZoom = function(scaleFactor) {
    const canvas = document.getElementById('atlasCanvas');
    const overlay = document.getElementById('atlasGridOverlay');
    const wrapper = document.getElementById('atlasWrapper');
    if (!canvas || !wrapper) return;

    const pxSize = 128 * scaleFactor;
    canvas.style.width = pxSize + 'px';
    canvas.style.height = pxSize + 'px';
    if (overlay) {
      overlay.style.width = pxSize + 'px';
      overlay.style.height = pxSize + 'px';
    }
    wrapper.style.width = pxSize + 'px';
    wrapper.style.height = pxSize + 'px';
  };

  // Сохранение с выбором пути (File System Access API)
  window.saveAtlasToFilePicker = async function() {
    const canvas = document.getElementById('atlasCanvas');
    if (!canvas) return;

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

    if ('showSaveFilePicker' in window) {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: 'texture_atlas_8x8.png',
          types: [{
            description: 'PNG Image (*.png)',
            accept: {
              'image/png': ['.png']
            }
          }]
        });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        window.showToast('✓ Атлас успешно сохранён по выбранному пути!');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.warn('showSaveFilePicker error, fallback to direct download:', err);
      }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'texture_atlas_8x8.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    window.showToast('✓ Атлас сохранён в папку загрузок (texture_atlas_8x8.png)');
  };

  window.quickDownloadAtlas = function() {
    const canvas = document.getElementById('atlasCanvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'texture_atlas_8x8.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.showToast('✓ Атлас скачан (texture_atlas_8x8.png)');
  };

  let toastTimeout = null;
  window.showToast = function(msg) {
    const toast = document.getElementById('toastNotification');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('visible');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('visible');
    }, 2400);
  };

  // --- 9. Инспектор тайлинга 3x3 ---
  window.triggerGenerate = function() {
    const seedInput = document.getElementById('seedInput');
    const variantsSelect = document.getElementById('variantsSelect');
    const genBtn = document.getElementById('generateBtn');

    if (!seedInput) return;

    const seedVal = seedInput.value.trim() || '1337';
    const variantsCount = variantsSelect ? parseInt(variantsSelect.value, 10) || 5 : 5;

    if (genBtn) {
      genBtn.classList.add('btn-loading');
      genBtn.disabled = true;
    }

    setTimeout(() => {
      try {
        executeGeneration(seedVal, variantsCount);
      } finally {
        if (genBtn) {
          genBtn.classList.remove('btn-loading');
          genBtn.disabled = false;
        }
      }
    }, 10);
  };

  window.randomizeSeed = function() {
    const seedInput = document.getElementById('seedInput');
    if (!seedInput) return;
    const rand = Math.floor(Math.random() * 1000000);
    seedInput.value = rand;
    window.triggerGenerate();
  };

  window.inspectTileByKey = function(blockId, varIndex) {
    const item = generatedStore.get(blockId + '_' + varIndex);
    if (item) {
      window.inspectTile(item.dataUrl, item.blockName + ' (Вариант ' + item.varIndex + ')', item.blockId, item.varIndex);
    } else {
      const img = document.getElementById('varImg_' + blockId + '_' + varIndex);
      if (img) {
        window.inspectTile(img.src, 'Блок ' + blockId + ' (Вариант ' + varIndex + ')', blockId, varIndex);
      }
    }
  };

  window.inspectTile = function(imgSrc, title, blockId, varIndex) {
    activeTileData = { imgSrc, title, blockId, varIndex };
    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.textContent = title + ' — Проверка тайлинга 3x3';

    const canvas = document.getElementById('tilingCanvas');
    if (canvas) {
      canvas.innerHTML = '';
      for (let i = 0; i < 9; i++) {
        const img = document.createElement('img');
        img.src = imgSrc;
        img.alt = 'tile';
        canvas.appendChild(img);
      }
    }

    const downloadBtn = document.getElementById('modalDownloadBtn');
    if (downloadBtn) {
      downloadBtn.onclick = () => {
        const link = document.createElement('a');
        link.download = (blockId || 'texture') + '_var' + (varIndex || 1) + '.png';
        link.href = imgSrc;
        link.click();
      };
    }

    const backdrop = document.getElementById('modalBackdrop');
    if (backdrop) backdrop.style.display = 'flex';
  };

  window.closeModal = function() {
    const backdrop = document.getElementById('modalBackdrop');
    if (backdrop) backdrop.style.display = 'none';
  };

  window.toggleGrid = function(checked) {
    const canvas = document.getElementById('tilingCanvas');
    if (!canvas) return;
    if (checked) {
      canvas.classList.add('show-grid');
    } else {
      canvas.classList.remove('show-grid');
    }
  };

  window.changeZoom = function(scalePercent) {
    const canvas = document.getElementById('tilingCanvas');
    if (!canvas) return;
    const tilePx = Math.round(16 * (scalePercent / 100));
    canvas.style.gridTemplateColumns = 'repeat(3, ' + tilePx + 'px)';
    canvas.style.gridTemplateRows = 'repeat(3, ' + tilePx + 'px)';
    canvas.style.width = (tilePx * 3) + 'px';
    canvas.style.height = (tilePx * 3) + 'px';
    const images = canvas.querySelectorAll('img');
    images.forEach(img => {
      img.style.width = tilePx + 'px';
      img.style.height = tilePx + 'px';
    });
  };

  window.downloadBlockVariants = function(blockId) {
    const variantsSelect = document.getElementById('variantsSelect');
    const variantsCount = variantsSelect ? parseInt(variantsSelect.value, 10) || 5 : 5;
    for (let v = 1; v <= variantsCount; v++) {
      const item = generatedStore.get(blockId + '_' + v);
      if (item) {
        const link = document.createElement('a');
        link.download = blockId + '_var' + v + '.png';
        link.href = item.dataUrl;
        link.click();
      }
    }
    window.showToast('✓ Варианты блока скачаны');
  };

  // --- 10. Инициализация при загрузке ---
  window.addEventListener('DOMContentLoaded', () => {
    const seedInput = document.getElementById('seedInput');
    const genBtn = document.getElementById('generateBtn');
    const randBtn = document.getElementById('randomSeedBtn');
    const varSelect = document.getElementById('variantsSelect');

    if (seedInput) {
      seedInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          window.triggerGenerate();
        }
      });
    }

    if (genBtn) genBtn.addEventListener('click', window.triggerGenerate);
    if (randBtn) randBtn.addEventListener('click', window.randomizeSeed);
    if (varSelect) varSelect.addEventListener('change', window.triggerGenerate);

    // Слушатели ползунков шума
    ['paramOctaves', 'paramWarp', 'paramScale', 'paramDither', 'paramLight'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', window.onNoiseParamChange);
      }
    });

    const atlasWrapper = document.getElementById('atlasWrapper');
    const atlasTooltip = document.getElementById('atlasHoverTooltip');
    if (atlasWrapper && atlasTooltip) {
      atlasWrapper.addEventListener('mousemove', (e) => {
        const rect = atlasWrapper.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        if (mouseX < 0 || mouseY < 0 || mouseX > rect.width || mouseY > rect.height) return;

        const col = Math.floor((mouseX / rect.width) * 8);
        const row = Math.floor((mouseY / rect.height) * 8);
        const slotIdx = row * 8 + col;

        const tile = currentAtlasTiles[slotIdx];
        if (tile) {
          atlasTooltip.innerHTML = 'Слот <b>[' + (col + 1) + ', ' + (row + 1) + ']</b> (№' + (slotIdx + 1) + '): <b>' + tile.blockName + '</b> (Вариант #' + tile.varIndex + ')';
        } else {
          atlasTooltip.innerHTML = 'Слот <b>[' + (col + 1) + ', ' + (row + 1) + ']</b> (№' + (slotIdx + 1) + '): <i>Пусто</i>';
        }
      });

      atlasWrapper.addEventListener('mouseleave', () => {
        atlasTooltip.innerHTML = 'Наведите курсор на слот для информации о блоке';
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.closeModal();
        window.closeAtlasModal();
      }
      if ((e.key === 'r' || e.key === 'к' || e.key === 'R' || e.key === 'К') && document.activeElement !== seedInput) {
        window.randomizeSeed();
      }
    });

    readParamsFromUi();

    const initialSeed = seedInput ? seedInput.value : '1337';
    const initialVariants = varSelect ? parseInt(varSelect.value, 10) || 5 : 5;
    executeGeneration(initialSeed, initialVariants);
  });
})();
`;
