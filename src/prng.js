/**
 * Детерминированный генератор псевдослучайных чисел на базе алгоритма Mulberry32.
 * Гарантирует воспроизводимость генерации по заданному целочисленному сиду.
 */
export class PRNG {
  /**
   * @param {number|string} seed
   */
  constructor(seed = 1337) {
    this.initialSeed = typeof seed === 'string' ? PRNG.hashString(seed) : (seed >>> 0);
    this.state = this.initialSeed;
  }

  /**
   * Преобразование произвольной строки в 32-битное беззнаковое целое
   */
  static hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (Math.imul(31, hash) + str.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  /**
   * Сброс к исходному состоянию
   */
  reset() {
    this.state = this.initialSeed;
  }

  /**
   * Возвращает псевдослучайное число с плавающей точкой в диапазоне [0, 1)
   */
  next() {
    let t = (this.state += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Число с плавающей точкой в диапазоне [min, max)
   */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /**
   * Целое число в диапазоне [min, max] включительно
   */
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  /**
   * Случайный элемент из массива
   */
  choice(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[this.int(0, arr.length - 1)];
  }

  /**
   * Проверка вероятности (от 0 до 1)
   */
  chance(probability) {
    return this.next() < probability;
  }

  /**
   * Создает дочерний PRNG со смещенным сидом
   */
  fork(offset = 0) {
    return new PRNG((this.state + offset + 0x9E3779B9) >>> 0);
  }
}
