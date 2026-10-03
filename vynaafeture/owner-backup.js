import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import util from 'util';
import config from '../config.js';
import db from '../lib/database.js';

const execAsync = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseDir = path.resolve(__dirname, '..');
const dbPath = path.resolve(baseDir, 'database.json');
const backupDir = path.resolve(baseDir, 'storage', 'backups');

export function getJakartaTimeString(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date) + ' WIB';
  } catch {
    return date.toLocaleString('id-ID');
  }
}

/**
 * Buat file archive .zip berisi full source code dan database.json
 */
export async function createProjectZipBackup() {
  if (db?.saveSync) db.saveSync();
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const now = new Date();
  const dateTag = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const cleanName = (config.botName || 'bot').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `backup_${cleanName}_${dateTag}.zip`;
  const zipPath = path.join(backupDir, fileName);

  // Perintah zip mengecualikan folder besar/temporary yang tidak perlu
  const excludePatterns = [
    'node_modules/*',
    '.git/*',
    'logs/*',
    '*.log',
    '.cache/*',
    '.local/*',
    'attached_assets/*',
    'storage/backups/*',
    'storage/temp/*',
    '.npm/*'
  ].map((p) => `"${p}"`).join(' ');

  const zipCmd = `cd "${baseDir}" && zip -r "${zipPath}" . -x ${excludePatterns}`;
  await execAsync(zipCmd);

  if (!fs.existsSync(zipPath)) {
    throw new Error('Gagal menghasilkan file .zip backup.');
  }

  const stat = fs.statSync(zipPath);
  const sizeKb = (stat.size / 1024).toFixed(2);
  const timeStr = getJakartaTimeString(now);

  // Rotasi backup: simpan maksimal 5 file backup terbaru agar tidak membebani kapasitas disk VPS
  try {
    const files = fs.readdirSync(backupDir)
      .filter((f) => f.endsWith('.zip'))
      .map((f) => ({
        name: f,
        path: path.join(backupDir, f),
        time: fs.statSync(path.join(backupDir, f)).mtimeMs
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > 5) {
      for (const oldFile of files.slice(5)) {
        try { fs.unlinkSync(oldFile.path); } catch (e) {}
      }
    }
  } catch (e) {}

  return {
    zipPath,
    fileName,
    sizeKb,
    timeStr
  };
}

/**
 * Kirim file backup .zip (source code + json) via WhatsApp
 */
export async function sendZipBackup(sock, targetChat, quotedRaw = null) {
  const { zipPath, fileName, sizeKb, timeStr } = await createProjectZipBackup();
  const zipBuffer = fs.readFileSync(zipPath);

  const caption = `┌── [ 📦 BACKUP SOURCE CODE & DATABASE ]
│
├ Bot      : ${config.botName}
├ File     : ${fileName}
├ Ukuran   : ${sizeKb} KB
├ Format   : ZIP Archive (.zip)
├ Waktu    : ${timeStr}
│
├── [ ISI CADANGAN ]
│ ├ Source Code Bot (index.js, handler.js, lib, vynaafeture)
│ ├ Database Bot (database.json)
│ ├ Konfigurasi (config.js, ecosystem.config.cjs)
│
└── [ Simpan file .zip ini untuk memulihkan seluruh bot kapan saja ]`;

  const sendOptions = quotedRaw ? { quoted: quotedRaw } : {};
  return await sock.sendMessage(targetChat, {
    document: zipBuffer,
    mimetype: 'application/zip',
    fileName,
    caption
  }, sendOptions);
}

/**
 * Kirim file database.json langsung ke chat target (Owner / Grup)
 */
export async function sendDatabaseBackup(sock, targetChat, quotedRaw = null) {
  if (!fs.existsSync(dbPath)) {
    throw new Error('File database.json tidak ditemukan!');
  }

  const dbBuffer = fs.readFileSync(dbPath);
  const now = new Date();
  const dateTag = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const fileName = `database_backup_${dateTag}.json`;

  const sizeKb = (dbBuffer.length / 1024).toFixed(2);
  const timeStr = getJakartaTimeString(now);

  const caption = `┌── [ 📦 BACKUP DATABASE BOT ]
│
├ Bot      : ${config.botName}
├ Waktu    : ${timeStr}
├ Ukuran   : ${sizeKb} KB
├ Format   : JSON (.json)
│
└── [ File backup database siap disimpan ]`;

  const sendOptions = quotedRaw ? { quoted: quotedRaw } : {};
  return await sock.sendMessage(targetChat, {
    document: dbBuffer,
    mimetype: 'application/json',
    fileName,
    caption
  }, sendOptions);
}

/**
 * Sistem Scheduler Auto Backup Otomatis
 */
export async function performAutoBackupSystem(sock, force = false) {
  if (!db.data.settings) db.data.settings = {};
  if (!db.data.settings.autobackup) {
    db.data.settings.autobackup = {
      enabled: true,
      intervalHours: 24,
      lastBackup: 0
    };
  }

  const setting = db.data.settings.autobackup;
  if (!setting.enabled && !force) return;

  const now = Date.now();
  const intervalMs = (setting.intervalHours || 24) * 3600 * 1000;
  if (!force && (now - (setting.lastBackup || 0)) < intervalMs) {
    return; // Belum waktunya backup
  }

  const { zipPath, fileName, sizeKb, timeStr } = await createProjectZipBackup();
  const zipBuffer = fs.readFileSync(zipPath);

  // 1. Kirim ke WhatsApp Owner Utama jika WhatsApp terhubung
  const primaryOwnerNum = config.owner?.[0] || '6283872659753';
  const primaryOwnerJid = `${primaryOwnerNum.replace(/\D/g, '')}@s.whatsapp.net`;
  if (sock?.user?.id) {
    const waCaption = `┌── [ ⏰ AUTO BACKUP BERKALA (ZIP) ]
│
├ Bot      : ${config.botName}
├ File     : ${fileName}
├ Ukuran   : ${sizeKb} KB
├ Interval : Setiap ${setting.intervalHours || 24} Jam
├ Waktu    : ${timeStr}
│
└── [ Source code & database otomatis dicadangkan ]`;

    await sock.sendMessage(primaryOwnerJid, {
      document: zipBuffer,
      mimetype: 'application/zip',
      fileName,
      caption: waCaption
    }).catch(() => {});
  }

  // 2. Kirim juga ke Telegram Owner jika aktif
  if (config.telegram?.enabled && config.telegram?.token) {
    try {
      const { default: telegram } = await import('../lib/telegram.js');
      if (telegram) {
        const tgCaption = `📦 *AUTO BACKUP SOURCE CODE & DATABASE (ZIP)*\n\n` +
          `• *Bot:* ${config.botName}\n` +
          `• *File:* \`${fileName}\`\n` +
          `• *Ukuran:* ${sizeKb} KB\n` +
          `• *Interval:* Setiap ${setting.intervalHours || 24} Jam\n` +
          `• *Waktu:* ${timeStr}\n\n` +
          `_File .zip ini berisi seluruh script bot dan database.json aktif._`;

        await telegram.sendDocument(telegram.ownerId, zipBuffer, fileName, tgCaption);
      }
    } catch (e) {}
  }

  setting.lastBackup = now;
  if (db?.saveSync) db.saveSync();
}

export default {
  name: 'backup',
  command: ['backup', 'backupzip', 'bckp', 'backupdb', 'autobackup'],
  menu: ['backup', 'autobackup'],
  category: 'owner',
  description: 'Mencadangkan source code & database bot dalam bentuk .zip (Khusus Owner)',
  owner: true,

  async execute({ vynaa, m, args, command, db }) {
    if (db?.saveSync) {
      db.saveSync();
    }

    if (!db.data.settings) db.data.settings = {};
    if (!db.data.settings.autobackup) {
      db.data.settings.autobackup = {
        enabled: true,
        intervalHours: 24,
        lastBackup: 0
      };
    }

    const sub = (args[0] || '').toLowerCase();

    // 1. Pengaturan Fitur Auto Backup (.autobackup)
    if (command === 'autobackup') {
      const setting = db.data.settings.autobackup;

      if (sub === 'on' || sub === 'enable' || sub === '1') {
        setting.enabled = true;
        db.saveSync();
        return m.reply(`✅ *Auto Backup Berhasil Diaktifkan!*\n\nBot akan otomatis mencadangkan seluruh source code & database ke format *.zip* setiap *${setting.intervalHours} Jam*.`);
      }

      if (sub === 'off' || sub === 'disable' || sub === '0') {
        setting.enabled = false;
        db.saveSync();
        return m.reply('🔴 *Auto Backup Dinonaktifkan.*');
      }

      if (sub === 'now' || sub === 'run') {
        await m.reply('⏳ Menjalankan auto backup sekarang...');
        await performAutoBackupSystem(vynaa, true);
        return m.reply('✅ Auto backup berhasil dijalankan dan dikirim ke Owner!');
      }

      // Atur interval jam, misal: .autobackup 12h atau .autobackup 12
      const matchHours = sub.match(/^(\d+)(h|jam)?$/);
      if (matchHours) {
        const hours = parseInt(matchHours[1], 10);
        if (hours < 1 || hours > 168) {
          return m.reply('⚠️ Interval harus antara 1 sampai 168 jam (7 hari).');
        }
        setting.intervalHours = hours;
        setting.enabled = true;
        db.saveSync();
        return m.reply(`✅ *Interval Auto Backup Diubah!*\nAuto backup sekarang diatur setiap *${hours} Jam*.`);
      }

      // Default: Tampilkan Status & Panduan Auto Backup
      const lastStr = setting.lastBackup ? getJakartaTimeString(new Date(setting.lastBackup)) : 'Belum pernah';
      const nextTime = setting.lastBackup ? new Date(setting.lastBackup + (setting.intervalHours * 3600 * 1000)) : new Date();
      const nextStr = setting.enabled ? getJakartaTimeString(nextTime) : '-';

      return m.reply(`⚙️ *PENGATURAN AUTO BACKUP (.ZIP)*

• *Status:* ${setting.enabled ? '🟢 AKTIF' : '🔴 NONAKTIF'}
• *Interval:* Setiap ${setting.intervalHours} Jam
• *Terakhir Backup:* ${lastStr}
• *Jadwal Berikutnya:* ${nextStr}
• *Target Kirim:* WhatsApp Owner & Telegram Owner
• *Format File:* .ZIP (Source Code + Database)

📋 *Perintah Pengaturan:*
• \`.autobackup on\` ➔ Aktifkan auto backup
• \`.autobackup off\` ➔ Matikan auto backup
• \`.autobackup 12h\` ➔ Atur interval per 12 jam (bisa 6h, 12h, 24h)
• \`.autobackup now\` ➔ Jalankan backup sekarang
• \`.backup\` ➔ Ambil file backup .zip langsung ke chat ini`);
    }

    // 2. Backup Database Saja (.backupdb)
    if (command === 'backupdb') {
      try {
        await m.reply('⏳ Sedang menyiapkan file cadangan database.json...');
        await sendDatabaseBackup(vynaa, m.chat, m.raw);
      } catch (err) {
        return m.reply(`⚠️ Gagal mencadangkan database: ${err.message}`);
      }
      return;
    }

    // 3. Backup Full Source Code + Database dalam format .zip (.backup / .backupzip)
    try {
      await m.reply('⏳ Sedang memproses dan mengompres seluruh *Source Code & Database* ke format *.zip*...');
      await sendZipBackup(vynaa, m.chat, m.raw);
    } catch (err) {
      return m.reply(`⚠️ Gagal membuat backup .zip: ${err.message}`);
    }
  }
};
