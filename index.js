/*
        ••JANGAN HAPUS INI••
SCRIPT BY © VYNAA VALERIE 
•• recode kasih credits 
•• contacts: (6282389924037) 
•• (github.com/VynaaValerie) 

•• Join https://whatsapp.com/channel/0029VbCaDhn11ulT1qwodB2x  

• Menerima pemberitahuan web
• Menerima pemberitahuan aplikasi 
• Menerima pembuatan script bot
• Menerima perbaikan script atau fitur bot
• Menerima pembuatan fitur bot
• Menerima semua kebutuhan bot
• Menerima Jadi Bot

ℹ️ Information

• Pembayaran bisa dicicil
• Bisa bayar di awal atau akhir
• Pembayaran melalu QRIS Only
• Testimoni Banyak

Aturan:
1. Dilarang memperjualbelikan script ini.
2. Hak cipta milik Vynaa Valerie.

“Dan janganlah kamu makan harta di antara kamu dengan jalan yang batil, dan janganlah kamu membunuh dirimu sendiri. Sesungguhnya Allah adalah Maha Penyayang kepadamu.” (QS. Al-Baqarah: 188)
*/
import fs from 'fs';
import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason, makeCacheableSignalKeyStore, Browsers } from '@whiskeysockets/baileys';
import pino from 'pino';
import chalk from 'chalk';
import readline from 'readline';
import path from 'path';
import qrcode from 'qrcode-terminal';
import { fileURLToPath } from 'url';
import config from './config.js';
import db from './lib/database.js';
import { messageHandler, groupParticipantsHandler } from './handler.js';
import { loadAllPlugins, watchPlugins, logger } from './lib/plugins.js';
import telegram from './lib/telegram.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


function sanitizeNumber(number) {
  if (!number) return '';
  let cleaned = String(number).replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  }
  return cleaned;
}

let currentSock = null;
let currentQR = null;
let isConnecting = false;
let sewaInterval = null;
let autoGroupInterval = null;
let autoBackupInterval = null;
let cachedTargetPhone = '';
let cachedUsePairing = true;

async function askUserLoginConfig(isRegistered) {
  if (isRegistered) return { usePairing: false, targetPhoneNumber: '' };
  if (cachedTargetPhone) return { usePairing: cachedUsePairing, targetPhoneNumber: cachedTargetPhone };

  // 1. Jika nomor pairing sudah terdefinisi di config.js
  if (config.pairingNumber && sanitizeNumber(config.pairingNumber).length >= 10) {
    cachedUsePairing = true;
    cachedTargetPhone = sanitizeNumber(config.pairingNumber);
    return { usePairing: true, targetPhoneNumber: cachedTargetPhone };
  }

  // 2. Jika berjalan di server/PM2 background tanpa TTY
  if (!process.stdin.isTTY) {
    logger.info('VPSDaemon', 'Mode VPS/Daemon aktif. Menunggu perintah sesi dari Telegram Bot (/getsesi)...');
    return { usePairing: false, targetPhoneNumber: '' };
  }

  // 3. Fallback jika terminal TTY lokal interaktif
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (q) => new Promise((resolve) => rl.question(q, (ans) => resolve(ans.trim())));

  try {
    console.log(chalk.hex('#00DFD8')('╭───────────────── [ METODE LOGIN ] ─────────────────╮'));
    console.log(chalk.hex('#00DFD8')('│') + chalk.white('  Pilih metode koneksi ke WhatsApp:                ') + chalk.hex('#00DFD8')('│'));
    console.log(chalk.hex('#00DFD8')('│') + chalk.yellow('  [1] Pairing Code (Kode 8 Digit via Telepon)      ') + chalk.hex('#00DFD8')('│'));
    console.log(chalk.hex('#00DFD8')('│') + chalk.green('  [2] QR Code (Scan Barcode di Terminal)           ') + chalk.hex('#00DFD8')('│'));
    console.log(chalk.hex('#00DFD8')('│') + chalk.magenta('  [3] Tunggu via Telegram Bot (/getsesi)          ') + chalk.hex('#00DFD8')('│'));
    console.log(chalk.hex('#00DFD8')('╰───────────────────────────────────────────────────╯'));

    const choice = await question(chalk.cyan(' Pilihan Anda (1/2/3) [Default: 1]: '));
    let usePairing = true;
    let targetPhoneNumber = sanitizeNumber(config.pairingNumber);

    if (choice === '3') {
      rl.close();
      return { usePairing: false, targetPhoneNumber: '' };
    } else if (choice === '2') {
      usePairing = false;
      logger.info('LoginMode', 'Mode QR Code dipilih. Barcode akan muncul di terminal...');
    } else {
      usePairing = true;
      while (!targetPhoneNumber || targetPhoneNumber.length < 10) {
        const defaultText = targetPhoneNumber ? ` [Default: ${targetPhoneNumber}]` : '';
        const inputNum = await question(chalk.cyan(` Masukkan Nomor WhatsApp Anda (contoh: 628xxx / 08xxx)${defaultText}: `));
        
        if (inputNum) {
          targetPhoneNumber = sanitizeNumber(inputNum);
        }

        if (!targetPhoneNumber || targetPhoneNumber.length < 10) {
          console.log(chalk.red(' ⚠️ Nomor tidak valid! Harap masukkan nomor lengkap (minimal 10 digit).'));
        }
      }
      logger.info('PairingTarget', `Target nomor pairing: +${targetPhoneNumber}`);
    }

    cachedUsePairing = usePairing;
    cachedTargetPhone = targetPhoneNumber;
    rl.close();
    return { usePairing, targetPhoneNumber };
  } catch (err) {
    rl.close();
    return { usePairing: false, targetPhoneNumber: sanitizeNumber(config.pairingNumber) };
  }
}

