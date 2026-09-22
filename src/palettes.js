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

  // --- ГЛИНА И ТЕРРАКОТА ---
  clay: {
    id: 'clay',
    nameRu: 'Глина',
    category: 'clay',
    template: 'clay',
    // Мягкий серо-голубоватый влажный оттенок речной осадочной глины
    palette: parsePalette([
      '#6b7382',
      '#7c8494',
      '#8d96a6',
      '#9ea8b8',
      '#afb9c9',
      '#c2ccdb'
    ]),
    accentPalette: parsePalette([
      '#565e6c',
      '#d7e0ed'
    ])
  },

  terracotta: {
    id: 'terracotta',
    nameRu: 'Терракота',
    category: 'clay',
    template: 'terracotta',
    // Теплый матовый оттенок обожженной керамической глины
    palette: parsePalette([
      '#7a3726',
      '#8e432f',
      '#a35039',
      '#b85e45',
      '#cb6d52',
      '#dc7d62'
    ]),
    accentPalette: parsePalette([
      '#572418',
      '#ec9379'
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
    category: 'layered',
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
  },

  // --- КАМЕННАЯ КЛАДКА ---
  cobblestone: {
    id: 'cobblestone',
    nameRu: 'Булыжник',
    category: 'stone',
    template: 'cobblestone',
    // Сбалансированная серая палитра кладки: от глубокого шва до верхнего скола
    palette: parsePalette([
      '#37373a',
      '#49494d',
      '#5c5c61',
      '#717177',
      '#86868d',
      '#9d9da5'
    ]),
    accentPalette: parsePalette([
      '#262628',
      '#afafb8'
    ])
  },

  bricks: {
    id: 'bricks',
    nameRu: 'Кирпич',
    category: 'stone',
    template: 'brick',
    // Классический красный обожженный кирпич со светлыми фасками и темным швом
    palette: parsePalette([
      '#6d281e',
      '#823326',
      '#993f2f',
      '#af4e3b',
      '#c45f49',
      '#d8735c'
    ]),
    accentPalette: parsePalette([
      '#3a2824',
      '#7b6a65'
    ])
  },

  // --- ДРЕВЕСИНА И ПИЛОМАТЕРИАЛЫ ---
  planks: {
    id: 'planks',
    nameRu: 'Доски',
    category: 'wood',
    template: 'wood_planks',
    // Теплый дубовый оттенок с продольными волокнами
    palette: parsePalette([
      '#5b3f29',
      '#715035',
      '#876242',
      '#9d744f',
      '#b3865d',
      '#c8996e'
    ]),
    accentPalette: parsePalette([
      '#3a2617',
      '#26190e'
    ])
  },

  wood_log_side: {
    id: 'wood_log_side',
    nameRu: 'Дерево (бок)',
    category: 'wood',
    template: 'wood_log_side',
    // Выразительная вертикальная фактура дубовой коры
    palette: parsePalette([
      '#38291a',
      '#493724',
      '#5c462f',
      '#6f563a',
      '#826747',
      '#957854'
    ]),
    accentPalette: parsePalette([
      '#251a10',
      '#1b130b'
    ])
  },

  wood_log_top: {
    id: 'wood_log_top',
    nameRu: 'Дерево (срез)',
    category: 'wood',
    template: 'wood_log_top',
    // Светлая сердцевина со спила с годичными кольцами и темной внешней корой
    palette: parsePalette([
      '#795e3c',
      '#907148',
      '#a78456',
      '#bd9764',
      '#d2ab74',
      '#e5be85'
    ]),
    accentPalette: parsePalette([
      '#38291a',
      '#493724',
      '#251a10'
    ])
  }
};
