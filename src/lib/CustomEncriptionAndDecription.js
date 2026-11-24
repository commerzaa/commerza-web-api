'use strict';
/** Exports: class CustomEncriptionAndDecription { decryption(string input): string; encryption(string numbers): string } */

class CustomEncriptionAndDecription {
  constructor() {
    this.encryted = '';
    this.decryted = '';
    this.zero = 'abc';
    this.one = 'bcd';
    this.two = 'cde';
    this.three = 'def';
    this.four = 'efg';
    this.five = 'fgh';
    this.six = 'ghi';
    this.seven = 'hij';
    this.eight = 'ijk';
    this.nine = 'jkl';
  }

  decryption(input) {
    let sb = '';
    for (let i = 0; i < input.length; i++) {
      if (i % 3 === 0) sb += ' ';
      sb += input[i];
    }
    let formatted = sb;
    if (formatted.length < 1) throw new RangeError('Index and count must refer to a location within the string.');
    formatted = formatted.substring(1); // Remove(0, 1)
    const StringArray = formatted.split(' ');

    for (let i = 0; i < StringArray.length; i++) {
      if (StringArray[i] === 'abc') this.decryted = this.decryted + 0;
      if (StringArray[i] === 'bcd') this.decryted = this.decryted + 1;
      if (StringArray[i] === 'cde') this.decryted = this.decryted + 2;
      if (StringArray[i] === 'def') this.decryted = this.decryted + 3;
      if (StringArray[i] === 'efg') this.decryted = this.decryted + 4;
      if (StringArray[i] === 'fgh') this.decryted = this.decryted + 5;
      if (StringArray[i] === 'ghi') this.decryted = this.decryted + 6;
      if (StringArray[i] === 'hij') this.decryted = this.decryted + 7;
      if (StringArray[i] === 'ijk') this.decryted = this.decryted + 8;
      if (StringArray[i] === 'jkl') this.decryted = this.decryted + 9;
    }
    return this.decryted;
  }

  encryption(numbers) {
    for (let i = 0; i < numbers.length; i++) {
      const c = numbers.charCodeAt(i);
      if (c === 48) this.encryted = this.encryted + this.zero;
      if (c === 49) this.encryted = this.encryted + this.one;
      if (c === 50) this.encryted = this.encryted + this.two;
      if (c === 51) this.encryted = this.encryted + this.three;
      if (c === 52) this.encryted = this.encryted + this.four;
      if (c === 53) this.encryted = this.encryted + this.five;
      if (c === 54) this.encryted = this.encryted + this.six;
      if (c === 55) this.encryted = this.encryted + this.seven;
      if (c === 56) this.encryted = this.encryted + this.eight;
      if (c === 57) this.encryted = this.encryted + this.nine;
    }
    return this.encryted;
  }
}

module.exports = CustomEncriptionAndDecription;