async function startBot() {
  if (isConnecting) return;
  isConnecting = true;

  logger.banner();

  // Muat semua fitur dari folder & subfolder /vynaafeture secara rekursif
  await loadAllPlugins();
  watchPlugins();

  const { state, saveCreds } = await useMultiFileAuthState(
    path.resolve(__dirname, config.sessionName)
  );

  const isRegistered = Boolean(state.creds?.registered);
  const { usePairing, targetPhoneNumber } = await askUserLoginConfig(isRegistered);

  const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307], isLatest: true }));
  logger.info('Baileys', `v${version.join('.')} (Latest: ${isLatest})`);

  // Konfigurasi Socket Stabil 2026 dengan Signal Key Cache Memory & Keep-Alive
  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    mobile: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
    },
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    version,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: true,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 0,
    keepAliveIntervalMs: 30000,
    retryRequestDelayMs: 2000,
    maxRetries: 5,
    getMessage: async () => ({ conversation: '' })
  });

  currentSock = sock;

  // Handle Pairing Code jika memilih metode 1 dari config atau terminal
  if (usePairing && !isRegistered && targetPhoneNumber && targetPhoneNumber.length >= 10) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(targetPhoneNumber);
        const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
        console.log('\n' + chalk.hex('#7928CA')('╔═══════════════════════════════════════════════════╗'));
        console.log(chalk.hex('#7928CA')('║') + chalk.hex('#00DFD8').bold(`   KODE PAIRING ANDA : ${chalk.white.bgHex('#7928CA').bold(` ${formattedCode} `)}            `) + chalk.hex('#7928CA')('║'));
        console.log(chalk.hex('#7928CA')('╠═══════════════════════════════════════════════════╣'));
        console.log(chalk.hex('#7928CA')('║') + chalk.gray('   1. Buka WhatsApp di Ponsel Anda                 ') + chalk.hex('#7928CA')('║'));
        console.log(chalk.hex('#7928CA')('║') + chalk.gray('   2. Masuk ke Perangkat Tertaut                   ') + chalk.hex('#7928CA')('║'));
        console.log(chalk.hex('#7928CA')('║') + chalk.gray('   3. Pilih Tautkan dengan Nomor Telepon           ') + chalk.hex('#7928CA')('║'));
        console.log(chalk.hex('#7928CA')('║') + chalk.gray(`   4. Masukkan kode: ${formattedCode}                `) + chalk.hex('#7928CA')('║'));
        console.log(chalk.hex('#7928CA')('╚═══════════════════════════════════════════════════╝\n'));
      } catch (err) {
        logger.error('PairingError', err.message || String(err));
      }
    }, 3000);
  }

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = qr;
      if (telegram) telegram.setLatestQR(qr);

      // Hanya cetak QR di terminal jika user di terminal interaktif lokal memilih metode QR
      if (!usePairing && !isRegistered && process.stdin.isTTY) {
        console.log(chalk.green('\nScan QR Code ini menggunakan WhatsApp Anda:\n'));
        qrcode.generate(qr, { small: true });
        console.log(chalk.gray('Buka WhatsApp -> Perangkat Tertaut -> Tautkan Perangkat -> Scan QR di atas.\n'));
      }
    }

    if (connection === 'close') {
      isConnecting = false;
      if (sewaInterval) clearInterval(sewaInterval);
      if (autoGroupInterval) clearInterval(autoGroupInterval);
      if (autoBackupInterval) clearInterval(autoBackupInterval);

      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const errorMsg = lastDisconnect?.error?.message || '';
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      logger.error('Disconnected', `Status: ${statusCode || 'Unknown'}${errorMsg ? ` (${errorMsg})` : ''}`);

      if (telegram) telegram.notifyDisconnected(errorMsg, shouldReconnect);

      if (shouldReconnect) {
        logger.info('Reconnect', 'Menyambung ulang dalam 3 detik...');
        setTimeout(startBot, 3000);
      } else {
        logger.error('SessionExpired', 'Sesi telah keluar. Hapus folder sesi untuk login ulang.');
        try {
          const sessionPath = path.resolve(__dirname, config.sessionName);
          if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            logger.info('SessionCleanup', 'Folder sesi telah dibersihkan otomatis.');
          }
        } catch (e) {}
      }
    } else if (connection === 'open') {
      isConnecting = false;
      currentQR = null;
      if (telegram) telegram.clearQR();
      logger.info('Gateway', 'Online & Terhubung ke WhatsApp Multi-Device');

      if (telegram) telegram.notifyConnected(sock);

      // Jalankan pengecekan masa sewa otomatis berkala setiap 60 detik (Expired & Reminder H-1)
      if (sewaInterval) clearInterval(sewaInterval);
      sewaInterval = setInterval(async () => {
        try {
          const now = Date.now();
          for (const [chatId, chat] of Object.entries(db.data.chats || {})) {
            if (!chat.sewa?.active || !chat.sewa?.expired) continue;

            // 1. Cek masa sewa habis
            if (now > chat.sewa.expired) {
              logger.info('SewaExpired', `Masa sewa habis di: ${chat.name || chatId}`);

              // Kirim ucapan pamit ke grup
              await sock.sendMessage(chatId, {
                text: `┌── [ MASA SEWA TELAH HABIS ]
│
├ Masa sewa bot di grup ini telah selesai.
├ Terima kasih telah menggunakan layanan ${config.botName}.
│
└── [ Bot akan keluar secara otomatis. Hubungi Owner untuk perpanjang ]`
              }).catch(() => {});

              // Matikan status sewa dan tinggalkan grup
              chat.sewa.active = false;
              db.saveSync();
              await sock.groupLeave(chatId).catch(() => {});
              continue;
            }

            // 2. Cek pengingat otomatis H-1 (tersisa <= 24 jam)
            const timeLeft = chat.sewa.expired - now;
            const oneDayMs = 24 * 60 * 60 * 1000;
            if (timeLeft > 0 && timeLeft <= oneDayMs && !chat.sewa.reminderH1) {
              let expiredDateStr = '';
              try {
                expiredDateStr = new Intl.DateTimeFormat('id-ID', {
                  timeZone: 'Asia/Jakarta',
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }).format(new Date(chat.sewa.expired)) + ' WIB';
              } catch {
                expiredDateStr = new Date(chat.sewa.expired).toLocaleString('id-ID');
              }

              logger.info('SewaH1', `Peringatan sewa H-1 dikirim ke: ${chat.name || chatId}`);

              // Kirim peringatan ke grup
              await sock.sendMessage(chatId, {
                text: `┌── [ ⚠️ PEMBERITAHUAN MASA SEWA (H-1) ]
│
├ Perhatian Admin & Anggota Grup:
├ Masa sewa ${config.botName} di grup ini tersisa kurang dari 24 JAM (H-1)!
│
├ Nama Grup     : ${chat.name || chatId}
├ Berakhir Pada : ${expiredDateStr}
│
├── [ PENTING ]
│ ├ Segera hubungi Owner untuk perpanjangan masa sewa
│ ├ Jika masa sewa habis, bot akan pamit & keluar otomatis
│
└── [ Ketik .owner untuk menghubungi Owner Bot ]`
              }).catch(() => {});

              // Kirim notifikasi juga ke Owner
              const primaryOwnerNum = config.owner?.[0] || '6283872659753';
              const primaryOwnerJid = `${primaryOwnerNum.replace(/\D/g, '')}@s.whatsapp.net`;
              await sock.sendMessage(primaryOwnerJid, {
                text: `⚠️ *[REMINDER SEWA H-1]*\n\nMasa sewa bot di grup *${chat.name || chatId}* tersisa kurang dari 24 jam.\n• Berakhir: ${expiredDateStr}\n• ID Grup: ${chatId}`
              }).catch(() => {});

              chat.sewa.reminderH1 = true;
              db.saveSync();
            }
          }
        } catch (err) {
          // Tangani silent
        }
      }, 60000);

      // Scheduler otomatis backup source code & database (.zip) berkala
      if (autoBackupInterval) clearInterval(autoBackupInterval);
      const checkAndRunAutoBackup = async () => {
        try {
          const { performAutoBackupSystem } = await import('./vynaafeture/owner-backup.js');
          await performAutoBackupSystem(sock);
        } catch (err) {
          logger.error('AutoBackupError', err.message || String(err));
        }
      };
      autoBackupInterval = setInterval(checkAndRunAutoBackup, 15 * 60 * 1000);
      setTimeout(checkAndRunAutoBackup, 15000);

      // Scheduler otomatis buka / tutup grup berkala setiap 30 detik
      if (autoGroupInterval) clearInterval(autoGroupInterval);
      autoGroupInterval = setInterval(async () => {
        try {
          let nowWib = '';
          try {
            nowWib = new Intl.DateTimeFormat('id-ID', {
              timeZone: 'Asia/Jakarta',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            }).format(new Date());
          } catch {
            const d = new Date();
            nowWib = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          }

          for (const [chatId, chat] of Object.entries(db.data.chats || {})) {
            if (!chat?.autogroup?.active) continue;

            if (nowWib === chat.autogroup.openTime && chat.autogroup.lastAction !== 'opened') {
              await sock.groupSettingUpdate(chatId, 'not_announcement').catch(() => {});
              await sock.sendMessage(chatId, {
                text: '📢 *PEMBERITAHUAN JADWAL GRUP*\n\nWaktu operasional telah tiba! Grup otomatis *DIBUKA* kembali untuk seluruh member. Selamat beraktivitas & bertransaksi!'
              }).catch(() => {});
              chat.autogroup.lastAction = 'opened';
              db.save();
            } else if (nowWib === chat.autogroup.closeTime && chat.autogroup.lastAction !== 'closed') {
              await sock.groupSettingUpdate(chatId, 'announcement').catch(() => {});
              await sock.sendMessage(chatId, {
                text: '🔒 *PEMBERITAHUAN JADWAL GRUP*\n\nWaktu operasional telah berakhir! Grup otomatis *DITUTUP* sementara. Hanya admin yang dapat mengirim pesan. Sampai jumpa besok pagi!'
              }).catch(() => {});
              chat.autogroup.lastAction = 'closed';
              db.save();
            }
          }
        } catch (err) {
          // Tangani silent
        }
      }, 30000);
    } else if (connection === 'connecting') {
      logger.info('Connecting', 'Menghubungkan ke server WhatsApp Gateway...');
    }
  });

  // Listener pesan masuk
  sock.ev.on('messages.upsert', async (chatUpdate) => {
    await messageHandler(sock, chatUpdate).catch(() => {});
  });

  // Listener update peserta grup (Welcome & Bye dengan foto profil)
  sock.ev.on('group-participants.update', async (update) => {
    await groupParticipantsHandler(sock, update).catch(() => {});
  });

  return sock;
}

