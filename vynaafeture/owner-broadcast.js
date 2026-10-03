export default {
  name: 'broadcast',
  command: ['broadcast', 'bcgc', 'bc'],
  category: 'owner',
  description: 'Mengirimkan pesan siaran ke seluruh grup yang dimasuki bot',
  owner: true,

  async execute({ vynaa, m, text, prefix }) {
    if (!text) {
      return m.reply(`Masukkan pesan siaran bro.\nContoh: ${prefix}bcgc Pengumuman pemeliharaan sistem.`);
    }

    try {
      const getChats = await vynaa.groupFetchAllParticipating();
      const groups = Object.values(getChats);

      let success = 0;
      let failed = 0;

      await m.reply(`Memulai siaran ke ${groups.length} grup...`);

      for (const group of groups) {
        try {
          await vynaa.sendMessage(group.id, {
            text: `[ PEMBERITAHUAN RESMI ]\n\n${text}\n\n----------------------------------------\n${global.config?.botName || 'Bot WhatsApp'}`
          });
          success++;
        } catch {
          failed++;
        }
        // Jeda singkat antar grup
        await new Promise((res) => setTimeout(res, 1000));
      }

      return m.reply(`Siaran selesai.\n- Berhasil: ${success} grup\n- Gagal: ${failed} grup`);
    } catch (err) {
      return m.reply(`Gagal melakukan siaran: ${err.message}`);
    }
  }
};
