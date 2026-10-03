import { exec } from 'child_process';

export default {
  name: 'exec',
  command: ['exec', '$'],
  category: 'owner',
  description: 'Menjalankan perintah Shell / Terminal (Khusus Owner)',
  owner: true,

  async execute({ m, text }) {
    if (!text) return m.reply('Masukkan perintah shell/terminal yang ingin dijalankan.');

    exec(text, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) {
        return m.reply(`Error:\n${err.message}`);
      }
      if (stderr && stderr.trim()) {
        return m.reply(`Stderr:\n${stderr}`);
      }
      return m.reply(stdout ? stdout.trim() : 'Perintah selesai tanpa output.');
    });
  }
};
