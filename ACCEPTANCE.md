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
| Launch nama kandidat + TEST | Belum tersedia; perlu canLaunch, nama kandidat dan transaksi nyata. |
| Sell approve + sell | Belum tersedia. |
| Detail description/creator + CurveBuy/CurveSell | Belum lengkap; history profil bukan halaman detail token. |
| Search/sort | Search nama/simbol/alamat ada, sort aktif dahulu/progres terbesar otomatis; kontrol sort manual belum ada. |
| createGraduatedPool phase 1 | Belum tersedia. |

Bonus tidak diwajibkan agar inti terpenuhi. Sebelum penyerahan: lengkapi bukti MetaMask/error/refetch, push + clone verification, dan redeploy fitur profil. Jangan menyatakan semua test lolos berdasarkan build saja.
