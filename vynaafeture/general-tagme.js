import { cleanJid } from '../lib/simple.js';

export default {
  name: 'tagme',
  command: ['tagme', 'me2'],
  category: 'general',
  description: 'Memanggil / mention nomor kamu sendiri',
  group: true,

  async execute({ vynaa, m }) {
    const mentions = Array.from(new Set([cleanJid(m.sender), cleanJid(m.rawSender)].filter(Boolean)));
    return vynaa.sendMessage(m.chat, {
      text: `Halo @${m.senderNumber}, ini tag untukmu.`,
      mentions
    }, { quoted: m.raw });
  }
};
