# Audit acceptance technical brief

Sumber: TASK-BRIEF.md, source saat ini, screenshot Chromium, dan catatan Muse/Luna di `../log-ai.txt`. Implementasi tersedia tidak otomatis berarti seluruh testing sudah lolos.

## Requirement inti

| Langkah | Implementasi | Bukti tersedia | Acceptance yang belum terbukti |
| --- | --- | --- | --- |
| 1. Setup + network | Vite, chain 46630, factory, Multicall3, launchFee, RPC fallback. | Build dan screenshot launch fee. | Setup dari clone bersih. |
| 2. Wallet | Connect/disconnect, alamat/saldo, add/switch, listener akun/network. | UI tanpa wallet terverifikasi. | MetaMask nyata: connect/disconnect, add chain, switch/reject, account/chain changes. |
| 3. Discovery | Event sejak deploy, chunk inklusif 50.000, dedupe, polling/refresh. Pair non-ETH disaring dan didokumentasikan. | Luna: 5/5 alamat cocok, 10 chunk. | Launch token baru saat halaman terbuka, cek discovery berikutnya. |
| 4. Data token | Metadata/reserve/realQuote/threshold/phase, multicall allowFailure, bigint price/progress, cap 100%, failed data blocks buy. | Lima token dan GRAD phase 2 terlihat; audit ABI/source. | Partial multicall failure, zero reserve/threshold, phase 1/3 melalui fixture. |
| 5. Daftar/UI | Placeholder, semua status, loading/empty/error/retry, desktop/mobile. | Screenshot asli desktop + 375px tanpa overflow. | Logo rusak, empty/RPC error/retry terkontrol. |
| 6. Estimasi | Bigint, parseEther <=18 decimals, fee/tax/snipe tax, default slippage 1%, minOut, gating wallet/chain/input/saldo termasuk gas. | Estimasi live; satu buy Luna output sama persis ketika snipe tax nol. | TAXED 10% melalui UI, insufficient gas, recipient exemption. Parser >18 desimal/nol dan .001 serta invariant bigint tax/slippage sudah lolos pemeriksaan Codex. |
| 7. Transaksi | Simulasi, buy/value/recipient, event actual output, awaiting/pending/success/reject/error, replacement hash, unknown receipt retry. | Buy EARLY 0.002 ETH sukses menurut Luna; hash di bawah. | MetaMask awaiting/pending, reject 4001, custom error melalui transaksi, timeout/retry, replacement/cancel. Decode nested SlippageExceeded dari data ABI sudah lolos pemeriksaan Codex. |
| 8. Refetch | Kartu reserve/progress/phase + ETH + saldo token, initial token balance, error refetch tetap transaksi sukses. | Implementasi di source. | Beli lewat UI: rekam ketiga data sebelum/sesudah tanpa reload; switch akun saat pending. |
| 9. README/demo | Run/setup/keputusan/AI/keterbatasan/source mismatch; screenshot di project. | README/screenshots, commit lokal dan deployment desain dicatat Luna. | Push repo + URL penyerahan, invite kodomo-toothpaste jika private, clone baru, laporan mismatch ke pengawas. |

Transaksi nyata yang dicatat Luna: `0x9ef408c5ead25df063cbc1492284fc8fb3b5499d54ab5120c5566b0ef7890f7e`.

Source curve memiliki snipe tax recipient-dependent dan partial fill/refund; aplikasi mengikuti source sesuai brief. Laporan kepada pengawas belum dibuktikan. Detail hasil verifikasi tambahan dicatat di log bersama.

## Tambahan user: profil wallet

Profil bukan requirement inti brief awal; ditambahkan sebagai scope baru pada tab **My wallet**:

- Alamat wallet, ETH balance, salin alamat, explorer.
- Saldo seluruh token supported memakai Multicall3 balanceOf; bukan penjumlahan riwayat buy.
- Token yang dimiliki (termasuk hasil transfer) atau pernah dibeli, walau saldo sekarang nol.
- Riwayat CurveBuy berdasarkan recipient wallet: token output aktual, ETH input aktual, block dan link receipt.
- ETH spent hanya event dengan buyer wallet sendiri, tanpa gas; hadiah dari buyer lain tidak menambah spent. Bukan PNL/valuasi pasar.
- Scan dari deployment, chunk 50.000, concurrency 3, cache memori per account/curve, incremental polling. Riwayat dibangun lagi dari chain sesudah reload/connect.
- Loading/empty/error/retry; respons akun lama diabaikan; BuyForm tetap mounted saat ganti view agar pending transaction tetap dilacak.

