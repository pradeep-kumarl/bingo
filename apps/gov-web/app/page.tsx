"use client";

import { useEffect, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Vehicle {
  id: string;
  wasteType: string;
  fillPct: number;
  currentKg: number;
  capacityKg: number;
  status: "active" | "swapping" | "full";
}

interface BinCard {
  wet: boolean;
  sanitary: boolean;
  dry: boolean;
  furniture: boolean;
  event: boolean;
}

interface Household {
  id: string;
  name: string;
  streak: number;
  isOutOfStation: boolean;
  lastActive: string;
  bins: BinCard;
}

interface Alert {
  id: string;
  zone: string;
  wasteType: string;
  vehicleId: string;
  fillPct: number;
  timestamp: string;
  status: "PENDING" | "ACKNOWLEDGED";
}

interface Zone {
  name: string;
  ward: string;
  totalHouseholds: number;
  activeVehicles: number;
}

interface DashboardData {
  zone: Zone;
  vehicles: Vehicle[];
  households: Household[];
  alerts: Alert[];
}

// ─── Mock data (mirrors seed.ts) ──────────────────────────────────────────────

const MOCK: DashboardData = {
  zone: {
    name: "Koramangala 4th Block Hub",
    ward: "Ward 151",
    totalHouseholds: 180,
    activeVehicles: 5,
  },
  vehicles: [
    { id: "VH-WET-01",  wasteType: "wet",       fillPct: 73.5, currentKg: 735,  capacityKg: 1000, status: "active" },
    { id: "VH-SAN-01",  wasteType: "sanitary",  fillPct: 38,   currentKg: 190,  capacityKg: 500,  status: "active" },
    { id: "VH-DRY-01",  wasteType: "dry",        fillPct: 51.7, currentKg: 620,  capacityKg: 1200, status: "active" },
    { id: "VH-FURN-01", wasteType: "furniture", fillPct: 22.5, currentKg: 450,  capacityKg: 2000, status: "active" },
    { id: "VH-EVNT-01", wasteType: "event",     fillPct: 21.3, currentKg: 320,  capacityKg: 1500, status: "active" },
  ],
  households: [
    {
      id: "HH-101", name: "Priya Sharma", streak: 6, isOutOfStation: false,
      lastActive: "2026-10-10",
      bins: { wet: false, sanitary: true, dry: true, furniture: true, event: true },
    },
    {
      id: "HH-102", name: "Devika Menon", streak: 3, isOutOfStation: false,
      lastActive: "2026-10-10",
      bins: { wet: true, sanitary: false, dry: true, furniture: false, event: false },
    },
    {
      id: "HH-103", name: "Kabir Mehta", streak: 0, isOutOfStation: true,
      lastActive: "2026-10-07",
      bins: { wet: false, sanitary: false, dry: false, furniture: false, event: false },
    },
    {
      id: "HH-104", name: "Lakshmi Narayanan", streak: 0, isOutOfStation: false,
      lastActive: "2026-10-07",
      bins: { wet: false, sanitary: false, dry: false, furniture: false, event: false },
    },
  ],
  alerts: [
    {
      id: "ALT-001",
      zone: "zone-indiranagar-1",
      wasteType: "dry",
      vehicleId: "VH-DRY-02",
      fillPct: 78.4,
      timestamp: "30 mins ago",
      status: "PENDING",
    },
  ],
};

// ─── Constants ────────────────────────────────────────────────────────────────

const WASTE_META: Record<string, { icon: string; label: string; color: string }> = {
  wet:       { icon: "💧", label: "Wet",       color: "text-blue-600" },
  sanitary:  { icon: "🧻", label: "Sanitary",  color: "text-pink-600" },
  dry:       { icon: "📦", label: "Dry",        color: "text-yellow-600" },
  furniture: { icon: "🛋️", label: "Furniture", color: "text-purple-600" },
  event:     { icon: "🎉", label: "Event",     color: "text-orange-600" },
};

const BIN_KEYS: (keyof BinCard)[] = ["wet", "sanitary", "dry", "furniture", "event"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fillColor(pct: number): string {
  if (pct >= 75) return "bg-red-500";
  if (pct >= 50) return "bg-amber-400";
  return "bg-green-500";
}

function statusBadge(status: Vehicle["status"]): string {
  const base = "text-xs font-semibold px-2 py-0.5 rounded-full";
  if (status === "active")   return `${base} bg-green-100 text-green-800`;
  if (status === "swapping") return `${base} bg-amber-100 text-amber-800`;
  return `${base} bg-red-100 text-red-800`;
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function VehicleCard({ v }: { v: Vehicle }) {
  const meta = WASTE_META[v.wasteType] ?? { icon: "🚛", label: v.wasteType, color: "text-gray-600" };
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{meta.icon}</span>
          <span className={`font-semibold capitalize ${meta.color}`}>{meta.label}</span>
        </div>
        <span className={statusBadge(v.status)}>{v.status}</span>
      </div>

      {/* Fill bar */}
      <div>
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>{v.fillPct.toFixed(1)}%</span>
          <span>{v.currentKg} / {v.capacityKg} kg</span>
        </div>
        <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${fillColor(v.fillPct)}`}
            style={{ width: `${Math.min(v.fillPct, 100)}%` }}
          />
        </div>
      </div>

      <div className="text-xs text-gray-400 font-mono">{v.id}</div>
    </div>
  );
}

function HouseholdCard({ h }: { h: Household }) {
  return (
    <div className={`relative bg-white rounded-xl border border-gray-200 shadow-sm p-4 ${h.isOutOfStation ? "opacity-60" : ""}`}>
      {h.isOutOfStation && (
        <div className="absolute inset-0 bg-gray-200/60 rounded-xl flex items-center justify-center z-10">
          <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
            ✈️ Out of Station
          </span>
        </div>
      )}
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-semibold text-gray-800 text-sm">{h.name}</p>
          <p className="text-xs text-gray-400 font-mono">{h.id}</p>
        </div>
        {h.streak > 0 && (
          <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
            🔥 {h.streak}d
          </span>
        )}
      </div>

      {/* BinGo card — 5 tiny squares */}
      <div className="flex gap-1 my-2" title="wet · sanitary · dry · furniture · event">
        {BIN_KEYS.map((k) => (
          <div
            key={k}
            title={k}
            className={`w-5 h-5 rounded-sm border ${h.bins[k] ? "bg-green-500 border-green-600" : "bg-gray-100 border-gray-300"}`}
          />
        ))}
      </div>

      <p className="text-xs text-gray-400">Last active: {h.lastActive}</p>
    </div>
  );
}

function AlertRow({ alert, onDismiss }: { alert: Alert; onDismiss: (id: string) => void }) {
  const meta = WASTE_META[alert.wasteType] ?? { icon: "🚛", label: alert.wasteType, color: "" };
  return (
    <div className="flex items-center justify-between gap-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
      <div className="flex items-center gap-3 flex-1 flex-wrap">
        <span className="text-lg">{meta.icon}</span>
        <div>
          <p className="text-sm font-semibold text-red-800">
            {alert.zone} — {meta.label} {alert.fillPct}% full
          </p>
          <p className="text-xs text-red-600">{alert.vehicleId} · {alert.timestamp}</p>
        </div>
      </div>
      <button
        onClick={() => onDismiss(alert.id)}
        className="text-xs font-semibold bg-white border border-red-300 text-red-700 rounded-lg px-3 py-1.5 hover:bg-red-100 transition-colors cursor-pointer shrink-0"
      >
        Acknowledge
      </button>
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function GovDashboard() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  const usingMock = !apiBase;

  const [data, setData] = useState<DashboardData>(MOCK);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [now, setNow] = useState<Date | null>(null); // null until hydrated

  // Clock: hydrate on client to avoid SSR mismatch
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Fetch live data when API available
  const fetchData = useCallback(async () => {
    if (!apiBase) return;
    try {
      const [vehiclesRes, householdsRes, alertsRes, zoneRes] = await Promise.all([
        fetch(`${apiBase}/vehicles`),
        fetch(`${apiBase}/households`),
        fetch(`${apiBase}/alerts?status=PENDING`),
        fetch(`${apiBase}/zones/current`),
      ]);
      const [vehicles, households, alerts, zone] = await Promise.all([
        vehiclesRes.ok ? vehiclesRes.json() : MOCK.vehicles,
        householdsRes.ok ? householdsRes.json() : MOCK.households,
        alertsRes.ok ? alertsRes.json() : MOCK.alerts,
        zoneRes.ok ? zoneRes.json() : MOCK.zone,
      ]);
      setData({ vehicles, households, alerts, zone });
    } catch {
      // silently fall back to existing state
    }
  }, [apiBase]);

  useEffect(() => {
    fetchData();
    if (apiBase) {
      const id = setInterval(fetchData, 30_000);
      return () => clearInterval(id);
    }
  }, [fetchData, apiBase]);

  const visibleAlerts = data.alerts.filter(
    (a) => a.status === "PENDING" && !dismissedAlerts.has(a.id)
  );

  function dismissAlert(id: string) {
    setDismissedAlerts((prev) => new Set([...prev, id]));
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-xl shadow">
              🗑️
            </div>
            <div>
              <span className="text-xl font-bold text-green-700">BinGo</span>
              <p className="text-xs text-gray-500 leading-none">Go to the zone. Bingo, done.</p>
            </div>
            <span className="ml-2 text-xs font-semibold bg-green-100 text-green-800 border border-green-300 rounded-full px-3 py-1">
              Government Dashboard
            </span>
          </div>

          {/* Clock */}
          <div className="text-sm text-gray-500 font-mono tabular-nums">
            {now ? fmtTime(now) : "──:──:──"}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6 w-full">

        {/* API config notice */}
        {usingMock && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
            <span>⚠️</span>
            <span>
              <strong>NEXT_PUBLIC_API_BASE_URL</strong> is not configured — showing mock data.
            </span>
          </div>
        )}

        {/* ── Zone summary bar ────────────────────────────────────────────── */}
        <section className="bg-green-700 text-white rounded-2xl px-6 py-4 flex flex-wrap gap-6 items-center shadow">
          <div>
            <p className="text-xs text-green-200 uppercase tracking-wide font-semibold">Zone</p>
            <p className="text-lg font-bold">{data.zone.name}</p>
          </div>
          <div className="h-8 w-px bg-green-500 hidden sm:block" />
          <div>
            <p className="text-xs text-green-200 uppercase tracking-wide font-semibold">Ward</p>
            <p className="font-semibold">{data.zone.ward}</p>
          </div>
          <div className="h-8 w-px bg-green-500 hidden sm:block" />
          <div>
            <p className="text-xs text-green-200 uppercase tracking-wide font-semibold">Households</p>
            <p className="font-semibold">{data.zone.totalHouseholds}</p>
          </div>
          <div className="h-8 w-px bg-green-500 hidden sm:block" />
          <div>
            <p className="text-xs text-green-200 uppercase tracking-wide font-semibold">Active Vehicles</p>
            <p className="font-semibold">{data.zone.activeVehicles}</p>
          </div>
        </section>

        {/* ── Vehicle Fill Levels ─────────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-3">🚛 Vehicle Fill Levels</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {data.vehicles.map((v) => (
              <VehicleCard key={v.id} v={v} />
            ))}
          </div>
        </section>

        {/* ── Swap Alerts ─────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-3">🔔 Swap Alerts</h2>
          {visibleAlerts.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-6 flex flex-col items-center gap-2 text-green-700">
              <span className="text-3xl">✅</span>
              <p className="font-semibold">No active alerts</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {visibleAlerts.map((a) => (
                <AlertRow key={a.id} alert={a} onDismiss={dismissAlert} />
              ))}
            </div>
          )}
        </section>

        {/* ── Household Participation ─────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-1">🏠 Household Participation</h2>
          <p className="text-xs text-gray-400 mb-3">Squares: 💧 Wet · 🧻 Sanitary · 📦 Dry · 🛋️ Furniture · 🎉 Event</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {data.households.map((h) => (
              <HouseholdCard key={h.id} h={h} />
            ))}
          </div>
        </section>

      </main>

      <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200 mt-auto">
        BinGo Government Dashboard · Refreshes every 30s
      </footer>
    </div>
  );
}
