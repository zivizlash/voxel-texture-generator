import zlib from 'node:zlib';

/**
 * Таблица CRC32 для вычисления контрольных сумм чанков PNG.
 */
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(typeStr, dataBuffer) {
  const typeBuf = Buffer.from(typeStr, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(dataBuffer.length, 0);

  const toCrc = Buffer.concat([typeBuf, dataBuffer]);
  const crcVal = crc32(toCrc);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, toCrc, crcBuf]);
}

/**
 * Кодирует 2D массив цветов [y][x] = { r, g, b, a? } в валидный PNG буфер
 * @param {number} width
 * @param {number} height
 * @param {Array<Array<{r:number, g:number, b:number, a?:number}>>} pixels
 * @returns {Buffer}
 */
export function encodePNG(width, height, pixels) {
  // Сигнатура PNG
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR чанк
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // 8 бит на канал
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; // компрессия deflate
  ihdr[11] = 0; // базовый фильтр
  ihdr[12] = 0; // без чересстрочности
  const ihdrChunk = createChunk('IHDR', ihdr);

  // Подготовка сканлайнов (каждый сканлайн начинается с фильтра 0 = None)
  const bytesPerPixel = 4;
  const rawScanlineLength = 1 + width * bytesPerPixel;
  const rawBuffer = Buffer.alloc(height * rawScanlineLength);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rawScanlineLength;
    rawBuffer[rowOffset] = 0; // filter byte: None

    for (let x = 0; x < width; x++) {
      const pixel = pixels[y][x];
      const pOffset = rowOffset + 1 + x * bytesPerPixel;
      rawBuffer[pOffset] = Math.max(0, Math.min(255, Math.round(pixel.r)));
      rawBuffer[pOffset + 1] = Math.max(0, Math.min(255, Math.round(pixel.g)));
      rawBuffer[pOffset + 2] = Math.max(0, Math.min(255, Math.round(pixel.b)));
      rawBuffer[pOffset + 3] = pixel.a !== undefined ? Math.max(0, Math.min(255, Math.round(pixel.a))) : 255;
    }
  }

  // Сжатие данных IDAT
  const compressed = zlib.deflateSync(rawBuffer, { level: 9 });
  const idatChunk = createChunk('IDAT', compressed);

  // IEND чанк
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}
