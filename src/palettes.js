/**
 * Палитры для всех 16 блоков из blocks.md.
 * Каждая палитра строго содержит от 4 до 7 гармоничных, приглушенных оттенков,
 * отсортированных от глубокой тени к яркому блику с естественным цветовым сдвигом (hue shifting).
 */

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

function parsePalette(hexArray) {
  return hexArray.map(hexToRgb);
}

export const BLOCKS = {
  // --- СЫПУЧИЕ И ПЛАСТИЧНЫЕ МАТЕРИАЛЫ ---
  sand: {
    id: 'sand',
    nameRu: 'Песок',
    template: 'granular',
    // Тёплый золотисто-песочный градиент от охры до светлого крем-брюле
    palette: parsePalette([
      '#bca874',
      '#cbba85',
      '#d7c996',
      '#dfd5a5',
      '#e8e0b5',
      '#f2ebd0'
    ])
  },

  red_sand: {
    id: 'red_sand',
    nameRu: 'Красный песок',
    template: 'granular',
    // Терракотово-оранжевый, обожженная глина, пустынные дюны
    palette: parsePalette([
      '#8f4019',
      '#a54d20',
      '#b85b28',
      '#c86c34',
      '#d57e44',
      '#e09257'
    ])
  },

  gravel: {
    id: 'gravel',
    nameRu: 'Гравий',
    template: 'granular',
    // Каменистая смесь прохладных серых и серо-коричневых камешков
    palette: parsePalette([
      '#5c5757',
      '#6f6868',
      '#7e7776',
      '#8f8785',
      '#9f9794',
      '#b0a8a5'
    ])
  },

  clay: {
    id: 'clay',
    nameRu: 'Глина',
    template: 'granular',
    // Мягкий серо-голубоватый влажный оттенок
    palette: parsePalette([
      '#7f8897',
      '#8d96a5',
      '#99a3b2',
      '#a5b0bf',
      '#b2bccb',
      '#c2cad6'
    ])
  },

  // --- ОРГАНИКА И ЗЕМЛЯНЫЕ ПОРОДЫ ---
  mud: {
    id: 'mud',
    nameRu: 'Грязь',
    template: 'organic',
    // Темная, влажная, плотная жирная почва
    palette: parsePalette([
      '#302c2e',
      '#3c3639',
      '#473f43',
      '#564b50',
      '#64585e',
      '#72656c'
    ])
  },

  coarse_dirt: {
    id: 'coarse_dirt',
    nameRu: 'Каменистая земля',
    template: 'organic',
    // Сухая земля с каменистыми включениями
    palette: parsePalette([
      '#4b3524',
      '#5b422e',
      '#6d4e36',
      '#7d5c41',
      '#8d6a4c',
      '#9d7756'
    ]),
    accentPalette: parsePalette([
      '#5f5954',
      '#756f68',
      '#898279'
    ])
  },

  rooted_dirt: {
    id: 'rooted_dirt',
    nameRu: 'Укоренившаяся земля',
    template: 'organic',
    // Земля с бежево-светлыми прожилками корней
    palette: parsePalette([
      '#4e3623',
      '#5e432c',
      '#705036',
      '#815d40',
      '#90694a',
      '#9f7553'
    ]),
    accentPalette: parsePalette([
      '#a58763',
      '#b89973',
      '#cbb08b'
    ])
  },

  podzol: {
    id: 'podzol',
    nameRu: 'Подзол',
    template: 'organic',
    // Земляная основа с хвойно-коричневым перегноем и сухими ветками
    palette: parsePalette([
      '#3d281a',
      '#4d3322',
      '#5d3f2a',
      '#6b4931',
      '#7b563a',
      '#8d6344'
    ]),
    accentPalette: parsePalette([
      '#362215',
      '#55371c',
      '#6e4a29',
      '#8a6038'
    ])
  },

  mycelium: {
    id: 'mycelium',
    nameRu: 'Мицелий',
    template: 'organic',
    // Серо-фиолетовый споровый покров на темной земле
    palette: parsePalette([
      '#49434b',
      '#57515b',
      '#68616d',
      '#79707e',
      '#8c8292',
      '#9c92a2'
    ]),
    accentPalette: parsePalette([
      '#726279',
      '#86748f',
      '#9c88a6',
      '#b29fbc'
    ])
  },

  // --- КАМЕННЫЕ И МАГМАТИЧЕСКИЕ ПОРОДЫ ---
  stone: {
    id: 'stone',
    nameRu: 'Камень',
    template: 'stone',
    // Классический нейтральный серый со сбалансированным контрастом
    palette: parsePalette([
      '#474747',
      '#585858',
      '#6b6b6b',
      '#7d7d7d',
      '#8f8f8f',
      '#a1a1a1',
      '#b3b3b3'
    ])
  },

  andesite: {
    id: 'andesite',
    nameRu: 'Андезит',
    template: 'stone',
    // Более шероховатый, слегка теплый полевошпатный серый
    palette: parsePalette([
      '#505052',
      '#616164',
      '#737376',
      '#848488',
      '#96969a',
      '#a7a7ab'
    ])
  },

  granite: {
    id: 'granite',
    nameRu: 'Гранит',
    template: 'stone',
    // Розовато-терракотовая магматическая порода с кристаллами кварца
    palette: parsePalette([
      '#66433a',
      '#7b5247',
      '#8f6256',
      '#a27266',
      '#b38175',
      '#c49286'
    ]),
    accentPalette: parsePalette([
      '#4a312a',
      '#d7aaa0',
      '#eed2cb'
    ])
  },

  diorite: {
    id: 'diorite',
    nameRu: 'Диорит',
    template: 'stone',
    // Светлая порода с контрастными темными минеральными зернами
    palette: parsePalette([
      '#868688',
      '#9c9c9f',
      '#b0b0b3',
      '#c5c5c8',
      '#d8d8db',
      '#ebebef'
    ]),
    accentPalette: parsePalette([
      '#3f3f42',
      '#525255',
      '#66666a'
    ])
  },

  // --- СЛОИСТЫЕ ПОРОДЫ ---
  deepslate: {
    id: 'deepslate',
    nameRu: 'Глубинный сланец',
    template: 'layered',
    // Глубокий серо-синий метаморфический сланец с горизонтальными пластами
    palette: parsePalette([
      '#212126',
      '#2d2d34',
      '#393941',
      '#474751',
      '#545460',
      '#636371'
    ])
  },

  sandstone: {
    id: 'sandstone',
    nameRu: 'Песчаник',
    template: 'layered',
    // Спрессованные кремово-желтые осадочные слои
    palette: parsePalette([
      '#b8a472',
      '#c8b582',
      '#d5c392',
      '#dfd0a2',
      '#ebdcb3',
      '#f6e8c4'
    ]),
    accentPalette: parsePalette([
      '#a49163',
      '#907e54'
    ])
  },

  red_sandstone: {
    id: 'red_sandstone',
    nameRu: 'Красный песчаник',
    template: 'layered',
    // Слоистый терракотово-красный осадочный песчаник
    palette: parsePalette([
      '#873917',
      '#9c441c',
      '#b05022',
      '#bf5e2b',
      '#cd6e37',
      '#da7e46'
    ]),
    accentPalette: parsePalette([
      '#6f2d10',
      '#5a240c'
    ])
  }
};
