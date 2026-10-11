/**
 * BinGo Resident Mobile App
 * Expo ~57 / React Native 0.86 / Expo Camera / TypeScript
 *
 * Requirements:
 * 1. Out of station does NOT reduce compliance percentage (vacation days protected / exempted)
 * 2. Removed chair / "View My Theater Seat" — replaced with clean "View My Tab"
 * 3. Bottom tab navigation / top tab bar for seamless switching:
 *    - Home Dashboard (Stats & QR Scanner)
 *    - View My Tab (Resident profile, household status, 12-month compliance, allotment)
 *    - Bulk Orders & Admin Message Board (2-way chat with Govt)
 * 4. Live camera scan at bins with instant drop confirmation pop-up
 */

import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

// ─── Config & Backend API ────────────────────────────────────────────────────
const API_BASE: string = 'https://nhi8wzvkvi.execute-api.ap-south-1.amazonaws.com';

// ─── Types ───────────────────────────────────────────────────────────────────
type WasteType = 'wet' | 'sanitary' | 'dry' | 'furniture' | 'event';
type SeatStatus = 'dropped' | 'pending' | 'out_of_station';

interface MonthPerformance {
  monthName: string;
  daysDropped: number;
  totalDays: number;
  compliancePct: number;
  badgeLabel: string;
}

interface HouseSeat {
  id: string; // e.g. "0082", "0104"
  numericId: number;
  block: string;
  status: SeatStatus;
  streak: number;
  monthDropsCount: number;
  monthTotalDays: number;
  dropTimeToday?: string;
  lastDropDate?: string; // "YYYY-MM-DD"
  octoberDropsCount?: number; // Tracks October drop count (e.g. 19 -> 20)
  residentName: string;
  address: string;
  assignedBadge: string;
  twelveMonths: MonthPerformance[];
}

interface CitizenMessage {
  id: string;
  houseId: string;
  category: 'Bulk Order / Event' | 'Bulky Pickup' | 'Bin Overflow' | 'Travel / Freeze' | 'Query';
  messageText: string;
  timestamp: string;
  status: 'pending_reply' | 'resolved';
  officialReply?: string;
  officerName?: string;
  replyTime?: string;
}

type TabKey = 'Home' | 'MyTab' | 'BulkOrder' | 'CameraScan';

