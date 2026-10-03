import { resolveJid, formatNumber } from '../lib/simple.js';
import * as simple from '../lib/simple.js';

const readMore = String.fromCharCode(8206).repeat(4001);

export default {
  name: 'totag',
  command: ['totag', 'tagulang'],
  category: 'admin',
  description: 'Meneruskan kembali pesan yang di-reply dengan tag ke seluruh member',
  group: true,
  admin: true,

  async execute({ vynaa, m, participants, prefix }) {
    if (!m.quoted) {
      return m.reply(`Reply pesan yang mau di-tag ke semua orang dengan perintah ${prefix}totag`);
    }

    const allMembers = typeof simple.getAllParticipantJids === 'function'
      ? simple.getAllParticipantJids(participants)
      : (participants || []).map((p) => resolveJid(p.id || p.jid, participants)).filter(Boolean);
    const uniqueNumbers = [...new Set((participants || []).map((p) => {
      const resolved = resolveJid(p.id || p.jid, participants);
      return formatNumber(resolved);
    }).filter(Boolean))];
    const hiddenTags = uniqueNumbers.map((num) => `@${num}`).join(' ');

    if (m.quoted.text) {
      const fullText = `${m.quoted.text}\n${readMore}\n${hiddenTags}`;
      return await vynaa.sendMessage(m.chat, {
        text: fullText,
        mentions: allMembers
      });
    }

    if (m.quoted.type && m.quoted.type !== 'conversation' && m.quoted.type !== 'extendedTextMessage') {
      try {
        const buffer = await m.quoted.download();
        if (buffer && buffer.length > 0) {
          const qType = m.quoted.type;
          const captionText = m.quoted.text || '';
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
        console.error('[Totag Download Error]', err);
      }
    }

    await vynaa.sendMessage(m.chat, {
      text: `${m.quoted?.text || 'Panggilan Anggota'}\n${readMore}\n${hiddenTags}`,
      mentions: allMembers
    });
  }
};
