/**
 * BinGo Resident App
 * Expo ~57 / React Native 0.86 / React 19 / TypeScript
 *
 * State-machine navigation: `screen` state drives which component renders.
 * Set API_BASE to your backend URL; leave empty for demo mode with mock data.
 */

import { StatusBar } from 'expo-status-bar';
import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

// ─── Config ──────────────────────────────────────────────────────────────────
const API_BASE = ''; // e.g. 'https://api.bingo.example.com'

// ─── Types ───────────────────────────────────────────────────────────────────
type WasteType = 'wet' | 'sanitary' | 'dry' | 'furniture' | 'event';

type CardProgress = Record<WasteType, boolean>;

interface ScanResult {
  wasteType: WasteType;
  message: string;
  vehicleFillPercentage: number;
  bingoWon: boolean;
  updatedCard: CardProgress;
}

interface ScanRecord {
  scanId: string;
  wasteType: WasteType;
  timestamp: string;
}

type Screen =
  | 'Login'
  | 'Home'
  | 'Scan'
  | 'ScanResult'
  | 'History';

// ─── Constants ────────────────────────────────────────────────────────────────
const WASTE_META: Record<WasteType, { label: string; icon: string }> = {
  wet:       { label: 'Wet',       icon: '🌊' },
  sanitary:  { label: 'Sanitary',  icon: '🚽' },
  dry:       { label: 'Dry',       icon: '♻️' },
  furniture: { label: 'Furniture', icon: '🛋️' },
  event:     { label: 'Event',     icon: '🎉' },
};

const SAMPLE_DEEP_LINK =
  'bingo://scan?data=DEMO_BAY_01&sig=abc123fakesignature';

const MOCK_HISTORY: ScanRecord[] = [
  { scanId: 'SC-001', wasteType: 'wet',      timestamp: '2026-10-10 08:15' },
  { scanId: 'SC-002', wasteType: 'dry',      timestamp: '2026-10-09 09:32' },
  { scanId: 'SC-003', wasteType: 'sanitary', timestamp: '2026-10-08 07:50' },
];

