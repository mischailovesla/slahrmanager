// ============================================================
// v0.34.0: minimale zip-lezer/-schrijver (docx = zip) zonder extra npm-pakket; alleen Node zlib.
//   lees(buf)            -> [{ naam, data: Buffer }]   (stored + deflate; volgorde zoals in het archief)
//   schrijf(entries)     -> Buffer                     (deflate; [Content_Types].xml blijft eerst als hij eerst stond)
// ============================================================
const zlib = require('zlib');

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

function lees(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Geen geldig zip/docx-bestand.');
  const aantal = buf.readUInt16LE(eocd + 10), cdStart = buf.readUInt32LE(eocd + 16);
  const uit = []; let p = cdStart;
  for (let i = 0; i < aantal; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Zip: centrale map beschadigd.');
    const methode = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), lh = buf.readUInt32LE(p + 42);
    const naam = buf.slice(p + 46, p + 46 + nlen).toString('utf8');
    const dStart = lh + 30 + buf.readUInt16LE(lh + 26) + buf.readUInt16LE(lh + 28);
    const ruw = buf.slice(dStart, dStart + csize);
    let data;
    if (methode === 0) data = Buffer.from(ruw);
    else if (methode === 8) data = zlib.inflateRawSync(ruw);
    else throw new Error('Zip: compressiemethode ' + methode + ' niet ondersteund (' + naam + ').');
    if (!naam.endsWith('/')) uit.push({ naam, data });
    p += 46 + nlen + elen + clen;
  }
  return uit;
}

function schrijf(entries) {
  const lokaal = [], centraal = []; let off = 0;
  const dt = new Date(), dosTijd = (dt.getHours() << 11) | (dt.getMinutes() << 5) | (dt.getSeconds() >> 1), dosDatum = ((dt.getFullYear() - 1980) << 9) | ((dt.getMonth() + 1) << 5) | dt.getDate();
  for (const e of entries) {
    const naam = Buffer.from(e.naam, 'utf8'), data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(String(e.data), 'utf8');
    const comp = zlib.deflateRawSync(data), crc = crc32(data);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
    h.writeUInt16LE(dosTijd, 10); h.writeUInt16LE(dosDatum, 12); h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(naam.length, 26); h.writeUInt16LE(0, 28);
    lokaal.push(h, naam, comp);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
    c.writeUInt16LE(dosTijd, 12); c.writeUInt16LE(dosDatum, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(naam.length, 28); c.writeUInt32LE(off, 42);
    centraal.push(c, naam);
    off += 30 + naam.length + comp.length;
  }
  const cd = Buffer.concat(centraal), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat(lokaal.concat([cd, end]));
}

module.exports = { lees, schrijf, crc32 };
