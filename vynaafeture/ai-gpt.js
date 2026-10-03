import axios from 'axios';
import config from '../config.js';

export default {
  name: 'ai',
  command: ['ai', 'gpt', 'tanya', 'ask', 'chatgpt'],
  menu: ['ai [pertanyaan]'],
  category: 'ai',
  description: 'Tanya jawab cerdas dengan AI GPT-Pro via VTech API',
  group: true,

  async execute({ vynaa, m, text, prefix }) {
    const prompt = text || m.quoted?.text || '';

    if (!prompt) {
      return m.reply(
        `*Panduan Fitur AI (GPT-Pro):*\n\n` +
        `Ketik: *${prefix}ai <pertanyaan kamu>*\n` +
        `Atau reply pesan teks dengan perintah *${prefix}ai*\n\n` +
        `Contoh: *${prefix}ai buatkan kata-kata promosi jualan diamond ff*`
      );
    }

    const apiKey = config.api?.apiKey || config.vtech || 'sk-3812b98420fb';
    const baseUrl = config.api?.vtech || 'https://api.vtech.biz.id';

    await m.reply('Thinking... Tunggu sebentar ya kak...');

    try {
      const url = `${baseUrl}/api/gpt-pro?apikey=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(prompt)}`;
      const response = await axios.get(url, {
        timeout: 45000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const data = response.data;
      const answer = data?.data?.message || data?.data?.answer || data?.message || data?.result;

      if (!answer) {
        return m.reply('Maaf kak, AI sedang tidak dapat memberikan respon. Silakan coba sesaat lagi.');
      }

      const formattedReply = `┌── [ AI GPT-PRO ]
│
├ Pertanyaan: ${prompt}
│
└── [ JAWABAN ]
${answer}`;

      return m.reply(formattedReply);
    } catch (err) {
      console.error('[AI GPT Error]', err);
      const errMsg = err.response?.data?.error || err.message || 'Terjadi kesalahan pada server AI.';
      return m.reply(`Gagal mendapatkan respon dari AI: ${errMsg}`);
    }
  }
};
