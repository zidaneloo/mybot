import config from '../config.js';

export default {
  name: 'instagram',
  command: ['instagram', 'ig', 'igdl', 'reels'],
  category: 'downloader',
  description: 'Download foto, video, atau reels Instagram via API VTech',
  group: true,

  async execute({ vynaa, m, text, prefix }) {
    if (!text) {
      return m.reply(`Masukkan link Instagram bro.\nContoh: ${prefix}ig https://www.instagram.com/reel/Cxxxx/`);
    }

    if (!/instagram\.com/.test(text)) {
      return m.reply('Link yang kamu masukkan bukan link Instagram yang valid.');
    }

    const apikey = config.api?.apiKey || config.vtech || 'free';
    const baseUrl = config.api?.vtech || 'https://api.vtech.biz.id';

    await m.reply('Sedang mengunduh media Instagram dari VTech API, tunggu sebentar...');

    try {
      const url = `${baseUrl}/api/ig?apikey=${apikey}&url=${encodeURIComponent(text)}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36'
        }
      });
      const result = await response.json();

      if (!result?.status || !Array.isArray(result?.data) || !result.data.length) {
        return m.reply('Gagal mengambil media Instagram. Pastikan akun tidak diprivat dan link masih aktif.');
      }

      const fetchBuffer = async (u) => {
        const r = await fetch(u, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
            'Referer': 'https://www.instagram.com/'
          }
        });
        if (!r.ok) throw new Error(`Fetch gagal: ${r.status}`);
        return Buffer.from(await r.arrayBuffer());
      };

      let index = 0;
      for (const item of result.data) {
        index++;
        try {
          const buffer = await fetchBuffer(item.url);
          const type = item.type?.toLowerCase() || '';

          const caption = `┌── [ INSTAGRAM DOWNLOADER ]
│
├ File    : ${index} dari ${result.data.length}
├ Tipe    : ${type.toUpperCase() || 'MEDIA'}
│
└── [ Selesai diunduh ]`;

          if (type === 'mp4' || type === 'video') {
            await vynaa.sendMessage(m.chat, {
              video: buffer,
              mimetype: 'video/mp4',
              caption
            }, { quoted: m.raw });
          } else if (type === 'jpg' || type === 'jpeg' || type === 'image') {
            await vynaa.sendMessage(m.chat, {
              image: buffer,
              caption
            }, { quoted: m.raw });
          } else {
            await vynaa.sendMessage(m.chat, {
              document: buffer,
              mimetype: 'application/octet-stream',
              fileName: `instagram_${index}.${type || 'mp4'}`,
              caption
            }, { quoted: m.raw });
          }
        } catch (e) {
          console.error(`[IG Error] Gagal mengirim media ke-${index}:`, e.message);
        }
      }

    } catch (err) {
      return m.reply(`Gagal mengunduh Instagram: ${err.message}`);
    }
  }
};
