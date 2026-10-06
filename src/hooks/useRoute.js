import { useCallback, useEffect, useState } from 'react';
function readRoute() {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'token' && /^0x[0-9a-fA-F]{40}$/.test(parts[1] || '')) return { page: 'token', address: parts[1] };
  return { page: ['wallet', 'launch', 'activity', 'guide'].includes(parts[0]) ? parts[0] : 'explore' };
}
export default function useRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const handle = () => { setRoute(readRoute()); window.scrollTo({ top: 0, behavior: 'auto' }); };
    window.addEventListener('hashchange', handle);
    return () => window.removeEventListener('hashchange', handle);
  }, []);
  const navigate = useCallback((page, address) => {
    const hash = page === 'token' ? `#/token/${address}` : `#/${page}`;
    window.location.hash = hash;
    setRoute(readRoute());
  }, []);
  return { route, navigate };
}
