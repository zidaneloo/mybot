import config from '../config.js';

export default {
  name: 'tiktok',
  command: ['tiktok', 'tt', 'ttdl', 'vt'],
  category: 'downloader',
  description: 'Download video TikTok tanpa watermark via API VTech',
  group: true,

  async execute({ vynaa, m, text, prefix }) {
    if (!text) {
      return m.reply(`Masukkan link video TikTok bro.\nContoh: ${prefix}tt https://vt.tiktok.com/ZSxxxx/`);
    }

    if (!/(tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com)/i.test(text)) {
      return m.reply('Link yang kamu masukkan bukan link TikTok yang valid.');
    }

    const apikey = config.api?.apiKey || config.vtech || 'free';
    const baseUrl = config.api?.vtech || 'https://api.vtech.biz.id';

    await m.reply('Sedang mengunduh video TikTok dari VTech API, tunggu sebentar...');

    try {
      const apiUrl = `${baseUrl}/api/tiktok?apikey=${apikey}&url=${encodeURIComponent(text)}`;
      const res = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36'
        }
      });
      const result = await res.json();

      if (!result?.status || !result?.data?.video) {
        return m.reply('Gagal mengambil video TikTok. Pastikan video publik dan link masih aktif.');
      }

      const { caption, author, statistic, music, published, video, videoWM, audio } = result.data;

      const dateStr = published
        ? new Date(Number(published) * 1000).toLocaleString('id-ID')
        : '-';

      const infoCaption = `┌── [ TIKTOK DOWNLOADER ]
│
├ Pembuat   : ${author?.nickname || '-'} (@${author?.uniqueId || '-'})
├ Deskripsi : ${caption || '-'}
├ Likes     : ${statistic?.likes?.toLocaleString?.() || statistic?.likes || '-'}
├ Komentar  : ${statistic?.comments || '-'}
├ Musik     : ${music?.title || '-'}
├ Rilis     : ${dateStr}
│
└── [ Video Tanpa Watermark ]`;

      // Download buffer video dengan retry
      const fetchBuffer = async (u, tries = 3) => {
        let lastErr;
        for (let i = 1; i <= tries; i++) {
          try {
            const resp = await fetch(u, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36',
                'Referer': 'https://www.tiktok.com/'
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

      let buffer;
      try {
        buffer = await fetchBuffer(video);
      } catch (e) {
        if (videoWM) buffer = await fetchBuffer(videoWM);
        else throw e;
      }

      // Kirim video
      await vynaa.sendMessage(m.chat, {
        video: buffer,
        mimetype: 'video/mp4',
        caption: infoCaption
      }, { quoted: m.raw });

      // Kirim audio jika ada
      if (audio) {
        try {
          const audioBuf = await fetchBuffer(audio);
          await vynaa.sendMessage(m.chat, {
            audio: audioBuf,
            mimetype: 'audio/mpeg',
            ptt: false
          }, { quoted: m.raw });
        } catch {}
      }

    } catch (err) {
      return m.reply(`Gagal mengunduh TikTok: ${err.message}`);
    }
  }
};
