/**
 * Minimal ZIP file builder using only Node.js built-ins.
 * Stores files as-is (no additional compression) since each entry
 * is already gzip-compressed before being added.
 */

function crc32(buf) {
  // Standard CRC-32 table
  if (!crc32._table) {
    crc32._table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crc32._table[i] = c;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crc32._table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime() {
  const d = new Date();
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  return { date, time };
}

function writeUInt16LE(buf, offset, val) {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >> 8) & 0xff;
}

function writeUInt32LE(buf, offset, val) {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >> 8) & 0xff;
  buf[offset + 2] = (val >> 16) & 0xff;
  buf[offset + 3] = (val >> 24) & 0xff;
}

export class ZipBuilder {
  constructor() {
    this._entries = [];
  }

  /**
   * Add a file to the archive.
   * @param {string} name   Filename inside the ZIP
   * @param {Buffer} data   Raw bytes (already compressed externally if desired)
   */
  addFile(name, data) {
    const nameBuf = Buffer.from(name, 'utf-8');
    const crc = crc32(data);
    const { date, time } = dosDateTime();
    this._entries.push({ name: nameBuf, data, crc, date, time });
  }

  /** Generate the complete ZIP buffer. */
  build() {
    const parts = [];
    const centralParts = [];
    let offset = 0;

    for (const entry of this._entries) {
      const localHeader = Buffer.alloc(30 + entry.name.length);
      writeUInt32LE(localHeader, 0, 0x04034b50);   // signature
      writeUInt16LE(localHeader, 4, 20);            // version needed
      writeUInt16LE(localHeader, 6, 0);             // flags
      writeUInt16LE(localHeader, 8, 0);             // compression: stored
      writeUInt16LE(localHeader, 10, entry.time);
      writeUInt16LE(localHeader, 12, entry.date);
      writeUInt32LE(localHeader, 14, entry.crc);
      writeUInt32LE(localHeader, 18, entry.data.length);  // compressed size
      writeUInt32LE(localHeader, 22, entry.data.length);  // uncompressed size
      writeUInt16LE(localHeader, 26, entry.name.length);
      writeUInt16LE(localHeader, 28, 0);            // extra field length
      entry.name.copy(localHeader, 30);

      const centralHeader = Buffer.alloc(46 + entry.name.length);
      writeUInt32LE(centralHeader, 0, 0x02014b50);  // signature
      writeUInt16LE(centralHeader, 4, 20);           // version made by
      writeUInt16LE(centralHeader, 6, 20);           // version needed
      writeUInt16LE(centralHeader, 8, 0);            // flags
      writeUInt16LE(centralHeader, 10, 0);           // compression: stored
      writeUInt16LE(centralHeader, 12, entry.time);
      writeUInt16LE(centralHeader, 14, entry.date);
      writeUInt32LE(centralHeader, 16, entry.crc);
      writeUInt32LE(centralHeader, 20, entry.data.length);
      writeUInt32LE(centralHeader, 24, entry.data.length);
      writeUInt16LE(centralHeader, 28, entry.name.length);
      writeUInt16LE(centralHeader, 30, 0);           // extra field length
      writeUInt16LE(centralHeader, 32, 0);           // comment length
      writeUInt16LE(centralHeader, 34, 0);           // disk number start
      writeUInt16LE(centralHeader, 36, 0);           // internal attributes
      writeUInt32LE(centralHeader, 38, 0);           // external attributes
      writeUInt32LE(centralHeader, 42, offset);      // local header offset
      entry.name.copy(centralHeader, 46);

      parts.push(localHeader, entry.data);
      centralParts.push(centralHeader);
      offset += localHeader.length + entry.data.length;
    }

    const centralDir = Buffer.concat(centralParts);
    const eocd = Buffer.alloc(22);
    writeUInt32LE(eocd, 0, 0x06054b50);             // EOCD signature
    writeUInt16LE(eocd, 4, 0);                       // disk number
    writeUInt16LE(eocd, 6, 0);                       // disk with central dir
    writeUInt16LE(eocd, 8, this._entries.length);
    writeUInt16LE(eocd, 10, this._entries.length);
    writeUInt32LE(eocd, 12, centralDir.length);
    writeUInt32LE(eocd, 16, offset);                 // central dir offset
    writeUInt16LE(eocd, 20, 0);                      // comment length

    return Buffer.concat([...parts, centralDir, eocd]);
  }
}
