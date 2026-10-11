'use client';

// Bay tablet display page: auto-refreshes QR token every 55 seconds
// Route: /bay/[bayId]  e.g. /bay/bay-wet-01
// The tablet at each waste bay shows this page full-screen

import { useEffect, useState, useCallback, use, Suspense } from 'react';
import QRCode from 'qrcode';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

// Waste type display metadata
const WASTE_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  wet:       { label: 'Wet Waste',       icon: '🌊', color: '#15803d', bg: '#dcfce7' },
  sanitary:  { label: 'Sanitary Waste',  icon: '🚽', color: '#b45309', bg: '#fef3c7' },
  dry:       { label: 'Dry / Recyclable',icon: '♻️', color: '#1d4ed8', bg: '#dbeafe' },
  furniture: { label: 'Bulky Furniture', icon: '🛋️', color: '#7c3aed', bg: '#ede9fe' },
  event:     { label: 'Event Waste',     icon: '🎉', color: '#db2777', bg: '#fce7f3' },
};

interface TokenData {
  qrData: string;
  signature: string;
  deepLink: string;
  wasteType: string;
  zoneId: string;
  bayId: string;
  exp: number;
  expiresInSeconds: number;
}

function BayContent({ params }: { params: Promise<{ bayId: string }> }) {
  const { bayId } = use(params);
  const [token, setToken] = useState<TokenData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [secondsLeft, setSecondsLeft] = useState(55);
  const [error, setError] = useState('');
  const [now, setNow] = useState<Date | null>(null); // null until hydrated — avoids prerender error

  const fetchToken = useCallback(async () => {
    if (!API_BASE) {
      // Demo mode: generate a fake token
      const fakeNonce = Math.random().toString(36).slice(2, 10);
      const fakeMeta = WASTE_META[bayId.replace('bay-', '').replace('-01', '')] ?? WASTE_META.wet;
      const wasteType = bayId.replace('bay-', '').replace('-01', '');
      const expTime = Math.floor(Date.now() / 1000) + 60;
      const payload = { bayId, zoneId: 'zone-koramangala-4', wasteType, iat: Math.floor(Date.now() / 1000), exp: expTime, nonce: fakeNonce };
      const qrData = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const fakeSig = 'demo-sig-' + fakeNonce;
      const deepLink = `bingo://scan?data=${qrData}&sig=${fakeSig}`;
      setToken({ qrData, signature: fakeSig, deepLink, wasteType, zoneId: 'zone-koramangala-4', bayId, exp: expTime, expiresInSeconds: 60 });
      setError('');
      setSecondsLeft(55);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/bays/${bayId}/token`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: TokenData = await res.json();
      setToken(data);
      setError('');
      setSecondsLeft(55);
    } catch (e: any) {
      setError('Failed to load token: ' + e.message);
    }
  }, [bayId]);

  // Generate QR code image from deep link
  useEffect(() => {
    if (!token) return;
    QRCode.toDataURL(token.deepLink, {
      width: 320,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).then(setQrDataUrl).catch(() => setQrDataUrl(''));
  }, [token]);

  // Auto-refresh token every 55s
  useEffect(() => {
    fetchToken();
    const interval = setInterval(fetchToken, 55000);
    return () => clearInterval(interval);
  }, [fetchToken]);

  // Countdown timer + clock — seeded on mount to avoid SSR prerender mismatch
  useEffect(() => {
    setNow(new Date()); // hydrate clock immediately on client
    const tick = setInterval(() => {
      setSecondsLeft(s => (s <= 1 ? 55 : s - 1));
      setNow(new Date());
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const meta = token ? (WASTE_META[token.wasteType] ?? WASTE_META.wet) : WASTE_META.wet;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ backgroundColor: meta.bg, fontFamily: 'system-ui, sans-serif' }}
    >
      {/* Header */}
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">{meta.icon}</div>
        <h1 className="text-3xl font-bold" style={{ color: meta.color }}>{meta.label}</h1>
        <p className="text-gray-500 text-sm mt-1">Bay: {bayId} · Zone: {token?.zoneId ?? '–'}</p>
      </div>

      {/* QR Code card */}
      <div className="bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-4 w-full max-w-sm">
        {!API_BASE && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded px-3 py-1 w-full text-center">
            Demo mode – QR is illustrative only
          </div>
        )}

        {error ? (
          <div className="text-red-600 text-sm text-center">{error}</div>
        ) : qrDataUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={qrDataUrl} alt="Bay QR code" className="rounded-xl" width={280} height={280} />
        ) : (
          <div className="w-[280px] h-[280px] bg-gray-100 rounded-xl animate-pulse flex items-center justify-center text-gray-400 text-sm">
            Loading QR…
          </div>
        )}

        {/* BinGo branding */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-xl font-bold text-gray-800">
            <span>🗑️</span> BinGo
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Scan with the BinGo resident app</p>
        </div>

        {/* Countdown ring */}
        <div className="flex flex-col items-center gap-1">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold border-4"
            style={{
              borderColor: secondsLeft > 15 ? meta.color : '#ef4444',
              color: secondsLeft > 15 ? meta.color : '#ef4444',
            }}
          >
            {secondsLeft}
          </div>
          <p className="text-xs text-gray-400">seconds left</p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-gray-400 text-xs">
        <p>{now ? now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '──:──:──'}</p>
        <p className="mt-1">Go to the zone. Bingo, done.</p>
      </div>
    </div>
  );
}

export default function BayPage({ params }: { params: Promise<{ bayId: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400">
          Loading bay...
        </div>
      }
    >
      <BayContent params={params} />
    </Suspense>
  );
}
