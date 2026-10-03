import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import crypto from 'crypto';
import config from '../config.js';

/**
 * Buat chunk metadata EXIF WebP untuk Sticker WhatsApp (Packname & Author)
 */
function createExif(packName = 'Vynaa Bot', authorName = 'Vynaa AI') {
  const json = {
    'sticker-pack-id': 'com.vynaa.bot',
    'sticker-pack-name': packName,
    'sticker-pack-publisher': authorName,
    'emojis': ['🤖']
  };
  const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
  const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8');
  const exif = Buffer.concat([exifAttr, jsonBuff]);
  exif.writeUIntLE(jsonBuff.length, 14, 4);
  return exif;
}

/**
 * Sisipkan metadata EXIF ke dalam buffer WebP
 */
function addExifToWebp(webpBuffer, packName, authorName) {
  try {
    const exif = createExif(packName, authorName);
    const riffHeader = webpBuffer.slice(0, 12);
    const chunks = [];
    let offset = 12;

    while (offset < webpBuffer.length) {
      const fourCC = webpBuffer.slice(offset, offset + 4).toString('ascii');
      const size = webpBuffer.readUInt32LE(offset + 4);
      const chunkSize = 8 + size + (size % 2);
      if (fourCC !== 'EXIF') {
        chunks.push(webpBuffer.slice(offset, offset + chunkSize));
      }
      offset += chunkSize;
    }

    const exifHeader = Buffer.from('EXIF');
    const exifSize = Buffer.alloc(4);
    exifSize.writeUInt32LE(exif.length, 0);
    const exifChunk = Buffer.concat([exifHeader, exifSize, exif]);

    const totalPayload = Buffer.concat([...chunks, exifChunk]);
    const newRiff = Buffer.alloc(12);
    riffHeader.copy(newRiff);
    newRiff.writeUInt32LE(totalPayload.length + 4, 4);

    return Buffer.concat([newRiff, totalPayload]);
  } catch {
    return webpBuffer;
  }
}

/**
 * Konversi buffer gambar/video ke WebP sticker 512x512
 */
function convertToWebp(inputBuffer, isVideo = false) {
  return new Promise((resolve, reject) => {
    const tmpIn = `/tmp/in_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${isVideo ? 'mp4' : 'jpg'}`;
    const tmpOut = `/tmp/out_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.webp`;
    fs.writeFileSync(tmpIn, inputBuffer);

    const args = isVideo
      ? ['-i', tmpIn, '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000', '-loop', '0', '-ss', '0', '-t', '6', '-preset', 'default', '-an', '-vsync', '0', '-s', '512:512', '-f', 'webp', tmpOut]
      : ['-i', tmpIn, '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000', '-f', 'webp', tmpOut];

    const proc = spawn('ffmpeg', args);
    proc.on('close', (code) => {
      try { fs.unlinkSync(tmpIn); } catch {}
      if (code === 0 && fs.existsSync(tmpOut)) {
        const out = fs.readFileSync(tmpOut);
        try { fs.unlinkSync(tmpOut); } catch {}
        resolve(out);
      } else {
        reject(new Error(`FFmpeg error (code: ${code})`));
      }
    });
    proc.on('error', (err) => {
      try { fs.unlinkSync(tmpIn); } catch {}
      reject(err);
    });
  });
}

export default {
  name: 'sticker',
  command: ['sticker', 's', 'stiker', 'wm', 'take'],
  menu: ['sticker [reply media]', 'wm [pack | author]'],
  category: 'downloader',
  description: 'Mengubah gambar, video singkat, atau stiker menjadi stiker WhatsApp dengan watermark kustom',
  group: true,

  async execute({ vynaa, m, text, command, prefix }) {
    let targetMsg = m;
    let isQuoted = false;

    if (m.quoted && m.quoted.type && m.quoted.type !== 'conversation' && m.quoted.type !== 'extendedTextMessage') {
      targetMsg = m.quoted;
      isQuoted = true;
    }

    const qType = targetMsg.type;
    const isImage = qType === 'imageMessage';
    const isVideo = qType === 'videoMessage';
    const isSticker = qType === 'stickerMessage';

    if (!isImage && !isVideo && !isSticker) {
      return m.reply(
        `*Panduan Pembuat Stiker:*\n\n` +
        `1. *Kirim gambar/video singkat* dengan caption: *${prefix}s*\n` +
        `2. *Atau reply gambar/video* dengan perintah: *${prefix}s*\n` +
        `3. *Ubah Watermark:* Reply stiker dengan perintah:\n` +
        `   *${prefix}wm NamaPack | NamaAuthor*`
      );
    }

    // Ambil packname & author kustom
    let packName = config.botName || 'Vynaa Bot';
    let authorName = 'Vynaa AI';

    if (text) {
      if (text.includes('|')) {
        const parts = text.split('|');
        packName = parts[0].trim() || packName;
        authorName = parts.slice(1).join('|').trim() || authorName;
      } else {
        packName = text.trim();
      }
    }

    await m.reply('Sedang membuat stiker, tunggu sebentar...');

    try {
      const buffer = await targetMsg.download();
      if (!buffer || buffer.length === 0) {
        return m.reply('Gagal mengunduh media dari pesan tersebut.');
      }

      // Jika mereply stiker untuk di-watermark ulang (.wm / .take)
      if (isSticker) {
        const stickerWithExif = addExifToWebp(buffer, packName, authorName);
        return await vynaa.sendMessage(m.chat, {
          sticker: stickerWithExif
        }, { quoted: m.raw });
      }

      // Konversi gambar atau video ke webp 512x512
      const webpBuffer = await convertToWebp(buffer, isVideo);
      const finalSticker = addExifToWebp(webpBuffer, packName, authorName);

      await vynaa.sendMessage(m.chat, {
        sticker: finalSticker
      }, { quoted: m.raw });
    } catch (err) {
      console.error('[Sticker Creation Error]', err);
      return m.reply(`Gagal membuat stiker: ${err.message || 'Format media tidak didukung'}`);
    }
  }
};