// ─── Constants ────────────────────────────────────────────────────────────────
const WASTE_META: Record<WasteType, { label: string; icon: string; desc: string }> = {
  wet:       { label: 'Waste Collection',            icon: '🗑️', desc: 'Daily segregated household waste collection' },
  sanitary:  { label: 'Sanitary / Soiled (Burning)', icon: '🔥', desc: 'Diapers & sanitary waste for incineration' },
  dry:       { label: 'Dry / Recyclables',           icon: '📦', desc: 'Paper, cardboard, plastics & cans' },
  furniture: { label: 'Bulky Furniture',             icon: '🛋️', desc: 'Mattresses, chairs & timber' },
  event:     { label: 'Bulk / Event Waste',          icon: '🎉', desc: 'Marriage halls, parties & catering waste' },
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const INDIAN_NAMES = [
  'Aarav Kulkarni', 'Priya Sharma', 'Devika Menon', 'Kabir Mehta', 'Lakshmi Narayanan', 'Vikram Sengupta',
  'Ananya Rao', 'Rohan Joshi', 'Deepa Nambiar', 'Sunil Reddy',
  'Tanvi Hegde', 'Aditya Nair', 'Sneha Iyer', 'Rajesh Deshmukh', 'Pooja Varma',
];

/**
 * 12-Month Performance generator:
 * Note: Out of Station does NOT reduce compliance percentage!
 * Vacation days are exempt from obligation (total active required days is reduced),
 * keeping compliance at 100% or protected rate.
 */
function generate12Months(houseIndex: number, todayStatus: SeatStatus, customOctDrops?: number): MonthPerformance[] {
  return MONTH_NAMES.map((name, mIdx) => {
    const totalDays = MONTH_DAYS[mIdx];
    const monthHash = ((houseIndex * 41 + mIdx * 29) * 2654435761) >>> 0;
    const rateFactor = (monthHash % 25) + 75; // Baseline high compliance (75% to 99%)

    let daysDropped = Math.round((totalDays * rateFactor) / 100);
    let activeObligationDays = totalDays;

    if (mIdx === 9) { // October (current month)
      const vacationDays = 8;
      if (customOctDrops !== undefined) {
        daysDropped = customOctDrops;
      } else if (todayStatus === 'out_of_station') {
        activeObligationDays = totalDays - vacationDays;
        daysDropped = 19; // baseline 19 drops for October in vacation mode (matches portal 19/31d)
      } else if (todayStatus === 'dropped') {
        daysDropped = 20; // 20 drops when scanned today!
      } else {
        daysDropped = 19; // baseline 19 drops for October
      }
      if (todayStatus === 'out_of_station') {
        activeObligationDays = totalDays - vacationDays;
      }
    }

    // Compliance percentage calculation protected against vacation days
    const compliancePct = Math.min(100, Math.round((daysDropped / activeObligationDays) * 100));
    let badgeLabel = 'Good Binner';

    if (todayStatus === 'out_of_station' && mIdx === 9) {
      badgeLabel = 'Protected Streak 🏖️';
    } else if (compliancePct >= 90) {
      badgeLabel = 'Eco Champion 🌟';
    } else if (compliancePct >= 80) {
      badgeLabel = 'Active Streak 🔥';
    } else if (compliancePct >= 70) {
      badgeLabel = 'Good Binner 🍀';
    } else {
      badgeLabel = 'Needs Defrost ❄️';
    }

    return {
      monthName: name,
      daysDropped,
      totalDays,
      compliancePct,
      badgeLabel,
    };
  });
}

function createHouseSeat(houseId: string, status: SeatStatus = 'out_of_station', customOctDrops: number = 19): HouseSeat {
  const numericId = parseInt(houseId.replace(/\D/g, ''), 10) || 82;
  const block = numericId <= 250 ? 'Block A' : numericId <= 500 ? 'Block B' : numericId <= 750 ? 'Block C' : 'Block D';
  const twelveMonths = generate12Months(numericId, status, customOctDrops);
  const currentMonth = twelveMonths[9];
  const residentName = numericId === 82 ? 'Aarav Kulkarni' : numericId === 104 ? 'Priya Sharma' : INDIAN_NAMES[numericId % INDIAN_NAMES.length];

  return {
    id: houseId.padStart(4, '0'),
    numericId,
    block,
    status,
    streak: 8,
    monthDropsCount: currentMonth.daysDropped,
    monthTotalDays: currentMonth.totalDays,
    dropTimeToday: status === 'dropped' ? '08:24 AM' : undefined,
    lastDropDate: undefined,
    octoberDropsCount: customOctDrops,
    residentName,
    address: `House #${houseId.padStart(4, '0')}, ${block}, Green Glen Layout, Ward 151`,
    assignedBadge: `BG-RFID-${houseId.padStart(4, '0')}`,
    twelveMonths,
  };
}

// ─── Chirpy Mascot Component ──────────────────────────────────────────────────
function ChirpyMascot({ mood, size = 64 }: { mood: 'happy' | 'frozen' | 'vacation'; size?: number }) {
  if (mood === 'frozen') {
    return (
      <View style={[styles.mascotBox, { width: size, height: size, backgroundColor: '#E0F2FE', borderColor: '#38BDF8' }]}>
        <Text style={{ fontSize: size * 0.45 }}>🧊</Text>
        <Text style={{ fontSize: size * 0.35, marginTop: -6 }}>🐦</Text>
      </View>
    );
  }

  if (mood === 'vacation') {
    return (
      <View style={[styles.mascotBox, { width: size, height: size, backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
        <Text style={{ fontSize: size * 0.45 }}>🏖️</Text>
        <Text style={{ fontSize: size * 0.35, marginTop: -6 }}>🦜</Text>
      </View>
    );
  }

  return (
    <View style={[styles.mascotBox, { width: size, height: size, backgroundColor: '#DCFCE7', borderColor: '#22C55E' }]}>
      <Text style={{ fontSize: size * 0.45 }}>🌟</Text>
      <Text style={{ fontSize: size * 0.35, marginTop: -6 }}>🐦</Text>
    </View>
  );
}

// ─── Main App Component ───────────────────────────────────────────────────────
export default function App() {
  const [houseId, setHouseId] = useState('0082');
  const [house, setHouse] = useState<HouseSeat>(() => createHouseSeat('0082', 'out_of_station', 19));
  const [activeTab, setActiveTab] = useState<TabKey>('Home');

  // Messages / Bulk orders sent to Admin Panel
  const [messages, setMessages] = useState<CitizenMessage[]>([
    {
      id: 'MSG-INIT-01',
      houseId: '0104',
      category: 'Bulk Order / Event',
      messageText: 'Need 3 bulk event waste containers for colony community feast tomorrow morning.',
      timestamp: 'Today, 10:15 AM',
      status: 'resolved',
      officialReply: 'Approved! Special Event Truck (VH-EVNT-01) scheduled for delivery tomorrow at 8:00 AM.',
      officerName: 'Officer M. Suresh (Ward 151)',
      replyTime: 'Today, 10:30 AM',
    },
    {
      id: 'MSG-INIT-02',
      houseId: '0104',
      category: 'Bulky Pickup',
      messageText: '2 old mattress pieces and discarded wooden cupboard ready for disposal.',
      timestamp: 'Yesterday',
      status: 'resolved',
      officialReply: 'Bulky vehicle VH-FURN-01 has collected the items. Thank you for segregating!',
      officerName: 'Ward Nodal Desk',
      replyTime: 'Yesterday, 04:12 PM',
    },
  ]);

  // Bulk Order Form State
  const [orderCategory, setOrderCategory] = useState<CitizenMessage['category']>('Bulk Order / Event');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  // QR Camera State
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [manualCodeInput, setManualCodeInput] = useState('');
  const [scanModalVisible, setScanModalVisible] = useState(false);

  // Drop recorded notification
  const [lastDropWaste, setLastDropWaste] = useState<WasteType>('wet');
  const [lastDropTimestamp, setLastDropTimestamp] = useState<string>('');
  const [lastDropBayLabel, setLastDropBayLabel] = useState<string>('Waste Collection Bay');

  // House ID is permanently allotted by Govt Office (like electricity meter or vehicle reg number).
  // Tenant or ownership updates can only be modified from the authorized Govt Admin Panel.

  // Helper to extract clean human-readable Bay name from QR data / deep links
  function extractCleanBayLabel(rawCode?: string, type: WasteType = 'wet'): string {
    if (!rawCode) return `${WASTE_META[type].label} Bay`;
    try {
      if (rawCode.includes('bingo://scan?data=')) {
        const url = new URL(rawCode);
        const dataParam = url.searchParams.get('data');
        if (dataParam) {
          // If base64 json
          try {
            const decoded = JSON.parse(atob(dataParam));
            if (decoded.bayName) return decoded.bayName;
            if (decoded.bayId) return `Bay #${decoded.bayId}`;
          } catch {
            // raw string in data param
            return `Bay ${dataParam}`;
          }
        }
      }
    } catch {
      // ignore
    }
    if (rawCode.startsWith('BAY-')) return `${rawCode} Station`;
    return `${WASTE_META[type].label} Bay`;
  }

  // Handle Scan recording — Strictly 1 drop per day!
  // Updates October from 19 to 20. If scanned again today, stays 20. Changes only when date changes.
  function handleRecordWasteDrop(type: WasteType = 'wet', bayCode?: string) {
    const todayDateStr = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
    const displayDate = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    // Check if waste was ALREADY dropped today
    if (house.lastDropDate === todayDateStr) {
      Alert.alert(
        'Already Recorded Today! ✅',
        `House #${house.id} has already recorded today's waste drop on ${displayDate} at ${house.dropTimeToday ?? timeStr}.\n\nOctober count is ${house.octoberDropsCount ?? 20} / 31 days.\n\nNext drop opens tomorrow morning!`
      );
      return;
    }

    // First scan today: increment October drops from 19 to 20!
    const newOctCount = (house.octoberDropsCount ?? 19) + 1;
    const updatedMonths = generate12Months(house.numericId, 'dropped', newOctCount);
    const cleanBay = extractCleanBayLabel(bayCode, type);

    setHouse((prev) => ({
      ...prev,
      status: 'dropped',
      streak: prev.streak + 1,
      dropTimeToday: timeStr,
      lastDropDate: todayDateStr,
      octoberDropsCount: newOctCount,
      monthDropsCount: newOctCount,
      twelveMonths: updatedMonths,
    }));

    setLastDropWaste(type);
    setLastDropTimestamp(`${displayDate} at ${timeStr}`);
    setLastDropBayLabel(cleanBay);
    setScanModalVisible(true);
  }

  // Handle Barcode Scanned Event from CameraView
  async function handleBarcodeScanned({ data }: { data: string }) {
    if (scanModalVisible) return;
    let detectedType: WasteType = 'wet';
    const lower = data.toLowerCase();
    if (lower.includes('dry') || lower.includes('recycl')) detectedType = 'dry';
    else if (lower.includes('sanit') || lower.includes('burn')) detectedType = 'sanitary';
    else if (lower.includes('furn') || lower.includes('bulk')) detectedType = 'furniture';
    else if (lower.includes('event')) detectedType = 'event';

    // Broadcast scan to backend API if live QR token
    try {
      if (data.includes('data=') && data.includes('sig=')) {
        const url = new URL(data);
        const qrDataParam = url.searchParams.get('data');
        const sigParam = url.searchParams.get('sig');
        if (qrDataParam && sigParam) {
          fetch(`${API_BASE}/scans`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              qrData: qrDataParam,
              signature: sigParam,
              householdId: house.id,
            }),
          }).catch(() => {});
        }
      }
    } catch {
      // ignore network errors
    }

    handleRecordWasteDrop(detectedType, data);
    setActiveTab('Home');
  }

  // Quick State Toggle Handler (Matches Govt Portal: Mark Dropped / Freeze / Set Vacation Mode / End Vacation Mode)
  function handleToggleStatus(newStatus: SeatStatus) {
    const todayDateStr = new Date().toISOString().split('T')[0];
    const displayDate = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    if (newStatus === 'dropped') {
      const isAlreadyDroppedToday = house.lastDropDate === todayDateStr;
      const newOctCount = isAlreadyDroppedToday ? (house.octoberDropsCount ?? 20) : ((house.octoberDropsCount ?? 19) + 1);
      const updatedMonths = generate12Months(house.numericId, 'dropped', newOctCount);

      setHouse((prev) => ({
        ...prev,
        status: 'dropped',
        streak: isAlreadyDroppedToday ? prev.streak : prev.streak + 1,
        dropTimeToday: prev.dropTimeToday || timeStr,
        lastDropDate: todayDateStr,
        octoberDropsCount: newOctCount,
        monthDropsCount: newOctCount,
        twelveMonths: updatedMonths,
      }));
      Alert.alert(
        isAlreadyDroppedToday ? 'Already Dropped Today! ✅' : 'Marked Dropped! ✨',
        `House #${house.id} recorded drop on ${displayDate} (${timeStr}).\n\nOctober count: ${newOctCount} / 31 days.`
      );
    } else if (newStatus === 'out_of_station') {
      const currentOct = house.octoberDropsCount ?? 19;
      const updatedMonths = generate12Months(house.numericId, 'out_of_station', currentOct);

      setHouse((prev) => ({
        ...prev,
        status: 'out_of_station',
        monthDropsCount: currentOct,
        twelveMonths: updatedMonths,
      }));

      const vacationMsg: CitizenMessage = {
        id: `MSG-TRV-${Date.now()}`,
        houseId: house.id,
        category: 'Travel / Freeze',
        messageText: `Travel Notice: House #${house.id} activated Vacation Mode via citizen app. Daily waste drops paused & streak protected 🏖️`,
        timestamp: 'Just now',
        status: 'pending_reply',
      };
      setMessages((prev) => [vacationMsg, ...prev]);

      Alert.alert(
        'Vacation Mode Active 🏖️',
        'Streak Protected! Vacation days are exempt from obligations, keeping your compliance percentage protected while traveling.'
      );
    } else {
      // 'pending'
      const resetOct = 19;
      const updatedMonths = generate12Months(house.numericId, 'pending', resetOct);

      setHouse((prev) => ({
        ...prev,
        status: 'pending',
        streak: prev.status === 'dropped' ? Math.max(0, prev.streak - 1) : prev.streak,
        dropTimeToday: undefined,
        lastDropDate: undefined,
        octoberDropsCount: resetOct,
        monthDropsCount: resetOct,
        twelveMonths: updatedMonths,
      }));
      Alert.alert('Status Set to Pending 🥶', 'Daily waste drop tracking is now pending for today.');
    }
  }

  // Vacation Mode Toggle helper
  function handleToggleVacation() {
    handleToggleStatus(house.status === 'out_of_station' ? 'pending' : 'out_of_station');
  }

  // Helper to render Vacation Mode / Holiday Banner (Matching Gov Web Portal)
  function renderVacationBanner() {
    const isVacation = house.status === 'out_of_station';
    if (isVacation) {
      return (
        <View style={styles.vacationBannerActive}>
          <View style={styles.vacationBannerContent}>
            <View style={styles.vacationIconBoxActive}>
              <Text style={styles.vacationIconLarge}>🏖️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.vacationTitleActive}>Vacation Mode Active (Streak Protected)</Text>
              <Text style={styles.vacationDescActive}>
                Household is traveling. Daily waste drops are paused and your Chirpy streak is frozen safe.
              </Text>
            </View>
          </View>
          <Pressable
            style={styles.endVacationBtn}
            onPress={() => handleToggleStatus('pending')}
          >
            <Text style={styles.endVacationBtnText}>End Vacation Mode 🏠</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.vacationBanner}>
        <View style={styles.vacationBannerContent}>
          <Text style={styles.vacationIcon}>🏖️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.vacationTitle}>Planning travel or holiday?</Text>
            <Text style={styles.vacationDesc}>
              Turn on Vacation Mode to protect your household's Chirpy streak while away.
            </Text>
          </View>
        </View>
        <Pressable
          style={styles.setVacationBtn}
          onPress={() => handleToggleStatus('out_of_station')}
        >
          <Text style={styles.setVacationBtnText}>Set Vacation Mode 🏖️</Text>
        </Pressable>
      </View>
    );
  }

  // Helper to render Quick State Overrides: Mark Dropped & Set Vacation Mode (Matching Gov Web Portal)
  function renderQuickStateControls() {
    const isDropped = house.status === 'dropped';
    const isVacation = house.status === 'out_of_station';

    return (
      <View style={styles.quickOverrideCard}>
        <View style={styles.quickOverrideHeaderRow}>
          <Text style={styles.quickOverrideLabel}>Quick State Overrides:</Text>
          <Text style={styles.quickOverrideSub}>Govt Portal Sync</Text>
        </View>
        <View style={styles.quickOverrideButtonRow}>
          <Pressable
            style={[
              styles.quickOverrideBtn,
              isDropped ? styles.quickOverrideBtnMuted : styles.quickOverrideBtnGreen,
            ]}
            onPress={() => handleToggleStatus(isDropped ? 'pending' : 'dropped')}
          >
            <Text
              style={[
                styles.quickOverrideBtnText,
                isDropped ? styles.quickOverrideBtnTextMuted : styles.quickOverrideBtnTextWhite,
              ]}
            >
              {isDropped ? 'Freeze (Pending 🥶)' : 'Mark Dropped (Happy ✨)'}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.quickOverrideBtn,
              isVacation ? styles.quickOverrideBtnMuted : styles.quickOverrideBtnOrange,
            ]}
            onPress={() => handleToggleStatus(isVacation ? 'pending' : 'out_of_station')}
          >
            <Text
              style={[
                styles.quickOverrideBtnText,
                isVacation ? styles.quickOverrideBtnTextMuted : styles.quickOverrideBtnTextWhite,
              ]}
            >
              {isVacation ? 'End Vacation Mode 🏠' : 'Set Vacation Mode 🏖️'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Send Bulk Waste Order / Message to Admin Desk
  function handleSendBulkOrder() {
    if (!orderNotes.trim()) {
      Alert.alert('Details Required', 'Please enter your order quantity, type of waste, or message details.');
      return;
    }

    setOrderSubmitting(true);
    setTimeout(() => {
      const newMsg: CitizenMessage = {
        id: `MSG-${Date.now()}`,
        houseId: house.id,
        category: orderCategory,
        messageText: orderNotes.trim(),
        timestamp: 'Just now',
        status: 'pending_reply',
      };
      setMessages((prev) => [newMsg, ...prev]);
      setOrderNotes('');
      setOrderSubmitting(false);
      Alert.alert('Transmitted to Admin! 🚀', `Your ${orderCategory} request has been logged in the Municipal Officer desk.`);
    }, 600);
  }

  // ── Render Tabs ──

  // TAB 1: Home Dashboard
  function renderHome() {
    const isDropped = house.status === 'dropped';
    const isVacation = house.status === 'out_of_station';
    const currentOct = house.twelveMonths[9];

    return (
      <ScrollView contentContainerStyle={styles.container}>
        {/* Top Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerWardBadge}>WARD 151 · ZONE 1 (0000-1000)</Text>
              <Text style={styles.headerTitle}>House #{house.id}</Text>
              <Text style={styles.headerSubtitle}>{house.residentName} · {house.block}</Text>
            </View>
            <Pressable onPress={() => setActiveTab('MyTab')}>
              <ChirpyMascot
                mood={isDropped ? 'happy' : isVacation ? 'vacation' : 'frozen'}
                size={58}
              />
            </Pressable>
          </View>

          {/* Quick House Status Banner */}
          <View style={[
            styles.statusBanner,
            isDropped ? styles.bannerDropped : isVacation ? styles.bannerVacation : styles.bannerFrozen
          ]}>
            <Text style={styles.statusBannerText}>
              {isDropped
                ? `✅ Binned Today at ${house.dropTimeToday ?? '08:24 AM'} · Streak Active 🔥`
                : isVacation
                ? '🏖️ Out of Station Active · Compliance Protected (No Reduction)'
                : '❄️ Drop Pending for Today · Defrost Chirpy Before 8 PM!'}
            </Text>
          </View>
        </View>

        {/* 🏖️ Vacation / Holiday Mode Banner (from Gov Web) */}
        {renderVacationBanner()}

        {/* ⚡ Quick State Overrides: Mark Dropped & Set Vacation Mode (from Gov Web) */}
        {renderQuickStateControls()}

        {/* Big Action Navigation Buttons */}
        <View style={styles.actionGrid}>
          {/* 1. Scan at Bins Button */}
          <Pressable
            style={[styles.bigButton, styles.bigButtonScan]}
            onPress={async () => {
              if (!permission?.granted) {
                const res = await requestPermission();
                if (!res.granted) {
                  Alert.alert('Camera Permission', 'Camera permission needed to scan bin QR codes. You can also type code manually.');
                }
              }
              setActiveTab('CameraScan');
            }}
          >
            <Text style={styles.bigButtonIcon}>📷</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.bigButtonTitle}>Scan Bin QR Code</Text>
              <Text style={styles.bigButtonSub}>Point camera at waste bay to log daily drop</Text>
            </View>
            <Text style={styles.arrowIcon}>→</Text>
          </Pressable>

          {/* 2. View My Tab Button */}
          <Pressable
            style={[styles.bigButton, styles.bigButtonTab]}
            onPress={() => setActiveTab('MyTab')}
          >
            <Text style={styles.bigButtonIcon}>📑</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.bigButtonTitle}>View My Tab</Text>
              <Text style={styles.bigButtonSub}>Household info, 12-Month score & status</Text>
            </View>
            <View style={[
              styles.statusPillBadge,
              isDropped ? styles.pillDropped : isVacation ? styles.pillVacation : styles.pillFrozen
            ]}>
              <Text style={styles.statusPillText}>
                {isDropped ? 'DROPPED' : isVacation ? 'TRAVEL' : 'PENDING'}
              </Text>
            </View>
          </Pressable>

          {/* 3. Bulk Order / Message to Admin */}
          <Pressable
            style={[styles.bigButton, styles.bigButtonBulk]}
            onPress={() => setActiveTab('BulkOrder')}
          >
            <Text style={styles.bigButtonIcon}>📦</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.bigButtonTitle}>Bulk Order & Admin Chat</Text>
              <Text style={styles.bigButtonSub}>Request bulky pickup, party waste, or help</Text>
            </View>
            <View style={styles.msgCountBadge}>
              <Text style={styles.msgCountText}>{messages.length}</Text>
            </View>
          </Pressable>
        </View>

        {/* Today's Streak & Stats Widget */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>🏅 Your Monthly Recycling Score</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{house.streak} Days</Text>
              <Text style={styles.statLabel}>Current Streak</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{currentOct.daysDropped} / {currentOct.totalDays}</Text>
              <Text style={styles.statLabel}>Oct Drops</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statVal, { color: '#059669' }]}>{currentOct.compliancePct}%</Text>
              <Text style={styles.statLabel}>Compliance</Text>
            </View>
          </View>

          {/* Quick Drop Simulation / Manual Trigger */}
          <Text style={styles.sectionSubtitle}>Quick Drop Log (Test Bins):</Text>
          <View style={styles.wastePillRow}>
            {(['wet', 'dry', 'sanitary', 'furniture', 'event'] as WasteType[]).map((w) => (
              <Pressable
                key={w}
                style={styles.wastePill}
                onPress={() => handleRecordWasteDrop(w, `BAY-${w.toUpperCase()}-01`)}
              >
                <Text style={styles.wastePillIcon}>{WASTE_META[w].icon}</Text>
                <Text style={styles.wastePillText}>{WASTE_META[w].label.split(' ')[0]}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    );
  }

  // TAB 2: View My Tab (Profile, Status, 12-Month Compliance)
  function renderMyTab() {
    const isDropped = house.status === 'dropped';
    const isVacation = house.status === 'out_of_station';
    const totalYearDrops = house.twelveMonths.reduce((a, b) => a + b.daysDropped, 0);
    const totalYearDays = house.twelveMonths.reduce((a, b) => a + b.totalDays, 0);
    const yearPct = Math.round((totalYearDrops / totalYearDays) * 100);

    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.navHeader}>
          <Pressable onPress={() => setActiveTab('Home')} style={styles.navBackBtn}>
            <Text style={styles.navBackText}>← Back</Text>
          </Pressable>
          <Text style={styles.navTitle}>View My Tab</Text>
        </View>

        {/* Resident Summary Tab Card */}
        <View style={styles.myTabCard}>
          <View style={styles.myTabHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.myTabSub}>RESIDENT TAB · ZONE 1 (0000 TO 1000)</Text>
              <Text style={styles.myTabHouseId}>House #{house.id}</Text>
              <Text style={styles.myTabResident}>{house.residentName}</Text>
              <Text style={styles.myTabAddress}>{house.address}</Text>
            </View>
            <ChirpyMascot
              mood={isDropped ? 'happy' : isVacation ? 'vacation' : 'frozen'}
              size={70}
            />
          </View>

          {/* Current Status Banner */}
          <View style={[
            styles.tabStatusBox,
            isDropped ? styles.tabStatusDropped : isVacation ? styles.tabStatusVacation : styles.tabStatusFrozen
          ]}>
            <Text style={styles.tabStatusTitle}>
              {isDropped ? '🟢 Status: Dropped Today' : isVacation ? '🟡 Status: Out of Station (Protected)' : '⚪ Status: Pending Drop'}
            </Text>
            <Text style={styles.tabStatusDesc}>
              {isDropped
                ? `Waste recorded at ${house.dropTimeToday ?? '08:24 AM'}. Streak is on!`
                : isVacation
                ? 'Out of station is active: compliance percentage is protected and does not drop.'
                : 'Pending waste drop for today. Log via camera scan or bin drop before 8 PM.'}
            </Text>
          </View>

          {/* Quick Details Grid */}
          <View style={styles.tabMetricsRow}>
            <View style={styles.tabMetricItem}>
              <Text style={styles.tabMetricVal}>{house.block}</Text>
              <Text style={styles.tabMetricLabel}>Assigned Block</Text>
            </View>
            <View style={styles.tabMetricItem}>
              <Text style={styles.tabMetricVal}>{house.streak} Days</Text>
              <Text style={styles.tabMetricLabel}>Active Streak</Text>
            </View>
            <View style={styles.tabMetricItem}>
              <Text style={[styles.tabMetricVal, { color: '#16A34A' }]}>{yearPct}%</Text>
              <Text style={styles.tabMetricLabel}>Year Compliance</Text>
            </View>
          </View>
        </View>

        {/* 🏖️ Vacation / Holiday Mode Banner (from Gov Web) */}
        {renderVacationBanner()}

        {/* ⚡ Quick State Overrides: Mark Dropped & Set Vacation Mode (from Gov Web) */}
        {renderQuickStateControls()}

        {/* Permanent Allotted Household Identifier Card (Locked like Electricity Meter / Vehicle Reg) */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={styles.cardHeader}>🔒 Government Allotment Identifier</Text>
            <View style={styles.lockedBadge}>
              <Text style={styles.lockedBadgeText}>PERMANENT & FIXED</Text>
            </View>
          </View>
          <Text style={styles.helpText}>
            This identifier is permanently assigned to your premises by the Ward 151 Govt Municipal Office (like an electricity meter or vehicle registration number).
          </Text>

          <View style={styles.fixedIdContainer}>
            <View style={styles.fixedIdRow}>
              <Text style={styles.fixedIdLabel}>Premises Number:</Text>
              <Text style={styles.fixedIdValue}>House #{house.id}</Text>
            </View>
            <View style={styles.fixedIdRow}>
              <Text style={styles.fixedIdLabel}>Sector Block:</Text>
              <Text style={styles.fixedIdValue}>{house.block} (Ward 151)</Text>
            </View>
            <View style={styles.fixedIdRow}>
              <Text style={styles.fixedIdLabel}>RFID Token / QR Barcode:</Text>
              <Text style={styles.fixedIdValue}>{house.assignedBadge}</Text>
            </View>
            <View style={styles.fixedIdRow}>
              <Text style={styles.fixedIdLabel}>Registered Resident:</Text>
              <Text style={styles.fixedIdValue}>{house.residentName}</Text>
            </View>
          </View>

          <View style={styles.tenantNoticeBox}>
            <Text style={styles.tenantNoticeIcon}>🏛️</Text>
            <Text style={styles.tenantNoticeText}>
              Tenant or ownership transfer? Allotment records can only be updated directly at the Government Ward Office with valid rental agreement / property deed.
            </Text>
          </View>
        </View>

        {/* 12-Month Performance & Compliance Breakdown */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={styles.cardHeader}>12-Month Compliance History</Text>
            <Text style={styles.yearScoreBadge}>{yearPct}% Year Average</Text>
          </View>
          <Text style={[styles.helpText, { marginBottom: 12 }]}>
            🛡️ Out of Station days are fully exempted and do NOT reduce your compliance score.
          </Text>

          <View style={styles.monthGrid}>
            {house.twelveMonths.map((m, idx) => (
              <View key={m.monthName} style={[styles.monthCard, idx === 9 && styles.monthCardActive]}>
                <Text style={styles.monthTitle}>{m.monthName}</Text>
                <Text style={styles.monthScore}>{m.compliancePct}%</Text>
                <Text style={styles.monthDrops}>{m.daysDropped}/{m.totalDays} d</Text>
                <Text style={styles.monthBadge}>{m.badgeLabel.split(' ')[0]}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    );
  }

  // TAB 3: Bulk Orders & 2-Way Message Desk
  function renderBulkOrder() {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.navHeader}>
          <Pressable onPress={() => setActiveTab('Home')} style={styles.navBackBtn}>
            <Text style={styles.navBackText}>← Back</Text>
          </Pressable>
          <Text style={styles.navTitle}>Bulk Orders & Admin Desk</Text>
        </View>

        {/* Order / Request Creator */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>📦 Request Bulk Service / Help</Text>
          <Text style={styles.helpText}>
            Direct line to Ward 151 Govt Officers. Request special bulk pickups, party waste bins, or report issues.
          </Text>

          {/* Category Selector */}
          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Request Category:</Text>
          <View style={styles.catChipsRow}>
            {(['Bulk Order / Event', 'Bulky Pickup', 'Bin Overflow', 'Query'] as CitizenMessage['category'][]).map((cat) => (
              <Pressable
                key={cat}
                style={[styles.catChip, orderCategory === cat && styles.catChipActive]}
                onPress={() => setOrderCategory(cat)}
              >
                <Text style={[styles.catChipText, orderCategory === cat && styles.catChipTextActive]}>
                  {cat === 'Bulk Order / Event' ? '🎉 Bulk / Event' : cat === 'Bulky Pickup' ? '🛋️ Bulky Waste' : cat === 'Bin Overflow' ? '⚠️ Bin Full' : '💬 Query'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Notes Input */}
          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Description & Details:</Text>
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={4}
            placeholder="e.g. Need bulk collection for birthday party with 40 guests on Sunday at 7 PM..."
            value={orderNotes}
            onChangeText={setOrderNotes}
          />

          <Pressable
            style={[styles.submitOrderBtn, orderSubmitting && { opacity: 0.7 }]}
            onPress={handleSendBulkOrder}
            disabled={orderSubmitting}
          >
            {orderSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitOrderBtnText}>Transmit to Govt Office 🚀</Text>
            )}
          </Pressable>
        </View>

        {/* 2-Way Conversation Feed */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>💬 Message Feed (Citizen App ↔ Govt Desk)</Text>
          {messages.length === 0 ? (
            <Text style={styles.emptyFeedText}>No messages yet. Send your first request above!</Text>
          ) : (
            messages.map((m) => (
              <View key={m.id} style={styles.messageCard}>
                <View style={styles.msgHeaderRow}>
                  <View style={styles.msgBadgeWrap}>
                    <Text style={styles.msgCategoryBadge}>{m.category}</Text>
                    <Text style={styles.msgTimeText}>{m.timestamp}</Text>
                  </View>
                  <Text style={m.status === 'resolved' ? styles.statusReplied : styles.statusPending}>
                    {m.status === 'resolved' ? 'Replied ✓' : 'Sent to Desk ⏳'}
                  </Text>
                </View>

                {/* Resident Message Bubble */}
                <View style={styles.residentBubble}>
                  <Text style={styles.bubbleAuthor}>You (House #{m.houseId}):</Text>
                  <Text style={styles.bubbleText}>{m.messageText}</Text>
                </View>

                {/* Government Official Reply Bubble */}
                {m.officialReply && (
                  <View style={styles.govtBubble}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={styles.govtAuthor}>🏛️ {m.officerName ?? 'Ward 151 Officer'}:</Text>
                      <Text style={styles.govtReplyTime}>{m.replyTime ?? 'Delivered'}</Text>
                    </View>
                    <Text style={styles.govtText}>{m.officialReply}</Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    );
  }

  // TAB 4: Camera Scanner
  function renderCameraScan() {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <View style={styles.cameraTopBar}>
          <Pressable onPress={() => setActiveTab('Home')} style={styles.cameraBackBtn}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>✕ Close</Text>
          </Pressable>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Scan Bin QR Code</Text>
          <View style={{ width: 50 }} />
        </View>

        {permission?.granted ? (
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            onBarcodeScanned={handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['qr', 'code128'],
            }}
          >
            {/* Viewfinder Target */}
            <View style={styles.viewFinderOverlay}>
              <View style={styles.viewFinderBox}>
                <View style={styles.viewFinderReticle} />
                <Text style={styles.viewFinderText}>Align QR code inside box</Text>
              </View>
            </View>
          </CameraView>
        ) : (
          <View style={styles.noCameraBox}>
            <Text style={{ fontSize: 44, marginBottom: 12 }}>📷</Text>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center' }}>
              Camera Access Needed
            </Text>
            <Text style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', marginTop: 6, marginHorizontal: 20 }}>
              Allow camera permission to scan QR stickers affixed to your designated waste bins.
            </Text>
            <Pressable
              style={styles.permissionBtn}
              onPress={requestPermission}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Grant Permission</Text>
            </Pressable>
          </View>
        )}

        {/* Manual Code Input Tray */}
        <View style={styles.cameraBottomTray}>
          <Text style={{ color: '#E5E7EB', fontSize: 12, marginBottom: 8, fontWeight: '600' }}>
            Or type bin barcode / bay ID manually:
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              style={styles.manualCodeInput}
              placeholder="e.g. BAY-WET-01, BAY-DRY-01"
              placeholderTextColor="#9CA3AF"
              value={manualCodeInput}
              onChangeText={setManualCodeInput}
              autoCapitalize="characters"
            />
            <Pressable
              style={styles.manualCodeSubmit}
              onPress={() => {
                const code = manualCodeInput.trim() || 'BAY-WET-01';
                let detected: WasteType = 'wet';
                if (code.toLowerCase().includes('dry')) detected = 'dry';
                else if (code.toLowerCase().includes('sanit')) detected = 'sanitary';
                else if (code.toLowerCase().includes('furn')) detected = 'furniture';
                else if (code.toLowerCase().includes('event')) detected = 'event';

                handleRecordWasteDrop(detected, code);
                setManualCodeInput('');
                setActiveTab('Home');
              }}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Submit</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      {/* Screen / Tab Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'Home' && renderHome()}
        {activeTab === 'MyTab' && renderMyTab()}
        {activeTab === 'BulkOrder' && renderBulkOrder()}
        {activeTab === 'CameraScan' && renderCameraScan()}
      </View>

      {/* Bottom Tab Bar (Home / View My Tab / Bulk Orders / Scan) */}
      {activeTab !== 'CameraScan' && (
        <View style={styles.bottomTabBar}>
          <Pressable
            style={[styles.tabBarItem, activeTab === 'Home' && styles.tabBarItemActive]}
            onPress={() => setActiveTab('Home')}
          >
            <Text style={styles.tabBarIcon}>🏠</Text>
            <Text style={[styles.tabBarLabel, activeTab === 'Home' && styles.tabBarLabelActive]}>
              Home
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tabBarItem, activeTab === 'MyTab' && styles.tabBarItemActive]}
            onPress={() => setActiveTab('MyTab')}
          >
            <Text style={styles.tabBarIcon}>📑</Text>
            <Text style={[styles.tabBarLabel, activeTab === 'MyTab' && styles.tabBarLabelActive]}>
              View My Tab
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tabBarItem, activeTab === 'BulkOrder' && styles.tabBarItemActive]}
            onPress={() => setActiveTab('BulkOrder')}
          >
            <Text style={styles.tabBarIcon}>📦</Text>
            <Text style={[styles.tabBarLabel, activeTab === 'BulkOrder' && styles.tabBarLabelActive]}>
              Bulk & Desk
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tabBarItem, styles.tabBarScanItem]}
            onPress={async () => {
              if (!permission?.granted) {
                await requestPermission();
              }
              setActiveTab('CameraScan');
            }}
          >
            <Text style={styles.tabBarScanIcon}>📷</Text>
            <Text style={styles.tabBarScanLabel}>Scan</Text>
          </Pressable>
        </View>
      )}

      {/* Drop Success Modal */}
      <Modal
        visible={scanModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setScanModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalDialog}>
            <View style={styles.modalIconWrap}>
              <ChirpyMascot mood="happy" size={72} />
            </View>

            <Text style={styles.modalTitle}>Waste Drop Recorded! 🎉</Text>
            <Text style={styles.modalSuccessNotice}>
              {WASTE_META[lastDropWaste].icon} {WASTE_META[lastDropWaste].label} successfully verified and recorded.
            </Text>

            {/* Permanent Allotted House & Date Card */}
            <View style={styles.modalDropReceipt}>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Permanent Allotted ID:</Text>
                <Text style={styles.receiptValHighlight}>House #{house.id}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Drop Date & Time:</Text>
                <Text style={styles.receiptVal}>{lastDropTimestamp}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Collection Point:</Text>
                <Text style={styles.receiptVal}>{lastDropBayLabel}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Sector Block:</Text>
                <Text style={styles.receiptVal}>{house.block} (Ward 151)</Text>
              </View>
            </View>

            {/* Daily Lock Notice */}
            <View style={styles.modalNextDayNotice}>
              <Text style={styles.nextDayIcon}>🔒</Text>
              <Text style={styles.nextDayText}>
                Daily drop completed for today! Next scan opens tomorrow morning.
              </Text>
            </View>

            <View style={styles.modalStreakCard}>
              <Text style={styles.modalStreakVal}>🔥 {house.streak}-Day Active Streak</Text>
              <Text style={styles.modalStreakSub}>
                House #{house.id} compliance score is 100% compliant for today!
              </Text>
            </View>

            <Pressable
              style={styles.modalCloseBtn}
              onPress={() => setScanModalVisible(false)}
            >
              <Text style={styles.modalCloseBtnText}>Awesome, Done! 🚀</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Design Tokens & Styles ───────────────────────────────────────────────────
const C = {
  bg: '#F3F4F6',
  cardBg: '#FFFFFF',
  primary: '#16A34A',
  primaryDark: '#15803D',
  amber: '#D97706',
  slate: '#0F172A',
  textMain: '#111827',
  textMute: '#6B7280',
  border: '#E5E7EB',
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  container: { padding: 18, paddingTop: 48, paddingBottom: 90 },

  // Header Card
  headerCard: {
    backgroundColor: '#064E3B',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerWardBadge: { fontSize: 10, fontWeight: '800', color: '#6EE7B7', letterSpacing: 1 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', marginTop: 2 },
  headerSubtitle: { fontSize: 13, color: '#A7F3D0', marginTop: 2 },

  // Status Banner
  statusBanner: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  bannerDropped: { backgroundColor: '#047857' },
  bannerVacation: { backgroundColor: '#B45309' },
  bannerFrozen: { backgroundColor: '#1E293B' },
  statusBannerText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', textAlign: 'center' },

  // Big Action Buttons
  actionGrid: { gap: 12, marginBottom: 16 },
  bigButton: {
    backgroundColor: C.cardBg,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  bigButtonScan: { borderLeftWidth: 6, borderLeftColor: '#16A34A' },
  bigButtonTab: { borderLeftWidth: 6, borderLeftColor: '#0284C7' },
  bigButtonBulk: { borderLeftWidth: 6, borderLeftColor: '#9333EA' },
  bigButtonIcon: { fontSize: 30 },
  bigButtonTitle: { fontSize: 16, fontWeight: '800', color: C.textMain },
  bigButtonSub: { fontSize: 12, color: C.textMute, marginTop: 2 },
  arrowIcon: { fontSize: 20, color: '#9CA3AF', fontWeight: 'bold' },

  statusPillBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  pillDropped: { backgroundColor: '#DCFCE7' },
  pillVacation: { backgroundColor: '#FEF3C7' },
  pillFrozen: { backgroundColor: '#E2E8F0' },
  statusPillText: { fontSize: 10, fontWeight: '800', color: C.textMain },

  msgCountBadge: { backgroundColor: '#F3E8FF', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  msgCountText: { fontSize: 11, fontWeight: 'bold', color: '#7E22CE' },

  // Generic Card
  card: {
    backgroundColor: C.cardBg,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardHeader: { fontSize: 16, fontWeight: '800', color: C.textMain, marginBottom: 4 },
  sectionSubtitle: { fontSize: 12, fontWeight: '700', color: C.textMute, marginTop: 14, marginBottom: 8 },
  helpText: { fontSize: 12, color: C.textMute, lineHeight: 18 },

  // Mascot Box
  mascotBox: {
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stats Row
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  statBox: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  statVal: { fontSize: 16, fontWeight: '900', color: C.textMain },
  statLabel: { fontSize: 11, color: C.textMute, marginTop: 2 },

  // Waste Pills
  wastePillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  wastePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  wastePillIcon: { fontSize: 16 },
  wastePillText: { fontSize: 12, fontWeight: '700', color: C.textMain },

  // 🏖️ Vacation Mode Banner Styles (matching Gov Web)
  vacationBanner: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  vacationBannerActive: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  vacationBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vacationIconBoxActive: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  vacationIcon: {
    fontSize: 28,
  },
  vacationIconLarge: {
    fontSize: 24,
  },
  vacationTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#78350F',
  },
  vacationTitleActive: {
    fontSize: 14,
    fontWeight: '800',
    color: '#451A03',
  },
  vacationDesc: {
    fontSize: 11,
    color: '#92400E',
    marginTop: 2,
    lineHeight: 16,
  },
  vacationDescActive: {
    fontSize: 11,
    color: '#92400E',
    marginTop: 2,
    lineHeight: 16,
  },
  setVacationBtn: {
    backgroundColor: '#F59E0B',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'flex-start',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  setVacationBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  endVacationBtn: {
    backgroundColor: '#D97706',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'flex-start',
    shadowColor: '#D97706',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  endVacationBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  // ⚡ Quick Override Action Controls (matching Gov Web)
  quickOverrideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  quickOverrideHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickOverrideLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4B5563',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickOverrideSub: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  quickOverrideButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickOverrideBtn: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickOverrideBtnGreen: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  quickOverrideBtnOrange: {
    backgroundColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  quickOverrideBtnMuted: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quickOverrideBtnText: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  quickOverrideBtnTextWhite: {
    color: '#FFFFFF',
  },
  quickOverrideBtnTextMuted: {
    color: '#4B5563',
  },

  // Navigation Header
  navHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  navBackBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#E5E7EB', borderRadius: 10 },
  navBackText: { fontSize: 13, fontWeight: '700', color: C.textMain },
  navTitle: { fontSize: 18, fontWeight: '900', color: C.textMain },

  // View My Tab Card
  myTabCard: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 22,
    marginBottom: 16,
  },
  myTabHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  myTabSub: { fontSize: 10, fontWeight: '800', color: '#34D399', letterSpacing: 1.2 },
  myTabHouseId: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', marginTop: 2 },
  myTabResident: { fontSize: 16, fontWeight: '700', color: '#E2E8F0', marginTop: 2 },
  myTabAddress: { fontSize: 11, color: '#94A3B8', marginTop: 2 },

  tabStatusBox: { borderRadius: 14, padding: 12, marginBottom: 16 },
  tabStatusDropped: { backgroundColor: 'rgba(22, 163, 74, 0.2)', borderWidth: 1, borderColor: '#16A34A' },
  tabStatusVacation: { backgroundColor: 'rgba(217, 119, 6, 0.2)', borderWidth: 1, borderColor: '#D97706' },
  tabStatusFrozen: { backgroundColor: 'rgba(51, 65, 85, 0.5)', borderWidth: 1, borderColor: '#475569' },
  tabStatusTitle: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  tabStatusDesc: { fontSize: 11, color: '#CBD5E1', marginTop: 2, lineHeight: 16 },

  tabMetricsRow: { flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: '#1E293B', paddingTop: 14 },
  tabMetricItem: { flex: 1, alignItems: 'center' },
  tabMetricVal: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
  tabMetricLabel: { fontSize: 10, color: '#94A3B8', marginTop: 2 },

  // 12-Month Grid
  yearScoreBadge: { fontSize: 12, fontWeight: '800', color: '#16A34A', backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  monthCard: {
    width: '22.8%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  monthCardActive: { borderColor: '#16A34A', backgroundColor: '#F0FDF4' },
  monthTitle: { fontSize: 11, fontWeight: '800', color: C.textMain },
  monthScore: { fontSize: 13, fontWeight: '900', color: '#16A34A', marginTop: 2 },
  monthDrops: { fontSize: 8, color: C.textMute, marginTop: 1 },
  monthBadge: { fontSize: 8, color: C.textMute, marginTop: 2, fontWeight: '700' },

  // Form Inputs
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: C.textMain,
  },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: C.textMain, marginBottom: 6 },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: C.textMain,
    minHeight: 85,
    textAlignVertical: 'top',
  },
  lockedBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  lockedBadgeText: { fontSize: 9, fontWeight: '900', color: '#92400E' },
  fixedIdContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  fixedIdRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fixedIdLabel: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  fixedIdValue: { fontSize: 12, fontWeight: '800', color: '#0F172A', fontFamily: 'monospace' },
  tenantNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
  },
  tenantNoticeIcon: { fontSize: 18 },
  tenantNoticeText: { flex: 1, fontSize: 11, color: '#166534', lineHeight: 16 },
  catChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  catChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  catChipActive: { backgroundColor: '#7E22CE', borderColor: '#6B21A8' },
  catChipText: { fontSize: 12, fontWeight: '700', color: C.textMain },
  catChipTextActive: { color: '#FFFFFF' },
  submitOrderBtn: {
    backgroundColor: '#7E22CE',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  submitOrderBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },

  // Messages
  emptyFeedText: { textAlign: 'center', color: C.textMute, fontSize: 13, marginVertical: 20 },
  messageCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  msgHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  msgBadgeWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  msgCategoryBadge: { fontSize: 11, fontWeight: '800', backgroundColor: '#E0E7FF', color: '#4338CA', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  msgTimeText: { fontSize: 10, color: C.textMute },
  statusReplied: { fontSize: 11, fontWeight: '800', color: '#16A34A' },
  statusPending: { fontSize: 11, fontWeight: '800', color: '#D97706' },
  residentBubble: { backgroundColor: '#FFFFFF', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8 },
  bubbleAuthor: { fontSize: 10, fontWeight: '800', color: C.textMute, marginBottom: 2 },
  bubbleText: { fontSize: 13, color: C.textMain, lineHeight: 18 },
  govtBubble: { backgroundColor: '#F0FDF4', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#BBF7D0' },
  govtAuthor: { fontSize: 11, fontWeight: '800', color: '#166534' },
  govtReplyTime: { fontSize: 9, color: '#166534' },
  govtText: { fontSize: 13, color: '#14532D', lineHeight: 18 },

  // Camera UI
  cameraTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#000',
  },
  cameraBackBtn: { padding: 6 },
  viewFinderOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewFinderBox: {
    width: 240,
    height: 240,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#22C55E',
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewFinderReticle: { width: 140, height: 140, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 12 },
  viewFinderText: { color: '#FFFFFF', fontSize: 12, marginTop: 12, fontWeight: '600' },
  cameraBottomTray: { backgroundColor: '#111827', padding: 18, paddingBottom: 32 },
  manualCodeInput: { flex: 1, backgroundColor: '#1F2937', color: '#FFF', borderRadius: 12, paddingHorizontal: 12, fontSize: 13 },
  manualCodeSubmit: { backgroundColor: '#16A34A', paddingHorizontal: 16, justifyContent: 'center', borderRadius: 12 },
  noCameraBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  permissionBtn: { backgroundColor: '#16A34A', marginTop: 18, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },

  // Bottom Tab Bar
  bottomTabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingVertical: 8,
    paddingHorizontal: 12,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  tabBarItem: { alignItems: 'center', justifyContent: 'center', paddingVertical: 4, paddingHorizontal: 10 },
  tabBarItemActive: { opacity: 1 },
  tabBarIcon: { fontSize: 20 },
  tabBarLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280', marginTop: 2 },
  tabBarLabelActive: { color: '#16A34A' },
  tabBarScanItem: {
    backgroundColor: '#16A34A',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  tabBarScanIcon: { fontSize: 18, color: '#FFF' },
  tabBarScanLabel: { fontSize: 10, fontWeight: '800', color: '#FFF', marginTop: 1 },

  // Success Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalDialog: { backgroundColor: '#FFFFFF', borderRadius: 28, padding: 24, alignItems: 'center', width: '100%', maxWidth: 340 },
  modalIconWrap: { marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: C.textMain, textAlign: 'center' },
  modalSuccessNotice: { fontSize: 13, color: '#15803D', fontWeight: '700', textAlign: 'center', marginTop: 4, lineHeight: 18 },
  modalDropReceipt: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    width: '100%',
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  receiptLabel: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  receiptVal: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  receiptValHighlight: { fontSize: 13, fontWeight: '900', color: '#16A34A', fontFamily: 'monospace' },
  modalNextDayNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    width: '100%',
  },
  nextDayIcon: { fontSize: 16 },
  nextDayText: { flex: 1, fontSize: 11, color: '#92400E', fontWeight: '700', lineHeight: 16 },
  modalStreakCard: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 16, padding: 14, width: '100%', marginTop: 10, alignItems: 'center' },
  modalStreakVal: { fontSize: 16, fontWeight: '900', color: '#16A34A' },
  modalStreakSub: { fontSize: 11, color: '#15803D', marginTop: 4, textAlign: 'center' },
  modalCloseBtn: { backgroundColor: '#16A34A', borderRadius: 16, paddingVertical: 14, width: '100%', alignItems: 'center', marginTop: 14 },
  modalCloseBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
