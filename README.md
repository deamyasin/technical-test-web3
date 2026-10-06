# Launchpad — Robinhood Chain Testnet

**[Live demo](https://technical-test.dea.web.id/)** · **[Source code](https://github.com/deamyasin/technical-test-web3)**

Aplikasi Web3 untuk menemukan token baru, membeli dan menjual melalui bonding curve, meluncurkan token, serta memantau portofolio dan aktivitas onchain. Dibangun untuk technical assessment fullstack Web3 dengan fokus pada integrasi smart contract, ketepatan perhitungan, dan pengalaman transaksi yang jelas.

## Fitur

- **Explore:** discovery token dari event factory, pencarian, filter status, pengurutan, dan progres graduation.
- **Trading:** estimasi buy/sell, pengaturan slippage, simulasi transaksi, pemeriksaan saldo dan gas, serta output aktual dari receipt.
- **My wallet:** saldo ETH dan token, token yang pernah dibeli, riwayat buy/sell, dan tautan explorer.
- **Create:** launch token dengan metadata, creator tax, buyback, dan validasi izin serta biaya factory.
- **Token detail:** metadata, creator, reserve, fee, aktivitas, approve/sell, dan pembuatan pool ketika token memasuki phase 1.
- **Wallet connection:** RainbowKit, MetaMask, Rainbow, Trust Wallet, WalletConnect, dan discovery extension melalui EIP-6963.
- **Antarmuka responsif:** tema charcoal–lime, tampilan desktop/mobile, serta state loading, empty, error, dan pending.

## Stack dan arsitektur

| Bagian | Teknologi / pendekatan |
| --- | --- |
| Frontend | React 18, Vite, CSS |
| Interaksi kontrak | viem, ABI lengkap dari assessment |
| Koneksi wallet | Wagmi 2, RainbowKit 2, WalletConnect |
| Query wallet | TanStack Query |
| Data aplikasi | RPC publik, event logs, Multicall3 |
| Navigasi | Hash routing dengan deep link |

Aplikasi membaca data langsung dari chain dan meminta tanda tangan melalui wallet pengguna. Tidak memerlukan backend, penyimpanan private key, atau kontrak baru.

### Keputusan implementasi

- **Discovery berbasis event:** `TokenLaunched` dibaca sejak deployment dalam rentang maksimal 50.000 blok, dengan concurrency tiga dan deduplikasi berdasarkan alamat token. Daftar token tidak di-hardcode.
- **Snapshot konsisten:** metadata, reserve, fee, dan phase dibaca melalui Multicall3 pada block yang sama. Kegagalan data wajib menonaktifkan transaksi; metadata opsional memiliki fallback.
- **Perhitungan bigint:** jumlah token, fee, tax, dan slippage memakai integer arithmetic. Input ETH dibatasi hingga 18 desimal; format tampilan dipisahkan dari nilai transaksi.
- **Transaksi terverifikasi:** simulasi diulang sebelum pengiriman, akun/network diperiksa melalui connector yang dipilih, dan estimasi gas diberi headroom 20%. Output sukses berasal dari event receipt, bukan estimasi.
- **Lifecycle transaksi:** konfirmasi wallet, pending, sukses, rejection, revert, replacement, dan receipt yang belum diketahui ditangani terpisah. Pengecekan receipt dapat diulang tanpa mengirim transaksi kedua.
- **Pembaruan data:** polling setiap 20 detik, refresh manual, dan refetch setelah transaksi. Respons saldo akun lama diabaikan ketika pengguna mengganti akun.
- **Navigasi saat pending:** halaman transaksi tetap mounted; satu transaksi aktif memblokir pengiriman transaksi lain.

## Menjalankan secara lokal

Prasyarat: Node.js 20.19+ atau 22.12+, npm, dan wallet EVM.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Buka `http://localhost:5173`, hubungkan wallet, lalu pindah ke Robinhood Chain Testnet. ETH untuk transaksi tersedia melalui [faucet testnet](https://faucet.testnet.chain.robinhood.com/).

```bash
npm run check:wallet
npm run build
npm run preview
```

`check:wallet` memeriksa kompatibilitas renderer QR dengan URI WalletConnect. Untuk hosting statis, publish seluruh folder `dist`, termasuk assets dan fonts.

### Konfigurasi WalletConnect

`.env.example` memuat Project ID publik untuk project ini. Untuk deployment sendiri, gunakan project dari [Reown Dashboard](https://dashboard.reown.com):

```dotenv
VITE_WALLETCONNECT_PROJECT_ID=<public-project-id>
```

Konfigurasikan allowlist origin untuk domain deployment dan development. Restart development server atau build ulang setelah mengubah environment variable. Project ID bersifat publik; seed phrase dan private key tidak diperlukan.

Tanpa Project ID valid, koneksi injected/EIP-6963 tetap tersedia. Koneksi dari browser mobile biasa menggunakan WalletConnect atau browser internal aplikasi wallet; tautan untuk membuka dApp di MetaMask tersedia sebagai fallback.

## Konfigurasi chain

| Parameter | Nilai |
| --- | --- |
| Network | Robinhood Chain Testnet |
| Chain ID | `46630` |
| Native currency | ETH |
| Factory | `0x533cE670f1372cb402D49866608b92e7bc2b4493` |
| Deployment block | `129157568` |
| Explorer | [Robinhood Explorer](https://explorer.testnet.chain.robinhood.com) |

Konfigurasi berada di `src/web3/chain.js`. RPC resmi digunakan sebagai endpoint utama, dengan fallback ke PublicNode.

## Halaman

| Route | Fungsi |
| --- | --- |
| `#/explore` | Discovery dan pembelian token |
| `#/wallet` | Portofolio dan riwayat wallet |
| `#/launch` | Peluncuran token |
| `#/activity` | Aktivitas buy/sell dan pencarian transaksi |
| `#/token/<address>` | Detail token, penjualan, dan graduation |
| `#/guide` | Panduan penggunaan dan penjelasan status token |

Hash routing mendukung reload, bookmark, serta browser back/forward tanpa konfigurasi rewrite pada hosting statis.

## Perilaku kontrak

**Buy:** estimasi memperhitungkan fee, creator tax, dan snipe tax berdasarkan recipient. Dekat graduation, kontrak dapat melakukan partial fill dan mengembalikan sisa ETH. Jumlah token aktual dibaca dari `CurveBuy`.

**Sell:** jika allowance belum cukup, pengguna terlebih dahulu menyetujui jumlah token yang akan dijual. Penjualan dilakukan melalui transaksi terpisah dengan `minQuoteOut` berdasarkan slippage. Output ETH dibaca dari `CurveSell`.

**Launch:** memakai overload tiga argumen, config 1, dan pair ETH. Izin `canLaunch`, `launchFee`, serta `expectedEconomics` dibaca ulang sebelum pengiriman; salt 32 byte dibuat acak untuk setiap percobaan.

**Graduation:** `createGraduatedPool` tersedia pada phase 1. Phase 2/3 menonaktifkan trading melalui curve.

Implementasi mengacu pada ABI dan [source kontrak terverifikasi](https://sourcify.dev/server/v2/contract/46630/0x168EA1234652A5dA6bf84D2C1fD243326412B5b2?fields=sources). Source menerapkan batas snipe tax `9900 − feeBps − creatorTaxBps` dan memperhitungkan partial fill saat memvalidasi slippage.

## Validasi dan cakupan

Production build dan pemeriksaan QR WalletConnect berhasil. Render halaman diperiksa pada viewport 1440 px dan 375 px, termasuk deep link, modal wallet, dan layar QR. Reconnect serta disconnect diperiksa menggunakan provider fixture read-only.

Transaksi testnet untuk buy, approval/sell, dan launch telah dijalankan. Contoh hasil launch adalah token **Dea Muhamad Yasin (TEST)**: [lihat transaksi](https://explorer.testnet.chain.robinhood.com/tx/0x836cd7a257fd3ddf89eccf787ea701cb4b057d8360896d36ca3cbf9684315e9e).

Cakupan aplikasi saat ini:

- Discovery dan portofolio hanya mencakup token pair ETH dari factory assessment; bukan seluruh aset wallet.
- Saldo dibaca dari `balanceOf`; riwayat buy/sell berasal dari event. Transfer dapat mengubah saldo tanpa menambah riwayat pembelian.
- Belum menyediakan swap pada pool v4, indexer, persistent cache, atau rekonsiliasi reorg. Pengambilan riwayat awal bergantung pada RPC publik.
- Simulasi dan estimasi tidak menjamin harga atau gas saat transaksi masuk ke block.
- Handoff aplikasi wallet dan tanda tangan transaksi pada perangkat Android/iOS asli, serta transaksi graduation phase 1, belum terverifikasi dalam pemeriksaan yang didokumentasikan.

Dependency override `cuer → qr@0.5.4` mempertahankan kompatibilitas renderer QR RainbowKit; `qr@0.7.2` menolak konfigurasi `border=0`. Regression check disediakan agar perubahan dependency tidak merusak layar QR.

## Screenshots

| Halaman | Desktop | Mobile |
| --- | --- | --- |
| Explore | [Lihat](screenshots/web3-desktop.png) | [Lihat](screenshots/web3-mobile.png) |
| My wallet | [Lihat](screenshots/profile-desktop.png) | [Lihat](screenshots/profile-mobile.png) |
| Create | [Lihat](screenshots/launch-desktop.png) | [Lihat](screenshots/launch-mobile.png) |
| Activity | [Lihat](screenshots/activity-desktop.png) | [Lihat](screenshots/activity-mobile.png) |
| Token detail | [Lihat](screenshots/token-detail-desktop.png) | [Lihat](screenshots/token-detail-mobile.png) |
| Guide | [Lihat](screenshots/guide-desktop.png) | [Lihat](screenshots/guide-mobile.png) |
| Wallet modal | [Lihat](screenshots/wallet-modal-desktop.png) | [Lihat](screenshots/wallet-modal-mobile.png) |

Screenshot menggunakan data chain nyata. Tampilan profil dan beberapa halaman pendukung menggunakan koneksi wallet fixture read-only; screenshot tidak menjadi bukti tanda tangan transaksi.