const INITIAL_CARD: CardProgress = {
  wet: false,
  sanitary: false,
  dry: false,
  furniture: false,
  event: false,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
/** Parse qrData + sig from a bingo:// deep-link or fall back to raw input. */
function parseDeepLink(raw: string): { qrData: string; signature: string } {
  try {
    const url = new URL(raw);
    return {
      qrData:    url.searchParams.get('data') ?? raw,
      signature: url.searchParams.get('sig')  ?? '',
    };
  } catch {
    return { qrData: raw, signature: '' };
  }
}

function isDemoMode(): boolean {
  return API_BASE === '';
}

// ─── Demo Banner ──────────────────────────────────────────────────────────────
function DemoBanner() {
  if (!isDemoMode()) return null;
  return (
    <View style={styles.demoBanner}>
      <Text style={styles.demoBannerText}>
        🔌 Demo mode – connect API_BASE for live data
      </Text>
    </View>
  );
}

// ─── BinGo Banner (won) ───────────────────────────────────────────────────────
function BingoBanner() {
  return (
    <View style={styles.bingoBanner}>
      <Text style={styles.bingoBannerText}>🎉 BinGo! You completed the card!</Text>
    </View>
  );
}

// ─── Card Squares ─────────────────────────────────────────────────────────────
function CardSquares({ card }: { card: CardProgress }) {
  const types: WasteType[] = ['wet', 'sanitary', 'dry', 'furniture', 'event'];
  return (
    <View style={styles.cardRow}>
      {types.map((t) => (
        <View
          key={t}
          style={[styles.cardSquare, card[t] ? styles.cardSquareDone : styles.cardSquareEmpty]}
        >
          <Text style={styles.cardSquareIcon}>
            {card[t] ? '✓' : WASTE_META[t].icon}
          </Text>
          <Text style={styles.cardSquareLabel}>{WASTE_META[t].label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Screen 1: Login ─────────────────────────────────────────────────────────
interface LoginProps {
  onLogin: (householdId: string) => void;
}

function LoginScreen({ onLogin }: LoginProps) {
  const [hhId, setHhId] = useState('');

  function handleEnter() {
    const trimmed = hhId.trim();
    if (!trimmed) {
      Alert.alert('Required', 'Please enter your Household ID (e.g. HH-101)');
      return;
    }
    onLogin(trimmed);
  }

  return (
    <View style={styles.centerContainer}>
      <DemoBanner />
      <Text style={styles.logo}>🗑️</Text>
      <Text style={styles.appTitle}>BinGo</Text>
      <Text style={styles.appSubtitle}>Smart Waste, Happy Streets</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Household ID</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. HH-101"
          value={hhId}
          onChangeText={setHhId}
          autoCapitalize="characters"
          returnKeyType="done"
          onSubmitEditing={handleEnter}
        />
        <Pressable style={styles.primaryBtn} onPress={handleEnter}>
          <Text style={styles.primaryBtnText}>Enter</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Screen 2: Home ───────────────────────────────────────────────────────────
interface HomeProps {
  householdId: string;
  card: CardProgress;
  streak: number;
  bingoWon: boolean;
  outOfStation: boolean;
  onScan: () => void;
  onHistory: () => void;
  onToggleOutOfStation: () => void;
}

function HomeScreen({
  householdId,
  card,
  streak,
  bingoWon,
  outOfStation,
  onScan,
  onHistory,
  onToggleOutOfStation,
}: HomeProps) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <DemoBanner />
      {bingoWon && <BingoBanner />}

      <Text style={styles.greeting}>Welcome, {householdId} 👋</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Your BinGo Card</Text>
        <CardSquares card={card} />
        <Text style={styles.streakText}>🔥 {streak}-day streak</Text>
      </View>

      <Pressable style={styles.primaryBtn} onPress={onScan}>
        <Text style={styles.primaryBtnText}>🔍 Scan Waste</Text>
      </Pressable>

      <Pressable style={styles.secondaryBtn} onPress={onHistory}>
        <Text style={styles.secondaryBtnText}>📋 View History</Text>
      </Pressable>

      <Pressable
        style={[styles.toggleBtn, outOfStation && styles.toggleBtnActive]}
        onPress={onToggleOutOfStation}
      >
        <Text style={[styles.toggleBtnText, outOfStation && styles.toggleBtnTextActive]}>
          {outOfStation ? '🏠 Back in Station' : '✈️ I\'m Out of Station'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

// ─── Screen 3: Scan ──────────────────────────────────────────────────────────
interface ScanProps {
  householdId: string;
  onResult: (result: ScanResult) => void;
  onBack: () => void;
}

function ScanScreen({ householdId, onResult, onBack }: ScanProps) {
  const [deepLink, setDeepLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    const raw = deepLink.trim();
    if (!raw) {
      setError('Please paste a deep-link or QR data first.');
      return;
    }
    setError('');
    setLoading(true);

    const { qrData, signature } = parseDeepLink(raw);

    try {
      if (isDemoMode()) {
        // Mock response — simulates a successful scan
        await new Promise<void>((r) => setTimeout(r, 800));
        const mockResult: ScanResult = {
          wasteType:            'wet',
          message:              'Wet waste logged successfully! Keep it up! 🌊',
          vehicleFillPercentage: 65,
          bingoWon:             false,
          updatedCard: {
            wet: true, sanitary: false, dry: false, furniture: false, event: false,
          },
        };
        onResult(mockResult);
        return;
      }

      const res = await fetch(`${API_BASE}/scans`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ qrData, signature, householdId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as ScanResult;
      onResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <DemoBanner />

      <Pressable style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backBtnText}>← Back</Text>
      </Pressable>

      <Text style={styles.screenTitle}>Scan Bay QR</Text>

      <View style={styles.card}>
        {/* Camera placeholder note */}
        <View style={styles.cameraNoteBox}>
          <Text style={styles.cameraNoteText}>
            📷 In production this opens the device camera.{'\n'}
            For the hackathon demo, paste the QR deep-link below.
          </Text>
        </View>

        <Text style={styles.label}>Paste QR deep-link here</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          placeholder="bingo://scan?data=...&sig=..."
          value={deepLink}
          onChangeText={setDeepLink}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
        />

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <Pressable
          style={styles.ghostBtn}
          onPress={() => setDeepLink(SAMPLE_DEEP_LINK)}
        >
          <Text style={styles.ghostBtnText}>📋 Fill sample deep-link</Text>
        </Pressable>

        <Pressable
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.primaryBtnText}>Submit Scan</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ─── Screen 4: Green Tick Result ─────────────────────────────────────────────
interface ScanResultProps {
  result: ScanResult;
  onDone: (updatedCard: CardProgress) => void;
}

function ScanResultScreen({ result, onDone }: ScanResultProps) {
  const meta = WASTE_META[result.wasteType];

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.resultIconWrap}>
        <Text style={styles.resultIcon}>{result.bingoWon ? '🎉' : '✅'}</Text>
      </View>

      {result.bingoWon && <BingoBanner />}

      <Text style={styles.resultWasteType}>
        {meta.icon} {meta.label} waste logged!
      </Text>
      <Text style={styles.resultMessage}>{result.message}</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Updated BinGo Card</Text>
        <CardSquares card={result.updatedCard} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Vehicle Status</Text>
        <View style={styles.fillBarBg}>
          {/* width accepts DimensionValue — `${n}%` is valid at runtime */}
          <View
            // eslint-disable-next-line react-native/no-inline-styles
            style={[styles.fillBarFg, { width: `${result.vehicleFillPercentage}%` as `${number}%` }]}
          />
        </View>
        <Text style={styles.fillBarLabel}>
          Vehicle {result.vehicleFillPercentage}% full
        </Text>
      </View>

      <Pressable style={styles.primaryBtn} onPress={() => onDone(result.updatedCard)}>
        <Text style={styles.primaryBtnText}>Done</Text>
      </Pressable>
    </ScrollView>
  );
}

// ─── Screen 5: History ───────────────────────────────────────────────────────
interface HistoryProps {
  householdId: string;
  onBack: () => void;
}

function HistoryScreen({ householdId, onBack }: HistoryProps) {
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch on mount
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      if (isDemoMode()) {
        await new Promise<void>((r) => setTimeout(r, 500));
        setRecords(MOCK_HISTORY);
        return;
      }
      const res = await fetch(`${API_BASE}/households/${householdId}/scans`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ScanRecord[];
      setRecords(data.length ? data : MOCK_HISTORY);
    } catch {
      setRecords(MOCK_HISTORY);
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  // Run fetchHistory once on mount
  React.useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return (
    <View style={styles.flex1}>
      <DemoBanner />
      <View style={styles.historyHeader}>
        <Pressable style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← Back</Text>
        </Pressable>
        <Text style={styles.screenTitle}>Scan History</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={C.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.scanId}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={[styles.card, styles.historyRow]}>
              <Text style={styles.historyIcon}>
                {WASTE_META[item.wasteType].icon}
              </Text>
              <View style={styles.historyInfo}>
                <Text style={styles.historyWaste}>
                  {WASTE_META[item.wasteType].label}
                </Text>
                <Text style={styles.historyTime}>{item.timestamp}</Text>
              </View>
              <Text style={styles.historyScanId}>{item.scanId}</Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No scans yet. Start scanning!</Text>
          }
        />
      )}
    </View>
  );
}

// ─── Root App ────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]           = useState<Screen>('Login');
  const [householdId, setHouseholdId] = useState('');
  const [card, setCard]               = useState<CardProgress>(INITIAL_CARD);
  const [streak]                      = useState(3);   // demo value
  const [bingoWon, setBingoWon]       = useState(false);
  const [outOfStation, setOutOfStation] = useState(false);
  const [scanResult, setScanResult]   = useState<ScanResult | null>(null);

  function handleLogin(id: string) {
    setHouseholdId(id);
    setScreen('Home');
  }

  function handleScanResult(result: ScanResult) {
    setScanResult(result);
    setBingoWon(result.bingoWon);
    setScreen('ScanResult');
  }

  function handleDone(updatedCard: CardProgress) {
    setCard(updatedCard);
    setScreen('Home');
  }

  async function handleToggleOutOfStation() {
    const next = !outOfStation;
    setOutOfStation(next);
    if (!isDemoMode()) {
      try {
        await fetch(`${API_BASE}/households/${householdId}/outofstation`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ outOfStation: next }),
        });
      } catch {
        // silently fail — local state already toggled
      }
    }
  }

  switch (screen) {
    case 'Login':
      return (
        <View style={styles.root}>
          <StatusBar style="dark" />
          <LoginScreen onLogin={handleLogin} />
        </View>
      );

    case 'Home':
      return (
        <View style={styles.root}>
          <StatusBar style="dark" />
          <HomeScreen
            householdId={householdId}
            card={card}
            streak={streak}
            bingoWon={bingoWon}
            outOfStation={outOfStation}
            onScan={() => setScreen('Scan')}
            onHistory={() => setScreen('History')}
            onToggleOutOfStation={handleToggleOutOfStation}
          />
        </View>
      );

    case 'Scan':
      return (
        <View style={styles.root}>
          <StatusBar style="dark" />
          <ScanScreen
            householdId={householdId}
            onResult={handleScanResult}
            onBack={() => setScreen('Home')}
          />
        </View>
      );

    case 'ScanResult':
      return (
        <View style={styles.root}>
          <StatusBar style="dark" />
          {scanResult && (
            <ScanResultScreen result={scanResult} onDone={handleDone} />
          )}
        </View>
      );

    case 'History':
      return (
        <View style={styles.root}>
          <StatusBar style="dark" />
          <HistoryScreen
            householdId={householdId}
            onBack={() => setScreen('Home')}
          />
        </View>
      );
  }
}

// ─── Design Tokens ───────────────────────────────────────────────────────────
const C = {
  bg:       '#F0FBF4',
  primary:  '#16A34A',
  surface:  '#FFFFFF',
  textMain: '#1A1A1A',
  textMute: '#6B7280',
  danger:   '#DC2626',
  warn:     '#D97706',
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  flex1: { flex: 1, backgroundColor: C.bg },

  // Containers
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg,
    padding: 24,
  },
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: C.bg,
    padding: 20,
    paddingTop: 56,
  },
  listContent: { padding: 20, paddingTop: 8 },

  // Logo / title
  logo: { fontSize: 64, marginBottom: 8 },
  appTitle: { fontSize: 36, fontWeight: '800', color: C.primary },
  appSubtitle: { fontSize: 14, color: C.textMute, marginBottom: 32 },

  // Generic card
  card: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  // BinGo card squares
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 12,
  },
  cardSquare: {
    width: 58,
    height: 68,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSquareDone:  { backgroundColor: C.primary },
  cardSquareEmpty: { backgroundColor: '#E5E7EB' },
  cardSquareIcon:  { fontSize: 20 },
  cardSquareLabel: { fontSize: 10, marginTop: 4, color: C.textMain, fontWeight: '600' },

  // Streak
  streakText: { fontSize: 18, fontWeight: '700', color: C.warn, textAlign: 'center' },

  // Greeting
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: C.textMain,
    marginBottom: 16,
  },

  // Buttons
  primaryBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnDisabled:    { opacity: 0.6 },

  secondaryBtn: {
    backgroundColor: C.surface,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: C.primary,
  },
  secondaryBtnText: { color: C.primary, fontSize: 16, fontWeight: '700' },

  toggleBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  toggleBtnActive:    { backgroundColor: '#FEF3C7', borderWidth: 1.5, borderColor: C.warn },
  toggleBtnText:      { color: C.textMute, fontSize: 15, fontWeight: '600' },
  toggleBtnTextActive:{ color: C.warn },

  ghostBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 12,
  },
  ghostBtnText: { color: C.primary, fontSize: 14, textDecorationLine: 'underline' },

  backBtn: { marginBottom: 12 },
  backBtnText: { color: C.primary, fontSize: 15, fontWeight: '600' },

  // Inputs
  label: { fontSize: 14, fontWeight: '600', color: C.textMain, marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: '#D1FAE5',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: C.textMain,
    backgroundColor: '#F9FAFB',
    marginBottom: 14,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },

  // Banners
  demoBanner: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderRadius: 6,
  },
  demoBannerText: { color: C.textMute, fontSize: 12, textAlign: 'center' },

  bingoBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: C.warn,
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  bingoBannerText: { fontSize: 18, fontWeight: '800', color: C.warn },

  // Screen titles
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: C.textMain,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.textMain,
    marginBottom: 4,
  },

  // Camera note
  cameraNoteBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  cameraNoteText: { color: C.textMute, fontSize: 13, lineHeight: 19 },

  // Error
  errorText: { color: C.danger, fontSize: 13, marginBottom: 10 },

  // Scan Result
  resultIconWrap: { alignItems: 'center', marginBottom: 12 },
  resultIcon:     { fontSize: 80 },
  resultWasteType: {
    fontSize: 22,
    fontWeight: '700',
    color: C.textMain,
    textAlign: 'center',
    marginBottom: 6,
  },
  resultMessage: {
    fontSize: 15,
    color: C.textMute,
    textAlign: 'center',
    marginBottom: 20,
  },

  // Fill bar
  fillBarBg: {
    height: 14,
    backgroundColor: '#E5E7EB',
    borderRadius: 7,
    overflow: 'hidden',
    marginTop: 8,
  },
  fillBarFg: {
    height: '100%',
    backgroundColor: C.primary,
    borderRadius: 7,
  },
  fillBarLabel: { color: C.textMute, fontSize: 13, marginTop: 6, textAlign: 'right' },

  // History
  historyHeader: { padding: 20, paddingTop: 56, backgroundColor: C.bg },
  historyRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 0 },
  historyIcon:   { fontSize: 28, marginRight: 12 },
  historyInfo:   { flex: 1 },
  historyWaste:  { fontSize: 15, fontWeight: '600', color: C.textMain },
  historyTime:   { fontSize: 12, color: C.textMute, marginTop: 2 },
  historyScanId: { fontSize: 11, color: C.textMute },

  loader:    { marginTop: 60 },
  emptyText: { textAlign: 'center', color: C.textMute, marginTop: 40, fontSize: 15 },
});
