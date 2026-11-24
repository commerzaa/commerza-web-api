/** Exports: class Base32Encoder  (namespace System.Text)
 *    new Base32Encoder() | new Base32Encoder(char padding) | new Base32Encoder(string encodingTable) | new Base32Encoder(string encodingTable, char padding)
 *    Encode(byte[]|Buffer input) : string ; Decode(string data) : Buffer(byte[])
 */
'use strict';

const DEF_ENCODING_TABLE = 'abcdefghijklmnopqrstuvwxyz234567';
const DEF_PADDING = '=';

class Base32Encoder {
  constructor(a, b) {
    let encodingTable = DEF_ENCODING_TABLE;
    let padding = DEF_PADDING;
    if (arguments.length === 1) {
      if (typeof a === 'string' && a.length === 1) padding = a; // (char padding)
      else encodingTable = a; // (string encodingTable)
    } else if (arguments.length >= 2) {
      encodingTable = a;
      padding = b;
    }
    this.eTable = encodingTable;
    this.padding = padding;
    this.dTable = new Uint8Array(0x80); // Decoding table
    this.InitialiseDecodingTable();
  }

  Encode(input) {
    const eTable = this.eTable;
    const padding = this.padding;
    let output = '';
    const specialLength = input.length % 5;
    const normalLength = input.length - specialLength;
    for (let i = 0; i < normalLength; i += 5) {
      const b1 = input[i] & 0xff;
      const b2 = input[i + 1] & 0xff;
      const b3 = input[i + 2] & 0xff;
      const b4 = input[i + 3] & 0xff;
      const b5 = input[i + 4] & 0xff;

      output += eTable[(b1 >> 3) & 0x1f];
      output += eTable[((b1 << 2) | (b2 >> 6)) & 0x1f];
      output += eTable[(b2 >> 1) & 0x1f];
      output += eTable[((b2 << 4) | (b3 >> 4)) & 0x1f];
      output += eTable[((b3 << 1) | (b4 >> 7)) & 0x1f];
      output += eTable[(b4 >> 2) & 0x1f];
      output += eTable[((b4 << 3) | (b5 >> 5)) & 0x1f];
      output += eTable[b5 & 0x1f];
    }

    switch (specialLength) {
      case 1: {
        const b1 = input[normalLength] & 0xff;
        output += eTable[(b1 >> 3) & 0x1f];
        output += eTable[(b1 << 2) & 0x1f];
        output += padding.repeat(6);
        break;
      }
      case 2: {
        const b1 = input[normalLength] & 0xff;
        const b2 = input[normalLength + 1] & 0xff;
        output += eTable[(b1 >> 3) & 0x1f];
        output += eTable[((b1 << 2) | (b2 >> 6)) & 0x1f];
        output += eTable[(b2 >> 1) & 0x1f];
        output += eTable[(b2 << 4) & 0x1f];
        output += padding.repeat(4);
        break;
      }
      case 3: {
        const b1 = input[normalLength] & 0xff;
        const b2 = input[normalLength + 1] & 0xff;
        const b3 = input[normalLength + 2] & 0xff;
        output += eTable[(b1 >> 3) & 0x1f];
        output += eTable[((b1 << 2) | (b2 >> 6)) & 0x1f];
        output += eTable[(b2 >> 1) & 0x1f];
        output += eTable[((b2 << 4) | (b3 >> 4)) & 0x1f];
        output += eTable[(b3 << 1) & 0x1f];
        output += padding.repeat(3);
        break;
      }
      case 4: {
        const b1 = input[normalLength] & 0xff;
        const b2 = input[normalLength + 1] & 0xff;
        const b3 = input[normalLength + 2] & 0xff;
        const b4 = input[normalLength + 3] & 0xff;
        output += eTable[(b1 >> 3) & 0x1f];
        output += eTable[((b1 << 2) | (b2 >> 6)) & 0x1f];
        output += eTable[(b2 >> 1) & 0x1f];
        output += eTable[((b2 << 4) | (b3 >> 4)) & 0x1f];
        output += eTable[((b3 << 1) | (b4 >> 7)) & 0x1f];
        output += eTable[(b4 >> 2) & 0x1f];
        output += eTable[(b4 << 3) & 0x1f];
        output += padding;
        break;
      }
      default:
        break;
    }
    return output;
  }

  // dTable[c] (C# throws IndexOutOfRangeException for chars >= 0x80)
  _d(c) {
    const code = c === undefined ? -1 : c.charCodeAt(0);
    if (code < 0 || code >= 0x80) throw new RangeError('Index was outside the bounds of the array.');
    return this.dTable[code];
  }

