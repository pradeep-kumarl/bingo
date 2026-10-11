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
  autoAlertDispatched?: boolean;
}

interface Alert {
  id: string;
  zone: string;
  wasteType: string;
  vehicleId: string;
  fillPct: number;
  timestamp: string;
  status: "PENDING" | "ACKNOWLEDGED";
  recipientName: string;
  recipientRole: string;
  recipientPhone: string;
  swapDriverName: string;
  swapTruckNumber: string;
  deliveryChannel: string;
}

interface Zone {
  name: string;
  ward: string;
  totalHouseholds: number;
  activeVehicles: number;
}

export type SeatStatus = "dropped" | "pending" | "out_of_station";

export interface MonthPerformance {
  monthName: string; // "Jan", "Feb", ...
  daysDropped: number;
  totalDays: number;
  compliancePct: number;
  sparrowMood: "gold_sparrow" | "happy_sparrow" | "frozen_sparrow" | "vacation_sparrow";
  moodEmoji: string;
  badgeLabel: string;
}

export interface HouseSeat {
  id: string; // "0000" to "1000"
  numericId: number;
  status: SeatStatus;
  streak: number;
  monthDropsCount: number; // current month (October)
  monthTotalDays: number;
  dropTimeToday?: string; // e.g. "07:45 AM"
  twelveMonths: MonthPerformance[]; // 12-Month Annual Waste History
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

// ─── Initial Seed Data ────────────────────────────────────────────────────────

const INITIAL_ZONE: Zone = {
  name: "Zone 1 (Houses 0000 to 1000)",
  ward: "Ward 151",
  totalHouseholds: 1001,
  activeVehicles: 5,
};

const INITIAL_VEHICLES: Vehicle[] = [
  { id: "VH-ORG-01",  wasteType: "wet",       fillPct: 73.5, currentKg: 735,  capacityKg: 1000, status: "active", autoAlertDispatched: false },
  { id: "VH-BURN-01", wasteType: "sanitary",  fillPct: 38.0, currentKg: 190,  capacityKg: 500,  status: "active", autoAlertDispatched: false },
  { id: "VH-DRY-01",  wasteType: "dry",        fillPct: 78.4, currentKg: 940,  capacityKg: 1200, status: "swapping", autoAlertDispatched: true },
  { id: "VH-FURN-01", wasteType: "furniture", fillPct: 22.5, currentKg: 450,  capacityKg: 2000, status: "active", autoAlertDispatched: false },
  { id: "VH-EVNT-01", wasteType: "event",     fillPct: 21.3, currentKg: 320,  capacityKg: 1500, status: "active", autoAlertDispatched: false },
];

const INITIAL_ALERTS: Alert[] = [
  {
    id: "ALT-75-001",
    zone: "Zone 1 (0000-1000)",
    wasteType: "dry",
    vehicleId: "VH-DRY-01",
    fillPct: 78.4,
    timestamp: "12 mins ago (Crossed 75% at 06:14 PM)",
    status: "PENDING",
    recipientName: "M. Suresh",
    recipientRole: "Ward 151 Nodal Sanitation Officer",
    recipientPhone: "+91 98450 12345",
    swapDriverName: "Ramesh Gowda",
    swapTruckNumber: "KA-01-EA-4412 (Backup Dry Vehicle)",
    deliveryChannel: "AWS SNS (SMS + WhatsApp + Control Room Push)",
  },
];

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// ─── Generate 12-Month Performance with Duolingo-style Sparrow Mascot ─────────

function generate12Months(houseIndex: number, todayStatus: SeatStatus): MonthPerformance[] {
  return MONTH_NAMES.map((name, mIdx) => {
    const totalDays = MONTH_DAYS[mIdx];
    const monthHash = ((houseIndex * 41 + mIdx * 29) * 2654435761) >>> 0;
    const rateFactor = (monthHash % 35) + 65; // 65% to 99%

    let daysDropped = Math.round((totalDays * rateFactor) / 100);

    // If current month (Oct = index 9)
    if (mIdx === 9) {
      if (todayStatus === "out_of_station") daysDropped = Math.max(12, daysDropped - 8);
      else if (todayStatus === "dropped") daysDropped = Math.min(totalDays, daysDropped + 2);
    }

    const compliancePct = Math.round((daysDropped / totalDays) * 100);

    let sparrowMood: MonthPerformance["sparrowMood"] = "happy_sparrow";
    let moodEmoji = "🐦✨";
    let badgeLabel = "Good Binner";

    if (compliancePct >= 92) {
      sparrowMood = "gold_sparrow";
      moodEmoji = "🐦👑";
      badgeLabel = "Eco Champion";
    } else if (compliancePct >= 80) {
      sparrowMood = "happy_sparrow";
      moodEmoji = "🐦✨";
      badgeLabel = "Active Streak";
    } else if (compliancePct >= 70) {
      sparrowMood = "vacation_sparrow";
      moodEmoji = "🐦🏖️";
      badgeLabel = "Travel Freeze";
    } else {
      sparrowMood = "frozen_sparrow";
      moodEmoji = "🐦🥶❄️";
      badgeLabel = "Frozen Streak";
    }

    return {
      monthName: name,
      daysDropped,
      totalDays,
      compliancePct,
      sparrowMood,
      moodEmoji,
      badgeLabel,
    };
  });
}

// ─── Deterministic Generator for 1,001 Sparrow Households (0000 to 1000) ──────

function generateInitialHouses(): HouseSeat[] {
  const houses: HouseSeat[] = [];

  for (let i = 0; i <= 1000; i++) {
    const id = i.toString().padStart(4, "0");
    const hash = (i * 2654435761) >>> 0;
    const mod100 = hash % 100;

    let status: SeatStatus = "pending";
    if (mod100 < 4) {
      status = "out_of_station"; // 4% out of station
    } else if (mod100 < 78) {
      status = "dropped"; // 74% dropped today
    } else {
      status = "pending"; // 22% pending
    }

    // Explicit demo overrides
    if (i === 101) status = "dropped";
    if (i === 102) status = "dropped";
    if (i === 103) status = "out_of_station";
    if (i === 104) status = "pending";

    const hour = 6 + (hash % 5);
    const minute = (hash % 60).toString().padStart(2, "0");
    const dropTimeToday = status === "dropped" ? `0${hour}:${minute} AM` : undefined;

    const twelveMonths = generate12Months(i, status);
    const currentMonthData = twelveMonths[9]; // October

    houses.push({
      id,
      numericId: i,
      status,
      streak: status === "dropped" ? 1 + (hash % 14) : 0,
      monthDropsCount: currentMonthData.daysDropped,
      monthTotalDays: currentMonthData.totalDays,
      dropTimeToday,
      twelveMonths,
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

// ─── Vehicle Card Component with 75% Auto-Alert Indicator ────────────────────

function VehicleCard({ v }: { v: Vehicle }) {
  const meta = WASTE_META[v.wasteType] ?? {
    icon: "🚛",
    label: v.wasteType,
    sub: "",
    color: "text-gray-700",
    badgeBg: "bg-gray-100 text-gray-700",
  };

  const isAlertThreshold = v.fillPct >= 75;

  return (
    <div
      className={`bg-white rounded-xl border shadow-sm p-4 flex flex-col justify-between gap-3 hover:shadow-md transition-all ${
        isAlertThreshold ? "border-red-400 ring-2 ring-red-200" : "border-gray-200"
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-3xl">{meta.icon}</span>
            <div>
              <p className={`font-bold text-sm ${meta.color}`}>{meta.label}</p>
              <p className="text-[11px] text-gray-400 leading-tight">{meta.sub}</p>
            </div>
          </div>
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
              isAlertThreshold
                ? "bg-red-100 text-red-800 font-bold animate-pulse"
                : "bg-emerald-100 text-emerald-800"
            }`}
          >
            {isAlertThreshold ? "75%+ Alert" : v.status}
          </span>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs text-gray-600 font-medium mb-1">
          <span className={isAlertThreshold ? "text-red-700 font-bold" : ""}>
            {v.fillPct.toFixed(1)}% full
          </span>
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

      {/* 75% Auto-Notification dispatch tag */}
      {isAlertThreshold ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-[11px] text-red-800 flex flex-col gap-0.5">
          <div className="flex items-center gap-1 font-bold text-red-900">
            <span>📲 Auto-Notification Sent via SNS</span>
          </div>
          <p className="text-[10px] text-red-700">
            Alerted Ward Officer (M. Suresh) & Swap Truck KA-01-EA-4412
          </p>
        </div>
      ) : (
        <div className="text-[10px] text-gray-400 flex items-center justify-between border-t border-gray-100 pt-2">
          <span>Auto-alert at 75%</span>
          <span className="font-mono">{v.id}</span>
        </div>
      )}
    </div>
  );
}

// ─── Seat Detail Modal with Duolingo Sparrow & 12-Month History ──────────────

function SeatDetailModal({
  house,
  onClose,
  onToggleStatus,
}: {
  house: HouseSeat;
  onClose: () => void;
  onToggleStatus: (newStatus: SeatStatus) => void;
}) {
  // Current month (October) compliance
  const currentMonth = house.twelveMonths[9];
  const totalYearDrops = house.twelveMonths.reduce(
    (acc, m) => acc + m.daysDropped,
    0
  );
  const totalYearDays = house.twelveMonths.reduce((acc, m) => acc + m.totalDays, 0);
  const yearPct = Math.round((totalYearDrops / totalYearDays) * 100);

  // Duolingo-style Chirpy Sparrow Mascot Reaction
  let mascotEmoji = "🐦✨";
  let mascotExpression = "Happy Chirpy!";
  let speechBubble =
    "Yay! House #" +
    house.id +
    " dropped waste on time today. The sparrow is celebrating with you! 🎉";
  let mascotBg = "bg-emerald-50 border-emerald-200 text-emerald-900";

  if (house.status === "pending") {
    mascotEmoji = "🐦🥶❄️";
    mascotExpression = "Frozen Streak Chirpy!";
    speechBubble =
      "Brrr! House #" +
      house.id +
      " is shivering in ice! Daily drop is pending today. Drop your segregated waste before 8:00 PM to defrost the sparrow! ❄️🔥";
    mascotBg = "bg-sky-50 border-sky-300 text-sky-950";
  } else if (house.status === "out_of_station") {
    mascotEmoji = "🐦🏖️✈️";
    mascotExpression = "Vacation Chirpy!";
    speechBubble =
      "Chirpy is enjoying a trip! House #" +
      house.id +
      " is marked Out of Station / No Waste. Your streak is frozen and protected from penalties! 🏝️";
    mascotBg = "bg-amber-50 border-amber-300 text-amber-950";
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-gray-100 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-700 via-green-700 to-emerald-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-2xl font-bold font-mono border border-white/20 shadow-inner">
              🐦
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black tracking-tight">House #{house.id}</h3>
                <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-mono">
                  Zone 1
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5">
                Ward 151 · Community Sparrow Seat
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer text-sm font-bold"
          >
            ✕
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5 overflow-y-auto">
          {/* ── Duolingo-style Chirpy Mascot Card ────────────────────────── */}
          <div className={`p-4 rounded-2xl border flex items-center gap-4 ${mascotBg}`}>
            {/* Mascot Avatar with changing expression */}
            <div className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-gray-200 flex flex-col items-center justify-center text-3xl shrink-0 select-none relative">
              <span>{mascotEmoji}</span>
              <span className="text-[9px] font-black uppercase text-gray-500 mt-0.5">
                Chirpy
              </span>
            </div>

            {/* Speech Bubble */}
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider">
                  {mascotExpression}
                </span>
                {house.streak > 0 && (
                  <span className="text-[11px] font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full">
                    🔥 {house.streak}d Streak
                  </span>
                )}
              </div>
              <p className="text-xs mt-1 leading-relaxed font-medium">
                {speechBubble}
              </p>
            </div>
          </div>

          {/* Today's Status Banner */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center justify-between text-xs">
            <span className="font-semibold text-gray-600">Today's Disposal Status:</span>
            <span
              className={`font-bold px-2.5 py-1 rounded-full ${
                house.status === "dropped"
                  ? "bg-emerald-100 text-emerald-800"
                  : house.status === "out_of_station"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-sky-100 text-sky-800"
              }`}
            >
              {house.status === "dropped"
                ? `✅ Dropped at ${house.dropTimeToday ?? "08:14 AM"}`
                : house.status === "out_of_station"
                ? "🏖️ Out of Station / No Waste"
                : "⏳ Pending Drop Today"}
            </span>
          </div>

          {/* ── 12-Month Annual Waste History (Replaces Old Picture 2) ───── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-base">📅</span>
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                  12-Month Annual Waste History (2026)
                </h4>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                Annual: {totalYearDrops} / {totalYearDays} Days ({yearPct}%)
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mb-3">
              Each month displays Chirpy the Sparrow’s mascot reaction based on monthly segregation compliance:
            </p>

            {/* 12 Months Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {house.twelveMonths.map((m, idx) => {
                const isCurrentMonth = idx === 9; // October
                const isGold = m.sparrowMood === "gold_sparrow";
                const isFrozen = m.sparrowMood === "frozen_sparrow";
                const isVacation = m.sparrowMood === "vacation_sparrow";

                return (
                  <div
                    key={m.monthName}
                    className={`p-3 rounded-xl border flex flex-col justify-between gap-1.5 transition-all ${
                      isCurrentMonth
                        ? "bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-300"
                        : "bg-white border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-800 font-mono">
                        {m.monthName}
                        {isCurrentMonth && (
                          <span className="text-[9px] bg-emerald-600 text-white px-1 py-0.2 rounded ml-1 font-sans">
                            Now
                          </span>
                        )}
                      </span>
                      {/* Sparrow Mascot Emoji */}
                      <span className="text-xl" title={m.badgeLabel}>
                        {m.moodEmoji}
                      </span>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-medium text-gray-600">
                        <span>
                          {m.daysDropped}/{m.totalDays}d
                        </span>
                        <span
                          className={`font-bold ${
                            isFrozen
                              ? "text-sky-600"
                              : isGold
                              ? "text-amber-600"
                              : "text-emerald-700"
                          }`}
                        >
                          {m.compliancePct}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden mt-1">
                        <div
                          className={`h-full rounded-full ${
                            isFrozen
                              ? "bg-sky-400"
                              : isVacation
                              ? "bg-amber-400"
                              : "bg-emerald-500"
                          }`}
                          style={{ width: `${m.compliancePct}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-[10px] font-medium text-gray-400 flex items-center justify-between">
                      <span>{m.badgeLabel}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Operator Overrides */}
          <div className="border-t border-gray-200 pt-4 flex flex-wrap gap-2 justify-between items-center">
            <span className="text-xs text-gray-400 font-medium">Quick Status Override:</span>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  onToggleStatus(
                    house.status === "dropped" ? "pending" : "dropped"
                  )
                }
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                  house.status === "dropped"
                    ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    : "bg-emerald-600 text-white hover:bg-emerald-700 shadow"
                }`}
              >
                {house.status === "dropped"
                  ? "Mark As Pending (Freeze)"
                  : "Mark Dropped (Happy 🐦)"}
              </button>

              <button
                onClick={() =>
                  onToggleStatus(
                    house.status === "out_of_station" ? "pending" : "out_of_station"
                  )
                }
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                  house.status === "out_of_station"
                    ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    : "bg-amber-500 text-white hover:bg-amber-600 shadow"
                }`}
              >
                {house.status === "out_of_station"
                  ? "Defrost / Remove Out of Station"
                  : "Set Out of Station (🏖️)"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Theater Seating Grid with Sparrow Emojis (0000 to 1000) ───────────────────

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
  const [activeSection, setActiveSection] = useState<number>(0);

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

  const displayedHouses = useMemo(() => {
    return houses.filter((h) => {
      if (filter !== "all" && h.status !== filter) return false;

      if (searchQuery.trim() !== "") {
        const query = searchQuery.trim().toLowerCase();
        if (!h.id.includes(query)) return false;
      }

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
            <span className="text-3xl">🐦🎭</span>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Community Sparrow Seating Theater — Houses 0000 to 1000
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Each seat represents a household mascot sparrow. Green = Binned today 🐦✨, Grey = Frozen pending 🐦🥶, Yellow = Vacation 🐦✈️.
              </p>
            </div>
          </div>
        </div>

        {/* Legend with Sparrow Emojis */}
        <div className="flex flex-wrap items-center gap-3 text-xs bg-gray-50 border border-gray-200 rounded-xl px-4 py-2">
          <div className="flex items-center gap-1.5 font-medium text-emerald-800">
            <span className="text-base">🐦</span>
            <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
            <span>Dropped Today ({droppedCount})</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-sky-800">
            <span className="text-base">🥶</span>
            <span className="w-2.5 h-2.5 rounded bg-slate-600 inline-block" />
            <span>Frozen / Pending ({pendingCount})</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-amber-800">
            <span className="text-base">✈️</span>
            <span className="w-2.5 h-2.5 rounded bg-amber-400 inline-block" />
            <span>Vacation ({outOfStationCount})</span>
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
            All Sparrows ({totalCount})
          </button>
          <button
            onClick={() => setFilter("dropped")}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              filter === "dropped"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            🐦 Dropped ({droppedCount})
          </button>
          <button
            onClick={() => setFilter("pending")}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              filter === "pending"
                ? "bg-slate-700 text-white shadow-xs"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            🥶 Frozen ({pendingCount})
          </button>
          <button
            onClick={() => setFilter("out_of_station")}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              filter === "out_of_station"
                ? "bg-amber-500 text-white shadow-xs"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            ✈️ Vacation ({outOfStationCount})
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
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800 font-bold"
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
        <div className="w-full max-w-2xl bg-gradient-to-r from-emerald-700 via-green-600 to-emerald-700 text-white rounded-t-2xl py-2 px-6 text-center shadow-sm border-b-4 border-emerald-800">
          <p className="text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
            <span>▼</span> COLLECTION HUBS & ROTATING BAY TABLETS <span>▼</span>
          </p>
          <p className="text-[10px] text-emerald-100 mt-0.5">
            Stage / Drop Point Direction (1,001 Sparrows facing the collection hub)
          </p>
        </div>
        <div className="w-full max-w-xl h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-60" />
      </div>

      {/* Cinema Seating Grid with Sparrow Emojis */}
      <div className="bg-gray-950 rounded-2xl p-6 text-white shadow-inner overflow-x-auto">
        <div className="min-w-[760px] flex flex-col items-center">
          {displayedHouses.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <p className="text-3xl mb-2">🐦🔍</p>
              <p className="font-semibold text-sm">No sparrows match this filter</p>
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
              <div className="flex flex-wrap gap-1.5 justify-center">
                {displayedHouses.map((h) => {
                  const isSelected = selectedHouseId === h.id;
                  const isDropped = h.status === "dropped";
                  const isOutOfStation = h.status === "out_of_station";

                  // Emoji per status
                  const sparrowSeatIcon = isDropped ? "🐦" : isOutOfStation ? "✈️" : "🥶";

                  return (
                    <button
                      key={h.id}
                      onClick={() => onSelectHouse(h)}
                      title={`House #${h.id} — ${
                        isDropped
                          ? `Binned at ${h.dropTimeToday ?? "Today"} (Happy Sparrow 🐦)`
                          : isOutOfStation
                          ? "Out of Station (Vacation Sparrow ✈️)"
                          : "Pending (Frozen Sparrow 🥶)"
                      }`}
                      className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-md flex flex-col items-center justify-center transition-all duration-150 cursor-pointer select-none ${
                        isDropped
                          ? "bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 shadow-xs"
                          : isOutOfStation
                          ? "bg-amber-400 hover:bg-amber-300 text-amber-950 border border-amber-300 shadow-xs"
                          : "bg-slate-800 hover:bg-slate-700 text-cyan-200 border border-slate-700"
                      } ${
                        isSelected
                          ? "ring-3 ring-yellow-400 scale-115 z-20 shadow-lg"
                          : "hover:scale-110"
                      }`}
                    >
                      {/* Sparrow Emoji on Seat */}
                      <span className="text-[12px] leading-none mb-0.5">
                        {sparrowSeatIcon}
                      </span>

                      {/* Seat House Number (3 digits) */}
                      <span className="text-[8px] font-mono font-bold leading-none opacity-80">
                        {h.id.slice(1)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t border-gray-800 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span>🐦</span>
              <span className="text-emerald-400 font-semibold">Green: Binned Today</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span>🥶</span>
              <span className="text-slate-400 font-semibold">Grey: Frozen Pending</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span>✈️</span>
              <span className="text-amber-400 font-semibold">Yellow: Vacation (No Waste)</span>
            </span>
          </div>
          <p className="text-[11px] text-gray-500">
            Showing {displayedHouses.length} of {totalCount} sparrow seats · Click to view 12-month history
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Government Dashboard Component ──────────────────────────────────────

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

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

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

  function handleToggleHouseStatus(newStatus: SeatStatus) {
    if (!selectedHouse) return;

    setHouses((prev) =>
      prev.map((h) => {
        if (h.id === selectedHouse.id) {
          const updatedMonths = generate12Months(h.numericId, newStatus);
          const currentMonthData = updatedMonths[9];

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
            monthDropsCount: currentMonthData.daysDropped,
            twelveMonths: updatedMonths,
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-xl shadow">
              🐦
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-emerald-700">BinGo</span>
                <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full px-2.5 py-0.5">
                  Chirpy Sparrow Operations
                </span>
              </div>
              <p className="text-xs text-gray-500 leading-none">
                Go to the zone. Bingo, done.
              </p>
            </div>
          </div>

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

          <a
            href="/bay/bay-wet-01"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold bg-white text-emerald-800 hover:bg-emerald-50 px-4 py-2 rounded-xl shadow transition-colors flex items-center gap-1.5"
          >
            <span>📱</span> Open Bay Tablet Display
          </a>
        </section>

        {/* ── Vehicle Fill Levels ─────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <span>🚛</span> Vehicle Fill Levels (Automatic Swap Alert at ≥75%)
              </h2>
              <p className="text-xs text-gray-500">
                System automatically sends an alert to the concerned officer and replacement truck driver when any vehicle reaches 75% load capacity
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {data.vehicles.map((v) => (
              <VehicleCard key={v.id} v={v} />
            ))}
          </div>
        </section>

        {/* ── Swap Alerts with Auto-Notification Recipient Details ─────────── */}
        {visibleAlerts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <span>🔔</span> Vehicle Swap Alerts (≥75% Fill Level Reached)
              </h2>
              <span className="text-xs font-semibold text-red-700 bg-red-100 border border-red-300 px-2.5 py-0.5 rounded-full">
                ⚡ Automated Dispatch Active
              </span>
            </div>

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
                    className="bg-red-50/90 border border-red-300 rounded-2xl p-5 shadow-xs flex flex-col gap-3"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <span className="text-3xl p-2 bg-white rounded-xl border border-red-200 shadow-2xs">
                          {meta.icon}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-red-900">
                              {a.zone} — {meta.label} at {a.fillPct}% Capacity
                            </span>
                            <span className="text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-full uppercase">
                              Threshold Reached
                            </span>
                          </div>
                          <p className="text-xs text-red-700 mt-0.5">
                            Vehicle {a.vehicleId} · Triggered {a.timestamp}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => dismissAlert(a.id)}
                        className="text-xs font-bold bg-white border border-red-300 text-red-700 rounded-xl px-4 py-2 hover:bg-red-100 transition-colors cursor-pointer shrink-0 shadow-xs"
                      >
                        Acknowledge & Confirm Swap
                      </button>
                    </div>

                    {/* Automatic Notification Dispatch Details */}
                    <div className="bg-white/80 border border-red-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-700">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📲</span>
                        <div>
                          <p className="font-bold text-gray-900">
                            Auto-Notification Sent To: {a.recipientName} ({a.recipientRole})
                          </p>
                          <p className="text-[11px] text-gray-500">
                            Phone: {a.recipientPhone} · Channel: {a.deliveryChannel}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:border-l sm:border-gray-200 sm:pl-4">
                        <span className="text-lg">🚛</span>
                        <div>
                          <p className="font-bold text-gray-900">
                            Replacement Driver: {a.swapDriverName}
                          </p>
                          <p className="text-[11px] text-emerald-700 font-semibold">
                            Truck: {a.swapTruckNumber} · En Route
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Community Theater Seating Arrangement with Sparrows ─────────── */}
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
          BinGo Municipal Operations · Zone 1 (0000 to 1000)
        </p>
        <p className="mt-1 text-[11px]">
          Chirpy Sparrow Mascot · Automatic 75% SNS Swap Alerts · 12-Month Compliance Tracking
        </p>
      </footer>
    </div>
  );
}
