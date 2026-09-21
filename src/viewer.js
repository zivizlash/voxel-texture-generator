/**
 * Генератор HTML-витрины для визуальной проверки текстур и тайлинга 3x3.
 */

export function generateViewerHtml({ runDate, seed, blocksData }) {
  const categories = {
    granular: 'Сыпучие и пластичные материалы',
    organic: 'Органика и почвы',
    stone: 'Каменные и магматические породы',
    layered: 'Слоистые и спрессованные породы'
  };

  const categorized = {};
  for (const item of blocksData) {
    const cat = item.block.template || 'other';
    if (!categorized[cat]) categorized[cat] = [];
    categorized[cat].push(item);
  }

  const sectionsHtml = Object.entries(categories).map(([catKey, catTitle]) => {
    const items = categorized[catKey] || [];
    if (items.length === 0) return '';

    const cardsHtml = items.map(item => {
      const { block, variants } = item;
      const paletteSwatches = block.palette.map(c =>
        `<span class="swatch" style="background: rgb(${c.r},${c.g},${c.b})" title="rgb(${c.r},${c.g},${c.b})"></span>`
      ).join('');

      const variantsHtml = variants.map(v => {
        return `
          <div class="variant-item" onclick="inspectTile('${v.fileName}', '${block.nameRu} (Вариант ${v.index})')">
            <img class="pixel-art" src="${v.fileName}" alt="${block.nameRu} #${v.index}">
            <span class="v-label">#${v.index}</span>
          </div>
        `;
      }).join('');

      return `
        <div class="block-card">
          <div class="card-header">
            <div>
              <h3>${block.nameRu}</h3>
              <code class="block-id">${block.id}</code>
            </div>
            <div class="palette-bar">
              ${paletteSwatches}
            </div>
          </div>
          <div class="variants-row">
            ${variantsHtml}
          </div>
        </div>
      `;
    }).join('\n');

    return `
      <section class="category-section">
        <h2>${catTitle}</h2>
        <div class="cards-grid">
          ${cardsHtml}
        </div>
      </section>
    `;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>16x16 Procedural Textures — ${runDate}</title>
  <style>
    :root {
      --bg: #141416;
      --card-bg: #1c1c20;
      --border: #2e2e34;
      --text: #e2e2e8;
      --text-dim: #8b8b96;
      --accent: #58a6ff;
      --accent-hover: #1f6feb;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 24px;
      line-height: 1.5;
    }
    header {
      border-bottom: 1px solid var(--border);
      padding-bottom: 18px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    h1 { font-size: 22px; font-weight: 700; }
    .badge {
      background: #23232a;
      border: 1px solid var(--border);
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 13px;
      color: var(--text-dim);
    }
    .badge b { color: var(--accent); }
    .category-section {
      margin-bottom: 32px;
    }
    .category-section h2 {
      font-size: 16px;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 12px;
      border-left: 3px solid var(--accent);
      padding-left: 8px;
    }
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 16px;
    }
    .block-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .card-header h3 {
      font-size: 16px;
      margin-bottom: 2px;
    }
    .block-id {
      font-size: 12px;
      color: var(--text-dim);
    }
    .palette-bar {
      display: flex;
      gap: 2px;
      padding: 2px;
      background: #111113;
      border-radius: 4px;
    }
    .swatch {
      width: 14px;
      height: 14px;
      border-radius: 2px;
      display: inline-block;
    }
    .variants-row {
      display: flex;
      gap: 8px;
      background: #111113;
      padding: 10px;
      border-radius: 6px;
      overflow-x: auto;
    }
    .variant-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: background 0.15s, transform 0.1s;
    }
    .variant-item:hover {
      background: #2a2a32;
      transform: translateY(-2px);
    }
    .pixel-art {
      width: 56px;
      height: 56px;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      border: 1px solid #333;
      background: #000;
    }
    .v-label {
      font-size: 11px;
      color: var(--text-dim);
    }

    /* Модальное окно инспектора бесшовности 3x3 */
    .modal-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.82);
      backdrop-filter: blur(4px);
      z-index: 1000;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    .modal {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      max-width: 600px;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-shadow: 0 16px 40px rgba(0,0,0,0.6);
    }
    .modal-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .close-btn {
      background: none;
      border: none;
      color: var(--text-dim);
      font-size: 24px;
      cursor: pointer;
    }
    .close-btn:hover { color: #fff; }
    .tiling-viewport {
      display: flex;
      justify-content: center;
      background: #0a0a0c;
      padding: 20px;
      border-radius: 8px;
      border: 1px dashed var(--border);
    }
    .tiling-canvas {
      display: grid;
      grid-template-columns: repeat(3, 96px);
      grid-template-rows: repeat(3, 96px);
      width: 288px;
      height: 288px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .tiling-canvas.show-grid img {
      outline: 1px solid rgba(88, 166, 255, 0.4);
    }
    .tiling-canvas img {
      width: 96px;
      height: 96px;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      display: block;
    }
    .modal-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      color: var(--text-dim);
    }
    .toggle-label {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>16x16 Texture Generator</h1>
      <div style="font-size: 13px; color: var(--text-dim); margin-top: 4px;">
        Процедурная генерация пиксельных текстур по правилам формы, палитры, тороидального шума и верхнего света
      </div>
    </div>
    <div style="display: flex; gap: 8px;">
      <span class="badge">Сид: <b>${seed}</b></span>
      <span class="badge">Дата: <b>${runDate}</b></span>
      <span class="badge">Всего текстур: <b>${blocksData.length * 5}</b></span>
    </div>
  </header>

  <main>
    ${sectionsHtml}
  </main>

  <div id="modalBackdrop" class="modal-backdrop" onclick="if(event.target === this) closeModal()">
    <div class="modal">
      <div class="modal-top">
        <h3 id="modalTitle">Инспектор бесшовности (3x3 Тайлинг)</h3>
        <button class="close-btn" onclick="closeModal()">&times;</button>
      </div>
      <p style="font-size: 13px; color: var(--text-dim);">
        Проверка стыков: слева с направо, сверху вниз. Обратите внимание на отсутствие повторяющихся назойливых точек ("ловушек ярких пикселей").
      </p>
      <div class="tiling-viewport">
        <div id="tilingCanvas" class="tiling-canvas">
          <!-- 9 копий текстуры -->
        </div>
      </div>
      <div class="modal-controls">
        <label class="toggle-label">
          <input type="checkbox" id="gridToggle" onchange="toggleGrid(this.checked)">
          Показывать сетку блоков 3x3
        </label>
        <span style="color: var(--text-dim);">Масштаб: 600%</span>
      </div>
    </div>
  </div>

  <script>
    function inspectTile(imgSrc, title) {
      document.getElementById('modalTitle').textContent = title + ' — Проверка тайлинга 3x3';
      const canvas = document.getElementById('tilingCanvas');
      canvas.innerHTML = '';
      for (let i = 0; i < 9; i++) {
        const img = document.createElement('img');
        img.src = imgSrc;
        img.alt = 'tile';
        canvas.appendChild(img);
      }
      document.getElementById('modalBackdrop').style.display = 'flex';
    }

    function closeModal() {
      document.getElementById('modalBackdrop').style.display = 'none';
    }

    function toggleGrid(checked) {
      const canvas = document.getElementById('tilingCanvas');
      if (checked) {
        canvas.classList.add('show-grid');
      } else {
        canvas.classList.remove('show-grid');
      }
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  </script>
</body>
</html>
`;
}
