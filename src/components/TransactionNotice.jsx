import { txUrl } from '../web3/client.js';
export default function TransactionNotice({ action }) {
  const { tx, retryReceipt } = action;
  const messages = { preparing: 'Memeriksa transaksi dan biaya gas…', awaiting: 'Konfirmasi di wallet…', pending: 'Transaksi terkirim, menunggu masuk blok…' };
  if (tx.state === 'idle') return null;
  return <div className={`txbox ${tx.state === 'success' ? 'success' : tx.state === 'error' ? 'error' : 'pending'}`} role="status"><b>{messages[tx.state] || tx.message}</b>{tx.warning && <p>{tx.warning}</p>}{tx.hash && <><br /><a href={txUrl(tx.hash)} target="_blank" rel="noreferrer">Lihat transaksi ↗</a></>}{tx.state === 'unknown' && <><br /><button className="text-button" onClick={retryReceipt}>Cek status kembali</button></>}</div>;
}