Scope: token pair ETH factory tes ini. Tidak mencakup seluruh aset semua chain, pembelian pool v4, atau riwayat sell/transfer lengkap. Identitas dApp memakai wallet; tidak perlu password/email/backend account.

Acceptance profil: akun dengan pembelian, akun kosong, hasil transfer, bought-but-zero balance, reload, switch akun, error RPC, refresh sesudah buy, navigasi saat pending dan mobile. Verifikasi read-only Codex berhasil: lima token ditemukan, dua event pembelian dan dua saldo positif untuk wallet penerima transaksi Luna; quoteIn/tokensOut history cocok dengan receipt; panggilan incremental tidak menduplikasi event. Bukti build/render terbaru ada di log. Pengujian UI dengan fixture provider bukan bukti MetaMask asli; acceptance MetaMask ditangani Muse/Luna.

## Bonus brief

| Bonus | Status |
| --- | --- |
| Launch nama kandidat + TEST | Form tersedia: overload 3 args, config1/ETH, fresh fee/economics, random salt dan canLaunch. Encoding ABI + render lolos; launch nyata memakai nama kandidat belum dibuktikan. |
| Sell approve + sell | Tersedia pada detail token: exact approve, receipt, sell/slippage dan CurveSell output. Rumus diperiksa terhadap source, parser/invariant fee lolos; dua transaksi nyata masih perlu diuji. |
| Detail description/creator + CurveBuy/CurveSell | Halaman detail tersedia dengan metadata/creator/fee/socials dan aktivitas token. Pembacaan metadata dan aktivitas nyata lolos; belum ada event sell nyata yang teramati saat audit. |
| Search/sort | Search dan filter phase tersedia, sort manual progress/newest/name tersedia. Activity dapat difilter buy/sell dan dicari. |
| createGraduatedPool phase 1 | Tombol dan simulasi/transaksi/refetch tersedia, gated phase1. Token contoh tidak menyediakan phase1; pengujian nyata belum dilakukan. |

Bonus tidak diwajibkan agar inti terpenuhi. Sebelum penyerahan: lengkapi bukti MetaMask/error/refetch, push + clone verification, dan redeploy fitur profil. Jangan menyatakan semua test lolos berdasarkan build saja.


## Halaman tambahan dan bukti terbaru

Explore, wallet, create, activity, guide, dan token detail memiliki URL hash/deep link. Provider fixture read-only dipakai untuk visual dengan data chain nyata; tidak ada signature/transaksi write dari Codex. Buy/Sell/Launch/Graduation memakai global transaction lock; pending action tetap mounted ketika navigasi.

Pemeriksaan read-only terakhir: lima token, tujuh event buy, belum ada event sell, tiga trade wallet; metadata/token activity/dedupe berhasil. Token parser menolak precision berlebih, fee round-trip buy→sell menurunkan ETH sesuai biaya, unsafe URL ditolak, encoding launch tiga argumen dan nested NotWhitelisted diterjemahkan. Render halaman pendukung 1440/375 px tidak overflow, deep-link reload berhasil, runtime exceptions nol.

**Tetap belum boleh disebut seluruh acceptance terpenuhi:** hasil write MetaMask bonus, reject/revert UI inti, post-buy refetch visual, token discovery baru, submission/push, clone baru dan laporan source mismatch harus memiliki bukti. Penyerahan repository terbaru menurut Luna gagal autentikasi GitHub; kandidat perlu login/push lewat perangkatnya. Bonus hanya tuntas jika transaksi benar-benar berhasil, bukan sekadar form tersedia.

## Wallet mobile — RainbowKit / WalletConnect

Implementasi: RainbowKit 2 + Wagmi 2, MetaMask/Rainbow/Trust Wallet/WalletConnect dan injected EIP-6963, chain custom 46630, reconnect sesi, ganti akun/network, disconnect, dan seluruh transaksi via connector terpilih. Project ID publik sudah dikonfigurasi di `.env.local` (ignored). Deployment harus menyediakan VITE_WALLETCONNECT_PROJECT_ID saat build dan allowlist origin di Reown.

Acceptance tambahan: Android Chrome/iOS Safari → buka wallet → approve → kembali ke dApp; desktop scan QR; reconnect setelah reload; reject, ganti akun/network, buy/sell/launch lewat wallet mobile. Browser smoke/fixture bukan bukti pengujian handoff aplikasi wallet nyata.

Bukti pemeriksaan Codex: production build PASS; regression check QR PASS; modal 375/1440 px tanpa overflow; QR WalletConnect tampil (3 SVG), runtime exceptions 0; fixture read-only EIP-6963 reconnect setelah reload + disconnect PASS. Tidak ada transaksi ditandatangani selama pemeriksaan ini.