// Setup Telegram Remote Controller Handlers
if (config.telegram?.enabled && config.telegram?.token) {
  telegram.handlers = {
    getSocket: () => currentSock,
    requestPairingCode: async (phone) => {
      if (!currentSock) {
        throw new Error('Socket WhatsApp belum siap. Sedang inisialisasi, tunggu sebentar...');
      }
      if (currentSock?.user?.id) {
        throw new Error(`WhatsApp sudah terhubung (+${currentSock.user.id.split(':')[0]}). Hapus sesi dahulu jika ingin mengganti akun.`);
      }

      // Pastikan WebSocket Baileys sudah terbuka sebelum request code
      if (!currentSock.ws?.isOpen) {
        logger.info('PairingCode', 'Menunggu WebSocket WhatsApp terhubung...');
        for (let i = 0; i < 20; i++) {
          if (currentSock?.ws?.isOpen) break;
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      if (!currentSock?.ws?.isOpen) {
        throw new Error('Koneksi WebSocket ke WhatsApp belum terbuka. Silakan tunggu beberapa detik lalu coba lagi.');
      }

      const code = await currentSock.requestPairingCode(phone);
      const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;

      // Cetak juga di console terminal sama persis seperti console
      console.log('\n' + chalk.hex('#7928CA')('╔═══════════════════════════════════════════════════╗'));
      console.log(chalk.hex('#7928CA')('║') + chalk.hex('#00DFD8').bold(`   KODE PAIRING ANDA : ${chalk.white.bgHex('#7928CA').bold(` ${formattedCode} `)}            `) + chalk.hex('#7928CA')('║'));
      console.log(chalk.hex('#7928CA')('╠═══════════════════════════════════════════════════╣'));
      console.log(chalk.hex('#7928CA')('║') + chalk.gray('   1. Buka WhatsApp di Ponsel Anda                 ') + chalk.hex('#7928CA')('║'));
      console.log(chalk.hex('#7928CA')('║') + chalk.gray('   2. Masuk ke Perangkat Tertaut                   ') + chalk.hex('#7928CA')('║'));
      console.log(chalk.hex('#7928CA')('║') + chalk.gray('   3. Pilih Tautkan dengan Nomor Telepon           ') + chalk.hex('#7928CA')('║'));
      console.log(chalk.hex('#7928CA')('║') + chalk.gray(`   4. Masukkan kode: ${formattedCode}                `) + chalk.hex('#7928CA')('║'));
      console.log(chalk.hex('#7928CA')('╚═══════════════════════════════════════════════════╝\n'));

      return code;
    },
    resetSession: async () => {
      try {
        if (currentSock) currentSock.end(undefined);
      } catch (e) {}
      cachedTargetPhone = '';
      cachedUsePairing = true;
      currentSock = null;
      currentQR = null;
      isConnecting = false;
      setTimeout(startBot, 2000);
    },
    restartBot: async () => {
      logger.info('Restart', 'Memulai ulang bot sesuai permintaan Telegram Owner...');
      process.exit(0);
    },
    triggerQR: async () => {
      if (currentQR) {
        await telegram.sendQRCodePhoto(telegram.ownerId, currentQR);
      } else {
        if (currentSock && !currentSock?.user?.id) {
          logger.info('TelegramQR', 'Menunggu QR Code dari gateway WhatsApp...');
        }
      }
    }
  };

  telegram.startPolling().catch((err) => {
    logger.error('TelegramError', err.message || String(err));
  });
}

// Optimasi performa VPS: Bersihkan memory V8 secara berkala jika flag --expose-gc diaktifkan
if (global.gc) {
  setInterval(() => {
    try {
      global.gc();
      logger.info('V8-GC', 'Memori V8 berhasil dibersihkan otomatis.');
    } catch (e) {}
  }, 30 * 60 * 1000);
}

// Jalankan bot
startBot().catch((err) => {
  isConnecting = false;
  logger.error('FatalError', err.message);
});
/*
        ••JANGAN HAPUS INI••
SCRIPT BY © VYNAA VALERIE 
•• recode kasih credits 
•• contacts: (6282389924037) 
•• (github.com/VynaaValerie) 

•• Join https://whatsapp.com/channel/0029VbCaDhn11ulT1qwodB2x  

• Menerima pemberitahuan web
• Menerima pemberitahuan aplikasi 
• Menerima pembuatan script bot
• Menerima perbaikan script atau fitur bot
• Menerima pembuatan fitur bot
• Menerima semua kebutuhan bot
• Menerima Jadi Bot

ℹ️ Information

• Pembayaran bisa dicicil
• Bisa bayar di awal atau akhir
• Pembayaran melalu QRIS Only
• Testimoni Banyak

Aturan:
1. Dilarang memperjualbelikan script ini.
2. Hak cipta milik Vynaa Valerie.

“Dan janganlah kamu makan harta di antara kamu dengan jalan yang batil, dan janganlah kamu membunuh dirimu sendiri. Sesungguhnya Allah adalah Maha Penyayang kepadamu.” (QS. Al-Baqarah: 188)
*/