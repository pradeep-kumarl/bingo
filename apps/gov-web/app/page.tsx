"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";

// ─── Sound Synthesizer (Native Web Audio API — No External Files) ──────────────

class SoundEffects {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private init() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  // Cute bird chirp sound (Duolingo style)
  chirp() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(2400, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(1800, now + 0.16);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } catch {
      // Audio not permitted or supported
    }
  }

  // Magic defrost sparkle sound
  defrost() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [1200, 1600, 2000, 2400].forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = "triangle";
        const t = now + idx * 0.05;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(t);
        osc.stop(t + 0.1);
      });
    } catch {
      // Audio not permitted
    }
  }

  // Dispatch message notification chime
  messageChime() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.setValueAtTime(880, now + 0.1); // A5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      // audio error
    }
  }

  // Police siren / patrol chime
  policeChime() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(880, now + 0.12);
      osc.frequency.setValueAtTime(440, now + 0.24);
      osc.frequency.setValueAtTime(880, now + 0.36);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    } catch {
      // audio error
    }
  }
}

const sfx = new SoundEffects();

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

interface DashboardData {
  zone: Zone;
  vehicles: Vehicle[];
  alerts: Alert[];
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-IN", { hour12: false });
}

export type SeatStatus = "dropped" | "pending" | "out_of_station";

export interface MonthPerformance {
  monthName: string;
  daysDropped: number;
  totalDays: number;
  compliancePct: number;
  sparrowMood: "gold_sparrow" | "happy_sparrow" | "frozen_sparrow" | "vacation_sparrow";
  badgeLabel: string;
}

export interface PoliceCheckInReply {
  id: string;
  timestamp: string;
  officerName: string;
  badgeNumber: string;
  patrolVehicle: string;
  message: string;
  lockStatus: "VERIFIED_LOCKED" | "ALL_CLEAR" | "PERIMETER_CHECKED";
}

export interface PolicePatrolRecord {
  patrolId: string;
  policeStation: string;
  beatSector: string;
  assignedVehicle: string;
  officerInCharge: string;
  officerPhone: string;
  status: "AUTOMATED_DISPATCHED" | "PATROL_ACTIVE" | "VERIFIED_SAFE";
  dispatchedTimestamp: string;
  patrolLink: string;
  vacationFrom: string;
  vacationTo: string;
  checkIns: PoliceCheckInReply[];
}

export interface HouseSeat {
  id: string; // "0000" to "1000"
  numericId: number;
  block: "Block A" | "Block B" | "Block C" | "Block D";
  status: SeatStatus;
  streak: number;
  monthDropsCount: number;
  monthTotalDays: number;
  dropTimeToday?: string;
  residentName: string;
  phone: string;
  address: string;
  assignedBadge: string;
  twelveMonths: MonthPerformance[];
  policePatrol?: PolicePatrolRecord;
}

export interface MessageItem {
  id: string;
  houseId: string;
  residentName: string;
  phone: string;
  category: "Bulky Pickup" | "Bin Overflow" | "Travel / Freeze" | "Query" | "Police Patrol";
  messageText: string;
  timestamp: string;
  status: "pending_reply" | "resolved";
  officialReply?: string;
  replyTime?: string;
  officerName?: string;
}

// ─── Waste Metadata ───────────────────────────────────────────────────────────

const WASTE_META: Record<
  string,
  { icon: string; label: string; sub: string; color: string; badgeBg: string }
