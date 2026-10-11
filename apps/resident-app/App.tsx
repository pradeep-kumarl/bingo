/**
 * BinGo Resident Mobile App
 * Expo ~57 / React Native 0.86 / Expo Camera / TypeScript
 *
 * Features:
 * 1. Live Camera QR Scanner & manual fallback for bin QR codes
 * 2. Visual Theater Seat Viewer for the resident's allotted seat (#0000 to #1000)
 *    with interactive Chirpy Sparrow mascot (Green=Dropped, Grey=Frozen Ice, Amber=Vacation)
 * 3. 12-Month Waste Performance history with compliance percentage
 * 4. 2-Way Message Desk: Send Bulk Waste / Event orders, bin issues & requests directly to Govt Admin
 * 5. Instant Vacation Mode / Streak Freeze toggle
 */

import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
  id: string; // e.g. "0104", "0042"
  numericId: number;
  block: string;
  status: SeatStatus;
  streak: number;
  monthDropsCount: number;
  monthTotalDays: number;
  dropTimeToday?: string;
  residentName: string;
  address: string;
  assignedBadge: string;
  twelveMonths: MonthPerformance[];
}

interface CitizenMessage {
  id: string;
  houseId: string;
  category: 'Bulky Pickup' | 'Bin Overflow' | 'Travel / Freeze' | 'Bulk Order / Event' | 'Query';
  messageText: string;
  timestamp: string;
  status: 'pending_reply' | 'resolved';
  officialReply?: string;
  officerName?: string;
  replyTime?: string;
}

type Screen = 'Home' | 'CameraScan' | 'MySeat' | 'BulkOrder' | 'History';

