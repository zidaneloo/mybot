import { resolveJid, formatNumber } from '../lib/simple.js';
import * as simple from '../lib/simple.js';

const readMore = String.fromCharCode(8206).repeat(4001);

export default {
  name: 'hidetag',
  command: ['hidetag', 'h', 'ht'],
  category: 'admin',
  description: 'Mengirim pesan pengumuman dengan tag tersembunyi ke semua member (benar-benar nge-tag tapi tag-nya di-hide)',
  group: true,
  admin: true,

  async execute({ vynaa, m, text, participants, prefix }) {
    const allMembers = typeof simple.getAllParticipantJids === 'function'
      ? simple.getAllParticipantJids(participants)
      : (participants || []).map((p) => resolveJid(p.id || p.jid, participants)).filter(Boolean);

    // Buat tag @nomor untuk setiap member yang disembunyikan di balik readMore
    // WhatsApp butuh token @nomor di dalam teks agar notifikasi mention (@) benar-benar terpicu
    const uniqueNumbers = [...new Set((participants || []).map((p) => {
      const resolved = resolveJid(p.id || p.jid, participants);
      return formatNumber(resolved);
    }).filter(Boolean))];

    const hiddenTags = uniqueNumbers.map((num) => `@${num}`).join(' ');

    // 1. Tangani jika membalas (reply) pesan media: gambar, video, stiker, audio, dokumen
    if (m.quoted && m.quoted.type && m.quoted.type !== 'conversation' && m.quoted.type !== 'extendedTextMessage') {
      try {
        const buffer = await m.quoted.download();
        if (buffer && buffer.length > 0) {
          const qType = m.quoted.type;
          const captionText = text || m.quoted.text || '';
          const mediaCaption = captionText
            ? `${captionText}\n${readMore}\n${hiddenTags}`
            : `${readMore}\n${hiddenTags}`;

          if (qType === 'imageMessage') {
            return await vynaa.sendMessage(m.chat, {
              image: buffer,
              caption: mediaCaption,
              mentions: allMembers
            });
          }

          if (qType === 'videoMessage') {
            return await vynaa.sendMessage(m.chat, {
              video: buffer,
              caption: mediaCaption,
              mentions: allMembers
            });
          }

          if (qType === 'documentMessage') {
            return await vynaa.sendMessage(m.chat, {
              document: buffer,
              mimetype: m.quoted.msg?.mimetype || 'application/octet-stream',
              fileName: m.quoted.msg?.fileName || 'document',
              caption: mediaCaption,
              mentions: allMembers
            });
          }

          if (qType === 'stickerMessage') {
            await vynaa.sendMessage(m.chat, {
              sticker: buffer
            });
            return await vynaa.sendMessage(m.chat, {
              text: `${captionText ? captionText + '\n' : ''}${readMore}\n${hiddenTags}`,
              mentions: allMembers
            });
          }

          if (qType === 'audioMessage') {
            await vynaa.sendMessage(m.chat, {
              audio: buffer,
              mimetype: m.quoted.msg?.mimetype || 'audio/mp4',
              ptt: m.quoted.msg?.ptt || false
            });
            return await vynaa.sendMessage(m.chat, {
              text: `${captionText ? captionText + '\n' : ''}${readMore}\n${hiddenTags}`,
              mentions: allMembers
            });
          }
        }
      } catch (err) {
        console.error('[Hidetag Media Download Error]', err);
      }
    }

    // 2. Pesan teks murni (teks langsung atau mengambil dari reply pesan teks)
    let messageText = text;
    if (!messageText && m.quoted?.text) {
      messageText = m.quoted.text;
    }

    if (!messageText) {
      return m.reply(
        `*Panduan Fitur Hidetag:*\n` +
        `• Ketik: *${prefix}hidetag <pesan pengumuman>*\n` +
        `• Atau reply teks/media dengan perintah *${prefix}hidetag*\n\n` +
        `_Pesan terkirim bersih (tag tersembunyi di balik Baca Selengkapnya) dan seluruh member tetap menerima notifikasi panggilan WhatsApp._`
      );
    }

    // Gabungkan pesan pengumuman dengan tag tersembunyi menggunakan readMore
    const fullMessageText = `${messageText}\n${readMore}\n${hiddenTags}`;

    await vynaa.sendMessage(m.chat, {
      text: fullMessageText,
      mentions: allMembers
    });
  }
};