> = {
  wet: {
    icon: "🥬",
    label: "Organic (Wet)",
    sub: "Kitchen & compostable waste",
    color: "text-emerald-700",
    badgeBg: "bg-emerald-100 text-emerald-800",
  },
  sanitary: {
    icon: "🔥",
    label: "Sanitary / Soiled (Burning)",
    sub: "Diapers & soiled for incineration",
    color: "text-amber-700",
    badgeBg: "bg-amber-100 text-amber-800",
  },
  dry: {
    icon: "📦",
    label: "Dry / Recyclables",
    sub: "Paper, clean plastics, bottles & metal",
    color: "text-blue-700",
    badgeBg: "bg-blue-100 text-blue-800",
  },
  furniture: {
    icon: "🛋️",
    label: "Bulky / Furniture",
    sub: "Large mattresses, wood & furnishings",
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

// ─── Seed Data ────────────────────────────────────────────────────────────────

const INITIAL_ZONE: Zone = {
  name: "Zone 1 (Houses 0000 to 1000)",
  ward: "Ward 151",
  totalHouseholds: 1001,
  activeVehicles: 5,
};

const INITIAL_VEHICLES: Vehicle[] = [
  { id: "VH-ORG-01",  wasteType: "wet",       fillPct: 73.5, currentKg: 735,  capacityKg: 1000, status: "active" },
  { id: "VH-BURN-01", wasteType: "sanitary",  fillPct: 38.0, currentKg: 190,  capacityKg: 500,  status: "active" },
  { id: "VH-DRY-01",  wasteType: "dry",        fillPct: 78.4, currentKg: 940,  capacityKg: 1200, status: "swapping" },
  { id: "VH-FURN-01", wasteType: "furniture", fillPct: 22.5, currentKg: 450,  capacityKg: 2000, status: "active" },
  { id: "VH-EVNT-01", wasteType: "event",     fillPct: 21.3, currentKg: 320,  capacityKg: 1500, status: "active" },
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

const INITIAL_MESSAGES: MessageItem[] = [
  {
    id: "MSG-101",
    houseId: "0142",
    residentName: "Vikram Sengupta",
    phone: "+91 98451 88234",
    category: "Bulky Pickup",
    messageText: "Hello Officer! We have 2 large wooden chairs and an old mattress. Can the furniture collection truck stop by our block tomorrow morning?",
    timestamp: "10 mins ago",
    status: "pending_reply",
  },
  {
    id: "MSG-102",
    houseId: "0087",
    residentName: "Ananya Rao",
    phone: "+91 97412 34567",
    category: "Bin Overflow",
    messageText: "Our family hosted a dinner party yesterday. We segregated organic waste into 3 biodegradable bags. Is Bay 1 open for extra drop before noon?",
    timestamp: "35 mins ago",
    status: "resolved",
    officialReply: "Yes Ananya! Bay 1 is operating normally till 8 PM. Please drop in the organic hopper. Happy to help!",
    replyTime: "22 mins ago",
    officerName: "Officer M. Suresh",
  },
  {
    id: "MSG-103",
    houseId: "0205",
    residentName: "Dr. K. Raman",
    phone: "+91 99001 56789",
    category: "Travel / Freeze",
    messageText: "Traveling to Delhi for medical conference Oct 12–18. Setting house status to Out of Station. Please protect our 45-day Chirpy streak!",
    timestamp: "1 hour ago",
    status: "resolved",
    officialReply: "Streak Freeze approved, Dr. Raman! Chirpy is in Vacation Mode 🏖️. Safe travels!",
    replyTime: "50 mins ago",
    officerName: "Officer M. Suresh",
  },
  {
    id: "MSG-104",
    houseId: "0000",
    residentName: "Priya Sharma",
    phone: "+91 98112 30000",
    category: "Police Patrol",
    messageText: "Vacation Alert: Away till Oct 25. House locked. Requesting Hoysala Beat #4 patrol night vigil check-ins.",
    timestamp: "2 hours ago",
    status: "resolved",
    officialReply: "🚓 Hoysala 12 Check-in (02:15 AM): Main gate padlock checked & secure. Perimeter safe 🛡️👮",
    replyTime: "1 hour ago",
    officerName: "HC Suresh K. (Beat Patrol Officer)",
  },
];

function createPolicePatrolRecord(houseId: string, residentName: string): PolicePatrolRecord {
  const num = parseInt(houseId, 10) || 0;
  const beatNum = (num % 6) + 1;
  const vehicleNum = 8810 + (num % 40);
  return {
    patrolId: `KSP-BEAT${beatNum}-VAC-${houseId}`,
    policeStation: "Koramangala Police Station (Ward 151 Beat)",
    beatSector: `Beat #${beatNum} (Koramangala Sector)`,
    assignedVehicle: `Hoysala Patrol KA-02-G-${vehicleNum}`,
    officerInCharge: "Head Constable Suresh K. & PC Raghu",
    officerPhone: "+91 94808 01100",
    status: "PATROL_ACTIVE",
    dispatchedTimestamp: "Today at 06:00 AM (Automated Link)",
    patrolLink: `https://police.ksp.gov.in/patrol/ward151/beat${beatNum}/house-${houseId}`,
    vacationFrom: "Oct 11, 2026",
    vacationTo: "Oct 25, 2026",
    checkIns: [
      {
        id: `CHK-${houseId}-1`,
        timestamp: "02:15 AM (Night Vigil)",
        officerName: "HC Suresh K.",
        badgeNumber: "HC-4412",
        patrolVehicle: `Hoysala ${beatNum}`,
        message: "Perimeter check complete. Main gate padlock verified intact & porch lights on. 🛡️👮",
        lockStatus: "VERIFIED_LOCKED",
      },
      {
        id: `CHK-${houseId}-2`,
        timestamp: "05:40 AM (Dawn Patrol Sweep)",
        officerName: "PC Raghu",
        badgeNumber: "PC-8891",
        patrolVehicle: `Cheetah 0${beatNum}`,
        message: "Morning drive-by completed. Compound secure, no anomalies detected. All clear! ✅",
        lockStatus: "ALL_CLEAR",
      },
    ],
  };
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function getBlockName(num: number): "Block A" | "Block B" | "Block C" | "Block D" {
  if (num <= 250) return "Block A";
  if (num <= 500) return "Block B";
  if (num <= 750) return "Block C";
  return "Block D";
}

function generate12Months(houseIndex: number, todayStatus: SeatStatus): MonthPerformance[] {
  return MONTH_NAMES.map((name, mIdx) => {
    const totalDays = MONTH_DAYS[mIdx];
    const monthHash = ((houseIndex * 41 + mIdx * 29) * 2654435761) >>> 0;
    const rateFactor = (monthHash % 35) + 65;

    let daysDropped = Math.round((totalDays * rateFactor) / 100);
    if (mIdx === 9) {
      if (todayStatus === "out_of_station") daysDropped = Math.max(12, daysDropped - 8);
      else if (todayStatus === "dropped") daysDropped = Math.min(totalDays, daysDropped + 2);
    }

    const compliancePct = Math.round((daysDropped / totalDays) * 100);
    let sparrowMood: MonthPerformance["sparrowMood"] = "happy_sparrow";
    let badgeLabel = "Good Binner";

    if (compliancePct >= 92) {
      sparrowMood = "gold_sparrow";
      badgeLabel = "Eco Champion";
    } else if (compliancePct >= 80) {
      sparrowMood = "happy_sparrow";
      badgeLabel = "Active Streak";
    } else if (compliancePct >= 70) {
      sparrowMood = "vacation_sparrow";
      badgeLabel = "Travel Freeze";
    } else {
      sparrowMood = "frozen_sparrow";
      badgeLabel = "Frozen Streak";
    }

    return {
      monthName: name,
      daysDropped,
      totalDays,
      compliancePct,
      sparrowMood,
      badgeLabel,
    };
  });
}

const INDIAN_NAMES = [
  "Priya Sharma", "Devika Menon", "Kabir Mehta", "Lakshmi Narayanan", "Vikram Sengupta",
  "Ananya Rao", "Rohan Joshi", "Aarav Kulkarni", "Deepa Nambiar", "Sunil Reddy",
  "Tanvi Hegde", "Aditya Nair", "Sneha Iyer", "Rajesh Deshmukh", "Pooja Varma",
];

function generateInitialHouses(): HouseSeat[] {
  const houses: HouseSeat[] = [];

  for (let i = 0; i <= 1000; i++) {
    const id = i.toString().padStart(4, "0");
    const hash = (i * 2654435761) >>> 0;
    const mod100 = hash % 100;

    let status: SeatStatus = "pending";
    if (mod100 < 4) status = "out_of_station";
    else if (mod100 < 78) status = "dropped";
    else status = "pending";

    if (i === 101) status = "dropped";
    if (i === 102) status = "dropped";
    if (i === 103) status = "out_of_station";
    if (i === 104) status = "pending";
    if (i === 142) status = "dropped";

    const hour = 6 + (hash % 5);
    const minute = (hash % 60).toString().padStart(2, "0");
    const dropTimeToday = status === "dropped" ? `0${hour}:${minute} AM` : undefined;

    const twelveMonths = generate12Months(i, status);
    const currentMonthData = twelveMonths[9];
    const name = INDIAN_NAMES[i % INDIAN_NAMES.length];
    const policePatrol = status === "out_of_station" ? createPolicePatrolRecord(id, name) : undefined;

    houses.push({
      id,
      numericId: i,
      block: getBlockName(i),
      status,
      streak: status === "dropped" ? 1 + (hash % 14) : 0,
      monthDropsCount: currentMonthData.daysDropped,
      monthTotalDays: currentMonthData.totalDays,
      dropTimeToday,
      residentName: name,
      phone: `+91 ${98000 + (hash % 1999)} ${10000 + (hash % 89999)}`,
      address: `House #${id}, ${getBlockName(i)}, Green Glen Layout, Ward 151`,
      assignedBadge: `BG-RFID-${id}`,
      twelveMonths,
      policePatrol,
    });
  }

  return houses;
}

// ─── Duolingo-Style Animated Vector Mascot SVG Component ───────────────────────

export function DuolingoChirpyMascot({
  mood,
  size = 80,
  interactive = true,
}: {
  mood: "happy" | "frozen" | "vacation" | "super_happy" | "crying";
  size?: number;
  interactive?: boolean;
}) {
  const [bounce, setBounce] = useState(false);

  function handleClick() {
    if (!interactive) return;
    setBounce(true);
    sfx.chirp();
    setTimeout(() => setBounce(false), 500);
  }

  // Expression styling based on Duolingo moods
  if (mood === "frozen") {
    return (
      <div
        onClick={handleClick}
        title="Frozen Chirpy: Streak is frozen in ice!"
        style={{ width: size, height: size }}
        className={`relative cursor-pointer transition-transform duration-200 select-none ${
          bounce ? "scale-115 rotate-6" : "hover:scale-108"
        }`}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
          {/* Ice Cube surround with refraction */}
          <rect x="8" y="10" width="84" height="80" rx="18" fill="#bae6fd" fillOpacity="0.45" stroke="#38bdf8" strokeWidth="2.5" />
          <path d="M12 25 L35 15 L88 20" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
          <path d="M20 85 L80 82" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.6" />

          {/* Shivering Pale Cyan Sparrow Body */}
          <ellipse cx="50" cy="54" rx="30" ry="28" fill="#7dd3fc" stroke="#0284c7" strokeWidth="2" />
          <ellipse cx="50" cy="58" rx="20" ry="17" fill="#e0f2fe" />

          {/* Frosted Cheeks */}
          <circle cx="30" cy="54" r="5" fill="#38bdf8" opacity="0.5" />
          <circle cx="70" cy="54" r="5" fill="#38bdf8" opacity="0.5" />

          {/* Shivering / Chattering Eyes (spiral/dizzy freeze) */}
          <ellipse cx="38" cy="42" rx="7" ry="8" fill="#ffffff" stroke="#0369a1" strokeWidth="1.5" />
          <ellipse cx="62" cy="42" rx="7" ry="8" fill="#ffffff" stroke="#0369a1" strokeWidth="1.5" />
          <circle cx="39" cy="42" r="3" fill="#0369a1" />
          <circle cx="61" cy="42" r="3" fill="#0369a1" />
          <circle cx="41" cy="40" r="1.2" fill="#ffffff" />
          <circle cx="63" cy="40" r="1.2" fill="#ffffff" />

          {/* Chattering Shivering Beak */}
          <polygon points="50,46 44,53 56,53" fill="#fb923c" stroke="#c2410c" strokeWidth="1" />
          <line x1="45" y1="51" x2="55" y2="51" stroke="#9a3412" strokeWidth="1" />

          {/* Icicles Dripping from Beak & Head */}
          <polygon points="46,54 48,64 50,54" fill="#38bdf8" />
          <polygon points="51,54 53,62 55,54" fill="#38bdf8" />
          <polygon points="35,28 37,20 39,28" fill="#e0f2fe" />
          <polygon points="60,28 62,19 64,28" fill="#e0f2fe" />

          {/* Shivering Wing Hug */}
          <path d="M22 55 Q35 62 40 55" fill="#38bdf8" stroke="#0284c7" strokeWidth="1.5" />
          <path d="M78 55 Q65 62 60 55" fill="#38bdf8" stroke="#0284c7" strokeWidth="1.5" />
        </svg>
      </div>
    );
  }

  if (mood === "vacation") {
    return (
      <div
        onClick={handleClick}
        title="Vacation Chirpy: Travelling & Streak Protected!"
        style={{ width: size, height: size }}
        className={`relative cursor-pointer transition-transform duration-200 select-none ${
          bounce ? "scale-115 rotate-6" : "hover:scale-108"
        }`}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
          {/* Golden Green Sparrow Body */}
          <ellipse cx="50" cy="55" rx="32" ry="28" fill="#10b981" stroke="#047857" strokeWidth="2" />
          <ellipse cx="50" cy="62" rx="20" ry="16" fill="#a7f3d0" />

          {/* Straw Sun Hat with Red Ribbon */}
          <ellipse cx="50" cy="28" rx="30" ry="8" fill="#fde047" stroke="#ca8a04" strokeWidth="1.5" />
          <path d="M32 26 Q50 14 68 26" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.5" />
          <rect x="33" y="24" width="34" height="4" fill="#ef4444" rx="1" />

          {/* Cool Aviator Sunglasses with Sky Reflection */}
          <rect x="26" y="38" width="20" height="15" rx="5" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
          <rect x="54" y="38" width="20" height="15" rx="5" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
          <line x1="46" y1="44" x2="54" y2="44" stroke="#475569" strokeWidth="2" />
          {/* Sunglasses glass gradient reflections */}
          <path d="M29 40 L38 40 L32 50 L27 50 Z" fill="#38bdf8" opacity="0.6" />
          <path d="M57 40 L66 40 L60 50 L55 50 Z" fill="#38bdf8" opacity="0.6" />

          {/* Happy Smiling Beak */}
          <polygon points="50,54 44,61 56,61" fill="#f97316" stroke="#c2410c" strokeWidth="1" />

          {/* Coconut Drink with Straw in Wing */}
          <circle cx="76" cy="68" r="9" fill="#78350f" stroke="#451a03" strokeWidth="1" />
          <ellipse cx="76" cy="63" rx="7" ry="3" fill="#fef3c7" />
          <line x1="77" y1="63" x2="84" y2="50" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (mood === "super_happy") {
    return (
      <div
        onClick={handleClick}
        title="Super Champion Chirpy: Golden Star Eco Binner!"
        style={{ width: size, height: size }}
        className={`relative cursor-pointer transition-transform duration-200 select-none ${
          bounce ? "scale-115 rotate-6" : "hover:scale-108"
        }`}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
          {/* Golden Crown */}
          <polygon points="34,22 42,12 50,19 58,12 66,22" fill="#eab308" stroke="#a16207" strokeWidth="1.5" />
          <circle cx="42" cy="12" r="2.5" fill="#ef4444" />
          <circle cx="50" cy="19" r="2.5" fill="#3b82f6" />
          <circle cx="58" cy="12" r="2.5" fill="#ef4444" />

          {/* Vibrant Green Duolingo Body */}
          <ellipse cx="50" cy="56" rx="32" ry="28" fill="#10b981" stroke="#047857" strokeWidth="2.5" />
          <ellipse cx="50" cy="63" rx="21" ry="16" fill="#6ee7b7" />

          {/* Huge Sparkling Kawaii Eyes */}
          <ellipse cx="37" cy="44" rx="8" ry="9" fill="#ffffff" stroke="#065f46" strokeWidth="1.5" />
          <ellipse cx="63" cy="44" rx="8" ry="9" fill="#ffffff" stroke="#065f46" strokeWidth="1.5" />
          <ellipse cx="38" cy="45" rx="5.5" ry="6.5" fill="#065f46" />
          <ellipse cx="62" cy="45" rx="5.5" ry="6.5" fill="#065f46" />
          {/* Eye Star Highlights */}
          <circle cx="40" cy="42" r="2.5" fill="#ffffff" />
          <circle cx="64" cy="42" r="2.5" fill="#ffffff" />
          <circle cx="36" cy="48" r="1.2" fill="#ffffff" />
          <circle cx="60" cy="48" r="1.2" fill="#ffffff" />

          {/* Blushing Pink Cheeks */}
          <ellipse cx="27" cy="54" rx="5" ry="3.5" fill="#f43f5e" opacity="0.6" />
          <ellipse cx="73" cy="54" rx="5" ry="3.5" fill="#f43f5e" opacity="0.6" />

          {/* Cheerful Open Singing Beak */}
          <path d="M44 54 Q50 63 56 54 Z" fill="#f97316" stroke="#c2410c" strokeWidth="1" />
          <polygon points="50,48 44,54 56,54" fill="#fb923c" stroke="#c2410c" strokeWidth="1" />

          {/* Flapping Wings with Sparkles */}
          <path d="M16 52 Q28 42 22 62" fill="#059669" stroke="#047857" strokeWidth="1.5" />
          <path d="M84 52 Q72 42 78 62" fill="#059669" stroke="#047857" strokeWidth="1.5" />
        </svg>
      </div>
    );
  }

  // Default: Happy Chirpy
  return (
    <div
      onClick={handleClick}
      title="Happy Chirpy: Waste deposited on time!"
      style={{ width: size, height: size }}
      className={`relative cursor-pointer transition-transform duration-200 select-none ${
        bounce ? "scale-115 rotate-6" : "hover:scale-108"
      }`}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
        {/* Plump Round Green Body */}
        <ellipse cx="50" cy="54" rx="32" ry="29" fill="#10b981" stroke="#047857" strokeWidth="2.5" />
        <ellipse cx="50" cy="62" rx="21" ry="17" fill="#6ee7b7" />

        {/* Big Cartoon Eyes */}
        <ellipse cx="37" cy="43" rx="8" ry="9" fill="#ffffff" stroke="#065f46" strokeWidth="1.5" />
        <ellipse cx="63" cy="43" rx="8" ry="9" fill="#ffffff" stroke="#065f46" strokeWidth="1.5" />
        <circle cx="38" cy="44" r="5" fill="#064e3b" />
        <circle cx="62" cy="44" r="5" fill="#064e3b" />
        <circle cx="40" cy="41" r="2" fill="#ffffff" />
        <circle cx="64" cy="41" r="2" fill="#ffffff" />

        {/* Cute Blushing Cheeks */}
        <circle cx="28" cy="52" r="4.5" fill="#fb7185" opacity="0.5" />
        <circle cx="72" cy="52" r="4.5" fill="#fb7185" opacity="0.5" />

        {/* Happy Orange Beak */}
        <polygon points="50,47 44,55 56,55" fill="#f97316" stroke="#c2410c" strokeWidth="1" />

        {/* Wings resting happily */}
        <path d="M18 55 Q28 65 24 75" fill="#059669" stroke="#047857" strokeWidth="1.5" />
        <path d="M82 55 Q72 65 76 75" fill="#059669" stroke="#047857" strokeWidth="1.5" />
      </svg>
    </div>
  );
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

  const isAlertThreshold = v.fillPct >= 75;

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm p-4 flex flex-col justify-between gap-3 hover:shadow-md transition-all ${
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
            className={`h-full rounded-full transition-all duration-500 ${
              v.fillPct >= 75 ? "bg-red-500" : v.fillPct >= 50 ? "bg-amber-400" : "bg-emerald-500"
            }`}
            style={{ width: `${Math.min(v.fillPct, 100)}%` }}
          />
        </div>
      </div>

      {isAlertThreshold ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 text-[11px] text-red-800 flex flex-col gap-0.5">
          <div className="flex items-center gap-1 font-bold text-red-900">
            <span>📲 Auto-Notification Dispatched via SNS</span>
          </div>
          <p className="text-[10px] text-red-700">
            Alerted Supervisor (M. Suresh) & Backup Truck KA-01-EA-4412
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

// ─── Seat Detail Pop-up Modal with Mascot & 12-Month History ──────────────────

function SeatDetailModal({
  house,
  isAdmin,
  onClose,
  onToggleStatus,
  onEditHouse,
  onSendPoliceCheckIn,
}: {
  house: HouseSeat;
  isAdmin: boolean;
  onClose: () => void;
  onToggleStatus: (newStatus: SeatStatus) => void;
  onEditHouse: () => void;
  onSendPoliceCheckIn: (
    houseId: string,
    replyMessage: string,
    lockStatus?: "VERIFIED_LOCKED" | "ALL_CLEAR" | "PERIMETER_CHECKED"
  ) => void;
}) {
  const [policeInput, setPoliceInput] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [sentToast, setSentToast] = useState<string | null>(null);

  const totalYearDrops = house.twelveMonths.reduce((acc, m) => acc + m.daysDropped, 0);
  const totalYearDays = house.twelveMonths.reduce((acc, m) => acc + m.totalDays, 0);
  const yearPct = Math.round((totalYearDrops / totalYearDays) * 100);

  const mascotMood =
    house.status === "dropped"
      ? (yearPct >= 90 ? "super_happy" : "happy")
      : house.status === "out_of_station"
      ? "vacation"
      : "frozen";

  const speechText =
    house.status === "dropped"
      ? `Chirpy is thrilled! House #${house.id} has binned today! Streak is active with ${house.streak} continuous days!`
      : house.status === "out_of_station"
      ? `Chirpy is on vacation! House #${house.id} is marked Out of Station with automated Police Beat Patrol security active!`
      : `Brrr! House #${house.id} is frozen in an ice cube! Drop waste before 8 PM to defrost Chirpy!`;

  function handleDispatchPoliceNote() {
    if (!policeInput.trim()) return;
    onSendPoliceCheckIn(house.id, policeInput.trim(), "VERIFIED_LOCKED");
    setPoliceInput("");
    setSentToast(`Patrol check-in sent directly to ${house.residentName}'s mobile app!`);
    sfx.policeChime();
    setTimeout(() => setSentToast(null), 3500);
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
        {/* Header with Unified Duolingo Mascot */}
        <div className="bg-gradient-to-r from-emerald-800 via-green-700 to-emerald-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 p-1 flex items-center justify-center border border-white/20 shadow-inner overflow-hidden shrink-0">
              <DuolingoChirpyMascot mood={mascotMood} size={42} interactive={false} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black">House #{house.id}</h3>
                <span className="text-xs bg-white/20 text-white px-2.5 py-0.5 rounded-full font-mono font-semibold">
                  {house.block}
                </span>
                {isAdmin && (
                  <span className="text-[10px] bg-amber-400 text-amber-950 font-bold px-2 py-0.5 rounded-full">
                    Admin Verified
                  </span>
                )}
                {house.status === "out_of_station" && (
                  <span className="text-[10px] bg-cyan-400 text-slate-950 font-bold px-2 py-0.5 rounded-full animate-pulse">
                    🚓 Police Patrol Active
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-100 mt-0.5">
                Ward 151 · {house.residentName} · {house.phone}
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
          {/* Duolingo Interactive Mascot Banner */}
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-3xl p-4 flex items-center gap-4">
            <DuolingoChirpyMascot mood={mascotMood} size={76} />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-900">
                  {house.status === "dropped"
                    ? "Happy Chirpy ✨"
                    : house.status === "out_of_station"
                    ? "Vacation Chirpy 🏖️ (Police Protected)"
                    : "Frozen Chirpy 🥶❄️"}
                </span>
                {house.streak > 0 && (
                  <span className="text-xs font-black bg-emerald-200 text-emerald-900 px-2.5 py-0.5 rounded-full">
                    🔥 {house.streak}d Streak
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-950 mt-1 font-medium leading-relaxed">
                {speechText}
              </p>
            </div>
          </div>

          {/* 🚓 Automated Police Beat Patrol Protection Hub */}
          {house.status === "out_of_station" ? (
            <div className="bg-slate-900 text-white border border-slate-700 rounded-3xl p-4.5 flex flex-col gap-3 shadow-md">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl p-1 bg-white/10 rounded-xl">🚓</span>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-cyan-300">
                      Automated Police Beat Patrol Protection Active
                    </h4>
                    <p className="text-[11px] text-slate-300">
                      House locked for travel · Linked to nearest beat patrolling unit
                    </p>
                  </div>
                </div>
                <span className="text-[10px] bg-emerald-500 text-white font-bold px-2.5 py-0.5 rounded-full animate-pulse">
                  ● Beat Live
                </span>
              </div>

              {/* Automated Dispatch Tracking Link */}
              <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] uppercase font-bold text-cyan-400">
                    Automated Patrol Link &amp; Sector Route:
                  </span>
                  <span className="text-xs font-mono text-cyan-200 truncate select-all">
                    {house.policePatrol?.patrolLink ??
                      `https://police.ksp.gov.in/patrol/ward151/beat4/house-${house.id}`}
                  </span>
                </div>
                <button
                  onClick={() => {
                    const link =
                      house.policePatrol?.patrolLink ??
                      `https://police.ksp.gov.in/patrol/ward151/beat4/house-${house.id}`;
                    navigator.clipboard?.writeText(link);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                    sfx.chirp();
                  }}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs"
                >
                  {copiedLink ? "✓ Link Copied" : "📋 Copy Patrol Link"}
                </button>
              </div>

              {/* Police Beat Details */}
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Nearest Police Station:
                  </span>
                  <span className="font-semibold">
                    {house.policePatrol?.policeStation ?? "Koramangala Police Station (Ward 151 Beat)"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Patrol Vehicle &amp; Sector:
                  </span>
                  <span className="font-semibold font-mono text-cyan-300">
                    {house.policePatrol?.assignedVehicle ?? "Hoysala Patrol KA-02-G-8819"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Officers In-Charge:
                  </span>
                  <span className="font-semibold">
                    {house.policePatrol?.officerInCharge ?? "HC Suresh K. & PC Raghu"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Emergency Beat Helpline:
                  </span>
                  <span className="font-mono text-cyan-300">
                    {house.policePatrol?.officerPhone ?? "+91 94808 01100"}
                  </span>
                </div>
              </div>

              {/* Live Patrol Verification & Check-in Messages Sent Directly to App */}
              <div className="mt-1 flex flex-col gap-2">
                <span className="text-[11px] font-bold text-cyan-200 flex items-center justify-between">
                  <span>👮 Patrol Updates Delivered Directly to Citizen App:</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    Real-time push to resident notification bar
                  </span>
                </span>

                <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                  {(house.policePatrol?.checkIns ?? []).map((chk) => (
                    <div
                      key={chk.id}
                      className="bg-slate-800/90 border border-slate-700 rounded-xl p-2.5 text-xs flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                          <span>🛡️</span> {chk.officerName} ({chk.patrolVehicle})
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {chk.timestamp}
                        </span>
                      </div>
                      <p className="text-slate-100 text-xs leading-relaxed">{chk.message}</p>
                      <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold border-t border-slate-700/60 pt-1 mt-0.5">
                        <span>✓ Verified Safe &amp; Delivered to App</span>
                        <span className="font-mono text-slate-400">{chk.badgeNumber}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Patrolling Police Officer Reply & Check-in Console */}
                <div className="bg-slate-950/80 rounded-2xl p-3 border border-slate-700/80 flex flex-col gap-2 mt-1">
                  <label className="text-[11px] font-bold text-cyan-300 flex items-center justify-between">
                    <span>Officer Patrol Check-in Reply to Resident App:</span>
                    <span className="text-[10px] text-slate-400">Pushes directly to resident's phone</span>
                  </label>

                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "Main gate padlock verified intact 🛡️",
                      "Night vigil 02:30 AM: All clear & premises secure ✅",
                      "Compound & windows inspected, no issues 🌙",
                      "Dawn patrol drive-by completed 🚓",
                    ].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setPoliceInput(preset)}
                        className="text-[10px] bg-slate-800 hover:bg-slate-700 text-cyan-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={policeInput}
                      onChange={(e) => setPoliceInput(e.target.value)}
                      placeholder="Type patrol check-in note to resident app..."
                      className="flex-1 text-xs p-2 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 font-medium"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleDispatchPoliceNote();
                      }}
                    />
                    <button
                      onClick={handleDispatchPoliceNote}
                      className="px-3.5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl text-xs transition-colors cursor-pointer shadow flex items-center gap-1 shrink-0"
                    >
                      <span>Reply to App 🚓</span>
                    </button>
                  </div>

                  {sentToast && (
                    <p className="text-[11px] font-bold text-emerald-400 animate-pulse">
                      ✓ {sentToast}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🚓</span>
                <div>
                  <p className="font-bold text-amber-900">
                    Automated Beat Police Patrol Link Integration
                  </p>
                  <p className="text-[11px] text-amber-700">
                    Marking Out of Station automatically triggers the Police Patrol link, assigning Hoysala Beat #4 for scheduled night vigils and verified lock check-in updates.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  onToggleStatus("out_of_station");
                  sfx.policeChime();
                }}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shrink-0 shadow-xs"
              >
                Set Vacation &amp; Link Police 🏖️
              </button>
            </div>
          )}

          {/* Resident Details (Allotted by Admin) */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between border-b border-gray-200/70 pb-2">
              <span className="font-bold text-gray-700 flex items-center gap-1.5">
                <span>📋</span> Household Registration Details
              </span>
              {isAdmin && (
                <button
                  onClick={onEditHouse}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-white border border-emerald-300 px-2.5 py-1 rounded-lg cursor-pointer"
                >
                  ✏️ Edit Allotment
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-gray-700 pt-1">
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Resident:</span>
                <span className="font-bold">{house.residentName}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Phone:</span>
                <span className="font-mono">{house.phone}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Address:</span>
                <span>{house.address}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">RFID Card:</span>
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-gray-200">{house.assignedBadge}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Today's Deposit:</span>
                <span className="font-bold text-emerald-700">{house.dropTimeToday ?? "Pending"}</span>
              </div>
            </div>
          </div>

          {/* 12-Month Annual Waste History */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-base">📅</span>
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                  12-Month Annual Compliance (2026)
                </h4>
              </div>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                Annual Total: {totalYearDrops} / {totalYearDays} Days ({yearPct}%)
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mb-3">
              Click any month to view Chirpy's seasonal mascot achievement:
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {house.twelveMonths.map((m, idx) => {
                const isCurrent = idx === 9; // October
                const isFrozen = m.sparrowMood === "frozen_sparrow";
                const isGold = m.sparrowMood === "gold_sparrow";

                return (
                  <div
                    key={m.monthName}
                    className={`p-3 rounded-2xl border flex flex-col justify-between gap-1.5 transition-all ${
                      isCurrent
                        ? "bg-emerald-50 border-emerald-400 ring-2 ring-emerald-300"
                        : "bg-white border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-800 font-mono">
                        {m.monthName}
                        {isCurrent && (
                          <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.2 rounded-full ml-1 font-sans">
                            Current
                          </span>
                        )}
                      </span>
                      {/* Mini Duolingo Vector Mascot (No Static Red Emoji) */}
                      <div className="shrink-0">
                        {isGold ? (
                          <DuolingoChirpyMascot mood="super_happy" size={26} interactive={false} />
                        ) : isFrozen ? (
                          <DuolingoChirpyMascot mood="frozen" size={26} interactive={false} />
                        ) : m.sparrowMood === "vacation_sparrow" ? (
                          <DuolingoChirpyMascot mood="vacation" size={26} interactive={false} />
                        ) : (
                          <DuolingoChirpyMascot mood="happy" size={26} interactive={false} />
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-medium text-gray-600">
                        <span>{m.daysDropped}/{m.totalDays}d</span>
                        <span className={`font-bold ${isFrozen ? "text-sky-600" : isGold ? "text-amber-600" : "text-emerald-700"}`}>
                          {m.compliancePct}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden mt-1">
                        <div
                          className={`h-full rounded-full ${
                            isFrozen ? "bg-sky-400" : isGold ? "bg-amber-400" : "bg-emerald-500"
                          }`}
                          style={{ width: `${m.compliancePct}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-[10px] font-medium text-gray-400">
                      {m.badgeLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Status Action Controls */}
          <div className="border-t border-gray-200 pt-4 flex flex-wrap gap-2 justify-between items-center">
            <span className="text-xs text-gray-400 font-medium">Quick State Overrides:</span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onToggleStatus(house.status === "dropped" ? "pending" : "dropped");
                  sfx.defrost();
                }}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                  house.status === "dropped"
                    ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    : "bg-emerald-600 text-white hover:bg-emerald-700 shadow"
                }`}
              >
                {house.status === "dropped" ? "Freeze (Pending 🥶)" : "Mark Dropped (Happy ✨)"}
              </button>

              <button
                onClick={() => {
                  onToggleStatus(house.status === "out_of_station" ? "pending" : "out_of_station");
                  if (house.status !== "out_of_station") {
                    sfx.policeChime();
                  }
                }}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                  house.status === "out_of_station"
                    ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    : "bg-amber-500 text-white hover:bg-amber-600 shadow"
                }`}
              >
                {house.status === "out_of_station" ? "Remove Out of Station" : "Set Out of Station & Link Police (🏖️ 🚓)"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Allotment Modal ────────────────────────────────────────────────────

function AdminAllotmentModal({
  house,
  onClose,
  onSave,
}: {
  house: HouseSeat;
  onClose: () => void;
  onSave: (updated: Partial<HouseSeat>) => void;
}) {
  const [name, setName] = useState(house.residentName);
  const [phone, setPhone] = useState(house.phone);
  const [address, setAddress] = useState(house.address);
  const [block, setBlock] = useState(house.block);
  const [badge, setBadge] = useState(house.assignedBadge);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      residentName: name,
      phone,
      address,
      block,
      assignedBadge: badge,
    });
    sfx.messageChime();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛡️</span>
            <div>
              <h3 className="text-base font-black">Allot Household Block #{house.id}</h3>
              <p className="text-xs text-gray-300">Authorized Municipal Admin Console</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 text-white font-bold">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 text-xs">
          <div>
            <label className="font-bold text-gray-700 block mb-1">House Number (Locked)</label>
            <input
              type="text"
              disabled
              value={`House #${house.id}`}
              className="w-full p-2 bg-gray-100 border border-gray-300 rounded-xl font-mono font-bold text-gray-600"
            />
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1">Allotted Block Section</label>
            <select
              value={block}
              onChange={(e) => setBlock(e.target.value as HouseSeat["block"])}
              className="w-full p-2 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Block A">Block A (Houses 0000–0250)</option>
              <option value="Block B">Block B (Houses 0251–0500)</option>
              <option value="Block C">Block C (Houses 0501–0750)</option>
              <option value="Block D">Block D (Houses 0751–1000)</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1">Primary Resident Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1">Phone Number (SMS & WhatsApp)</label>
            <input
              type="text"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 font-mono"
            />
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1">Physical Street / Apartment Address</label>
            <textarea
              rows={2}
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1">Assigned BinGo RFID / QR Token ID</label>
            <input
              type="text"
              value={badge}
              onChange={(e) => setBadge(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 font-mono"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 cursor-pointer shadow"
            >
              Save & Allot Seat
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── 2-Way Citizen Live Message Board Component ───────────────────────────────

function CitizenMessageBoard({
  messages,
  onReply,
  onNewMockMessage,
  onSimulatePoliceCheckIn,
}: {
  messages: MessageItem[];
  onReply: (messageId: string, replyText: string) => void;
  onNewMockMessage: () => void;
  onSimulatePoliceCheckIn: () => void;
}) {
  const [selectedMsgId, setSelectedMsgId] = useState<string>(messages[0]?.id || "");
  const [filterCategory, setFilterCategory] = useState<"all" | "waste" | "police">("all");
  const [replyInput, setReplyInput] = useState("");

  const filteredMessages = messages.filter((m) => {
    if (filterCategory === "police") return m.category === "Police Patrol";
    if (filterCategory === "waste") return m.category !== "Police Patrol";
    return true;
  });

  const activeMsg = filteredMessages.find((m) => m.id === selectedMsgId) || filteredMessages[0] || messages[0];

  function handleSendReply() {
    if (!replyInput.trim() || !activeMsg) return;
    onReply(activeMsg.id, replyInput.trim());
    setReplyInput("");
    if (activeMsg.category === "Police Patrol") {
      sfx.policeChime();
    } else {
      sfx.messageChime();
    }
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">💬</span>
            <h3 className="text-base font-black text-gray-900">
              Community Dispatch & 2-Way Citizen Message Board
            </h3>
            <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
              Live Sync (App ↔ Govt Desk)
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Residents submit requests via BinGo mobile app. Officers &amp; Beat Police reply directly back to resident phones.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              onNewMockMessage();
              sfx.messageChime();
            }}
            className="text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-xl cursor-pointer transition-colors shrink-0"
          >
            + Simulate Citizen App Message
          </button>
          <button
            onClick={() => {
              onSimulatePoliceCheckIn();
            }}
            className="text-xs font-bold bg-slate-900 text-cyan-200 hover:bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl cursor-pointer transition-colors shrink-0 shadow-xs flex items-center gap-1"
          >
            <span>🚓</span> + Simulate Beat Police Check-in
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={() => setFilterCategory("all")}
          className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all ${
            filterCategory === "all"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All Feeds ({messages.length})
        </button>
        <button
          onClick={() => setFilterCategory("waste")}
          className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all ${
            filterCategory === "waste"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Waste &amp; Bulky ({messages.filter((m) => m.category !== "Police Patrol").length})
        </button>
        <button
          onClick={() => setFilterCategory("police")}
          className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all flex items-center gap-1 ${
            filterCategory === "police"
              ? "bg-slate-900 text-cyan-300 shadow-xs"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          <span>🚓</span> Police Patrol Updates ({messages.filter((m) => m.category === "Police Patrol").length})
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Messages List */}
        <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
          {filteredMessages.map((m) => {
            const isSelected = m.id === selectedMsgId;
            const isPolice = m.category === "Police Patrol";
            return (
              <div
                key={m.id}
                onClick={() => setSelectedMsgId(m.id)}
                className={`p-3 rounded-2xl border text-xs cursor-pointer transition-all ${
                  isSelected
                    ? isPolice
                      ? "bg-slate-900 text-white border-cyan-400 ring-2 ring-cyan-300/50 shadow-md"
                      : "bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-200"
                    : "bg-white border-gray-200 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`font-bold font-mono ${
                      isSelected && isPolice ? "text-cyan-300" : "text-gray-900"
                    }`}
                  >
                    House #{m.houseId}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      m.status === "resolved"
                        ? isPolice
                          ? "bg-cyan-400/20 text-cyan-300 border border-cyan-400/30"
                          : "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800 animate-pulse"
                    }`}
                  >
                    {m.status === "resolved"
                      ? isPolice
                        ? "Patrol Delivered"
                        : "Replied"
                      : "Pending Reply"}
                  </span>
                </div>
                <p
                  className={`font-semibold truncate ${
                    isSelected && isPolice ? "text-slate-100" : "text-gray-800"
                  }`}
                >
                  {m.residentName}
                </p>
                <p
                  className={`text-[11px] line-clamp-2 mt-0.5 ${
                    isSelected && isPolice ? "text-slate-300" : "text-gray-500"
                  }`}
                >
                  {m.messageText}
                </p>
                <div
                  className={`flex justify-between items-center text-[10px] mt-2 ${
                    isSelected && isPolice ? "text-slate-400" : "text-gray-400"
                  }`}
                >
                  <span className="font-semibold">{m.category}</span>
                  <span>{m.timestamp}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Message & Reply Pane */}
        {activeMsg && (
          <div className="md:col-span-2 bg-gray-50 border border-gray-200 rounded-2xl p-5 flex flex-col justify-between gap-4">
            <div>
              {/* Message Header */}
              <div className="flex items-start justify-between border-b border-gray-200 pb-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-gray-900">
                      House #{activeMsg.houseId} — {activeMsg.residentName}
                    </span>
                    <span className="text-[10px] bg-white border border-gray-200 px-2 py-0.5 rounded-full font-mono">
                      {activeMsg.phone}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Category: <strong className="text-gray-700">{activeMsg.category}</strong> · Sent from Resident Mobile App
                  </p>
                </div>
                <span className="text-xs text-gray-400 font-mono">{activeMsg.timestamp}</span>
              </div>

              {/* Resident Message Bubble */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs mb-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Citizen Request / Vacation Notice:
                </p>
                <p className="text-xs text-gray-800 leading-relaxed font-medium">
                  "{activeMsg.messageText}"
                </p>
              </div>

              {/* Existing Reply if any */}
              {activeMsg.officialReply && (
                <div
                  className={`rounded-2xl p-4 shadow-2xs mb-4 border ${
                    activeMsg.category === "Police Patrol"
                      ? "bg-slate-900 text-white border-slate-700"
                      : "bg-emerald-50 border-emerald-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[11px] font-bold flex items-center gap-1.5 ${
                        activeMsg.category === "Police Patrol"
                          ? "text-cyan-300"
                          : "text-emerald-900"
                      }`}
                    >
                      <span>{activeMsg.category === "Police Patrol" ? "🚓" : "👮"}</span>
                      {activeMsg.officerName} (Delivered Directly to Citizen App)
                    </span>
                    <span
                      className={`text-[10px] font-mono ${
                        activeMsg.category === "Police Patrol"
                          ? "text-slate-400"
                          : "text-emerald-700"
                      }`}
                    >
                      {activeMsg.replyTime}
                    </span>
                  </div>
                  <p
                    className={`text-xs font-medium ${
                      activeMsg.category === "Police Patrol" ? "text-slate-100" : "text-emerald-950"
                    }`}
                  >
                    {activeMsg.officialReply}
                  </p>
                </div>
              )}
            </div>

            {/* Officer / Police Reply Box */}
            <div className="bg-white border border-gray-200 rounded-2xl p-3 flex flex-col gap-2">
              <label className="text-[11px] font-bold text-gray-700 flex items-center justify-between">
                <span>Direct Reply to Resident's App:</span>
                <span className="text-[10px] text-gray-400">Delivers instantly to resident notification bar</span>
              </label>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-1.5 mb-1">
                {(activeMsg.category === "Police Patrol"
                  ? [
                      "Main gate padlock verified intact 🛡️",
                      "Night vigil 02:30 AM: All clear & premises secure ✅",
                      "Compound & windows inspected, no issues 🌙",
                      "Dawn patrol drive-by completed 🚓",
                    ]
                  : [
                      "Vehicle Dispatched 🚛",
                      "Streak Freeze Approved 🏖️ (Police Linked)",
                      "Confirmed for Tomorrow Morning ✅",
                      "Please drop at Bay 1 hopper before 2 PM 🥬",
                    ]
                ).map((txt) => (
                  <button
                    key={txt}
                    onClick={() => setReplyInput(txt)}
                    className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-lg cursor-pointer transition-colors"
                  >
                    {txt}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={replyInput}
                  onChange={(e) => setReplyInput(e.target.value)}
                  placeholder={
                    activeMsg.category === "Police Patrol"
                      ? "Type police patrol check-in reply to resident app..."
                      : "Type official response to this household..."
                  }
                  className="flex-1 text-xs p-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendReply();
                  }}
                />
                <button
                  onClick={handleSendReply}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow"
                >
                  Send Reply 🚀
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Gamified Theater Seating Grid with Duolingo Sparrows ──────────────────────

function TheaterSeatingGrid({
  houses,
  isAdmin,
  onSelectHouse,
  selectedHouseId,
}: {
  houses: HouseSeat[];
  isAdmin: boolean;
  onSelectHouse: (house: HouseSeat) => void;
  selectedHouseId: string | null;
}) {
  const [filter, setFilter] = useState<"all" | "dropped" | "pending" | "out_of_station">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState<number>(0);

  const totalCount = houses.length;
  const droppedCount = useMemo(() => houses.filter((h) => h.status === "dropped").length, [houses]);
  const pendingCount = useMemo(() => houses.filter((h) => h.status === "pending").length, [houses]);
  const outOfStationCount = useMemo(() => houses.filter((h) => h.status === "out_of_station").length, [houses]);

  // Block Derby Score
  const blockScores = useMemo(() => {
    const blocks = ["Block A", "Block B", "Block C", "Block D"] as const;
    return blocks.map((b) => {
      const inBlock = houses.filter((h) => h.block === b);
      const dropped = inBlock.filter((h) => h.status === "dropped").length;
      const pct = Math.round((dropped / inBlock.length) * 100);
      return { block: b, pct, dropped, total: inBlock.length };
    });
  }, [houses]);

  const displayedHouses = useMemo(() => {
    return houses.filter((h) => {
      if (filter !== "all" && h.status !== filter) return false;

      if (searchQuery.trim() !== "") {
        const query = searchQuery.trim().toLowerCase();
        if (!h.id.includes(query) && !h.residentName.toLowerCase().includes(query)) return false;
      }

      if (activeSection === 1 && (h.numericId < 0 || h.numericId > 250)) return false;
      if (activeSection === 2 && (h.numericId < 251 || h.numericId > 500)) return false;
      if (activeSection === 3 && (h.numericId < 501 || h.numericId > 750)) return false;
      if (activeSection === 4 && (h.numericId < 751 || h.numericId > 1000)) return false;

      return true;
    });
  }, [houses, filter, searchQuery, activeSection]);

  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 flex flex-col gap-6">
      {/* Gamified Ward Derby HUD */}
      <div className="bg-gradient-to-r from-emerald-900 via-green-800 to-emerald-950 text-white rounded-2xl p-5 shadow-md flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <DuolingoChirpyMascot mood="super_happy" size={54} interactive={true} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black">Zone 1 Gamified Ward Derby</span>
                <span className="text-xs bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full font-bold">
                  Level 5: Green Canopy 🌳
                </span>
              </div>
              <p className="text-xs text-emerald-200">
                {droppedCount} of {totalCount} Households Binned Today ({Math.round((droppedCount / totalCount) * 100)}% Zone Score)
              </p>
            </div>
          </div>
        </div>

        {/* 4 Block Derby Race */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {blockScores.map((b) => (
            <div key={b.block} className="bg-white/10 rounded-xl p-2.5 flex flex-col gap-1 border border-white/10">
              <div className="flex justify-between font-bold">
                <span>{b.block}</span>
                <span className="text-amber-300 font-mono">{b.pct}%</span>
              </div>
              <div className="h-2 w-full bg-black/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-green-300 rounded-full transition-all duration-500"
                  style={{ width: `${b.pct}%` }}
                />
              </div>
              <span className="text-[10px] text-emerald-200">
                {b.dropped}/{b.total} Sparrows Dropped
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Seating Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <span>🎭</span> Interactive Community Seating Theater (0000 to 1000)
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Every seat is an interactive mascot sparrow. Click any seat to view resident profile, address, phone & 12-month records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs bg-gray-50 border border-gray-200 rounded-2xl px-3 py-1.5">
          <span className="flex items-center gap-1.5 text-emerald-800 font-bold">
            <DuolingoChirpyMascot mood="happy" size={18} interactive={false} /> Binned ({droppedCount})
          </span>
          <span className="flex items-center gap-1.5 text-sky-800 font-bold">
            <DuolingoChirpyMascot mood="frozen" size={18} interactive={false} /> Frozen ({pendingCount})
          </span>
          <span className="flex items-center gap-1.5 text-amber-800 font-bold">
            <DuolingoChirpyMascot mood="vacation" size={18} interactive={false} /> Vacation ({outOfStationCount})
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              filter === "all" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            All Sparrows ({totalCount})
          </button>
          <button
            onClick={() => setFilter("dropped")}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              filter === "dropped" ? "bg-emerald-600 text-white shadow-xs" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <DuolingoChirpyMascot mood="happy" size={14} interactive={false} /> Binned ({droppedCount})
          </button>
          <button
            onClick={() => setFilter("pending")}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              filter === "pending" ? "bg-slate-700 text-white shadow-xs" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <DuolingoChirpyMascot mood="frozen" size={14} interactive={false} /> Frozen ({pendingCount})
          </button>
          <button
            onClick={() => setFilter("out_of_station")}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              filter === "out_of_station" ? "bg-amber-500 text-white shadow-xs" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <DuolingoChirpyMascot mood="vacation" size={14} interactive={false} /> Vacation ({outOfStationCount})
          </button>
        </div>

        {/* Section Blocks Tabs */}
        <div className="flex items-center gap-1 text-xs">
          {[
            { label: "All Blocks", val: 0 },
            { label: "Block A (0000–0250)", val: 1 },
            { label: "Block B (0251–0500)", val: 2 },
            { label: "Block C (0501–0750)", val: 3 },
            { label: "Block D (0751–1000)", val: 4 },
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

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search house # or name..."
            className="pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-xl w-56 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
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

      {/* Theater Stage / Hub Indicator */}
      <div className="flex flex-col items-center my-1">
        <div className="w-full max-w-2xl bg-gradient-to-r from-emerald-700 via-green-600 to-emerald-700 text-white rounded-t-2xl py-2 px-6 text-center shadow-sm border-b-4 border-emerald-800">
          <p className="text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
            <span>▼</span> COMMUNITY WASTE HUBS & ROTATING BAY TABLETS <span>▼</span>
          </p>
          <p className="text-[10px] text-emerald-100 mt-0.5">
            Stage / Drop Direction (1,001 Sparrows facing collection trucks)
          </p>
        </div>
        <div className="w-full max-w-xl h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-60" />
      </div>

      {/* Cinema / Theater Grid of 1,001 Sparrows */}
      <div className="bg-gray-950 rounded-3xl p-6 text-white shadow-inner overflow-x-auto">
        <div className="min-w-[760px] flex flex-col items-center">
          {displayedHouses.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <div className="flex justify-center mb-2">
                <DuolingoChirpyMascot mood="frozen" size={38} interactive={false} />
              </div>
              <p className="font-semibold text-sm">No sparrows match this filter</p>
            </div>
          ) : (
            <div className="w-full">
              <div className="flex flex-wrap gap-1.5 justify-center">
                {displayedHouses.map((h) => {
                  const isSelected = selectedHouseId === h.id;
                  const isDropped = h.status === "dropped";
                  const isOutOfStation = h.status === "out_of_station";

                  return (
                    <button
                      key={h.id}
                      onClick={() => {
                        onSelectHouse(h);
                        sfx.chirp();
                      }}
                      title={`House #${h.id} (${h.residentName}) — ${
                        isDropped
                          ? `Binned at ${h.dropTimeToday ?? "Today"}`
                          : isOutOfStation
                          ? "Vacation / Out of Station (Police Beat Link Active 🚓)"
                          : "Frozen Streak (Drop Pending)"
                      }`}
                      className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-md flex flex-col items-center justify-center transition-all duration-150 cursor-pointer select-none ${
                        isDropped
                          ? "bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 shadow-xs"
                          : isOutOfStation
                          ? "bg-amber-400 hover:bg-amber-300 text-amber-950 border border-amber-300 shadow-xs"
                          : "bg-slate-800 hover:bg-slate-700 text-cyan-200 border border-slate-700"
                      } ${
                        isSelected ? "ring-3 ring-yellow-400 scale-120 z-20 shadow-lg" : "hover:scale-110"
                      }`}
                    >
                      <div className="mb-0.5 shrink-0 pointer-events-none">
                        {isDropped ? (
                          <DuolingoChirpyMascot mood="happy" size={16} interactive={false} />
                        ) : isOutOfStation ? (
                          <DuolingoChirpyMascot mood="vacation" size={16} interactive={false} />
                        ) : (
                          <DuolingoChirpyMascot mood="frozen" size={16} interactive={false} />
                        )}
                      </div>
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
  const [messages, setMessages] = useState<MessageItem[]>(INITIAL_MESSAGES);
  const [selectedHouse, setSelectedHouse] = useState<HouseSeat | null>(null);
  const [editingHouse, setEditingHouse] = useState<HouseSeat | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
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
      // Fallback
    }
  }, [apiBase, data.vehicles, data.alerts, data.zone]);

  useEffect(() => {
    fetchData();
    if (apiBase) {
      const id = setInterval(fetchData, 30_000);
      return () => clearInterval(id);
    }
  }, [fetchData, apiBase]);

  const visibleAlerts = data.alerts.filter((a) => a.status === "PENDING" && !dismissedAlerts.has(a.id));

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

          let policePatrol = h.policePatrol;
          if (newStatus === "out_of_station" && !policePatrol) {
            policePatrol = createPolicePatrolRecord(h.id, h.residentName);
            const newPoliceMsg: MessageItem = {
              id: `MSG-POL-${Date.now()}`,
              houseId: h.id,
              residentName: h.residentName,
              phone: h.phone,
              category: "Police Patrol",
              messageText: `Vacation Alert: House #${h.id} (${h.residentName}) marked Out of Station. Automated link dispatched to Koramangala Police Hoysala Beat #4.`,
              timestamp: "Just now",
              status: "resolved",
              officialReply: "🚓 Hoysala Patrol Beat #4 (HC Suresh K.) assigned! Night vigil scheduled. Patrol check-in link activated.",
              replyTime: "Just now",
              officerName: "HC Suresh K. (Beat Patrol Officer)",
            };
            setMessages((prevMsg) => [newPoliceMsg, ...prevMsg]);
          }

          const updated: HouseSeat = {
            ...h,
            status: newStatus,
            dropTimeToday:
              newStatus === "dropped"
                ? new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                : undefined,
            monthDropsCount: currentMonthData.daysDropped,
            twelveMonths: updatedMonths,
            policePatrol,
          };
          setSelectedHouse(updated);
          return updated;
        }
        return h;
      })
    );
  }

  function handleSendPoliceCheckIn(
    houseId: string,
    replyMessage: string,
    lockStatus: "VERIFIED_LOCKED" | "ALL_CLEAR" | "PERIMETER_CHECKED" = "VERIFIED_LOCKED"
  ) {
    const newCheckIn: PoliceCheckInReply = {
      id: `CHK-${houseId}-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      officerName: "HC Suresh K.",
      badgeNumber: "HC-4412",
      patrolVehicle: "Hoysala 12",
      message: replyMessage,
      lockStatus,
    };

    setHouses((prev) =>
      prev.map((h) => {
        if (h.id === houseId) {
          const existingPatrol = h.policePatrol ?? createPolicePatrolRecord(h.id, h.residentName);
          const updatedPatrol: PolicePatrolRecord = {
            ...existingPatrol,
            checkIns: [newCheckIn, ...existingPatrol.checkIns],
          };
          const updatedHouse = { ...h, policePatrol: updatedPatrol };
          if (selectedHouse && selectedHouse.id === houseId) {
            setSelectedHouse(updatedHouse);
          }
          return updatedHouse;
        }
        return h;
      })
    );

    const targetHouse = houses.find((h) => h.id === houseId);
    const newMsg: MessageItem = {
      id: `MSG-POL-${Date.now()}`,
      houseId,
      residentName: targetHouse?.residentName ?? "Resident",
      phone: targetHouse?.phone ?? "",
      category: "Police Patrol",
      messageText: `Beat Patrol Officer Check-in for House #${houseId}: "${replyMessage}"`,
      timestamp: "Just now",
      status: "resolved",
      officialReply: `Pushed to resident mobile app: "${replyMessage}" (Padlock Verified)`,
      replyTime: "Just now",
      officerName: "HC Suresh K. (Beat Patrol Officer)",
    };
    setMessages((prev) => [newMsg, ...prev]);
  }

  function handleSimulatePoliceCheckIn() {
    const vacationHouses = houses.filter((h) => h.status === "out_of_station");
    const target = vacationHouses[0] || houses[0];
    handleSendPoliceCheckIn(
      target.id,
      `Perimeter & main gate padlock verified intact at ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}. All secure 🛡️👮`,
      "VERIFIED_LOCKED"
    );
    sfx.policeChime();
  }

  function handleSaveAllotment(updatedDetails: Partial<HouseSeat>) {
    if (!editingHouse) return;

    setHouses((prev) =>
      prev.map((h) => {
        if (h.id === editingHouse.id) {
          const updated = { ...h, ...updatedDetails };
          if (selectedHouse && selectedHouse.id === h.id) {
            setSelectedHouse(updated);
          }
          return updated;
        }
        return h;
      })
    );
  }

  function handleReplyMessage(msgId: string, replyText: string) {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId) {
          return {
            ...m,
            status: "resolved",
            officialReply: replyText,
            replyTime: "Just now",
            officerName: "Officer M. Suresh",
          };
        }
        return m;
      })
    );
  }

  function handleSimulateIncomingMessage() {
    const randomHouse = houses[Math.floor(Math.random() * 50) + 10];
    const newMsg: MessageItem = {
      id: `MSG-${Date.now()}`,
      houseId: randomHouse.id,
      residentName: randomHouse.residentName,
      phone: randomHouse.phone,
      category: "Bulky Pickup",
      messageText: `Hi Ward Officer! House #${randomHouse.id} has some extra carton boxes and cardboard recyclables ready at the door. Please notify driver!`,
      timestamp: "Just now",
      status: "pending_reply",
    };
    setMessages((prev) => [newMsg, ...prev]);
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-700/80 flex items-center justify-center p-1 shadow border border-emerald-500/40 shrink-0 overflow-hidden">
              <DuolingoChirpyMascot mood="happy" size={36} interactive={false} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-emerald-700">BinGo</span>
                <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full px-2.5 py-0.5">
                  Chirpy Sparrow Operations
                </span>
                {isAdmin ? (
                  <span className="text-xs font-bold bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full flex items-center gap-1">
                    🛡️ Admin Active
                  </span>
                ) : (
                  <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    Guest Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 leading-none">
                Go to the zone. Bingo, done.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            {/* Admin Toggle Button */}
            <button
              onClick={() => {
                if (isAdmin) {
                  setIsAdmin(false);
                } else {
                  setShowAdminLoginModal(true);
                }
              }}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                isAdmin
                  ? "bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200"
                  : "bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {isAdmin ? "🛡️ Logout Admin" : "🔒 Officer Admin Login"}
            </button>

            <div className="flex items-center gap-1.5 font-mono tabular-nums bg-gray-100 border border-gray-200 px-3 py-1 rounded-lg text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{now ? fmtTime(now) : "──:──:──"}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6 w-full">
        {/* ── Zone Banner ─────────────────────────────────────────────────── */}
        <section className="bg-gradient-to-r from-emerald-800 via-green-700 to-emerald-800 text-white rounded-3xl px-6 py-5 flex flex-wrap gap-6 items-center justify-between shadow-md">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="text-xs text-emerald-200 uppercase tracking-wider font-semibold">
                Designated Zone
              </p>
              <p className="text-xl font-extrabold">{data.zone.name}</p>
            </div>
            <div className="h-8 w-px bg-emerald-500/50 hidden sm:block" />
            <div>
              <p className="text-xs text-emerald-200 uppercase tracking-wider font-semibold">Ward</p>
              <p className="text-lg font-bold">{data.zone.ward}</p>
            </div>
            <div className="h-8 w-px bg-emerald-500/50 hidden sm:block" />
            <div>
              <p className="text-xs text-emerald-200 uppercase tracking-wider font-semibold">
                Households Allotted
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

        {/* ── Swap Alerts with Auto-Notification ───────────────────────────── */}
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
                    className="bg-red-50/90 border border-red-300 rounded-3xl p-5 shadow-xs flex flex-col gap-3"
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

        {/* ── 2-Way Citizen & Officer Message Board ────────────────────────── */}
        <section>
          <CitizenMessageBoard
            messages={messages}
            onReply={handleReplyMessage}
            onNewMockMessage={handleSimulateIncomingMessage}
            onSimulatePoliceCheckIn={handleSimulatePoliceCheckIn}
          />
        </section>

        {/* ── Gamified Theater Seating Grid ────────────────────────────────── */}
        <section>
          <TheaterSeatingGrid
            houses={houses}
            isAdmin={isAdmin}
            onSelectHouse={(h) => setSelectedHouse(h)}
            selectedHouseId={selectedHouse?.id ?? null}
          />
        </section>
      </main>

      {/* ── Seat Detail Modal Pop-up ───────────────────────────────────────── */}
      {selectedHouse && (
        <SeatDetailModal
          house={selectedHouse}
          isAdmin={isAdmin}
          onClose={() => setSelectedHouse(null)}
          onToggleStatus={handleToggleHouseStatus}
          onEditHouse={() => {
            setEditingHouse(selectedHouse);
            setSelectedHouse(null);
          }}
          onSendPoliceCheckIn={handleSendPoliceCheckIn}
        />
      )}

      {/* ── Admin Allotment Modal ──────────────────────────────────────────── */}
      {editingHouse && (
        <AdminAllotmentModal
          house={editingHouse}
          onClose={() => setEditingHouse(null)}
          onSave={handleSaveAllotment}
        />
      )}

      {/* ── Admin Login Passcode Modal ─────────────────────────────────────── */}
      {showAdminLoginModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setShowAdminLoginModal(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center border border-gray-100 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 text-3xl flex items-center justify-center mx-auto">
              🛡️
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900">Officer Admin Access</h3>
              <p className="text-xs text-gray-500 mt-1">
                Authorized for Municipal Ward 151 Officers to allot household blocks and manage resident data.
              </p>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs text-left">
              <p className="text-gray-500 text-[11px]">Default Officer Credential:</p>
              <p className="font-mono font-bold text-gray-800">Officer M. Suresh (Passcode: admin)</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAdminLoginModal(false)}
                className="flex-1 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setIsAdmin(true);
                  setShowAdminLoginModal(false);
                  sfx.messageChime();
                }}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow"
              >
                Login as Officer 🚀
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 py-6 border-t border-gray-200 mt-auto bg-white">
        <p className="font-semibold text-gray-600">
          BinGo Municipal Operations · Zone 1 (0000 to 1000)
        </p>
        <p className="mt-1 text-[11px]">
          Chirpy Sparrow Mascot · Admin Block Allotment · 2-Way Citizen App Message Board · Automatic 75% SNS Alerts
        </p>
      </footer>
    </div>
  );
}