  Decode(data) {
    const outStream = [];

    let length = data.length;
    while (length > 0) {
      if (!this.Ignore(data[length - 1])) break;
      length--;
    }

    let i = 0;
    const finish = length - 8;
    for (i = this.NextI(data, i, finish); i < finish; i = this.NextI(data, i, finish)) {
      const b1 = this._d(data[i++]);
      i = this.NextI(data, i, finish);
      const b2 = this._d(data[i++]);
      i = this.NextI(data, i, finish);
      const b3 = this._d(data[i++]);
      i = this.NextI(data, i, finish);
      const b4 = this._d(data[i++]);
      i = this.NextI(data, i, finish);
      const b5 = this._d(data[i++]);
      i = this.NextI(data, i, finish);
      const b6 = this._d(data[i++]);
      i = this.NextI(data, i, finish);
      const b7 = this._d(data[i++]);
      i = this.NextI(data, i, finish);
      const b8 = this._d(data[i++]);

      outStream.push(((b1 << 3) | (b2 >> 2)) & 0xff);
      outStream.push(((b2 << 6) | (b3 << 1) | (b4 >> 4)) & 0xff);
      outStream.push(((b4 << 4) | (b5 >> 1)) & 0xff);
      outStream.push(((b5 << 7) | (b6 << 2) | (b7 >> 3)) & 0xff);
      outStream.push(((b7 << 5) | b8) & 0xff);
    }
    if (length < 8) throw new RangeError('Index was out of range. Must be non-negative and less than the size of the collection.');
    this.DecodeLastBlock(outStream,
      data[length - 8], data[length - 7], data[length - 6], data[length - 5],
      data[length - 4], data[length - 3], data[length - 2], data[length - 1]);

    return Buffer.from(outStream);
  }

  DecodeLastBlock(outStream, c1, c2, c3, c4, c5, c6, c7, c8) {
    const padding = this.padding;
    const d = (c) => this._d(c);
    if (c3 === padding) {
      const b1 = d(c1);
      const b2 = d(c2);
      outStream.push(((b1 << 3) | (b2 >> 2)) & 0xff);
      return 1;
    }

    if (c5 === padding) {
      const b1 = d(c1); const b2 = d(c2); const b3 = d(c3); const b4 = d(c4);
      outStream.push(((b1 << 3) | (b2 >> 2)) & 0xff);
      outStream.push(((b2 << 6) | (b3 << 1) | (b4 >> 4)) & 0xff);
      return 2;
    }

    if (c6 === padding) {
      const b1 = d(c1); const b2 = d(c2); const b3 = d(c3); const b4 = d(c4); const b5 = d(c5);
      outStream.push(((b1 << 3) | (b2 >> 2)) & 0xff);
      outStream.push(((b2 << 6) | (b3 << 1) | (b4 >> 4)) & 0xff);
      outStream.push(((b4 << 4) | (b5 >> 1)) & 0xff);
      return 3;
    }

    if (c8 === padding) {
      const b1 = d(c1); const b2 = d(c2); const b3 = d(c3); const b4 = d(c4); const b5 = d(c5); const b6 = d(c6); const b7 = d(c7);
      outStream.push(((b1 << 3) | (b2 >> 2)) & 0xff);
      outStream.push(((b2 << 6) | (b3 << 1) | (b4 >> 4)) & 0xff);
      outStream.push(((b4 << 4) | (b5 >> 1)) & 0xff);
      outStream.push(((b5 << 7) | (b6 << 2) | (b7 >> 3)) & 0xff);
      return 4;
    }

    const b1 = d(c1); const b2 = d(c2); const b3 = d(c3); const b4 = d(c4); const b5 = d(c5); const b6 = d(c6); const b7 = d(c7); const b8 = d(c8);
    outStream.push(((b1 << 3) | (b2 >> 2)) & 0xff);
    outStream.push(((b2 << 6) | (b3 << 1) | (b4 >> 4)) & 0xff);
    outStream.push(((b4 << 4) | (b5 >> 1)) & 0xff);
    outStream.push(((b5 << 7) | (b6 << 2) | (b7 >> 3)) & 0xff);
    outStream.push(((b7 << 5) | b8) & 0xff);
    return 5;
  }

  NextI(data, i, finish) {
    while (i < finish && this.Ignore(data[i])) i++;
    return i;
  }

  Ignore(c) {
    return c === '\n' || c === '\r' || c === '\t' || c === ' ' || c === '-';
  }

  InitialiseDecodingTable() {
    for (let i = 0; i < this.eTable.length; i++) {
      this.dTable[this.eTable.charCodeAt(i)] = i;
    }
  }
}

module.exports = Base32Encoder;