// ─── Constants ────────────────────────────────────────────────────────────────
const WASTE_META: Record<WasteType, { label: string; icon: string; desc: string }> = {
  wet:       { label: 'Organic (Wet)',               icon: '🥬', desc: 'Compostable food & kitchen waste' },
  sanitary:  { label: 'Sanitary / Soiled (Burning)', icon: '🔥', desc: 'Diapers & sanitary waste for incineration' },
  dry:       { label: 'Dry / Recyclables',           icon: '📦', desc: 'Paper, cardboard, plastics & cans' },
  furniture: { label: 'Bulky Furniture',             icon: '🛋️', desc: 'Mattresses, chairs & timber' },
  event:     { label: 'Bulk / Event Waste',          icon: '🎉', desc: 'Marriage halls, parties & catering waste' },
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function generate12Months(houseIndex: number, todayStatus: SeatStatus): MonthPerformance[] {
  return MONTH_NAMES.map((name, mIdx) => {
    const totalDays = MONTH_DAYS[mIdx];
    const monthHash = ((houseIndex * 41 + mIdx * 29) * 2654435761) >>> 0;
    const rateFactor = (monthHash % 35) + 65;
    let daysDropped = Math.round((totalDays * rateFactor) / 100);

    if (mIdx === 9) { // October (current month)
      if (todayStatus === 'out_of_station') daysDropped = Math.max(12, daysDropped - 6);
      else if (todayStatus === 'dropped') daysDropped = Math.min(totalDays, daysDropped + 2);
    }

    const compliancePct = Math.round((daysDropped / totalDays) * 100);
    let badgeLabel = 'Good Binner';
    if (compliancePct >= 90) badgeLabel = 'Eco Champion 🌟';
    else if (compliancePct >= 80) badgeLabel = 'Active Streak 🔥';
    else if (compliancePct >= 70) badgeLabel = 'Travel Freeze 🏖️';
    else badgeLabel = 'Frozen Defrost ❄️';

    return {
      monthName: name,
      daysDropped,
      totalDays,
      compliancePct,
      badgeLabel,
    };
  });
}

function createHouseSeat(houseId: string, status: SeatStatus = 'pending'): HouseSeat {
  const numericId = parseInt(houseId.replace(/\D/g, ''), 10) || 104;
  const block = numericId <= 250 ? 'Block A' : numericId <= 500 ? 'Block B' : numericId <= 750 ? 'Block C' : 'Block D';
  const twelveMonths = generate12Months(numericId, status);
  const currentMonth = twelveMonths[9];

  return {
    id: houseId.padStart(4, '0'),
    numericId,
    block,
    status,
    streak: status === 'dropped' ? 7 : 0,
    monthDropsCount: currentMonth.daysDropped,
    monthTotalDays: currentMonth.totalDays,
    dropTimeToday: status === 'dropped' ? '08:24 AM' : undefined,
    residentName: 'Priya Sharma',
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
  const [houseId, setHouseId] = useState('0104');
  const [house, setHouse] = useState<HouseSeat>(() => createHouseSeat('0104', 'pending'));
  const [currentScreen, setCurrentScreen] = useState<Screen>('Home');

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

  // Switch House ID (e.g. testing different seats from 0000 to 1000)
  function handleSaveHouseId(newId: string) {
    const clean = newId.trim().padStart(4, '0');
    setHouseId(clean);
    setHouse(createHouseSeat(clean, house.status));
    Alert.alert('Seat Updated', `Switched to House Seat #${clean} in Ward 151.`);
  }

  // Handle Scan recording
  function handleRecordWasteDrop(type: WasteType = 'wet', bayCode?: string) {
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const updatedMonths = generate12Months(house.numericId, 'dropped');

    setHouse((prev) => ({
      ...prev,
      status: 'dropped',
      streak: prev.streak + 1,
      dropTimeToday: timeStr,
      monthDropsCount: updatedMonths[9].daysDropped,
      twelveMonths: updatedMonths,
    }));

    setLastDropWaste(type);
    setScanModalVisible(true);
    setScannedResult(bayCode ?? `BAY-${type.toUpperCase()}-01`);
  }

  // Handle Barcode Scanned Event from CameraView
  function handleBarcodeScanned({ data }: { data: string }) {
    if (scanModalVisible) return;
    let detectedType: WasteType = 'wet';
    const lower = data.toLowerCase();
    if (lower.includes('dry') || lower.includes('recycl')) detectedType = 'dry';
    else if (lower.includes('sanit') || lower.includes('burn')) detectedType = 'sanitary';
    else if (lower.includes('furn') || lower.includes('bulk')) detectedType = 'furniture';
    else if (lower.includes('event')) detectedType = 'event';

    handleRecordWasteDrop(detectedType, data);
    setCurrentScreen('Home');
  }

  // Vacation Mode Toggle
  function handleToggleVacation() {
    const nextStatus: SeatStatus = house.status === 'out_of_station' ? 'pending' : 'out_of_station';
    const updatedMonths = generate12Months(house.numericId, nextStatus);

    setHouse((prev) => ({
      ...prev,
      status: nextStatus,
      monthDropsCount: updatedMonths[9].daysDropped,
      twelveMonths: updatedMonths,
    }));

    if (nextStatus === 'out_of_station') {
      const vacationMsg: CitizenMessage = {
        id: `MSG-TRV-${Date.now()}`,
        houseId: house.id,
        category: 'Travel / Freeze',
        messageText: `Travel Notice: House #${house.id} enabled Vacation Mode. Pausing daily drops & protecting streak 🏖️`,
        timestamp: 'Just now',
        status: 'pending_reply',
      };
      setMessages((prev) => [vacationMsg, ...prev]);
      Alert.alert('Vacation Mode Activated 🏖️', 'Streak is protected! Daily waste drops paused without penalizing your score.');
    } else {
      Alert.alert('Welcome Back! 🏠', 'Vacation mode ended. Streak tracking resumed.');
    }
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
      Alert.alert('Request Sent to Admin! 🚀', `Your ${orderCategory} request was transmitted directly to the Municipal Officer desk.`);
      setCurrentScreen('BulkOrder');
    }, 600);
  }

  // ── Render Screens ──

  // SCREEN 1: Home Dashboard
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
              <Text style={styles.headerTitle}>House Seat #{house.id}</Text>
              <Text style={styles.headerSubtitle}>{house.residentName} · {house.block}</Text>
            </View>
            <Pressable onPress={() => setCurrentScreen('MySeat')}>
              <ChirpyMascot
                mood={isDropped ? 'happy' : isVacation ? 'vacation' : 'frozen'}
                size={58}
              />
            </Pressable>
          </View>

          {/* Quick House Status Pill */}
          <View style={[
            styles.statusBanner,
            isDropped ? styles.bannerDropped : isVacation ? styles.bannerVacation : styles.bannerFrozen
          ]}>
            <Text style={styles.statusBannerText}>
              {isDropped
                ? `✅ Binned Today at ${house.dropTimeToday ?? '08:24 AM'} · Streak Active 🔥`
                : isVacation
                ? '🏖️ Vacation Mode Active · Streak Freeze Protected'
                : '❄️ Drop Pending for Today · Defrost Chirpy Before 8 PM!'}
            </Text>
          </View>
        </View>

        {/* Big Action Buttons */}
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
              setCurrentScreen('CameraScan');
            }}
          >
            <Text style={styles.bigButtonIcon}>📷</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.bigButtonTitle}>Scan Bin QR Code</Text>
              <Text style={styles.bigButtonSub}>Point phone at bin to log daily drop</Text>
            </View>
            <Text style={styles.arrowIcon}>→</Text>
          </Pressable>

          {/* 2. My Theater Seat Button */}
          <Pressable
            style={[styles.bigButton, styles.bigButtonSeat]}
            onPress={() => setCurrentScreen('MySeat')}
          >
            <Text style={styles.bigButtonIcon}>🪑</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.bigButtonTitle}>View My Theater Seat</Text>
              <Text style={styles.bigButtonSub}>Seat #{house.id} · 12-Month Performance</Text>
            </View>
            <View style={[
              styles.seatMiniBadge,
              isDropped ? styles.seatMiniDropped : isVacation ? styles.seatMiniVacation : styles.seatMiniFrozen
            ]}>
              <Text style={styles.seatMiniBadgeText}>{isDropped ? 'GREEN' : isVacation ? 'AMBER' : 'GREY'}</Text>
            </View>
          </Pressable>

          {/* 3. Bulk Order / Message to Admin */}
          <Pressable
            style={[styles.bigButton, styles.bigButtonBulk]}
            onPress={() => setCurrentScreen('BulkOrder')}
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
          <Text style={styles.cardHeader}>🏅 Your Monthly Recycling Card</Text>
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
          <Text style={styles.sectionSubtitle}>Quick Log Waste Drop:</Text>
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

        {/* Vacation Mode Quick Toggle */}
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>🏖️ Vacation / Out of Station</Text>
              <Text style={styles.toggleDesc}>
                Traveling? Protect streak from freezing. Automatically notifies govt waste system.
              </Text>
            </View>
            <Pressable
              style={[styles.toggleBtn, isVacation && styles.toggleBtnActive]}
              onPress={handleToggleVacation}
            >
              <Text style={[styles.toggleBtnText, isVacation && styles.toggleBtnTextActive]}>
                {isVacation ? 'Active 🏖️' : 'Turn On'}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    );
  }

  // SCREEN 2: Camera Scanner
  function renderCameraScan() {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <View style={styles.cameraTopBar}>
          <Pressable onPress={() => setCurrentScreen('Home')} style={styles.cameraBackBtn}>
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
                setCurrentScreen('Home');
              }}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Submit</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // SCREEN 3: My Theater Seat View
  function renderMySeat() {
    const isDropped = house.status === 'dropped';
    const isVacation = house.status === 'out_of_station';
    const totalYearDrops = house.twelveMonths.reduce((a, b) => a + b.daysDropped, 0);
    const totalYearDays = house.twelveMonths.reduce((a, b) => a + b.totalDays, 0);
    const yearPct = Math.round((totalYearDrops / totalYearDays) * 100);

    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.navHeader}>
          <Pressable onPress={() => setCurrentScreen('Home')} style={styles.navBackBtn}>
            <Text style={styles.navBackText}>← Back</Text>
          </Pressable>
          <Text style={styles.navTitle}>Theater Seating Status</Text>
        </View>

        {/* Big Theater Seat Card (representing 1 seat in 0000-1000) */}
        <View style={styles.theaterSeatCard}>
          <View style={styles.theaterStageLine}>
            <Text style={styles.theaterStageText}>ZONE 1 THEATER GRID · SEAT 0000 TO 1000</Text>
          </View>

          <View style={styles.seatVisualCenter}>
            {/* The Seat Icon */}
            <View style={[
              styles.bigSeatBox,
              isDropped ? styles.bigSeatDropped : isVacation ? styles.bigSeatVacation : styles.bigSeatFrozen
            ]}>
              <ChirpyMascot
                mood={isDropped ? 'happy' : isVacation ? 'vacation' : 'frozen'}
                size={76}
              />
              <Text style={styles.seatNumberText}>#{house.id}</Text>
              <Text style={styles.seatStatusPill}>
                {isDropped ? 'GREEN SEAT (DROPPED)' : isVacation ? 'AMBER SEAT (VACATION)' : 'GREY SEAT (PENDING)'}
              </Text>
            </View>

            <Text style={styles.seatResidentName}>{house.residentName}</Text>
            <Text style={styles.seatAddressText}>{house.address}</Text>
          </View>

          {/* Seat Color Legend explanation */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#16A34A' }]} />
              <Text style={styles.legendText}>Green: Dropped</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#475569' }]} />
              <Text style={styles.legendText}>Grey: Not Dropped</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.legendText}>Amber: Vacation</Text>
            </View>
          </View>
        </View>

        {/* Switch House Seat Number Input */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Allotted Seat Identifier</Text>
          <Text style={styles.helpText}>
            Zone 1 comprises households 0000 through 1000. Enter your allotted number below:
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={houseId}
              onChangeText={setHouseId}
              placeholder="e.g. 0104"
              keyboardType="number-pad"
              maxLength={4}
            />
            <Pressable
              style={styles.saveSeatBtn}
              onPress={() => handleSaveHouseId(houseId)}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Allot Seat</Text>
            </Pressable>
          </View>
        </View>

        {/* 12-Month Performance Breakdown */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={styles.cardHeader}>12-Month Drop History</Text>
            <Text style={styles.yearScoreBadge}>{yearPct}% Year Average</Text>
          </View>

          <View style={styles.monthGrid}>
            {house.twelveMonths.map((m, idx) => (
              <View key={m.monthName} style={[styles.monthCard, idx === 9 && styles.monthCardActive]}>
                <Text style={styles.monthTitle}>{m.monthName}</Text>
                <Text style={styles.monthScore}>{m.compliancePct}%</Text>
                <Text style={styles.monthDrops}>{m.daysDropped}/{m.totalDays} days</Text>
                <Text style={styles.monthBadge}>{m.badgeLabel.split(' ')[0]}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    );
  }

  // SCREEN 4: Bulk Order & 2-Way Message Desk
  function renderBulkOrder() {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.navHeader}>
          <Pressable onPress={() => setCurrentScreen('Home')} style={styles.navBackBtn}>
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

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      {/* Screen Router */}
      {currentScreen === 'Home' && renderHome()}
      {currentScreen === 'CameraScan' && renderCameraScan()}
      {currentScreen === 'MySeat' && renderMySeat()}
      {currentScreen === 'BulkOrder' && renderBulkOrder()}

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
            <Text style={styles.modalMeta}>
              {WASTE_META[lastDropWaste].icon} {WASTE_META[lastDropWaste].label} logged successfully at {scannedResult ?? 'Station Bay'}.
            </Text>
            <View style={styles.modalStreakCard}>
              <Text style={styles.modalStreakVal}>🔥 {house.streak}-Day Active Streak</Text>
              <Text style={styles.modalStreakSub}>Your theater seat #{house.id} has turned GREEN for today!</Text>
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
  container: { padding: 18, paddingTop: 48, paddingBottom: 40 },

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
  bigButtonSeat: { borderLeftWidth: 6, borderLeftColor: '#0284C7' },
  bigButtonBulk: { borderLeftWidth: 6, borderLeftColor: '#9333EA' },
  bigButtonIcon: { fontSize: 32 },
  bigButtonTitle: { fontSize: 16, fontWeight: '800', color: C.textMain },
  bigButtonSub: { fontSize: 12, color: C.textMute, marginTop: 2 },
  arrowIcon: { fontSize: 20, color: '#9CA3AF', fontWeight: 'bold' },

  seatMiniBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  seatMiniDropped: { backgroundColor: '#DCFCE7' },
  seatMiniVacation: { backgroundColor: '#FEF3C7' },
  seatMiniFrozen: { backgroundColor: '#E2E8F0' },
  seatMiniBadgeText: { fontSize: 10, fontWeight: '800', color: C.textMain },

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

  // Vacation Toggle
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleTitle: { fontSize: 15, fontWeight: '800', color: C.textMain },
  toggleDesc: { fontSize: 12, color: C.textMute, marginTop: 2, lineHeight: 16 },
  toggleBtn: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  toggleBtnActive: { backgroundColor: '#F59E0B', borderColor: '#D97706' },
  toggleBtnText: { fontSize: 12, fontWeight: '800', color: C.textMain },
  toggleBtnTextActive: { color: '#FFFFFF' },

  // Navigation Header
  navHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  navBackBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#E5E7EB', borderRadius: 10 },
  navBackText: { fontSize: 13, fontWeight: '700', color: C.textMain },
  navTitle: { fontSize: 18, fontWeight: '900', color: C.textMain },

  // Theater Seat Card
  theaterSeatCard: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 22,
    marginBottom: 16,
    alignItems: 'center',
  },
  theaterStageLine: {
    borderBottomWidth: 2,
    borderBottomColor: '#10B981',
    paddingBottom: 6,
    marginBottom: 20,
    width: '100%',
    alignItems: 'center',
  },
  theaterStageText: { fontSize: 10, fontWeight: '800', color: '#34D399', letterSpacing: 1.5 },
  seatVisualCenter: { alignItems: 'center', marginBottom: 18 },
  bigSeatBox: {
    width: 140,
    height: 140,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 3,
  },
  bigSeatDropped: { backgroundColor: '#16A34A', borderColor: '#4ADE80' },
  bigSeatVacation: { backgroundColor: '#D97706', borderColor: '#FBBF24' },
  bigSeatFrozen: { backgroundColor: '#334155', borderColor: '#64748B' },
  seatNumberText: { fontSize: 16, fontWeight: '900', color: '#FFFFFF', marginTop: 4 },
  seatStatusPill: { fontSize: 8, fontWeight: '900', color: '#E2E8F0', marginTop: 2 },
  seatResidentName: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  seatAddressText: { fontSize: 11, color: '#94A3B8', marginTop: 2, textAlign: 'center' },

  legendRow: { flexDirection: 'row', gap: 16, borderTopWidth: 1, borderTopColor: '#1E293B', paddingTop: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },

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
  saveSeatBtn: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 12,
  },
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

  // Success Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalDialog: { backgroundColor: '#FFFFFF', borderRadius: 28, padding: 24, alignItems: 'center', width: '100%', maxWidth: 340 },
  modalIconWrap: { marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: C.textMain, textAlign: 'center' },
  modalMeta: { fontSize: 13, color: C.textMute, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  modalStreakCard: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 16, padding: 14, width: '100%', marginTop: 16, alignItems: 'center' },
  modalStreakVal: { fontSize: 16, fontWeight: '900', color: '#16A34A' },
  modalStreakSub: { fontSize: 11, color: '#15803D', marginTop: 4, textAlign: 'center' },
  modalCloseBtn: { backgroundColor: '#16A34A', borderRadius: 16, paddingVertical: 14, width: '100%', alignItems: 'center', marginTop: 16 },
  modalCloseBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
