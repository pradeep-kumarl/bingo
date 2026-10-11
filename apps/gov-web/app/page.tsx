"use client";

import { useEffect, useState, useCallback, useMemo } from "react";

// ─── Domain Types ─────────────────────────────────────────────────────────────

interface Vehicle {
  id: string;
  wasteType: "wet" | "sanitary" | "dry" | "furniture" | "event";
  fillPct: number;
  currentKg: number;
  capacityKg: number;
  status: "active" | "swapping" | "full";
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

export type SeatStatus = "dropped" | "pending" | "out_of_station";

export interface HouseSeat {
  id: string; // "0000" to "1000"
  numericId: number;
  status: SeatStatus;
  streak: number;
  monthDropsCount: number; // e.g. 24 out of 30 days
  monthTotalDays: number;
  dropTimeToday?: string; // e.g. "07:45 AM"
  streamsToday: {
    wet: boolean; // Organic
    sanitary: boolean; // Sanitary/soiled for burning
    dry: boolean; // Dry recyclables
    furniture: boolean; // Bulky
    event: boolean; // Bulk event
  };
  monthlyHistory: ("dropped" | "pending" | "out_of_station")[]; // 30 days history
}

interface DashboardData {
  zone: Zone;
  vehicles: Vehicle[];
  alerts: Alert[];
}

// ─── Waste Streams Metadata ───────────────────────────────────────────────────

const WASTE_META: Record<
  string,
  { icon: string; label: string; sub: string; color: string; badgeBg: string }
> = {
  wet: {
    icon: "🥬",
    label: "Organic (Wet)",
    sub: "Kitchen & organic compostable waste",
    color: "text-emerald-700",
    badgeBg: "bg-emerald-100 text-emerald-800",
  },
  sanitary: {
    icon: "🔥",
    label: "Sanitary / Soiled (Burning)",
    sub: "Diapers, pads & soiled waste for incineration",
    color: "text-amber-700",
    badgeBg: "bg-amber-100 text-amber-800",
  },
  dry: {
    icon: "📦",
    label: "Dry / Recyclables",
    sub: "Paper, clean plastics, cardboard & metal",
    color: "text-blue-700",
    badgeBg: "bg-blue-100 text-blue-800",
  },
  furniture: {
    icon: "🛋️",
    label: "Bulky / Furniture",
    sub: "Large wood, mattresses & discarded fixtures",
    color: "text-purple-700",
    badgeBg: "bg-purple-100 text-purple-800",
  },
  event: {
    icon: "🎉",
    label: "Bulk / Event Waste",
    sub: "Party, wedding, catering & community waste",
    color: "text-pink-700",
    badgeBg: "bg-pink-100 text-pink-800",
  },
};

// ─── Seed Data for Zone & Vehicles ───────────────────────────────────────────

const INITIAL_ZONE: Zone = {
  name: "Zone 1 (Houses 0000 to 1000)",
  ward: "Ward 151",
  totalHouseholds: 1001,
  activeVehicles: 5,
};

const INITIAL_VEHICLES: Vehicle[] = [
  { id: "VH-ORG-01",  wasteType: "wet",       fillPct: 73.5, currentKg: 735,  capacityKg: 1000, status: "active" },
  { id: "VH-BURN-01", wasteType: "sanitary",  fillPct: 38.0, currentKg: 190,  capacityKg: 500,  status: "active" },
  { id: "VH-DRY-01",  wasteType: "dry",        fillPct: 51.7, currentKg: 620,  capacityKg: 1200, status: "active" },
  { id: "VH-FURN-01", wasteType: "furniture", fillPct: 22.5, currentKg: 450,  capacityKg: 2000, status: "active" },
  { id: "VH-EVNT-01", wasteType: "event",     fillPct: 21.3, currentKg: 320,  capacityKg: 1500, status: "active" },
];

const INITIAL_ALERTS: Alert[] = [
  {
    id: "ALT-001",
    zone: "Zone 1 (0000-1000)",
    wasteType: "dry",
    vehicleId: "VH-DRY-01",
    fillPct: 78.4,
    timestamp: "30 mins ago",
    status: "PENDING",
  },
];

// ─── Deterministic Generator for 1,001 Houses (0000 to 1000) ──────────────────

function generateInitialHouses(): HouseSeat[] {
  const houses: HouseSeat[] = [];

  for (let i = 0; i <= 1000; i++) {
    const id = i.toString().padStart(4, "0");
    // Pseudo-random deterministic hash based on house number
    const hash = (i * 2654435761) >>> 0;
    const mod100 = hash % 100;

    let status: SeatStatus = "pending";
    if (mod100 < 4) {
      status = "out_of_station"; // 4% out of station / no waste
    } else if (mod100 < 78) {
      status = "dropped"; // 74% dropped today
    } else {
      status = "pending"; // 22% pending
    }

    // Specific overrides for demo houses
    if (i === 101) status = "dropped";
    if (i === 102) status = "dropped";
    if (i === 103) status = "out_of_station";
    if (i === 104) status = "pending";

    // Monthly drop count out of 30 days
    const monthBase = 18 + (hash % 12); // between 18 and 29 days
    const monthDropsCount = status === "out_of_station" ? Math.max(10, monthBase - 6) : monthBase;

    // Drop time
    const hour = 6 + (hash % 5);
    const minute = (hash % 60).toString().padStart(2, "0");
    const dropTimeToday = status === "dropped" ? `0${hour}:${minute} AM` : undefined;

    // Generate 30 days of monthly history
    const monthlyHistory: ("dropped" | "pending" | "out_of_station")[] = [];
    for (let day = 1; day <= 30; day++) {
      if (day === 30) {
        monthlyHistory.push(status);
      } else {
        const dayHash = ((i * 31 + day * 17) * 2654435761) >>> 0;
        const dayMod = dayHash % 100;
        if (dayMod < 5) monthlyHistory.push("out_of_station");
        else if (dayMod < 82) monthlyHistory.push("dropped");
        else monthlyHistory.push("pending");
      }
    }

    houses.push({
      id,
      numericId: i,
      status,
      streak: status === "dropped" ? 1 + (hash % 12) : 0,
      monthDropsCount,
      monthTotalDays: 30,
      dropTimeToday,
      streamsToday: {
        wet: status === "dropped",
        sanitary: status === "dropped" && (hash % 3 === 0),
        dry: status === "dropped" && (hash % 2 === 0),
        furniture: status === "dropped" && (hash % 15 === 0),
        event: status === "dropped" && (hash % 20 === 0),
      },
      monthlyHistory,
    });
  }

  return houses;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fillColor(pct: number): string {
  if (pct >= 75) return "bg-red-500";
  if (pct >= 50) return "bg-amber-400";
  return "bg-emerald-500";
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ─── Vehicle Card Component ───────────────────────────────────────────────────

function VehicleCard({ v }: { v: Vehicle }) {
  const meta = WASTE_META[v.wasteType] ?? {
    icon: "🚛",
    label: v.wasteType,
    sub: "",
    color: "text-gray-700",
    badgeBg: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col justify-between gap-3 hover:shadow-md transition-shadow">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-3xl">{meta.icon}</span>
            <div>
              <p className={`font-bold text-sm ${meta.color}`}>{meta.label}</p>
              <p className="text-[11px] text-gray-400 leading-tight">{meta.sub}</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider">
            {v.status}
          </span>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs text-gray-600 font-medium mb-1">
          <span>{v.fillPct.toFixed(1)}% full</span>
          <span>
            {v.currentKg} / {v.capacityKg} kg
          </span>
        </div>
        <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${fillColor(
              v.fillPct
            )}`}
            style={{ width: `${Math.min(v.fillPct, 100)}%` }}
          />
        </div>
      </div>

      <div className="flex justify-between items-center text-[11px] text-gray-400 font-mono border-t border-gray-100 pt-2">
        <span>ID: {v.id}</span>
        {v.fillPct >= 75 && (
          <span className="text-red-600 font-semibold flex items-center gap-1">
            ⚠️ Swap Needed
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Seat Detail Modal ────────────────────────────────────────────────────────

function SeatDetailModal({
  house,
  onClose,
  onToggleStatus,
}: {
  house: HouseSeat;
  onClose: () => void;
  onToggleStatus: (newStatus: SeatStatus) => void;
}) {
  const compliancePct = Math.round(
    (house.monthDropsCount / house.monthTotalDays) * 100
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-700 to-green-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl font-bold font-mono border border-white/20">
              {house.id}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">House #{house.id}</h3>
                <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-mono">
                  Zone 1
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5">
                Ward 151 · Koramangala Hub
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
          {/* Today's Status Banner */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between ${
              house.status === "dropped"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : house.status === "out_of_station"
                ? "bg-amber-50 border-amber-200 text-amber-900"
                : "bg-gray-50 border-gray-200 text-gray-800"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {house.status === "dropped"
                  ? "🟢"
                  : house.status === "out_of_station"
                  ? "🟡"
                  : "⚪"}
              </span>
              <div>
                <p className="font-bold text-sm">
                  {house.status === "dropped"
                    ? "Waste Dropped Today ✅"
                    : house.status === "out_of_station"
                    ? "Marked Out of Station (No Waste) ✈️"
                    : "Not Dropped Today Yet ⏳"}
                </p>
                <p className="text-xs opacity-75">
                  {house.status === "dropped"
                    ? `Recorded at ${house.dropTimeToday ?? "08:14 AM"}`
                    : house.status === "out_of_station"
                    ? "Exempt from missed-disposal alert today"
                    : "Awaiting resident drop before 8:00 PM cutoff"}
                </p>
              </div>
            </div>
            {house.streak > 0 && (
              <span className="text-xs font-semibold bg-emerald-200/60 text-emerald-800 px-2.5 py-1 rounded-full">
                🔥 {house.streak}d streak
              </span>
            )}
          </div>

          {/* Monthly Performance Stats */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                🗓️ This Month’s Drop Record
              </span>
              <span className="text-xs font-bold text-emerald-700">
                {compliancePct}% Segregation Rate
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-3xl font-extrabold text-gray-900 font-mono">
                {house.monthDropsCount}
              </span>
              <span className="text-sm text-gray-500 font-medium">
                / {house.monthTotalDays} days waste dropped this month
              </span>
            </div>

            {/* 30-Day Attendance Grid */}
            <p className="text-[11px] text-gray-400 mb-1.5 font-medium">
              October 2026 Daily Log (Day 1 to 30):
            </p>
            <div className="grid grid-cols-10 gap-1.5 p-2 bg-white rounded-lg border border-gray-200">
              {house.monthlyHistory.map((s, idx) => (
                <div
                  key={idx}
                  title={`Day ${idx + 1}: ${
                    s === "dropped"
                      ? "Dropped"
                      : s === "out_of_station"
                      ? "Out of station"
                      : "Pending/Missed"
                  }`}
                  className={`h-6 rounded text-[10px] font-mono flex items-center justify-center font-bold transition-all ${
                    s === "dropped"
                      ? "bg-emerald-500 text-white"
                      : s === "out_of_station"
                      ? "bg-amber-400 text-amber-950"
                      : "bg-gray-200 text-gray-500"
                  } ${idx === 29 ? "ring-2 ring-emerald-700 ring-offset-1" : ""}`}
                >
                  {idx + 1}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-4 text-[11px] text-gray-500 mt-2">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
                Dropped ({house.monthDropsCount}d)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-gray-200 inline-block" />
                Missed ({house.monthTotalDays - house.monthDropsCount}d)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-amber-400 inline-block" />
                Out of Station
              </span>
            </div>
          </div>

          {/* Today's Waste Stream Breakdown */}
          <div>
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
              ♻️ Waste Streams Checked Today
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div
                className={`p-2.5 rounded-lg border flex items-center justify-between ${
                  house.streamsToday.wet
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : "bg-gray-50 border-gray-200 text-gray-400"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🥬</span>
                  <div>
                    <p className="font-semibold">Organic (Wet)</p>
                    <p className="text-[10px] text-gray-500">Kitchen & compost</p>
                  </div>
                </div>
                <span>{house.streamsToday.wet ? "✅ Deposited" : "⚪ None"}</span>
              </div>

              <div
                className={`p-2.5 rounded-lg border flex items-center justify-between ${
                  house.streamsToday.sanitary
                    ? "bg-amber-50 border-amber-200 text-amber-900"
                    : "bg-gray-50 border-gray-200 text-gray-400"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🔥</span>
                  <div>
                    <p className="font-semibold">Sanitary / Soiled</p>
                    <p className="text-[10px] text-gray-500">For burning</p>
                  </div>
                </div>
                <span>{house.streamsToday.sanitary ? "✅ Deposited" : "⚪ None"}</span>
              </div>

              <div
                className={`p-2.5 rounded-lg border flex items-center justify-between ${
                  house.streamsToday.dry
                    ? "bg-blue-50 border-blue-200 text-blue-900"
                    : "bg-gray-50 border-gray-200 text-gray-400"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">📦</span>
                  <div>
                    <p className="font-semibold">Dry / Recyclables</p>
                    <p className="text-[10px] text-gray-500">Paper, bottles, etc.</p>
                  </div>
                </div>
                <span>{house.streamsToday.dry ? "✅ Deposited" : "⚪ None"}</span>
              </div>

              <div
                className={`p-2.5 rounded-lg border flex items-center justify-between ${
                  house.streamsToday.furniture
                    ? "bg-purple-50 border-purple-200 text-purple-900"
                    : "bg-gray-50 border-gray-200 text-gray-400"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🛋️</span>
                  <div>
                    <p className="font-semibold">Bulky / Furniture</p>
                    <p className="text-[10px] text-gray-500">Large items</p>
                  </div>
                </div>
                <span>{house.streamsToday.furniture ? "✅ Deposited" : "⚪ None"}</span>
              </div>

              <div
                className={`p-2.5 rounded-lg border flex items-center justify-between sm:col-span-2 ${
                  house.streamsToday.event
                    ? "bg-pink-50 border-pink-200 text-pink-900"
                    : "bg-gray-50 border-gray-200 text-gray-400"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🎉</span>
                  <div>
                    <p className="font-semibold">Bulk / Event Waste</p>
                    <p className="text-[10px] text-gray-500">Parties & community events</p>
                  </div>
                </div>
                <span>{house.streamsToday.event ? "✅ Deposited" : "⚪ None"}</span>
              </div>
            </div>
          </div>

          {/* Quick Municipal Operator Actions */}
          <div className="border-t border-gray-200 pt-4 flex flex-wrap gap-2 justify-between items-center">
            <span className="text-xs text-gray-400 font-medium">Operator Overrides:</span>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  onToggleStatus(
                    house.status === "dropped" ? "pending" : "dropped"
                  )
                }
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  house.status === "dropped"
                    ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    : "bg-emerald-600 text-white hover:bg-emerald-700 shadow"
                }`}
              >
                {house.status === "dropped"
                  ? "Mark As Pending"
                  : "Mark Dropped Today"}
              </button>

              <button
                onClick={() =>
                  onToggleStatus(
                    house.status === "out_of_station" ? "pending" : "out_of_station"
                  )
                }
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  house.status === "out_of_station"
                    ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    : "bg-amber-500 text-white hover:bg-amber-600 shadow"
                }`}
              >
                {house.status === "out_of_station"
                  ? "Remove Out of Station"
                  : "Set Out of Station"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Theater Seating Arrangement Component (Houses 0000 to 1000) ───────────────

function TheaterSeatingGrid({
  houses,
  onSelectHouse,
  selectedHouseId,
}: {
  houses: HouseSeat[];
  onSelectHouse: (house: HouseSeat) => void;
  selectedHouseId: string | null;
}) {
  const [filter, setFilter] = useState<"all" | "dropped" | "pending" | "out_of_station">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState<number>(0); // 0 = all, 1 = 0000-0250, 2 = 0251-0500, etc.

  // Stats calculation
  const totalCount = houses.length;
  const droppedCount = useMemo(
    () => houses.filter((h) => h.status === "dropped").length,
    [houses]
  );
  const pendingCount = useMemo(
    () => houses.filter((h) => h.status === "pending").length,
    [houses]
  );
  const outOfStationCount = useMemo(
    () => houses.filter((h) => h.status === "out_of_station").length,
    [houses]
  );

  // Filtered houses
  const displayedHouses = useMemo(() => {
    return houses.filter((h) => {
      // Status filter
      if (filter !== "all" && h.status !== filter) return false;

      // Search query
      if (searchQuery.trim() !== "") {
        const query = searchQuery.trim().toLowerCase();
        if (!h.id.includes(query)) return false;
      }

      // Section tab filter
      if (activeSection === 1 && (h.numericId < 0 || h.numericId > 250)) return false;
      if (activeSection === 2 && (h.numericId < 251 || h.numericId > 500)) return false;
      if (activeSection === 3 && (h.numericId < 501 || h.numericId > 750)) return false;
      if (activeSection === 4 && (h.numericId < 751 || h.numericId > 1000)) return false;

      return true;
    });
  }, [houses, filter, searchQuery, activeSection]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col gap-6">
      {/* Theater Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎭</span>
            <h2 className="text-lg font-bold text-gray-900">
              Community Seating Grid — Houses 0000 to 1000
            </h2>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Theater-style map of 1,001 households. Click any seat to view monthly drop rate & streams.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs bg-gray-50 border border-gray-200 rounded-xl px-4 py-2">
          <div className="flex items-center gap-1.5 font-medium text-emerald-800">
            <span className="w-3.5 h-3.5 rounded bg-emerald-500 border border-emerald-600 shadow-xs inline-block" />
            <span>Dropped Today ({droppedCount})</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-gray-600">
            <span className="w-3.5 h-3.5 rounded bg-gray-200 border border-gray-300 shadow-xs inline-block" />
            <span>Pending ({pendingCount})</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-amber-800">
            <span className="w-3.5 h-3.5 rounded bg-amber-400 border border-amber-500 shadow-xs inline-block" />
            <span>Out of Station / No Waste ({outOfStationCount})</span>
          </div>
        </div>
      </div>

      {/* Controls & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              filter === "all"
                ? "bg-white text-gray-900 shadow-xs"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            All ({totalCount})
          </button>
          <button
            onClick={() => setFilter("dropped")}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              filter === "dropped"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            🟢 Dropped ({droppedCount})
          </button>
          <button
            onClick={() => setFilter("pending")}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              filter === "pending"
                ? "bg-gray-600 text-white shadow-xs"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            ⚪ Pending ({pendingCount})
          </button>
          <button
            onClick={() => setFilter("out_of_station")}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              filter === "out_of_station"
                ? "bg-amber-500 text-white shadow-xs"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            🟡 Out of Station ({outOfStationCount})
          </button>
        </div>

        {/* Section Blocks Tabs */}
        <div className="flex items-center gap-1 text-xs">
          <span className="text-gray-400 text-[11px] font-medium mr-1 hidden sm:inline">
            Blocks:
          </span>
          {[
            { label: "All (0000–1000)", val: 0 },
            { label: "0000–0250", val: 1 },
            { label: "0251–0500", val: 2 },
            { label: "0501–0750", val: 3 },
            { label: "0751–1000", val: 4 },
          ].map((sec) => (
            <button
              key={sec.val}
              onClick={() => setActiveSection(sec.val)}
              className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-medium transition-colors cursor-pointer ${
                activeSection === sec.val
                  ? "bg-green-50 border-green-300 text-green-800 font-bold"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search house # (e.g. 0142)..."
            className="pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
          />
          <span className="absolute left-2.5 top-1.5 text-xs text-gray-400">🔍</span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1.5 text-xs text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Theater Stage / Drop Bay Indicator */}
      <div className="flex flex-col items-center my-1">
        <div className="w-full max-w-2xl bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-600 text-white rounded-t-2xl py-2 px-6 text-center shadow-sm border-b-4 border-emerald-800">
          <p className="text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
            <span>▼</span> COMMUNITY WASTE COLLECTION HUBS & ROTATING BAY TABLETS <span>▼</span>
          </p>
          <p className="text-[10px] text-emerald-100 mt-0.5">
            Stage / Drop Point Direction (Houses arranged in theater tiers facing the bay)
          </p>
        </div>
        <div className="w-full max-w-xl h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-60" />
      </div>

      {/* Cinema / Theater Seating Grid */}
      <div className="bg-gray-900 rounded-2xl p-6 text-white shadow-inner overflow-x-auto">
        <div className="min-w-[760px] flex flex-col items-center">
          {displayedHouses.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <p className="text-2xl mb-2">🔍</p>
              <p className="font-semibold text-sm">No houses match the search/filter</p>
              <button
                onClick={() => {
                  setFilter("all");
                  setSearchQuery("");
                  setActiveSection(0);
                }}
                className="mt-3 text-xs text-emerald-400 underline cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="w-full">
              {/* Theater layout: render in aisles / rows */}
              <div className="flex flex-wrap gap-1.5 justify-center">
                {displayedHouses.map((h) => {
                  const isSelected = selectedHouseId === h.id;
                  const isDropped = h.status === "dropped";
                  const isOutOfStation = h.status === "out_of_station";

                  return (
                    <button
                      key={h.id}
                      onClick={() => onSelectHouse(h)}
                      title={`House #${h.id} — ${
                        isDropped
                          ? `Dropped at ${h.dropTimeToday ?? "Today"}`
                          : isOutOfStation
                          ? "Out of Station / No Waste"
                          : "Pending Drop"
                      } (Click for monthly details)`}
                      className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-md flex flex-col items-center justify-center transition-all duration-150 cursor-pointer text-[10px] font-mono font-bold select-none ${
                        isDropped
                          ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-xs border border-emerald-400"
                          : isOutOfStation
                          ? "bg-amber-400 hover:bg-amber-300 text-amber-950 border border-amber-300"
                          : "bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600"
                      } ${
                        isSelected
                          ? "ring-3 ring-yellow-400 scale-110 z-20 shadow-lg"
                          : "hover:scale-105"
                      }`}
                    >
                      {/* Seat Back / Armrest styling */}
                      <span className="leading-none text-[9px] font-mono">
                        {h.id.slice(1)} {/* Last 3 digits for seat readability */}
                      </span>

                      {/* Micro indicator dot */}
                      <span
                        className={`w-1 h-1 rounded-full mt-0.5 ${
                          isDropped
                            ? "bg-white"
                            : isOutOfStation
                            ? "bg-amber-950"
                            : "bg-gray-500"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Theater Bottom Legend / Note */}
        <div className="mt-6 pt-4 border-t border-gray-800 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
              <span>Green: Waste Dropped Today</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-gray-700 inline-block" />
              <span>Grey: Pending Drop</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-400 inline-block" />
              <span>Yellow: No Waste / Out of Station</span>
            </span>
          </div>
          <p className="text-[11px] text-gray-500">
            Showing {displayedHouses.length} of {totalCount} seats · Click any seat to open pop-up
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Government Dashboard ────────────────────────────────────────────────

export default function GovDashboard() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

  const [data, setData] = useState<DashboardData>({
    zone: INITIAL_ZONE,
    vehicles: INITIAL_VEHICLES,
    alerts: INITIAL_ALERTS,
  });

  const [houses, setHouses] = useState<HouseSeat[]>(() => generateInitialHouses());
  const [selectedHouse, setSelectedHouse] = useState<HouseSeat | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [now, setNow] = useState<Date | null>(null);

  // Clock: hydrate on client to avoid SSR mismatch
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Fetch live API data when available
  const fetchData = useCallback(async () => {
    if (!apiBase) return;
    try {
      const [vehiclesRes, alertsRes, zoneRes] = await Promise.all([
        fetch(`${apiBase}/vehicles`),
        fetch(`${apiBase}/alerts?status=PENDING`),
        fetch(`${apiBase}/zones/current`),
      ]);
      const [vehicles, alerts, zone] = await Promise.all([
        vehiclesRes.ok ? vehiclesRes.json() : data.vehicles,
        alertsRes.ok ? alertsRes.json() : data.alerts,
        zoneRes.ok ? zoneRes.json() : data.zone,
      ]);
      setData((prev) => ({
        ...prev,
        vehicles: vehicles ?? prev.vehicles,
        alerts: alerts ?? prev.alerts,
        zone: zone ?? prev.zone,
      }));
    } catch {
      // Fallback silently
    }
  }, [apiBase, data.vehicles, data.alerts, data.zone]);

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

  // Update house status in state (live interactive update)
  function handleToggleHouseStatus(newStatus: SeatStatus) {
    if (!selectedHouse) return;

    setHouses((prev) =>
      prev.map((h) => {
        if (h.id === selectedHouse.id) {
          const updated: HouseSeat = {
            ...h,
            status: newStatus,
            dropTimeToday:
              newStatus === "dropped"
                ? new Date().toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : undefined,
            monthDropsCount:
              newStatus === "dropped" && h.status !== "dropped"
                ? h.monthDropsCount + 1
                : newStatus !== "dropped" && h.status === "dropped"
                ? Math.max(0, h.monthDropsCount - 1)
                : h.monthDropsCount,
            streamsToday: {
              ...h.streamsToday,
              wet: newStatus === "dropped",
              dry: newStatus === "dropped",
            },
          };
          setSelectedHouse(updated);
          return updated;
        }
        return h;
      })
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          {/* Logo & Branding */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-xl shadow">
              🗑️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-emerald-700">BinGo</span>
                <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full px-2.5 py-0.5">
                  Municipal Operations
                </span>
              </div>
              <p className="text-xs text-gray-500 leading-none">
                Go to the zone. Bingo, done.
              </p>
            </div>
          </div>

          {/* Clock & Refresh Indicator */}
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <div className="flex items-center gap-1.5 font-mono tabular-nums bg-gray-100 border border-gray-200 px-3 py-1 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{now ? fmtTime(now) : "──:──:──"}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6 w-full">
        {/* ── Zone Summary Bar ────────────────────────────────────────────── */}
        <section className="bg-gradient-to-r from-emerald-800 via-green-700 to-emerald-800 text-white rounded-2xl px-6 py-5 flex flex-wrap gap-6 items-center justify-between shadow-md">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="text-xs text-emerald-200 uppercase tracking-wider font-semibold">
                Designated Zone
              </p>
              <p className="text-xl font-extrabold">{data.zone.name}</p>
            </div>
            <div className="h-8 w-px bg-emerald-500/50 hidden sm:block" />
            <div>
              <p className="text-xs text-emerald-200 uppercase tracking-wider font-semibold">
                Ward
              </p>
              <p className="text-lg font-bold">{data.zone.ward}</p>
            </div>
            <div className="h-8 w-px bg-emerald-500/50 hidden sm:block" />
            <div>
              <p className="text-xs text-emerald-200 uppercase tracking-wider font-semibold">
                Households Monitored
              </p>
              <p className="text-lg font-bold font-mono">
                {data.zone.totalHouseholds} (0000 – 1000)
              </p>
            </div>
            <div className="h-8 w-px bg-emerald-500/50 hidden sm:block" />
            <div>
              <p className="text-xs text-emerald-200 uppercase tracking-wider font-semibold">
                Active Fleet Vehicles
              </p>
              <p className="text-lg font-bold">{data.zone.activeVehicles} streams</p>
            </div>
          </div>

          {/* Live Tablet Link */}
          <a
            href="/bay/bay-wet-01"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold bg-white text-emerald-800 hover:bg-emerald-50 px-4 py-2 rounded-xl shadow transition-colors flex items-center gap-1.5"
          >
            <span>📱</span> Open Bay Tablet Display
          </a>
        </section>

        {/* ── Vehicle Fill Levels (5 Distinct Streams) ────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <span>🚛</span> Vehicle Fill Levels & Segregation Stream Fleets
              </h2>
              <p className="text-xs text-gray-500">
                Automatic replacement alert dispatched via SNS when any stream crosses 75% load capacity
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {data.vehicles.map((v) => (
              <VehicleCard key={v.id} v={v} />
            ))}
          </div>
        </section>

        {/* ── Swap Alerts ─────────────────────────────────────────────────── */}
        {visibleAlerts.length > 0 && (
          <section>
            <h2 className="text-base font-bold text-gray-800 mb-2 flex items-center gap-2">
              <span>🔔</span> Swap Alerts Required (≥75% Fill Level)
            </h2>
            <div className="flex flex-col gap-3">
              {visibleAlerts.map((a) => {
                const meta = WASTE_META[a.wasteType] ?? {
                  icon: "🚛",
                  label: a.wasteType,
                  color: "",
                };
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
                  >
                    <div className="flex items-center gap-3 flex-1 flex-wrap">
                      <span className="text-2xl">{meta.icon}</span>
                      <div>
                        <p className="text-sm font-bold text-red-900">
                          {a.zone} — {meta.label} at {a.fillPct}% Capacity
                        </p>
                        <p className="text-xs text-red-600">
                          Vehicle {a.vehicleId} · Triggered {a.timestamp}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => dismissAlert(a.id)}
                      className="text-xs font-semibold bg-white border border-red-300 text-red-700 rounded-lg px-3 py-1.5 hover:bg-red-100 transition-colors cursor-pointer shrink-0"
                    >
                      Acknowledge & Dispatch Swap
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Community Theater Seating Arrangement (Houses 0000 to 1000) ─── */}
        <section>
          <TheaterSeatingGrid
            houses={houses}
            onSelectHouse={(h) => setSelectedHouse(h)}
            selectedHouseId={selectedHouse?.id ?? null}
          />
        </section>
      </main>

      {/* ── Seat Detail Modal Pop-up ───────────────────────────────────────── */}
      {selectedHouse && (
        <SeatDetailModal
          house={selectedHouse}
          onClose={() => setSelectedHouse(null)}
          onToggleStatus={handleToggleHouseStatus}
        />
      )}

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 py-6 border-t border-gray-200 mt-auto bg-white">
        <p className="font-semibold text-gray-600">
          BinGo Municipal Waste Management System · Zone 1 Operations
        </p>
        <p className="mt-1 text-[11px]">
          Live tracking for houses 0000 to 1000 · Organic (Wet), Sanitary/Burning, Dry Recyclable, Bulky Furniture, Bulk Event Waste
        </p>
      </footer>
    </div>
  );
}
