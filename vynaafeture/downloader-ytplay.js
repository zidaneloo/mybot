import config from '../config.js';

export default {
  name: 'ytplay',
  command: ['ytplay', 'play', 'lagu', 'song'],
  menu: ['play'],
  category: 'downloader',
  description: 'Mencari dan mengunduh audio/lagu YouTube via API VTech',
  group: true,

  async execute({ vynaa, m, text, prefix }) {
    if (!text) {
      return m.reply(`Masukkan judul lagu yang ingin dicari bro.\nContoh: ${prefix}play Rewrite The Stars`);
    }

    const apikey = config.api?.apiKey || config.vtech || 'free';
    const baseUrl = config.api?.vtech || 'https://api.vtech.biz.id';

    await m.reply('Sedang mencari dan mengunduh audio dari YouTube, tunggu sebentar...');

    try {
      const apiUrl = `${baseUrl}/api/play?apikey=${apikey}&q=${encodeURIComponent(text)}`;
      const res = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36'
        }
      });
      const result = await res.json();

      if (!result?.status || !result?.data?.url) {
        return m.reply('Lagu tidak ditemukan atau server VTech sedang sibuk. Coba judul lain yang lebih jelas.');
      }

      const { title, thumbnail, duration, channel, views, data } = result;
      const { filename, quality, size, url: audioUrl } = data;

      const caption = `┌── [ YOUTUBE PLAY ]
│
├ Judul    : ${title || '-'}
├ Channel  : ${channel || '-'}
├ Durasi   : ${duration || '-'}
├ Views    : ${views || '-'}
├ Kualitas : ${quality || '128kbps'}
├ Ukuran   : ${size || '-'}
│
└── [ Mengirimkan audio MP3... ]`;

      // Kirim thumbnail preview jika ada
      if (thumbnail) {
        await vynaa.sendMessage(m.chat, {
          image: { url: thumbnail },
          caption
        }, { quoted: m.raw });
      } else {
        await m.reply(caption);
      }

      // Download buffer audio dengan retry
      const fetchBuffer = async (u, tries = 3) => {
        let lastErr;
        for (let i = 1; i <= tries; i++) {
          try {
            const resp = await fetch(u, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36',
                'Referer': 'https://www.youtube.com/'
              }
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return Buffer.from(await resp.arrayBuffer());
          } catch (e) {
            lastErr = e;
            await new Promise((r) => setTimeout(r, 1500 * i));
          }
        }
        throw lastErr;
      };

      const audioBuffer = await fetchBuffer(audioUrl);

      // Kirim file audio
      await vynaa.sendMessage(m.chat, {
        audio: audioBuffer,
        mimetype: 'audio/mpeg',
        fileName: filename || `${title}.mp3`,
        ptt: false
      }, { quoted: m.raw });

    } catch (err) {
      return m.reply(`Gagal memproses lagu: ${err.message}`);
    }
  }
};
