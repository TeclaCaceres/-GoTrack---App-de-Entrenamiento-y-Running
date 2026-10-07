import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  AppState,
  StyleSheet,
  TextInput,
  ScrollView,
  StatusBar,
  Alert,
  View,
  TouchableOpacity,
  Animated,
  Easing,
  useWindowDimensions,
  Image,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import { useFonts } from 'expo-font';
import { SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium, JetBrainsMono_600SemiBold, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import Svg, { Circle, Path } from 'react-native-svg';
import * as Speech from 'expo-speech';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config';
import { Pedometer } from 'expo-sensors';
import * as SQLite from 'expo-sqlite';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import {
  Button as PaperButton,
  Card,
  Text,
  Provider as PaperProvider,
  Divider,
  configureFonts,
} from 'react-native-paper';

const F = {
  heading: 'SpaceGrotesk_600SemiBold',
  headingMed: 'SpaceGrotesk_500Medium',
  headingBold: 'SpaceGrotesk_700Bold',
  sans: 'Inter_400Regular',
  sansMed: 'Inter_500Medium',
  sansSem: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
  mono: 'JetBrainsMono_400Regular',
  monoMed: 'JetBrainsMono_500Medium',
  monoSem: 'JetBrainsMono_600SemiBold',
  monoBold: 'JetBrainsMono_700Bold',
};

// Typescale completo de react-native-paper (MD3) con las familias de marca.
// Sin esto, los `variant="labelLarge"` etc. rompen porque theme.fonts los pierde.
const paperFonts = (() => {
  const base = configureFonts({ config: { fontFamily: F.sans } });
  const withFamily = (key, family) => ({ ...base[key], fontFamily: family });
  return {
    ...base,
    displayLarge: withFamily('displayLarge', F.headingBold),
    displayMedium: withFamily('displayMedium', F.headingBold),
    displaySmall: withFamily('displaySmall', F.headingBold),
    headlineLarge: withFamily('headlineLarge', F.headingBold),
    headlineMedium: withFamily('headlineMedium', F.heading),
    headlineSmall: withFamily('headlineSmall', F.heading),
    titleLarge: withFamily('titleLarge', F.heading),
    titleMedium: withFamily('titleMedium', F.heading),
    titleSmall: withFamily('titleSmall', F.heading),
    labelLarge: withFamily('labelLarge', F.sansSem),
    labelMedium: withFamily('labelMedium', F.sansMed),
    labelSmall: withFamily('labelSmall', F.sansMed),
  };
})();

// Identidad GoTrack v2 (base: referencias Sleek "Pulse Performance")
const PALETTE = {
  bg: '#0E0F0C',
  fg: '#F4F2EC',
  card: '#1B1D18',
  cardTint: '#171914',
  popover: '#20221D',
  muted: '#2A2C26',
  mapSurface: '#12140F',
  border: '#30332C',
  primary: '#D7FE47',
  onPrimary: '#0E0F0C',
  accent: '#FF5A1F',
  onAccent: '#F4F2EC',
  destructive: '#E5484D',
  mutedFg: '#92958A',
  routeDim: '#373B30',
  chart: '#8A8D82',
  textSoft: '#B7C0A4',
};

const DARK = {
  dark: true,
  colors: {
    primary: PALETTE.primary,
    onPrimary: PALETTE.onPrimary,
    background: PALETTE.bg,
    surface: PALETTE.card,
    surfaceVariant: PALETTE.popover,
    onSurface: PALETTE.fg,
    onSurfaceVariant: PALETTE.mutedFg,
    outline: PALETTE.border,
    error: PALETTE.destructive,
    accent: PALETTE.accent,
    onAccent: PALETTE.onAccent,
    mapSurface: PALETTE.mapSurface,
    cardTint: PALETTE.cardTint,
    muted: PALETTE.muted,
    routeDim: PALETTE.routeDim,
    textSoft: PALETTE.textSoft,
  },
  fonts: paperFonts,
};

const LIGHT = {
  dark: false,
  colors: {
    primary: '#B8E330',
    onPrimary: '#0E0F0C',
    background: '#F4F2EC',
    surface: '#FFFFFF',
    surfaceVariant: '#ECEBE4',
    onSurface: '#1A1C17',
    onSurfaceVariant: '#6E7068',
    outline: '#D8D6CC',
    error: '#C33D43',
    accent: '#FF5A1F',
    onAccent: '#FFFFFF',
    mapSurface: '#EDEBE2',
    cardTint: '#F7F6F0',
    muted: '#E4E2D8',
    routeDim: '#CDB79E',
    textSoft: '#55604A',
  },
  fonts: paperFonts,
};

const ACTIVE_WORKOUT_KEY = '@gotrack_active_workout';

// ── Supabase (respaldo en la nube) ───────────────────────────────────────────
const supabaseAvail = !!(
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  SUPABASE_URL.includes('.supabase.co') &&
  !SUPABASE_ANON_KEY.includes('TU-')
);
const supabase = supabaseAvail
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: AsyncStorage,
      },
    })
  : null;

const META_CONF = {
  DISTANCIA: { icon: 'navigate-outline', subtitle: 'Cuántos km por semana', unit: 'km', chips: ['10', '20', '30', '40', '50'], placeholder: 'Ej: 20', keyboard: 'numeric' },
  RITMO: { icon: 'speedometer-outline', subtitle: 'Ritmo objetivo (mm:ss)', unit: '/km', chips: ['04:30', '05:00', '05:30', '06:00'], placeholder: 'Ej: 05:30', keyboard: 'default' },
  FRECUENCIA: { icon: 'calendar-outline', subtitle: 'Sesiones por semana', unit: 'veces', chips: ['2', '3', '4', '5'], placeholder: 'Ej: 3', keyboard: 'numeric' },
};

// Aros animados (identidad Pulse Performance: anillos en overlays y esfera)
const SpinRing = ({ inset = 8, color = 'rgba(215,254,71,0.22)', duration = 9000 }) => {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(value, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [value, duration]);
  const rotate = value.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', top: -inset, left: -inset, right: -inset, bottom: -inset, borderRadius: 999, borderWidth: 1, borderColor: color, transform: [{ rotate }] }}
    />
  );
};

const PulseRing = ({ inset = 12, color = 'rgba(215,254,71,0.32)', scaleMax = 1.08 }) => {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [value]);
  const scale = value.interpolate({ inputRange: [0, 1], outputRange: [1, scaleMax] });
  const opacity = value.interpolate({ inputRange: [0, 1], outputRange: [0.85, 0] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', top: -inset, left: -inset, right: -inset, bottom: -inset, borderRadius: 999, borderWidth: 2, borderColor: color, opacity, transform: [{ scale }] }}
    />
  );
};

// Mapa estilizado del diseño (Pulse Performance): reticula punteada, ruta SVG gris+lima,
// punto de posición con onda "ping" y pill de ritmo medio. Si hay puntos GPS reales,
// dibuja la ruta real normalizada al viewBox del diseño.

// ── Precarga: pantalla de arranque con identidad mientras cargan fuentes, SQLite y nube ──
const PreloadScreen = ({ isDarkMode }) => {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.24] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });
  const bg = isDarkMode ? '#0E0F0C' : '#F4F2EC';
  const fg = isDarkMode ? '#F4F2EC' : '#0E0F0C';
  return (
    <View style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 128, height: 128, alignItems: 'center', justifyContent: 'center' }}>
        <Image source={require('./assets/icon.png')} style={{ width: 92, height: 92, borderRadius: 22 }} resizeMode="contain" />
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', top: -6, left: -6, right: -6, bottom: -6, borderRadius: 999, borderWidth: 2, borderColor: '#D7FE47', opacity, transform: [{ scale }] }}
        />
      </View>
      <Text style={{ fontSize: 26, fontWeight: '800', letterSpacing: -0.5, color: fg, marginTop: 20 }}>GoTrack</Text>
      <Text style={{ fontSize: 11, letterSpacing: 2.4, color: isDarkMode ? '#92958A' : '#55604A', marginTop: 8 }}>PREPARANDO TODO…</Text>
    </View>
  );
};

// ── Intros: onboarding swipeable, se muestra solo la primera vez ──
const INTRO_SLIDES = [
  {
    emoji: '🏃',
    title: 'Bienvenido a GoTrack',
    text: 'Corré, sumá kilómetros y seguí tu evolución. Todo en un solo lugar.',
  },
  {
    emoji: '🗺️',
    title: 'Mapa GPS en vivo',
    text: 'Tu ruta se dibuja sobre un mapa real mientras corrés, incluso sin datos.',
  },
  {
    emoji: '🌤️',
    title: 'Respaldo en la nube',
    text: 'Creá una cuenta (opcional) y tu historial te sigue en cualquier teléfono.',
  },
];

const IntroScreen = ({ isDarkMode, onFinish }) => {
  const scrollRef = useRef(null);
  const [page, setPage] = useState(0);
  const { width } = useWindowDimensions();
  const bg = isDarkMode ? '#0E0F0C' : '#F4F2EC';
  const fg = isDarkMode ? '#F4F2EC' : '#0E0F0C';
  const sub = isDarkMode ? '#92958A' : '#55604A';
  const cardBg = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';

  const goTo = (i) => {
    const next = Math.max(0, Math.min(INTRO_SLIDES.length - 1, i));
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    setPage(next);
  };

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={bg} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 8 }}>
          <TouchableOpacity onPress={onFinish} style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', letterSpacing: 1, color: sub }}>SALTAR</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          style={{ flex: 1 }}
        >
          {INTRO_SLIDES.map((s) => (
            <View key={s.title} style={{ width, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 }}>
              <View
                style={{
                  width: 160,
                  height: 160,
                  borderRadius: 80,
                  backgroundColor: cardBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(215,254,71,0.35)',
                }}
              >
                <Text style={{ fontSize: 64 }}>{s.emoji}</Text>
              </View>
              <Text style={{ fontSize: 26, fontWeight: '800', letterSpacing: -0.5, color: fg, fontFamily: F.sansBold, textAlign: 'center', marginTop: 34 }}>{s.title}</Text>
              <Text style={{ fontSize: 15, lineHeight: 22, color: sub, textAlign: 'center', marginTop: 12, maxWidth: 300 }}>{s.text}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 34, paddingTop: 12 }}>
          <View style={{ flexDirection: 'row', gap: 7, flex: 1 }}>
            {INTRO_SLIDES.map((_, i) => (
              <View key={i} style={{ width: page === i ? 22 : 7, height: 7, borderRadius: 999, backgroundColor: page === i ? '#D7FE47' : sub, opacity: page === i ? 1 : 0.4 }} />
            ))}
          </View>
          {page < INTRO_SLIDES.length - 1 ? (
            <TouchableOpacity onPress={() => goTo(page + 1)} style={{ backgroundColor: '#D7FE47', borderRadius: 999, paddingVertical: 14, paddingHorizontal: 28 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', letterSpacing: 1, color: '#0E0F0C' }}>SIGUIENTE →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={onFinish} style={{ backgroundColor: '#D7FE47', borderRadius: 999, paddingVertical: 14, paddingHorizontal: 28 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', letterSpacing: 1, color: '#0E0F0C' }}>EMPEZAR 🏁</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
};

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
  });
  const [activeScreen, setActiveScreen] = useState('home');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [prepTime, setPrepTime] = useState(3);
  const [countdownValue, setCountdownValue] = useState(null);

  const [locationList, setLocationList] = useState([]);
  const [stepCount, setStepCount] = useState(0);
  const [cadence, setCadence] = useState(0);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [pedometerEnabled, setPedometerEnabled] = useState(true);

  const [notes, setNotes] = useState('');
  const [surface, setSurface] = useState('asfalto');
  const [feeling, setFeeling] = useState('😀 Excelente');
  const [showSaveModal, setShowSaveModal] = useState(false);

  const [history, setHistory] = useState([]);
  const [profile, setProfile] = useState({
    name: 'Atleta GoTrack',
    height: '175',
    weight: '70',
    avatar: '🏃‍♂️',
    avatarPhoto: null,
    bio: 'Entrenando para mi mejor marca personal.',
    age: '',
    city: '',
    level: 'intermedio',
    goalType: 'km',
    goalValue: '20',
    goalPace: '05:30',
    planGoal: '10K',
    planLevel: 'intermedio',
    metaDist: '',
    metaRitmo: '',
    metaFrec: '',
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [metaModal, setMetaModal] = useState(null);
  const [metaDraft, setMetaDraft] = useState('');
  const [newsScroll, setNewsScroll] = useState(0);
  const [bootReady, setBootReady] = useState(false);
  const [introDone, setIntroDone] = useState(null); // null = todavía no se leyó
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');

  const startTimeRef = useRef(0);
  const accumulatedTimeRef = useRef(0);
  const requestRef = useRef(null);
  const locationSubRef = useRef(null);
  const pedometerSubRef = useRef(null);
  const webViewRef = useRef(null);
  const deviceIdRef = useRef(null);
  const dbRef = useRef(null);
  const totalStepsRef = useRef(0);
  const lastPedometerStepsRef = useRef(null);
  const stepTimesRef = useRef([]);
  const runningRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const countdownIntervalRef = useRef(null);
  const saveSnapshotRef = useRef(null);
  const resumeTimerRef = useRef(null);

  const theme = isDarkMode ? DARK : LIGHT;

  useEffect(() => {
    initDatabase();
    restoreWorkout();
    return () => {
      cancelAnimationFrame(requestRef.current);
      stopSensors();
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const pickAvatarPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permiso de fotos', 'Necesitamos acceso a tus fotos para elegir el avatar.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setProfile((prev) => ({ ...prev, avatarPhoto: result.assets[0].uri }));
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo cargar la foto.');
    }
  };

  const openMetaEditor = (key) => {
    setMetaDraft(
      key === 'DISTANCIA' ? profile.metaDist : key === 'RITMO' ? profile.metaRitmo : profile.metaFrec
    );
    setMetaModal(key);
  };

  const saveMeta = () => {
    const val = metaDraft.trim();
    if (metaModal === 'DISTANCIA') setProfile({ ...profile, metaDist: val });
    if (metaModal === 'RITMO') setProfile({ ...profile, metaRitmo: val });
    if (metaModal === 'FRECUENCIA') setProfile({ ...profile, metaFrec: val });
    setMetaModal(null);
  };

  const initDatabase = async () => {
    deviceIdRef.current = await getDeviceId();
    let sessionUid = null;
    if (supabase) {
      try {
        const { data } = await supabase.auth.getSession();
        sessionUid = data?.session?.user?.id ?? null;
        setUser(data?.session?.user ?? null);
      } catch (e) {
        console.error('Error leyendo sesión de Supabase', e);
      }
    }
    try {
      const raw = await AsyncStorage.getItem('@gotrack_intro_done');
      setIntroDone(raw === '1');
    } catch (e) {
      setIntroDone(false);
    }
    try {
      const db = SQLite.openDatabaseSync('gotrack.db');
      dbRef.current = db;
      db.execSync(`
        CREATE TABLE IF NOT EXISTS runs (
          id TEXT PRIMARY KEY NOT NULL,
          date TEXT,
          duration INTEGER,
          surface TEXT,
          feeling TEXT,
          notes TEXT,
          steps INTEGER,
          locations TEXT
        );
      `);
    } catch (e) {
      console.error('SQLite no disponible, usando AsyncStorage', e);
      dbRef.current = null;
    }
    await loadDatabaseRuns();
    // Respaldo en la nube: bajá lo que haya y unilo con lo local
    const cloud = await pullRunsFromCloud(sessionUid);
    if (cloud) {
      setHistory((prev) => mergeRunsLists(prev, cloud));
      backfillLocalRunsToCloud(cloud, sessionUid);
    }
    setBootReady(true);
  };

  const backfillLocalRunsToCloud = async (cloud, uid) => {
    if (!supabase || !cloud) return;
    const cloudIds = new Set(cloud.map((r) => r.id));
    let local = [];
    if (dbRef.current) {
      try {
        local = dbRef.current.getAllSync('SELECT * FROM runs');
      } catch (e) {
        console.error('Error leyendo SQLite para backfill', e);
      }
    }
    if (local.length === 0) {
      try {
        const raw = await AsyncStorage.getItem('@gotrack_runs');
        if (raw) local = JSON.parse(raw);
      } catch (e) {}
    }
    const pendientes = local.filter((r) => !cloudIds.has(r.id));
    pendientes.forEach((r) => pushRunToCloud(r, uid));
    if (pendientes.length > 0) {
      console.log(`GoTrack: subiendo ${pendientes.length} carreras al respaldo en la nube`);
    }
  };

  const loadDatabaseRuns = async () => {
    if (dbRef.current) {
      try {
        const allRows = dbRef.current.getAllSync('SELECT * FROM runs ORDER BY date DESC;');
        setHistory(allRows);
        return;
      } catch (e) {
        console.error('Error leyendo SQLite, usando AsyncStorage', e);
      }
    }
    try {
      const raw = await AsyncStorage.getItem('@gotrack_runs');
      const rows = raw ? JSON.parse(raw) : [];
      rows.sort((a, b) => new Date(b.date) - new Date(a.date));
      setHistory(rows);
    } catch (e) {
      console.error('Error cargando historial de AsyncStorage', e);
    }
  };

  const persistRunsFallback = async (runs) => {
    try {
      await AsyncStorage.setItem('@gotrack_runs', JSON.stringify(runs));
    } catch (e) {
      console.error('Error guardando en AsyncStorage', e);
    }
  };

  const getDeviceId = async () => {
    try {
      let id = await AsyncStorage.getItem('@gotrack_device_id');
      if (!id) {
        id = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        await AsyncStorage.setItem('@gotrack_device_id', id);
      }
      return id;
    } catch (e) {
      return `dev-${Date.now().toString(36)}`;
    }
  };

  // ── Supabase: respaldo en la nube (no bloquea si no está configurado) ──
  const pushRunToCloud = async (run, uid) => {
    if (!supabase || !deviceIdRef.current) return;
    const owner = uid !== undefined ? uid : user ? user.id : null;
    try {
      await supabase
        .from('runs')
        .upsert({ ...run, device_id: deviceIdRef.current, user_id: owner }, { onConflict: 'id' });
    } catch (e) {
      console.error('Error subiendo carrera a Supabase', e);
    }
  };

  const pullRunsFromCloud = async (uid) => {
    if (!supabase) return null;
    const selector = uid || (user ? user.id : deviceIdRef.current);
    if (!selector) return null;
    try {
      const query = supabase
        .from('runs')
        .select('*')
        .order('date', { ascending: false });
      const res = uid || user
        ? await query.eq('user_id', selector)
        : await query.eq('device_id', selector);
      const { data } = res;
      if (!data) return null;
      return data.map(({ device_id, synced_at, ...run }) => run);
    } catch (e) {
      console.error('Error bajando historial de Supabase', e);
      return null;
    }
  };

  const deleteRunInCloud = async (id) => {
    if (!supabase) return;
    try {
      let q = supabase.from('runs').delete().eq('id', id);
      q = user
        ? q.eq('user_id', user.id)
        : q.eq('device_id', deviceIdRef.current);
      await q;
    } catch (e) {
      console.error('Error borrando en Supabase', e);
    }
  };

  const mergeRunsLists = (local, cloud) => {
    const byId = new Map();
    (cloud || []).forEach((r) => byId.set(r.id, r));
    (local || []).forEach((r) => byId.set(r.id, r)); // local gana ante el mismo id
    return Array.from(byId.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  // ── Supabase: sesión opcional (la app funciona igual sin cuenta) ──
  useEffect(() => {
    if (!supabase) return;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const claimDeviceRuns = async (userId) => {
    if (!supabase || !userId || !deviceIdRef.current) return;
    try {
      const { data } = await supabase
        .from('runs')
        .select('id')
        .eq('device_id', deviceIdRef.current)
        .is('user_id', null);
      if (data && data.length > 0) {
        await supabase
          .from('runs')
          .update({ user_id: userId })
          .eq('device_id', deviceIdRef.current)
          .is('user_id', null);
      }
    } catch (e) {
      console.error('Error reclamando carreras a la cuenta', e);
    }
  };

  const handleAuth = async () => {
    if (!supabase) {
      Alert.alert('Nube no configurada', 'Completá SUPABASE_URL y SUPABASE_ANON_KEY en supabase-config.js');
      return;
    }
    setAuthBusy(true);
    setAuthError('');
    try {
      const email = authEmail.trim().toLowerCase();
      const password = authPassword;
      if (!email || !/^\S+@\S+\.\S+$/.test(email) || password.length < 6) {
        setAuthError('Ingresá un email válido y una contraseña de al menos 6 caracteres.');
        setAuthBusy(false);
        return;
      }
      const res =
        authMode === 'login'
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });
      if (res.error) {
        setAuthError(res.error.message);
      } else if (authMode === 'login' || res.data.session) {
        const uid = res.data.session.user.id;
        setUser(res.data.session.user);
        claimDeviceRuns(uid).catch(() => {});
        const cloud = await pullRunsFromCloud(uid);
        if (cloud) setHistory((prev) => mergeRunsLists(prev, cloud));
        setAuthEmail('');
        setAuthPassword('');
        setShowAuthModal(false);
      } else {
        // signUp con confirmación por email habilitada
        Alert.alert('Revisá tu email', 'Te mandamos un link de confirmación. Confirmalo y después iniciá sesión desde acá.');
        setAuthMode('login');
      }
    } catch (e) {
      setAuthError('No se pudo conectar. Revisá la conexión e intentá de nuevo.');
    }
    setAuthBusy(false);
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    // El historial queda como está en el dispositivo; al volver a entrar se re-sincroniza con la cuenta.
  };

  const finishIntros = async () => {
    try {
      await AsyncStorage.setItem('@gotrack_intro_done', '1');
    } catch (e) {}
    setIntroDone(true);
  };

  const computeElapsed = () =>
    accumulatedTimeRef.current + (runningRef.current ? Date.now() - startTimeRef.current : 0);

  const saveWorkoutSnapshot = async () => {
    try {
      const raw = JSON.stringify({
        running: runningRef.current,
        elapsedTime: computeElapsed(),
        stepCount: totalStepsRef.current,
        cadence,
        totalSteps: totalStepsRef.current,
        lastPedometerSteps: lastPedometerStepsRef.current,
        locationList,
        gpsEnabled,
        pedometerEnabled,
        prepTime,
        isLocked,
        notes,
        surface,
        feeling,
        isDarkMode,
      });
      await AsyncStorage.setItem(ACTIVE_WORKOUT_KEY, raw);
    } catch (e) {
      console.error('Error guardando sesión activa', e);
    }
  };

  const restoreWorkout = async () => {
    try {
      const raw = await AsyncStorage.getItem(ACTIVE_WORKOUT_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      const restarted = Number(s.elapsedTime) || 0;
      accumulatedTimeRef.current = restarted;
      totalStepsRef.current = Number(s.totalSteps) || 0;
      lastPedometerStepsRef.current = s.lastPedometerSteps ?? null;
      setElapsedTime(restarted);
      setStepCount(totalStepsRef.current);
      setCadence(Number(s.cadence) || 0);
      setLocationList(Array.isArray(s.locationList) ? s.locationList : []);
      setGpsEnabled(!!s.gpsEnabled);
      setPedometerEnabled(s.pedometerEnabled !== false);
      setPrepTime(Number(s.prepTime) || 3);
      setIsLocked(!!s.isLocked);
      setNotes(s.notes || '');
      setSurface(s.surface || 'asfalto');
      setFeeling(s.feeling || '😀 Excelente');
      setIsDarkMode(!!s.isDarkMode);

      if (s.running) {
        // Volvió en carrera: retomamos el cronómetro y los sensores desde acá
        startTimeRef.current = Date.now();
        runningRef.current = true;
        setIsRunning(true);
        setActiveScreen('run');
        cancelAnimationFrame(requestRef.current);
        requestRef.current = requestAnimationFrame(updateTimer);
        activateKeepAwakeAsync().catch(() => {});
        startSensors();
      } else if (restarted > 0) {
        // Quedó en pausa: mostramos la pantalla de correr para guardar o retomar
        setActiveScreen('run');
      } else {
        await AsyncStorage.removeItem(ACTIVE_WORKOUT_KEY);
      }
    } catch (e) {
      console.error('Error restaurando sesión activa', e);
    }
  };

  // Referencias siempre actualizadas para usarlas desde el listener de AppState
  saveSnapshotRef.current = saveWorkoutSnapshot;
  resumeTimerRef.current = () => {
    if (runningRef.current) {
      setElapsedTime(accumulatedTimeRef.current + (Date.now() - startTimeRef.current));
      cancelAnimationFrame(requestRef.current);
      requestRef.current = requestAnimationFrame(updateTimer);
    } else {
      setElapsedTime(accumulatedTimeRef.current);
    }
  };

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      if (nextState === 'background' || nextState === 'inactive') {
        // Congelamos el loop visual y guardamos un snapshot del estado
        cancelAnimationFrame(requestRef.current);
        if (saveSnapshotRef.current) saveSnapshotRef.current();
      } else if (nextState === 'active' && prev !== 'active') {
        if (resumeTimerRef.current) resumeTimerRef.current();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (webViewRef.current && locationList.length > 0) {
      const message = JSON.stringify({
        type: 'UPDATE_LOCATIONS',
        coords: locationList,
        isDarkMode
      });
      webViewRef.current.postMessage(message);
    }
  }, [locationList, isDarkMode]);

  const updateTimer = () => {
    const now = Date.now();
    const currentElapsed = accumulatedTimeRef.current + (now - startTimeRef.current);
    setElapsedTime(currentElapsed);
    requestRef.current = requestAnimationFrame(updateTimer);
  };

  const startClock = async () => {
    startTimeRef.current = Date.now();
    runningRef.current = true;
    setIsRunning(true);
    cancelAnimationFrame(requestRef.current);
    requestRef.current = requestAnimationFrame(updateTimer);
    await activateKeepAwakeAsync();
    startSensors();
    saveWorkoutSnapshot();
  };

  const pauseClock = async () => {
    cancelAnimationFrame(requestRef.current);
    accumulatedTimeRef.current = accumulatedTimeRef.current + (Date.now() - startTimeRef.current);
    runningRef.current = false;
    setIsRunning(false);
    await deactivateKeepAwake();
    stopSensors();
    saveWorkoutSnapshot();
  };

  const stopClockAndReset = async () => {
    cancelAnimationFrame(requestRef.current);
    accumulatedTimeRef.current = computeElapsed();
    runningRef.current = false;
    setIsRunning(false);
    await deactivateKeepAwake();
    stopSensors();
    setShowSaveModal(true);
    saveWorkoutSnapshot();
  };

  const startSensors = async () => {
    if (gpsEnabled) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        locationSubRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 3 },
          (loc) => {
            const { latitude, longitude } = loc.coords;
            setLocationList((prev) => [...prev, [latitude, longitude]]);
          }
        );
      }
    }

    if (pedometerEnabled) {
      const isAvailable = await Pedometer.isAvailableAsync();
      if (isAvailable) {
        lastPedometerStepsRef.current = null;
        pedometerSubRef.current = Pedometer.watchStepCount((result) => {
          if (lastPedometerStepsRef.current === null) {
            lastPedometerStepsRef.current = result.steps;
          } else {
            const delta = result.steps - lastPedometerStepsRef.current;
            if (delta > 0) {
              totalStepsRef.current += delta;
              lastPedometerStepsRef.current = result.steps;
              stepTimesRef.current.push(Date.now());
              setStepCount(totalStepsRef.current);
            }
          }
          const now = Date.now();
          stepTimesRef.current = stepTimesRef.current.filter((t) => now - t < 60000);
          setCadence(stepTimesRef.current.length);
        });
      }
    }
  };

  const stopSensors = () => {
    if (locationSubRef.current) locationSubRef.current.remove();
    if (pedometerSubRef.current) pedometerSubRef.current.remove();
  };

  const handleStartCountdown = () => {
    if (isRunning || countdownValue !== null) return;

    if (prepTime === 0) {
      Speech.stop();
      Speech.speak('¡Ya!', { language: 'es-AR', rate: 1.2 });
      startClock();
      return;
    }

    let count = prepTime;
    setCountdownValue(count);
    Speech.stop();
    Speech.speak(`Salida en ${count}`, { language: 'es-AR', rate: 1.0 });

    const interval = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdownValue(count);
        Speech.stop();
        Speech.speak(`${count}`, { language: 'es-AR', rate: 1.1 });
      } else {
        clearInterval(interval);
        countdownIntervalRef.current = null;
        setCountdownValue(null);
        Speech.stop();
        Speech.speak('¡Ya!', { language: 'es-AR', rate: 1.2 });
        startClock();
      }
    }, 1000);
    countdownIntervalRef.current = interval;
  };

  const cancelCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    Speech.stop();
    setCountdownValue(null);
  };

  const handleSaveRun = async () => {
    const id = Date.now().toString();
    const date = new Date().toISOString();
    const locationsJson = JSON.stringify(locationList);
    const duration = computeElapsed();

    if (dbRef.current) {
      try {
        dbRef.current.runSync(
          'INSERT INTO runs (id, date, duration, surface, feeling, notes, steps, locations) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [id, date, duration, surface, feeling, notes, stepCount, locationsJson]
        );
        loadDatabaseRuns();
      } catch (e) {
        console.error('Error insertando carrera en SQLite', e);
        const nueva = { id, date, duration, surface, feeling, notes, steps: stepCount, locations: locationsJson };
        const nuevoHistorial = [nueva, ...history];
        setHistory(nuevoHistorial);
        persistRunsFallback(nuevoHistorial);
      }
    } else {
      const nueva = { id, date, duration, surface, feeling, notes, steps: stepCount, locations: locationsJson };
      const nuevoHistorial = [nueva, ...history];
      setHistory(nuevoHistorial);
      persistRunsFallback(nuevoHistorial);
    }

    pushRunToCloud({ id, date, duration, surface, feeling, notes, steps: stepCount, locations: locationsJson });

    setNotes('');
    setElapsedTime(0);
    setStepCount(0);
    setCadence(0);
    totalStepsRef.current = 0;
    lastPedometerStepsRef.current = null;
    stepTimesRef.current = [];
    setLocationList([]);
    accumulatedTimeRef.current = 0;
    runningRef.current = false;
    await AsyncStorage.removeItem(ACTIVE_WORKOUT_KEY);
    setShowSaveModal(false);
    setIsLocked(false);
  };

  const handleDeleteRun = async (id) => {
    Alert.alert('Eliminar carrera', '¿Estás seguro de borrar este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          deleteRunInCloud(id);
          if (dbRef.current) {
            try {
              dbRef.current.runSync('DELETE FROM runs WHERE id = ?', [id]);
              loadDatabaseRuns();
            } catch (e) {
              console.error('Error borrando en SQLite', e);
              const nuevoHistorial = history.filter((r) => r.id !== id);
              setHistory(nuevoHistorial);
              persistRunsFallback(nuevoHistorial);
            }
          } else {
            const nuevoHistorial = history.filter((r) => r.id !== id);
            setHistory(nuevoHistorial);
            persistRunsFallback(nuevoHistorial);
          }
        },
      },
    ]);
  };

  const exportToGPX = async (run) => {
    try {
      const coords = JSON.parse(run.locations || '[]');
      let trkpt = '';
      coords.forEach(([lat, lon]) => {
        trkpt += `<trkpt lat="${lat}" lon="${lon}"></trkpt>\n`;
      });

      const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GoTrack">
  <trk>
    <name>Carrera ${new Date(run.date).toLocaleDateString()}</name>
    <trkseg>
      ${trkpt}
    </trkseg>
  </trk>
</gpx>`;

      const fileUri = FileSystem.documentDirectory + `Carrera_${run.id}.gpx`;
      await FileSystem.writeAsStringAsync(fileUri, gpxContent);
      await Sharing.shareAsync(fileUri);
    } catch (e) {
      Alert.alert('Error', 'No se pudo exportar el archivo GPX');
    }
  };

  const formatTimeFull = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = Math.floor((ms % 1000) / 10);
    const pad = (num, digits = 2) => num.toString().padStart(digits, '0');
    return `${pad(minutes)}:${pad(seconds)}:${pad(milliseconds)}`;
  };

  const formatTimeRunParts = (ms) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const c = Math.floor((ms % 1000) / 10);
    const pad = (num) => num.toString().padStart(2, '0');
    return { main: `${pad(h)}:${pad(m)}:${pad(s)}`, cents: pad(c) };
  };

  const formatCompact = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1).replace('.', ',').replace(',0', '')}M`;
    if (num >= 100000) return `${Math.round(num / 1000)}k`;
    if (num >= 10000) return `${(num / 1000).toFixed(1).replace('.0', '')}k`;
    return `${num}`;
  };

  const formatDurationShort = (ms) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return { hours: h, minutes: m };
  };

  const haversineMeters = (a, b) => {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b[0] - a[0]);
    const dLon = toRad(b[1] - a[1]);
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  };

  const routeDistanceMeters = (list) => {
    let total = 0;
    for (let i = 1; i < list.length; i++) {
      total += haversineMeters(list[i - 1], list[i]);
    }
    return total;
  };

  // km/ritmo derivados del historial (para Estadísticas, Perfil e Inicio)
  const kmOfRun = (h) => {
    try {
      const locs = (typeof h.locations === 'string' ? JSON.parse(h.locations) : h.locations) || [];
      return routeDistanceMeters(Array.isArray(locs) ? locs : []) / 1000;
    } catch (e) {
      return 0;
    }
  };
  const weekKmTotal = (list) =>
    list
      .filter((h) => h.date && Date.now() - new Date(h.date).getTime() < 7 * 24 * 3600 * 1000)
      .reduce((acc, h) => acc + kmOfRun(h), 0);
  const formatPace = (secPerKm) => {
    if (!secPerKm || !isFinite(secPerKm)) return '—';
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  const LEVEL_LABEL = { principiante: 'Principiante', intermedio: 'Intermedio', avanzado: 'Avanzado' };

  const mapHTML = useMemo(() => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; background: ${isDarkMode ? '#0E0F0C' : '#F4F2EC'}; }
        #map { width: 100vw; height: 100vh; background: ${isDarkMode ? '#171A15' : '#EDF0E8'}; }
        .leaflet-tile-pane { ${isDarkMode ? 'filter: invert(92%) hue-rotate(180deg) brightness(0.92) contrast(1.05);' : ''} }
        .leaflet-control-attribution { font-size: 8px; opacity: 0.7; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        let map, polyline, marker, lastCenter = null;
        map = L.map('map', { zoomControl: false }).setView([-34.9214, -57.9545], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
        const distM = function(a, b) {
          const R = 6371000, toR = function(d){ return d * Math.PI / 180; };
          const dLat = toR(b[0] - a[0]), dLon = toR(b[1] - a[1]);
          const s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toR(a[0])) * Math.cos(toR(b[0])) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
          return 2 * R * Math.asin(Math.sqrt(s));
        };
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'READY' }));
        }
        document.addEventListener("message", function(event) {
          const data = JSON.parse(event.data);
          if (data.type === 'UPDATE_LOCATIONS' && data.coords && data.coords.length > 0) {
            const coords = data.coords;
            const lastCoord = coords[coords.length - 1];
            if (!polyline) {
              polyline = L.polyline(coords, { color: '#D7FE47', weight: 5, opacity: 0.95 }).addTo(map);
              marker = L.circleMarker(lastCoord, { radius: 7, color: '#0E0F0C', weight: 2, fillColor: '#D7FE47', fillOpacity: 1 }).addTo(map);
              try { map.fitBounds(L.latLngBounds(coords), { padding: [44, 44] }); } catch (e) { map.setView(lastCoord, 16); }
            } else {
              polyline.setLatLngs(coords);
              marker.setLatLng(lastCoord);
              const base = lastCenter || lastCoord;
              if (distM(base, lastCoord) > 12) {
                map.panTo(lastCoord);
                lastCenter = lastCoord;
              }
            }
          }
        });
      </script>
    </body>
    </html>
  `, [isDarkMode]);

  const renderRunScreen = () => {
    const { main, cents } = formatTimeRunParts(elapsedTime);
    const distMeters = routeDistanceMeters(locationList);
    const distKm = distMeters > 0 ? distMeters / 1000 : 0;
    const paceMin = distKm > 0.01 && elapsedTime > 0 ? elapsedTime / 60000 / distKm : null;
    const paceStr =
      paceMin != null
        ? `${String(Math.floor(paceMin)).padStart(2, '0')}:${String(Math.round((paceMin % 1) * 60)).padStart(2, '0')}`
        : '--:--';
    const stateLabel = isRunning ? 'EN CARRERA' : elapsedTime > 0 ? 'PAUSA' : 'LISTO';
    // Anillo de progreso: barre la fracción del minuto en curso
    const CIRC = 2 * Math.PI * 46;
    const frac = isRunning ? (elapsedTime % 60000) / 60000 : elapsedTime > 0 ? 0.3 : 0;
    const dashOffset = CIRC * (1 - frac);
    const gpsText = gpsEnabled ? 'GPS' : 'NO GPS';
    // Bordes de superficie legibles en ambos temas (las capturas aprobadas son dark-first)
    const sphereBorder = isDarkMode ? 'rgba(48,51,44,0.6)' : 'rgba(48,51,44,0.2)';
    const sphereBg = isDarkMode ? 'rgba(27,29,24,0.15)' : 'rgba(255,255,255,0.3)';
    const trackStroke = isDarkMode ? 'rgba(48,51,44,0.3)' : 'rgba(48,51,44,0.15)';
    const cardBorder = isDarkMode ? 'rgba(48,51,44,0.5)' : 'rgba(48,51,44,0.18)';
    const mapPillBg = isDarkMode ? 'rgba(14,15,12,0.82)' : 'rgba(244,242,236,0.92)';
    const mapPillBorder = isDarkMode ? 'rgba(48,51,44,0.5)' : 'rgba(48,51,44,0.2)';

    return (
      <ScrollView contentContainerStyle={{ paddingBottom: 150 }}>
        {/* Header: estado GPS + estado de la carrera */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 }}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => { if (!isRunning && countdownValue === null) setGpsEnabled(!gpsEnabled); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: gpsEnabled ? theme.colors.primary : theme.colors.onSurfaceVariant }} />
            <Text style={{ fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 2, color: gpsEnabled ? theme.colors.primary : theme.colors.onSurfaceVariant, fontFamily: F.sansSem }}>
              {gpsText}
            </Text>
          </TouchableOpacity>
          <View style={{ borderRadius: 999, backgroundColor: theme.colors.surfaceVariant, paddingHorizontal: 12, paddingVertical: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', color: theme.colors.onSurface, fontFamily: F.sansSem }}>
              {stateLabel}
            </Text>
          </View>
        </View>

        {/* Esfera del cronómetro */}
        <View style={{ alignItems: 'center' }}>
          <View style={{ width: 280, height: 280, borderRadius: 140, borderWidth: 1, borderColor: sphereBorder, backgroundColor: sphereBg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <Svg style={{ position: 'absolute', top: 0, left: 0, width: 280, height: 280, transform: [{ rotate: '-90deg' }] }} viewBox="0 0 100 100">
              <Circle cx="50" cy="50" r="46" fill="none" stroke={trackStroke} strokeWidth="2.5" />
              <Circle cx="50" cy="50" r="46" fill="none" stroke={theme.colors.primary} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={String(CIRC)} strokeDashoffset={String(dashOffset)} />
            </Svg>
            <View style={{ alignItems: 'center', padding: 16 }}>
              <Text style={{ fontSize: 10, letterSpacing: 2.2, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, marginBottom: 4, fontFamily: F.sansMed }}>
                TIEMPO TRANSCURRIDO
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={{ fontFamily: F.headingBold, fontSize: 40, lineHeight: 42, fontWeight: '700', letterSpacing: -1.6, color: theme.colors.onSurface, fontVariant: ['tabular-nums'] }}>
                  {main}
                </Text>
                <Text style={{ fontFamily: F.headingBold, fontSize: 20, fontWeight: '600', color: theme.colors.onSurfaceVariant }}>.{cents}</Text>
              </View>
              <View style={{ width: 96, height: 1, backgroundColor: theme.colors.outline, marginVertical: 12 }} />
              <View style={{ flexDirection: 'row', gap: 16, width: 200, justifyContent: 'space-between' }}>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 9, letterSpacing: 1.6, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, fontFamily: F.sansMed }}>PASOS</Text>
                  <Text style={{ fontFamily: F.headingBold, fontSize: 18, fontWeight: '700', color: theme.colors.onSurface, fontVariant: ['tabular-nums'] }}>{stepCount}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 9, letterSpacing: 1.6, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, fontFamily: F.sansMed }}>CADENCIA</Text>
                  <Text style={{ fontFamily: F.headingBold, fontSize: 18, fontWeight: '700', color: theme.colors.onSurface, fontVariant: ['tabular-nums'] }}>
                    {cadence}<Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant, fontFamily: F.sansMed }}> spm</Text>
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Ruta GPS */}
        <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
          <View style={{ borderRadius: 24, backgroundColor: theme.colors.surfaceVariant, padding: 16, borderWidth: 1, borderColor: cardBorder, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="location" size={16} color={theme.colors.primary} />
                <Text style={{ fontSize: 10, letterSpacing: 1.8, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, fontFamily: F.sansMed }}>RUTA GPS EN VIVO</Text>
              </View>
              <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.onSurface, fontVariant: ['tabular-nums'], fontFamily: F.sansSem }}>{distKm.toFixed(2)} km</Text>
            </View>
            <View style={{ borderRadius: 18, overflow: 'hidden', height: 200, position: 'relative', backgroundColor: theme.colors.mapSurface, borderWidth: 1, borderColor: cardBorder }}>
              <WebView
                ref={webViewRef}
                source={{ html: mapHTML }}
                style={{ flex: 1, backgroundColor: 'transparent' }}
                originWhitelist={['*']}
                javaScriptEnabled
                domStorageEnabled
                scrollEnabled={false}
                onMessage={(event) => {
                  try {
                    const data = JSON.parse(event.nativeEvent.data);
                    if (data.type === 'READY' && webViewRef.current && locationList.length > 0) {
                      webViewRef.current.postMessage(JSON.stringify({ type: 'UPDATE_LOCATIONS', coords: locationList }));
                    }
                  } catch (e) {}
                }}
              />
              {!gpsEnabled ? (
                <View pointerEvents="none" style={{ position: 'absolute', top: 10, alignSelf: 'center', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: mapPillBg, borderWidth: 1, borderColor: mapPillBorder }}>
                  <Text style={{ fontSize: 10, letterSpacing: 1, color: theme.colors.onSurfaceVariant, fontFamily: F.sansMed }}>NO GPS — ACTIVALO ARRIBA</Text>
                </View>
              ) : locationList.length < 2 ? (
                <View pointerEvents="none" style={{ position: 'absolute', top: 10, alignSelf: 'center', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: mapPillBg, borderWidth: 1, borderColor: mapPillBorder }}>
                  <Text style={{ fontSize: 10, letterSpacing: 1, color: theme.colors.onSurfaceVariant, fontFamily: F.sansMed }}>BUSCANDO SEÑAL GPS…</Text>
                </View>
              ) : null}
              <View pointerEvents="none" style={{ position: 'absolute', bottom: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: mapPillBg, borderWidth: 1, borderColor: mapPillBorder }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.accent }} />
                <Text style={{ fontSize: 10, letterSpacing: 0.6, color: theme.colors.onSurfaceVariant }}>Ritmo medio {paceStr} /km</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Controles */}
        <View style={{ paddingHorizontal: 24, marginTop: 24, alignItems: 'center' }}>
          {elapsedTime === 0 && !isRunning && (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              {[0, 3, 5, 10].map((val) => (
                <PaperButton
                  key={val}
                  mode="contained"
                  onPress={() => setPrepTime(val)}
                  style={{ borderRadius: 999, elevation: 0 }}
                  buttonColor={prepTime === val ? theme.colors.primary : theme.colors.surfaceVariant}
                  textColor={prepTime === val ? theme.colors.onPrimary : theme.colors.onSurface}
                  labelStyle={{ fontSize: 12, fontWeight: '600' }}
                >
                  {val}s
                </PaperButton>
              ))}
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            {!isRunning && elapsedTime === 0 && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleStartCountdown}
                style={{ width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary, elevation: 6 }}
              >
                <Ionicons name="play" size={38} color={theme.colors.onPrimary} />
              </TouchableOpacity>
            )}

            {isRunning && (
              <>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setIsLocked(true)}
                  style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.surfaceVariant, borderWidth: 1, borderColor: theme.colors.outline, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="lock-closed" size={20} color={theme.colors.onSurface} />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={pauseClock}
                  style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="pause" size={28} color={theme.colors.onAccent} />
                </TouchableOpacity>
              </>
            )}

            {!isRunning && elapsedTime > 0 && (
              <>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setIsLocked(true)}
                  style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.surfaceVariant, borderWidth: 1, borderColor: theme.colors.outline, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="lock-closed" size={20} color={theme.colors.onSurface} />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={startClock}
                  style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="play" size={28} color={theme.colors.onPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={stopClockAndReset}
                  style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(229,72,77,0.2)', borderWidth: 1, borderColor: 'rgba(229,72,77,0.4)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="stop" size={20} color={theme.colors.error} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Pedómetro */}
        {!isLocked && !isRunning && (
          <View style={{ alignItems: 'center', marginTop: 20 }}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setPedometerEnabled(!pedometerEnabled)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: pedometerEnabled ? 'rgba(215,254,71,0.12)' : theme.colors.surfaceVariant }}
            >
              <Ionicons name="walk" size={16} color={pedometerEnabled ? theme.colors.primary : theme.colors.onSurfaceVariant} />
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: pedometerEnabled ? theme.colors.primary : theme.colors.onSurfaceVariant, fontFamily: F.sansBold }}>
                PASOS {pedometerEnabled ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    );
  };


  const renderHomeScreen = () => {
    const totalSteps = history.reduce((acc, r) => acc + (typeof r.steps === 'number' ? r.steps : 0), 0);
    const totalTime = history.reduce((acc, r) => acc + (r.duration || 0), 0);
    const first = (profile.name.split(' ')[0] || 'Runner');
    const hour = new Date().getHours();
    const saludo = hour < 12 ? 'BUENOS DÍAS' : hour < 19 ? 'BUENAS TARDES' : 'BUENAS NOCHES';
    const { hours: totH, minutes: totM } = formatDurationShort(totalTime);
    const homeWeekKm = weekKmTotal(history);
    const homeGoalKm = parseFloat(profile.goalValue) || 1;
    const metas = [
      { key: 'DISTANCIA', icon: 'navigate-outline', value: profile.metaDist ? `${profile.metaDist} km` : null },
      { key: 'RITMO', icon: 'speedometer-outline', value: profile.metaRitmo ? `${profile.metaRitmo} /km` : null },
      { key: 'FRECUENCIA', icon: 'calendar-outline', value: profile.metaFrec ? `${profile.metaFrec} por sem.` : null },
    ];
    const novedades = [
      { emoji: '🗺️', title: 'Mapa GPS en vivo', desc: 'Seguí tu ruta dibujándose sobre un mapa real mientras corrés. Funciona con o sin datos.', tag: 'NUEVO' },
      { emoji: '📊', title: 'Análisis y planes', desc: 'Km por día, récords y plan de entrenamiento 5K, 10K o 21K según tu nivel.', tag: 'NUEVO' },
      { emoji: '🌐', title: 'Comunidad', desc: 'Pronto: agregá tu comunidad, sumá kilómetros y entrená en equipo.', tag: 'PRONTO' },
    ];
    return (
      <ScrollView contentContainerStyle={{ paddingBottom: 150 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 28, paddingBottom: 22 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {profile.avatarPhoto ? (
                <Image source={{ uri: profile.avatarPhoto }} style={{ width: 44, height: 44 }} />
              ) : (
                <Text style={{ fontSize: 22 }}>{profile.avatar}</Text>
              )}
            </View>
            <View>
              <Text style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, fontFamily: F.sansSem }}>
                {saludo}
              </Text>
              <Text style={{ fontFamily: F.heading, fontSize: 19, fontWeight: '600', color: theme.colors.onSurface, letterSpacing: -0.4 }}>
                {first}, ¿listo?
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setIsDarkMode(!isDarkMode)}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name={isDarkMode ? 'sunny' : 'moon'} size={18} color={theme.colors.onSurface} />
            </TouchableOpacity>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <Ionicons name="notifications" size={18} color={theme.colors.onSurface} />
              <View style={{ position: 'absolute', top: 8, right: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.accent }} />
            </View>
          </View>
        </View>

        {/* Hero · LISTO PARA SALIR */}
        <View style={{ paddingHorizontal: 24 }}>
          <View style={{ borderRadius: 24, backgroundColor: theme.colors.primary, padding: 20, minHeight: 190, justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '500', opacity: 0.7, color: theme.colors.onPrimary, fontFamily: F.sansMed }}>
                  LISTO PARA SALIR
                </Text>
                <Text style={{ fontFamily: F.headingBold, fontSize: 28, lineHeight: 28, fontWeight: '700', letterSpacing: -1, color: theme.colors.onPrimary, marginTop: 8, maxWidth: 220 }}>
                  Tu próxima carrera empieza acá
                </Text>
              </View>
              <Ionicons name="footsteps" size={24} color={theme.colors.onPrimary} style={{ opacity: 0.8 }} />
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setActiveScreen('run')}
              style={{ alignSelf: 'flex-start', height: 44, paddingHorizontal: 20, borderRadius: 999, backgroundColor: theme.colors.onPrimary, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.primary, fontFamily: F.sansSem }}>IR A CORRER</Text>
              <Ionicons name="arrow-up" size={16} color={theme.colors.primary} style={{ transform: [{ rotate: '45deg' }] }} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Novedades */}
        <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontFamily: F.heading, fontSize: 16, fontWeight: '600', color: theme.colors.onSurface }}>Novedades</Text>
            <Text style={{ fontSize: 10, letterSpacing: 1.8, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, fontFamily: F.sansSem }}>DESLIZÁ</Text>
          </View>
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={(e) => {
                const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
                const maxOffset = contentSize.width - layoutMeasurement.width;
                setNewsScroll(maxOffset > 0 ? Math.min(1, Math.max(0, contentOffset.x / maxOffset)) : 1);
              }}
              contentContainerStyle={{ gap: 12, paddingRight: 4 }}
            >
              {novedades.map((n) => (
                <View key={n.title} style={{ width: 232, borderRadius: 20, backgroundColor: theme.colors.surface, padding: 16, borderWidth: 1, borderColor: theme.colors.outline, justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: theme.colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 18 }}>{n.emoji}</Text>
                    </View>
                    <View style={{ borderRadius: 999, backgroundColor: n.tag === 'PRONTO' ? 'rgba(215,254,71,0.18)' : 'rgba(215,254,71,0.12)', paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 8, fontWeight: '700', letterSpacing: 1, color: theme.colors.primary, fontFamily: F.sansBold }}>{n.tag}</Text>
                    </View>
                  </View>
                  <View style={{ marginTop: 14 }}>
                    <Text style={{ fontFamily: F.heading, fontSize: 15, fontWeight: '600', color: theme.colors.onSurface, letterSpacing: -0.3 }}>{n.title}</Text>
                    <Text style={{ fontSize: 11, lineHeight: 16, color: theme.colors.onSurfaceVariant, marginTop: 6, fontFamily: F.sans }}>{n.desc}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={{ height: 3, borderRadius: 2, backgroundColor: theme.colors.surfaceVariant, marginTop: 12, overflow: 'hidden' }}>
              <View style={{ width: `${newsScroll * 100}%`, height: '100%', borderRadius: 2, backgroundColor: theme.colors.primary }} />
            </View>
          </View>
        </View>

        {/* Tu recorrido */}
        <View style={{ paddingHorizontal: 24, marginTop: 28 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontFamily: F.heading, fontSize: 16, fontWeight: '600', color: theme.colors.onSurface }}>Tu recorrido</Text>
            <Text style={{ fontSize: 10, letterSpacing: 1.8, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, fontFamily: F.sansSem }}>TODA LA ACTIVIDAD</Text>
          </View>
          <View style={{ borderRadius: 24, backgroundColor: theme.colors.surface, padding: 20 }}>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, marginBottom: 8, fontFamily: F.sansMed }}>CARRERAS</Text>
                <Text style={{ fontFamily: F.headingBold, fontSize: 28, lineHeight: 30, fontWeight: '700', letterSpacing: -1, color: theme.colors.onSurface, fontVariant: ['tabular-nums'] }}>{history.length}</Text>
                <Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant, marginTop: 8, fontFamily: F.sans }}>sesiones</Text>
              </View>
              <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: theme.colors.outline, paddingLeft: 12 }}>
                <Text style={{ fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, marginBottom: 8, fontFamily: F.sansMed }}>TIEMPO TOTAL</Text>
                <Text style={{ fontFamily: F.headingBold, fontSize: 28, lineHeight: 30, fontWeight: '700', letterSpacing: -1, color: theme.colors.onSurface, fontVariant: ['tabular-nums'] }}>
                  {totH}<Text style={{ fontSize: 14, fontWeight: '500', color: theme.colors.onSurfaceVariant, marginLeft: 4, fontFamily: F.sansMed }}> h</Text>
                </Text>
                <Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant, marginTop: 8, fontFamily: F.sans }}>{totM} min</Text>
              </View>
              <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: theme.colors.outline, paddingLeft: 12 }}>
                <Text style={{ fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, marginBottom: 8, fontFamily: F.sansMed }}>PASOS</Text>
                <Text style={{ fontFamily: F.headingBold, fontSize: 28, lineHeight: 30, fontWeight: '700', letterSpacing: -1, color: theme.colors.onSurface, fontVariant: ['tabular-nums'] }}>
                  {formatCompact(totalSteps)}<Text style={{ fontSize: 14, fontWeight: '500', color: theme.colors.onSurfaceVariant, fontFamily: F.sansMed }}> </Text>
                </Text>
                <Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant, marginTop: 8, fontFamily: F.sans }}>acumulados</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Metas */}
        <View style={{ paddingHorizontal: 24, marginTop: 28 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontFamily: F.heading, fontSize: 16, fontWeight: '600', color: theme.colors.onSurface }}>Metas</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <TouchableOpacity activeOpacity={0.6} onPress={() => openMetaEditor('DISTANCIA')}>
                <Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant, fontFamily: F.sansMed }}>EDITAR</Text>
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={12} color={theme.colors.onSurfaceVariant} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {metas.map((m) => (
              <TouchableOpacity
                key={m.key}
                activeOpacity={0.7}
                onPress={() => openMetaEditor(m.key)}
                style={{ flex: 1, borderRadius: 20, backgroundColor: theme.colors.surfaceVariant, padding: 16, minHeight: 126, justifyContent: 'space-between' }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Ionicons name={m.icon} size={18} color={theme.colors.onSurfaceVariant} />
                  <Ionicons name="pencil" size={11} color={theme.colors.primary} />
                </View>
                <View>
                  <Text style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, fontFamily: F.sansMed }}>{m.key}</Text>
                  <Text style={{ fontFamily: F.heading, fontSize: 15, fontWeight: '600', marginTop: 4, letterSpacing: -0.2, fontVariant: ['tabular-nums'], color: m.value ? theme.colors.primary : theme.colors.onSurface }}>
                    {m.value || 'Sin definir'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Objetivo (se edita en Perfil) */}
        <View style={{ paddingHorizontal: 24, marginTop: 28 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontFamily: F.heading, fontSize: 16, fontWeight: '600', color: theme.colors.onSurface }}>Objetivo</Text>
            <View style={{ borderRadius: 999, backgroundColor: theme.colors.surfaceVariant, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 1, color: theme.colors.primary, fontFamily: F.sansSem }}>
                {profile.goalType === 'km' ? `META ${profile.goalValue} KM` : 'RITMO'}
              </Text>
            </View>
          </View>
          <View style={{ borderRadius: 24, backgroundColor: theme.colors.surface, padding: 18 }}>
            {profile.goalType === 'km' ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant, fontFamily: F.sans }}>Esta semana</Text>
                  <Text style={{ fontFamily: F.headingBold, fontSize: 20, fontWeight: '700', color: theme.colors.onSurface, fontVariant: ['tabular-nums'] }}>
                    {homeWeekKm.toFixed(1)}<Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant, fontFamily: F.sansMed }}> / {profile.goalValue} km</Text>
                  </Text>
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.colors.surfaceVariant, marginTop: 12, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.min(1, homeWeekKm / homeGoalKm) * 100}%`, height: '100%', borderRadius: 4, backgroundColor: theme.colors.primary }} />
                </View>
              </>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, fontFamily: F.sansMed }}>RITMO OBJETIVO</Text>
                  <Text style={{ fontFamily: F.headingBold, fontSize: 26, fontWeight: '700', letterSpacing: -0.8, color: theme.colors.primary, marginTop: 4, fontVariant: ['tabular-nums'] }}>
                    {profile.goalPace}<Text style={{ fontSize: 13, color: theme.colors.onSurfaceVariant, fontFamily: F.sansMed }}> /km</Text>
                  </Text>
                </View>
                <Ionicons name="speedometer-outline" size={28} color={theme.colors.primary} />
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderHistoryScreen = () => (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 130 }}>
      <View style={{ paddingTop: 24, paddingBottom: 18 }}>
        <Text style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, fontFamily: F.sansSem }}>TU ACTIVIDAD</Text>
        <Text style={{ fontFamily: F.headingBold, fontSize: 24, fontWeight: '700', letterSpacing: -0.6, color: theme.colors.onSurface }}>Historial</Text>
      </View>
      {history.length === 0 ? (
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: 60 }}>
          No tenés entrenamientos guardados.
        </Text>
      ) : (
        history.map((item) => (
          <Card key={item.id} style={{ borderRadius: 24, backgroundColor: theme.colors.surface, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.outline }}>
            <Card.Content>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  {new Date(item.date).toLocaleDateString()} · {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleDeleteRun(item.id)}
                  style={{ padding: 6 }}
                >
                  <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
                </TouchableOpacity>
              </View>
              <Text style={{ fontFamily: F.headingBold, fontSize: 34, fontWeight: '700', letterSpacing: -0.8, color: theme.colors.primary, marginVertical: 4, fontVariant: ['tabular-nums'] }}>{formatTimeFull(item.duration)}</Text>
              <Text variant="labelMedium" style={{ color: theme.colors.onSurface }}>
                SUPERFICIE: {item.surface.toUpperCase()} · SENSACIÓN: {item.feeling || 'Sin especificar'}
              </Text>
              {(item.notes || '').trim() ? (
                <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>💬 {item.notes}</Text>
              ) : null}
              {typeof item.steps === 'number' && item.steps > 0 && (
                <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>👟 {item.steps} pasos</Text>
              )}
              <PaperButton
                mode="outlined"
                onPress={() => exportToGPX(item)}
                style={{ alignSelf: 'flex-start', borderRadius: 999, marginTop: 10 }}
                textColor={theme.colors.primary}
                icon={({ color, size }) => <Ionicons name="download-outline" size={size} color={color} />}
              >
                Exportar GPX
              </PaperButton>
            </Card.Content>
          </Card>
        ))
      )}
    </ScrollView>
  );

  const renderToolsScreen = () => {
    const totalKm = history.reduce((a, h) => a + kmOfRun(h), 0);
    const totalTime = history.reduce((a, h) => a + (h.duration || 0), 0);
    const totalSteps = history.reduce((a, h) => a + (h.steps || 0), 0);
    const { hours: tH, minutes: tM } = formatDurationShort(totalTime);
    const timeVal = tH > 0 ? `${tH}h ${tM}` : `${tM}m`;
    const avgPaceSec = totalKm > 0 ? totalTime / 1000 / totalKm : 0;
    let bestPaceSec = 0;
    history.forEach((h) => {
      const km = kmOfRun(h);
      if (km > 0 && (h.duration || 0) > 0) {
        const p = h.duration / 1000 / km;
        if (!bestPaceSec || p < bestPaceSec) bestPaceSec = p;
      }
    });
    const semanaKm = weekKmTotal(history);
    const semanaSesiones = history.filter((h) => h.date && Date.now() - new Date(h.date).getTime() < 7 * 24 * 3600 * 1000).length;
    // Gráfico de la última semana (7 días)
    const dayNames = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const kmDay = history
        .filter((h) => h.date && new Date(h.date).toDateString() === d.toDateString())
        .reduce((a, h) => a + kmOfRun(h), 0);
      days.push({ label: dayNames[d.getDay()], km: kmDay, today: i === 0 });
    }
    const maxDayKm = Math.max(1, ...days.map((d) => d.km));
    const maxDist = history.reduce((a, h) => Math.max(a, kmOfRun(h)), 0);
    // Plan de entrenamiento según objetivo y nivel
    const PLANS = {
      '5K': {
        principiante: ['Rodaje suave · 25′', 'Caminata + trote · 20′', 'Rodaje + 4×1′ rápido', 'Descanso activo'],
        intermedio: ['Rodaje · 30′', 'Series 6×400 m', 'Rodaje · 35′', 'Trote largo · 45′'],
        avanzado: ['Rodaje · 35′', 'Series 8×400 m', 'Tempo · 20′', 'Largo · 50′'],
      },
      '10K': {
        principiante: ['Rodaje · 30′', 'Series 4×200 m', 'Rodaje · 35′', 'Largo · 40′'],
        intermedio: ['Rodaje · 40′', 'Series 6×800 m', 'Tempo · 25′', 'Largo · 60′'],
        avanzado: ['Rodaje · 45′', 'Series 8×800 m', 'Tempo · 30′', 'Largo · 75′'],
      },
      '21K': {
        principiante: ['Rodaje · 35′', 'Series 4×400 m', 'Rodaje · 40′', 'Largo · 55′'],
        intermedio: ['Rodaje · 45′', 'Series 6×1000 m', 'Tempo · 30′', 'Largo · 90′'],
        avanzado: ['Rodaje · 50′', 'Series 10×800 m', 'Tempo · 40′', 'Largo · 110′'],
      },
    };
    const planGoal = PLANS[profile.planGoal] ? profile.planGoal : '10K';
    const planLevel = PLANS[planGoal][profile.planLevel] ? profile.planLevel : 'intermedio';
    const planSessions = PLANS[planGoal][planLevel];
    const rows = [
      [
        { label: 'KM TOTALES', value: totalKm.toFixed(1), suffix: '' },
        { label: 'TIEMPO TOTAL', value: timeVal, suffix: '' },
        { label: 'RITMO PROM', value: formatPace(avgPaceSec), suffix: ' /km' },
      ],
      [
        { label: 'SESIONES', value: String(history.length), suffix: '' },
        { label: 'PASOS', value: formatCompact(totalSteps), suffix: '' },
        { label: 'MEJOR RITMO', value: formatPace(bestPaceSec), suffix: ' /km' },
      ],
    ];
    return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 130 }}>
      <View style={{ paddingTop: 24, paddingBottom: 18 }}>
        <Text style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, fontFamily: F.sansSem }}>ACTIVIDAD · DATOS</Text>
        <Text style={{ fontFamily: F.headingBold, fontSize: 24, fontWeight: '700', letterSpacing: -0.6, color: theme.colors.onSurface }}>Herramientas</Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: supabaseAvail ? '#D7FE47' : theme.colors.outline }} />
        <Text style={{ fontSize: 10, letterSpacing: 1, color: theme.colors.onSurfaceVariant, fontFamily: F.sansMed }}>
          {!supabaseAvail
            ? 'MODO LOCAL · SIN NUBE'
            : user
              ? `RESPALDO EN LA NUBE · ${user.email}`
              : 'RESPALDO EN LA NUBE ACTIVO (dispositivo)'}
        </Text>
        {supabaseAvail && <Ionicons name={user ? 'cloud-done' : 'cloud-done-outline'} size={14} color="#D7FE47" />}
      </View>

      {/* Estadísticas de rendimiento */}
      <View style={{ marginBottom: 14 }}>
        <View style={{ borderRadius: 24, backgroundColor: theme.colors.primary, padding: 18, marginBottom: 12 }}>
          <Text style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700', opacity: 0.65, color: theme.colors.onPrimary, fontFamily: F.sansSem }}>ESTA SEMANA</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 }}>
            <Text style={{ fontFamily: F.headingBold, fontSize: 34, fontWeight: '700', letterSpacing: -1, color: theme.colors.onPrimary, fontVariant: ['tabular-nums'] }}>{semanaKm.toFixed(1)} km</Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.onPrimary, opacity: 0.75, fontFamily: F.sansMed }}>{semanaSesiones} sesiones</Text>
          </View>
        </View>

        {/* Análisis avanzado */}
        <View style={{ borderRadius: 24, backgroundColor: theme.colors.surface, padding: 18, borderWidth: 1, borderColor: theme.colors.outline, marginBottom: 12 }}>
          <Text style={{ fontFamily: F.heading, fontSize: 16, fontWeight: '600', color: theme.colors.onSurface, marginBottom: 4 }}>Análisis</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 14 }}>Tu actividad de la última semana</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 84 }}>
            {days.map((d, idx) => (
              <View key={idx} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', marginHorizontal: 3 }}>
                <View style={{ height: Math.max(4, (d.km / maxDayKm) * 62), width: '100%', maxWidth: 22, borderRadius: 6, backgroundColor: d.km > 0 ? (d.today ? theme.colors.primary : 'rgba(215,254,71,0.45)') : theme.colors.surfaceVariant }} />
                <Text style={{ fontSize: 9, marginTop: 6, color: d.today ? theme.colors.primary : theme.colors.onSurfaceVariant, fontWeight: d.today ? '700' : '400', fontFamily: F.sansMed }}>{d.label}</Text>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: theme.colors.outline, marginTop: 16, paddingTop: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9, letterSpacing: 1.4, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, marginBottom: 6, fontFamily: F.sansMed }}>MAYOR DISTANCIA</Text>
              <Text style={{ fontFamily: F.headingBold, fontSize: 16, fontWeight: '700', letterSpacing: -0.3, color: theme.colors.onSurface, fontVariant: ['tabular-nums'] }}>{maxDist.toFixed(1)} km</Text>
            </View>
            <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: theme.colors.outline, paddingLeft: 12 }}>
              <Text style={{ fontSize: 9, letterSpacing: 1.4, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, marginBottom: 6, fontFamily: F.sansMed }}>MEJOR RITMO</Text>
              <Text style={{ fontFamily: F.headingBold, fontSize: 16, fontWeight: '700', letterSpacing: -0.3, color: theme.colors.onSurface, fontVariant: ['tabular-nums'] }}>{formatPace(bestPaceSec)} /km</Text>
            </View>
            <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: theme.colors.outline, paddingLeft: 12 }}>
              <Text style={{ fontSize: 9, letterSpacing: 1.4, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, marginBottom: 6, fontFamily: F.sansMed }}>RÉCORD SEMANA</Text>
              <Text style={{ fontFamily: F.headingBold, fontSize: 16, fontWeight: '700', letterSpacing: -0.3, color: theme.colors.onSurface, fontVariant: ['tabular-nums'] }}>{semanaKm.toFixed(1)} km</Text>
            </View>
          </View>
        </View>

        {/* Plan de entrenamiento */}
        <View style={{ borderRadius: 24, backgroundColor: theme.colors.surface, padding: 18, borderWidth: 1, borderColor: theme.colors.outline, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontFamily: F.heading, fontSize: 16, fontWeight: '600', color: theme.colors.onSurface }}>Plan de entrenamiento</Text>
            <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} />
          </View>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>Una semana tipo según tu objetivo y nivel</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            {['5K', '10K', '21K'].map((g) => (
              <TouchableOpacity key={g} activeOpacity={0.8} onPress={() => setProfile({ ...profile, planGoal: g })}
                style={{ flex: 1, borderRadius: 999, paddingVertical: 9, alignItems: 'center', backgroundColor: planGoal === g ? theme.colors.primary : theme.colors.surfaceVariant, borderWidth: 1, borderColor: planGoal === g ? theme.colors.primary : theme.colors.outline }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: planGoal === g ? theme.colors.onPrimary : theme.colors.onSurface, fontFamily: F.sansBold }}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            {['principiante', 'intermedio', 'avanzado'].map((lv) => (
              <TouchableOpacity key={lv} activeOpacity={0.8} onPress={() => setProfile({ ...profile, planLevel: lv })}
                style={{ flex: 1, borderRadius: 999, paddingVertical: 8, alignItems: 'center', backgroundColor: planLevel === lv ? theme.colors.surfaceVariant : 'transparent', borderWidth: 1, borderColor: planLevel === lv ? theme.colors.primary : 'transparent' }}>
                <Text style={{ fontSize: 9, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', color: planLevel === lv ? theme.colors.primary : theme.colors.onSurfaceVariant, fontFamily: F.sansSem }}>{LEVEL_LABEL[lv]}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ gap: 8 }}>
            {planSessions.map((s, idx) => (
              <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, backgroundColor: theme.colors.surfaceVariant, paddingHorizontal: 12, paddingVertical: 10 }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: idx === 0 ? theme.colors.primary : 'transparent', borderWidth: 1.5, borderColor: idx === 0 ? theme.colors.primary : theme.colors.outline, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: idx === 0 ? theme.colors.onPrimary : theme.colors.onSurfaceVariant, fontFamily: F.sansBold }}>{idx + 1}</Text>
                </View>
                <Text style={{ flex: 1, fontSize: 13, color: theme.colors.onSurface, fontFamily: F.sansMed }}>{s}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ borderRadius: 24, backgroundColor: theme.colors.surface, padding: 18, borderWidth: 1, borderColor: theme.colors.outline }}>
          <Text style={{ fontFamily: F.heading, fontSize: 16, fontWeight: '600', color: theme.colors.onSurface, marginBottom: 14 }}>Tus números</Text>
          {rows.map((row, rIdx) => (
            <View key={rIdx} style={{ flexDirection: 'row', marginBottom: rIdx === 0 ? 18 : 0 }}>
              {row.map((s, sIdx) => (
                <View key={s.label} style={{ flex: 1, borderLeftWidth: sIdx > 0 ? 1 : 0, borderLeftColor: theme.colors.outline, paddingLeft: sIdx > 0 ? 12 : 0 }}>
                  <Text style={{ fontSize: 9, letterSpacing: 1.4, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, marginBottom: 6, fontFamily: F.sansMed }}>{s.label}</Text>
                  <Text style={{ fontFamily: F.headingBold, fontSize: 18, fontWeight: '700', letterSpacing: -0.4, color: theme.colors.onSurface, fontVariant: ['tabular-nums'] }}>
                    {s.value}<Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant, fontFamily: F.sansMed }}>{s.suffix}</Text>
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>
      <Card style={{ borderRadius: 24, backgroundColor: theme.colors.surface, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.outline }}>
        <Card.Content>
          <Text style={{ fontFamily: F.heading, fontSize: 17, fontWeight: '600', letterSpacing: -0.3, color: theme.colors.onSurface }}>Exportar</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>Generá archivos GPX de tus carreras para llevar a otras apps.</Text>
          <PaperButton
            mode="outlined"
            icon={({ color, size }) => <Ionicons name="albums-outline" size={size} color={color} />}
            onPress={() => { history.forEach((h) => exportToGPX(h)); }}
            style={{ borderRadius: 999, alignSelf: 'flex-start' }}
            textColor={theme.colors.primary}
          >
            Exportar todo ({history.length})
          </PaperButton>
        </Card.Content>
      </Card>
    </ScrollView>
    );
  };

  const renderProfileScreen = () => {
    const goalKm = parseFloat(profile.goalValue) || 1;
    const metaSemanaKm = weekKmTotal(history);
    const metaProgress = Math.min(1, metaSemanaKm / goalKm);
    return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 130 }}>
      <View style={{ paddingTop: 24, paddingBottom: 18 }}>
        <Text style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, fontFamily: F.sansSem }}>TU ESPACIO</Text>
        <Text style={{ fontFamily: F.headingBold, fontSize: 24, fontWeight: '700', letterSpacing: -0.6, color: theme.colors.onSurface }}>Mi perfil</Text>
      </View>

      <Card style={{ borderRadius: 24, backgroundColor: theme.colors.surface }}>
        <Card.Content>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {profile.avatarPhoto ? (
                <Image source={{ uri: profile.avatarPhoto }} style={{ width: 64, height: 64 }} />
              ) : (
                <Text style={{ fontSize: 32 }}>{profile.avatar}</Text>
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={{ fontFamily: F.heading, fontSize: 17, fontWeight: '600', letterSpacing: -0.3, color: theme.colors.onSurface }}>{profile.name}</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{profile.bio}</Text>
            </View>
          </View>

          <Divider style={{ marginVertical: 16 }} />

          {!isEditingProfile ? (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontFamily: F.headingBold, fontSize: 22, fontWeight: '700', letterSpacing: -0.5, color: theme.colors.primary, fontVariant: ['tabular-nums'] }}>{profile.height} cm</Text>
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>ESTATURA</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontFamily: F.headingBold, fontSize: 22, fontWeight: '700', letterSpacing: -0.5, color: theme.colors.primary, fontVariant: ['tabular-nums'] }}>{profile.weight} kg</Text>
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>PESO</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontFamily: F.headingBold, fontSize: 22, fontWeight: '700', letterSpacing: -0.5, color: theme.colors.primary, fontVariant: ['tabular-nums'] }}>{profile.age || '—'}</Text>
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>EDAD</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: theme.colors.outline, paddingTop: 14, marginTop: 16 }}>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>CIUDAD</Text>
                  <Text style={{ fontFamily: F.heading, fontSize: 15, fontWeight: '600', color: theme.colors.onSurface, marginTop: 3 }}>{profile.city || '—'}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center', borderLeftWidth: 1, borderLeftColor: theme.colors.outline }}>
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>NIVEL</Text>
                  <Text style={{ fontFamily: F.heading, fontSize: 15, fontWeight: '600', color: theme.colors.onSurface, marginTop: 3 }}>{LEVEL_LABEL[profile.level] || profile.level}</Text>
                </View>
              </View>

              <Divider style={{ marginVertical: 16 }} />

              <View style={{ borderRadius: 20, backgroundColor: theme.colors.surfaceVariant, padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, fontFamily: F.sansSem }}>
                    {profile.goalType === 'km' ? 'OBJETIVO SEMANAL' : 'RITMO OBJETIVO'}
                  </Text>
                  <Ionicons name="flag-outline" size={16} color={theme.colors.primary} />
                </View>
                {profile.goalType === 'km' ? (
                  <>
                    <Text style={{ fontFamily: F.headingBold, fontSize: 26, fontWeight: '700', letterSpacing: -0.8, color: theme.colors.primary, marginTop: 6, fontVariant: ['tabular-nums'] }}>
                      {profile.goalValue}<Text style={{ fontSize: 14, color: theme.colors.onSurfaceVariant, fontWeight: '500' }}> km / semana</Text>
                    </Text>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.outline, marginTop: 12, overflow: 'hidden' }}>
                      <View style={{ width: `${metaProgress * 100}%`, height: '100%', borderRadius: 3, backgroundColor: theme.colors.primary }} />
                    </View>
                    <Text style={{ fontSize: 10, color: theme.colors.onSurfaceVariant, marginTop: 6, fontFamily: F.sansMed }}>{metaSemanaKm.toFixed(1)} km esta semana</Text>
                  </>
                ) : (
                  <Text style={{ fontFamily: F.headingBold, fontSize: 26, fontWeight: '700', letterSpacing: -0.8, color: theme.colors.primary, marginTop: 6, fontVariant: ['tabular-nums'] }}>{profile.goalPace} /km</Text>
                )}
              </View>

              <PaperButton
                mode="outlined"
                onPress={() => setIsEditingProfile(true)}
                style={{ borderRadius: 999, marginTop: 20 }}
                textColor={theme.colors.primary}
                icon={({ color, size }) => <Ionicons name="pencil-outline" size={size} color={color} />}
              >
                Editar perfil
              </PaperButton>
            </>
          ) : (
            <View style={{ gap: 12 }}>
              <View>
                <Text style={{ fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, marginBottom: 8, fontFamily: F.sansSem }}>AVATAR</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {profile.avatarPhoto ? (
                      <Image source={{ uri: profile.avatarPhoto }} style={{ width: 48, height: 48 }} />
                    ) : (
                      <Text style={{ fontSize: 24 }}>{profile.avatar}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={pickAvatarPhoto}
                    style={{ flex: 1, borderRadius: 999, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, backgroundColor: theme.colors.primary }}
                  >
                    <Ionicons name="image-outline" size={14} color={theme.colors.onPrimary} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.onPrimary, fontFamily: F.sansBold }}>SUBIR FOTO</Text>
                  </TouchableOpacity>
                  {profile.avatarPhoto && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setProfile({ ...profile, avatarPhoto: null })}
                      style={{ borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: theme.colors.outline }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.onSurface, fontFamily: F.sansMed }}>USAR EMOJI</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {['🏃', '🏃‍♂️', '🏃‍♀️', '👟', '🥇', '🏆', '🏅', '🎽', '💪', '🚴', '🔥', '😄', '😎', '🤩'].map((emo) => (
                    <TouchableOpacity
                      key={emo}
                      activeOpacity={0.7}
                      onPress={() => setProfile({ ...profile, avatar: emo, avatarPhoto: null })}
                      style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: !profile.avatarPhoto && profile.avatar === emo ? 'rgba(215,254,71,0.15)' : theme.colors.surfaceVariant, borderWidth: 1.5, borderColor: !profile.avatarPhoto && profile.avatar === emo ? theme.colors.primary : 'transparent' }}
                    >
                      <Text style={{ fontSize: 22 }}>{emo}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <TextInput style={{ borderRadius: 12, padding: 12, backgroundColor: theme.colors.surfaceVariant, color: theme.colors.onSurface }} value={profile.name} onChangeText={(v) => setProfile({ ...profile, name: v })} placeholder="Nombre" placeholderTextColor="#888" />
              <TextInput style={{ borderRadius: 12, padding: 12, backgroundColor: theme.colors.surfaceVariant, color: theme.colors.onSurface }} keyboardType="numeric" value={profile.height} onChangeText={(v) => setProfile({ ...profile, height: v })} placeholder="Estatura (cm)" placeholderTextColor="#888" />
              <TextInput style={{ borderRadius: 12, padding: 12, backgroundColor: theme.colors.surfaceVariant, color: theme.colors.onSurface }} keyboardType="numeric" value={profile.weight} onChangeText={(v) => setProfile({ ...profile, weight: v })} placeholder="Peso (kg)" placeholderTextColor="#888" />
              <TextInput style={{ borderRadius: 12, padding: 12, backgroundColor: theme.colors.surfaceVariant, color: theme.colors.onSurface }} keyboardType="numeric" value={profile.age} onChangeText={(v) => setProfile({ ...profile, age: v })} placeholder="Edad" placeholderTextColor="#888" />
              <TextInput style={{ borderRadius: 12, padding: 12, backgroundColor: theme.colors.surfaceVariant, color: theme.colors.onSurface }} value={profile.city} onChangeText={(v) => setProfile({ ...profile, city: v })} placeholder="Ciudad" placeholderTextColor="#888" />

              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['principiante', 'intermedio', 'avanzado'].map((lv) => (
                  <TouchableOpacity
                    key={lv}
                    activeOpacity={0.8}
                    onPress={() => setProfile({ ...profile, level: lv })}
                    style={{ flex: 1, borderRadius: 999, paddingVertical: 10, alignItems: 'center', backgroundColor: profile.level === lv ? theme.colors.primary : theme.colors.surfaceVariant, borderWidth: 1, borderColor: profile.level === lv ? theme.colors.primary : theme.colors.outline }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: profile.level === lv ? theme.colors.onPrimary : theme.colors.onSurface, fontFamily: F.sansBold }}>{lv.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[{ key: 'km', label: 'KM / SEMANA' }, { key: 'pace', label: 'RITMO /KM' }].map((o) => (
                  <TouchableOpacity
                    key={o.key}
                    activeOpacity={0.8}
                    onPress={() => setProfile({ ...profile, goalType: o.key })}
                    style={{ flex: 1, borderRadius: 999, paddingVertical: 10, alignItems: 'center', backgroundColor: profile.goalType === o.key ? theme.colors.primary : theme.colors.surfaceVariant, borderWidth: 1, borderColor: profile.goalType === o.key ? theme.colors.primary : theme.colors.outline }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: profile.goalType === o.key ? theme.colors.onPrimary : theme.colors.onSurface, fontFamily: F.sansBold }}>{o.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {profile.goalType === 'km' ? (
                <TextInput style={{ borderRadius: 12, padding: 12, backgroundColor: theme.colors.surfaceVariant, color: theme.colors.onSurface }} keyboardType="numeric" value={profile.goalValue} onChangeText={(v) => setProfile({ ...profile, goalValue: v })} placeholder="Meta semanal (km)" placeholderTextColor="#888" />
              ) : (
                <TextInput style={{ borderRadius: 12, padding: 12, backgroundColor: theme.colors.surfaceVariant, color: theme.colors.onSurface }} value={profile.goalPace} onChangeText={(v) => setProfile({ ...profile, goalPace: v })} placeholder="Ritmo objetivo (mm:ss)" placeholderTextColor="#888" />
              )}

              <PaperButton mode="contained" onPress={() => setIsEditingProfile(false)} style={{ borderRadius: 999 }} buttonColor={theme.colors.primary} textColor={theme.colors.onPrimary}>
                Guardar cambios
              </PaperButton>
            </View>
          )}
        </Card.Content>
      </Card>

      <Card style={{ borderRadius: 24, backgroundColor: theme.colors.surface, marginTop: 18, borderWidth: 1, borderColor: theme.colors.outline }}>
        <Card.Content>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, fontFamily: F.sansSem }}>MI CUENTA</Text>
              <Text style={{ fontSize: 13, color: theme.colors.onSurface, marginTop: 4, fontFamily: F.sansMed }}>
                {user ? user.email : 'Sin sesión'}
              </Text>
              <Text style={{ fontSize: 11, lineHeight: 16, color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                {user
                  ? 'Historial sincronizado con tu cuenta'
                  : 'Opcional: el historial queda en este dispositivo'}
              </Text>
            </View>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: user ? 'rgba(215,254,71,0.12)' : theme.colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={user ? 'cloud-done' : 'cloud-offline-outline'} size={22} color={theme.colors.primary} />
            </View>
          </View>
          {user ? (
            <PaperButton mode="outlined" onPress={handleSignOut} style={{ borderRadius: 999, marginTop: 16 }} textColor={theme.colors.onSurface} icon={({ color, size }) => <Ionicons name="log-out-outline" size={size} color={color} />}>
              Cerrar sesión
            </PaperButton>
          ) : (
            <PaperButton
              mode="contained"
              onPress={() => { setAuthMode('login'); setAuthError(''); setShowAuthModal(true); }}
              style={{ borderRadius: 999, marginTop: 16 }}
              buttonColor={theme.colors.primary}
              textColor={theme.colors.onPrimary}
              icon={({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} />}
            >
              Iniciar sesión / Crear cuenta
            </PaperButton>
          )}
        </Card.Content>
      </Card>

      <View style={{ marginTop: 28, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: F.headingBold, fontSize: 18, fontWeight: '700', letterSpacing: -0.4, color: theme.colors.onSurface }}>Historial</Text>
        <View style={{ borderRadius: 999, backgroundColor: theme.colors.surfaceVariant, paddingHorizontal: 10, paddingVertical: 3 }}>
          <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 1, color: theme.colors.onSurfaceVariant, fontFamily: F.sansSem }}>{history.length} CARRERAS</Text>
        </View>
      </View>
      {history.length === 0 ? (
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: 20 }}>
          No tenés entrenamientos guardados.
        </Text>
      ) : (
        history.map((item) => (
          <Card key={item.id} style={{ borderRadius: 24, backgroundColor: theme.colors.surface, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.outline }}>
            <Card.Content>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  {new Date(item.date).toLocaleDateString()} · {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleDeleteRun(item.id)}
                  style={{ padding: 6 }}
                >
                  <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
                </TouchableOpacity>
              </View>
              <Text style={{ fontFamily: F.headingBold, fontSize: 34, fontWeight: '700', letterSpacing: -0.8, color: theme.colors.primary, marginVertical: 4, fontVariant: ['tabular-nums'] }}>{formatTimeFull(item.duration)}</Text>
              <Text variant="labelMedium" style={{ color: theme.colors.onSurface }}>
                SUPERFICIE: {item.surface.toUpperCase()} · SENSACIÓN: {item.feeling || 'Sin especificar'}
              </Text>
              {(item.notes || '').trim() ? (
                <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>💬 {item.notes}</Text>
              ) : null}
              {typeof item.steps === 'number' && item.steps > 0 && (
                <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>👟 {item.steps} pasos</Text>
              )}
              <PaperButton
                mode="outlined"
                onPress={() => exportToGPX(item)}
                style={{ alignSelf: 'flex-start', borderRadius: 999, marginTop: 10 }}
                textColor={theme.colors.primary}
                icon={({ color, size }) => <Ionicons name="download-outline" size={size} color={color} />}
              >
                Exportar GPX
              </PaperButton>
            </Card.Content>
          </Card>
        ))
      )}
    </ScrollView>
    );
  };

  const renderScene = ({ route }) => {
    switch (route.key) {
      case 'home': return renderHomeScreen();
      case 'run': return renderRunScreen();
      case 'tools': return renderToolsScreen();
      case 'profile': return renderProfileScreen();
      default: return renderRunScreen();
    }
  };

  const routes = [
    { key: 'home', title: 'Inicio' },
    { key: 'run', title: 'Correr' },
    { key: 'tools', title: 'Herramientas' },
    { key: 'profile', title: 'Perfil' },
  ];

  // Métricas en vivo para el overlay de pantalla bloqueada
  const lockMain = formatTimeRunParts(elapsedTime).main;
  const lockKm = routeDistanceMeters(locationList) / 1000;
  const lockPaceRaw = lockKm > 0.01 && elapsedTime > 0 ? elapsedTime / 60000 / lockKm : null;
  const lockPaceStr =
    lockPaceRaw != null
      ? `${String(Math.floor(lockPaceRaw)).padStart(2, '0')}:${String(Math.round((lockPaceRaw % 1) * 60)).padStart(2, '0')}`
      : '--:--';

  if (!fontsLoaded || !bootReady) {
    return <PreloadScreen isDarkMode={isDarkMode} />;
  }

  if (introDone === false) {
    return (
      <PaperProvider theme={theme}>
        <SafeAreaProvider>
          <IntroScreen isDarkMode={isDarkMode} onFinish={finishIntros} />
        </SafeAreaProvider>
      </PaperProvider>
    );
  }

  return (
    <PaperProvider theme={theme}>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />

          <View style={{ flex: 1 }}>
            {renderScene({ route: routes.find((r) => r.key === activeScreen) || routes[0] })}

            {!(isRunning || countdownValue !== null || showSaveModal || isLocked) && (
              <View style={{ position: 'absolute', bottom: 20, left: 24, right: 24, alignItems: 'center' }} pointerEvents="box-none">
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'rgba(23,25,20,0.96)',
                    borderRadius: 999,
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.55,
                    shadowRadius: 24,
                    elevation: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.05)',
                  }}
                >
                  {routes.map((route) => {
                    const focused = activeScreen === route.key;
                    const iconName =
                      route.key === 'home' ? 'home'
                        : route.key === 'run' ? 'play'
                          : route.key === 'tools' ? 'options'
                            : 'person';
                    return (
                        <TouchableOpacity
                          key={route.key}
                          activeOpacity={0.7}
                          onPress={() => setActiveScreen(route.key)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            height: 44,
                            minWidth: 44,
                            paddingHorizontal: focused ? 16 : 8,
                            borderRadius: 999,
                            backgroundColor: focused ? theme.colors.primary : 'transparent',
                          }}
                        >
                          <Ionicons name={iconName} size={focused ? 17 : 19} color={focused ? theme.colors.onPrimary : 'rgba(244,242,236,0.6)'} />
                          {focused && (
                            <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.onPrimary, fontFamily: F.sansSem }}>
                              {route.title.toUpperCase()}
                            </Text>
                          )}
                        </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {isLocked && (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.background, zIndex: 70 }]}>
                <View
                  pointerEvents="none"
                  style={{ position: 'absolute', top: -180, alignSelf: 'center', width: 480, height: 480, borderRadius: 240, backgroundColor: 'rgba(215,254,71,0.05)' }}
                />
                <TouchableOpacity
                  style={{ flex: 1, paddingHorizontal: 32, paddingVertical: 20 }}
                  activeOpacity={1}
                  delayLongPress={120}
                  onLongPress={() => setIsLocked(false)}
                >
                  <View style={{ flex: 1, justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary, opacity: 0.9 }} />
                        <Text style={{ fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 2, color: theme.colors.onSurfaceVariant, fontFamily: F.sansSem }}>
                          CARRERA ACTIVA
                        </Text>
                      </View>
                      <Text style={{ fontFamily: F.mono, fontSize: 13, color: theme.colors.onSurfaceVariant, fontVariant: ['tabular-nums'] }}>{lockMain}</Text>
                    </View>

                    <View style={{ alignItems: 'center' }}>
                      <View style={{ position: 'relative', width: 112, height: 112, borderRadius: 56, backgroundColor: 'rgba(27,29,24,0.8)', borderWidth: 1, borderColor: theme.colors.outline, alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
                        <SpinRing inset={8} />
                        <Ionicons name="lock-closed" size={44} color={theme.colors.primary} />
                      </View>
                      <Text style={{ fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 2.4, color: theme.colors.onSurfaceVariant, marginBottom: 6, fontFamily: F.sansSem }}>
                        MODO PROTEGIDO
                      </Text>
                      <Text style={{ fontFamily: F.headingBold, fontSize: 30, fontWeight: '700', color: theme.colors.onSurface, letterSpacing: -0.8 }}>
                        PANTALLA BLOQUEADA
                      </Text>
                      <Text style={{ fontSize: 13, color: theme.colors.onSurfaceVariant, marginTop: 8, textAlign: 'center', maxWidth: 240, fontFamily: F.sans }}>
                        Mantené presionado para desbloquear los controles
                      </Text>
                      <View style={{ marginTop: 28, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.outline, backgroundColor: 'rgba(27,29,24,0.6)', paddingHorizontal: 18, paddingVertical: 10 }}>
                        <Ionicons name="finger-print" size={18} color={theme.colors.primary} />
                        <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.4, color: theme.colors.onSurface, fontFamily: F.sansBold }}>
                          MANTENER 2 S
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingBottom: 8 }}>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontFamily: F.headingBold, fontSize: 18, fontWeight: '700', color: theme.colors.onSurface, fontVariant: ['tabular-nums'] }}>
                          {lockKm.toFixed(2)}<Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant, fontFamily: F.sansMed }}> km</Text>
                        </Text>
                        <Text style={{ fontSize: 9, letterSpacing: 1.6, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, marginTop: 4, fontFamily: F.sansMed }}>DISTANCIA</Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontFamily: F.headingBold, fontSize: 18, fontWeight: '700', color: theme.colors.onSurface, fontVariant: ['tabular-nums'] }}>{cadence}</Text>
                        <Text style={{ fontSize: 9, letterSpacing: 1.6, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, marginTop: 4, fontFamily: F.sansMed }}>PASOS/MIN</Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontFamily: F.headingBold, fontSize: 18, fontWeight: '700', color: theme.colors.onSurface, fontVariant: ['tabular-nums'] }}>
                          {lockPaceStr}<Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant, fontFamily: F.sansMed }}> /km</Text>
                        </Text>
                        <Text style={{ fontSize: 9, letterSpacing: 1.6, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, marginTop: 4, fontFamily: F.sansMed }}>RITMO</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {countdownValue !== null && (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.background, zIndex: 60 }]}>
                <View
                  pointerEvents="none"
                  style={{ position: 'absolute', top: '18%', alignSelf: 'center', width: 380, height: 380, borderRadius: 190, backgroundColor: 'rgba(215,254,71,0.08)' }}
                />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 28, paddingHorizontal: 32 }}>
                    <Text style={{ fontSize: 10, letterSpacing: 2.4, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, fontFamily: F.sansSem }}>
                      GOTRACK LIVE
                    </Text>
                    <View style={{ borderRadius: 999, backgroundColor: theme.colors.surfaceVariant, paddingHorizontal: 14, paddingVertical: 5 }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', letterSpacing: 1.4, textTransform: 'uppercase', color: theme.colors.primary, fontFamily: F.sansSem }}>
                        LISTO
                      </Text>
                    </View>
                  </View>

                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ position: 'relative', width: 224, height: 224, borderRadius: 112, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: theme.colors.primary, shadowOpacity: 0.25, shadowRadius: 40, elevation: 14 }}>
                      <Text style={{ fontFamily: F.headingBold, fontSize: 116, lineHeight: 120, fontWeight: '700', color: theme.colors.onPrimary, fontVariant: ['tabular-nums'], letterSpacing: -6 }}>
                        {countdownValue}
                      </Text>
                      <PulseRing inset={12} />
                    </View>
                    <Text style={{ fontSize: 12, letterSpacing: 2.6, textTransform: 'uppercase', color: theme.colors.primary, fontWeight: '600', marginTop: 32, marginBottom: 6, fontFamily: F.sansSem }}>
                      INICIO AUTOMÁTICO
                    </Text>
                    <Text style={{ fontFamily: F.headingBold, fontSize: 34, fontWeight: '700', color: theme.colors.onSurface, letterSpacing: -0.8 }}>
                      PREPARATE
                    </Text>
                    <Text style={{ fontSize: 13, color: theme.colors.onSurfaceVariant, marginTop: 8, textAlign: 'center', paddingHorizontal: 32, fontFamily: F.sans }}>
                      Buscando señal GPS óptima y calibrando sensor...
                    </Text>
                  </View>

                  <View style={{ alignItems: 'center', paddingBottom: 44 }}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={cancelCountdown}
                      style={{ height: 44, paddingHorizontal: 30, borderRadius: 999, backgroundColor: theme.colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.outline }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, color: theme.colors.onSurface, fontFamily: F.sansBold }}>CANCELAR</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {metaModal && (() => {
              const conf = META_CONF[metaModal];
              const hasValue = metaDraft.trim() !== '';
              return (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,6,4,0.72)', justifyContent: 'center', padding: 20, zIndex: 64 }]}>
                  <View style={{ borderRadius: 28, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(48,51,44,0.18)' }}>
                    <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 26 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Ionicons name={conf.icon} size={16} color={theme.colors.primary} />
                          <Text style={{ fontSize: 10, letterSpacing: 1.8, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, fontFamily: F.sansSem }}>EDITAR META · {metaModal}</Text>
                        </View>
                        <TouchableOpacity activeOpacity={0.7} onPress={() => setMetaModal(null)} hitSlop={10}>
                          <Ionicons name="close" size={20} color={theme.colors.onSurfaceVariant} />
                        </TouchableOpacity>
                      </View>
                      <Text style={{ fontFamily: F.heading, fontSize: 22, fontWeight: '700', letterSpacing: -0.5, color: theme.colors.onSurface, marginBottom: 4 }}>{metaModal}</Text>
                      <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant, marginBottom: 16, fontFamily: F.sans }}>{conf.subtitle}</Text>

                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                        {conf.chips.map((c) => (
                          <TouchableOpacity
                            key={c}
                            activeOpacity={0.7}
                            onPress={() => setMetaDraft(c)}
                            style={{ borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: metaDraft === c ? theme.colors.primary : theme.colors.surfaceVariant, borderWidth: 1, borderColor: metaDraft === c ? theme.colors.primary : theme.colors.outline }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: metaDraft === c ? theme.colors.onPrimary : theme.colors.onSurface, fontFamily: F.sansBold, fontVariant: ['tabular-nums'] }}>{c}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: theme.colors.outline, backgroundColor: theme.colors.surfaceVariant, paddingHorizontal: 14, marginBottom: 18 }}>
                        <TextInput
                          style={{ flex: 1, paddingVertical: 12, color: theme.colors.onSurface, fontFamily: F.headingBold, fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] }}
                          keyboardType={conf.keyboard}
                          value={metaDraft}
                          onChangeText={setMetaDraft}
                          placeholder={conf.placeholder}
                          placeholderTextColor={theme.colors.onSurfaceVariant}
                        />
                        <Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant, fontFamily: F.sansMed }}>{conf.unit}</Text>
                      </View>

                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        {hasValue && (
                          <PaperButton
                            mode="outlined"
                            onPress={() => { setMetaDraft(''); setMetaModal(null); }}
                            style={{ borderRadius: 999, minHeight: 48, justifyContent: 'center' }}
                            textColor={theme.colors.onSurfaceVariant}
                          >
                            BORRAR
                          </PaperButton>
                        )}
                        <PaperButton
                          mode="contained"
                          onPress={saveMeta}
                          style={{ flex: 1, borderRadius: 999, minHeight: 48, justifyContent: 'center' }}
                          buttonColor={theme.colors.primary}
                          textColor={theme.colors.onPrimary}
                        >
                          GUARDAR
                        </PaperButton>
                      </View>
                    </ScrollView>
                  </View>
                </View>
              );
            })()}

            {showSaveModal && (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,6,4,0.72)', justifyContent: 'center', padding: 20, zIndex: 65 }]}>
                <Card style={{ borderRadius: 28, backgroundColor: theme.colors.surface, maxHeight: '88%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' }}>
                  <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 30 }}>
                    <View style={{ alignItems: 'center', marginBottom: 10 }}>
                      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(215,254,71,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="checkmark-circle" size={28} color={theme.colors.primary} />
                      </View>
                    </View>
                    <Text style={{ fontFamily: F.headingBold, fontSize: 22, fontWeight: '700', letterSpacing: -0.5, color: theme.colors.onSurface, textAlign: 'center' }}>
                      GUARDAR ENTRENAMIENTO
                    </Text>
                    <Text style={{ fontFamily: F.headingBold, fontSize: 40, fontWeight: '700', color: theme.colors.primary, textAlign: 'center', marginVertical: 10, fontVariant: ['tabular-nums'] }}>
                      {formatTimeFull(elapsedTime)}
                    </Text>

                    <Text style={{ fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, marginBottom: 8, fontFamily: F.sansSem }}>SUPERFICIE</Text>
                    <View style={{ flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                      {['asfalto', 'pista', 'tierra'].map((item) => (
                        <PaperButton
                          key={item}
                          mode={surface === item ? 'contained' : 'outlined'}
                          onPress={() => setSurface(item)}
                          style={{ borderRadius: 999, minHeight: 46, justifyContent: 'center' }}
                          buttonColor={surface === item ? theme.colors.primary : undefined}
                          textColor={surface === item ? theme.colors.onPrimary : theme.colors.onSurface}
                        >
                          {item.toUpperCase()}
                        </PaperButton>
                      ))}
                    </View>

                    <Text style={{ fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, marginBottom: 8, fontFamily: F.sansSem }}>SENSACIÓN AL TERMINAR</Text>
                    <View style={{ flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                      {['😀 Excelente', '😐 Normal', '😫 Agotado'].map((item) => (
                        <PaperButton
                          key={item}
                          mode={feeling === item ? 'contained' : 'outlined'}
                          onPress={() => setFeeling(item)}
                          style={{ borderRadius: 999, minHeight: 46, justifyContent: 'center' }}
                          buttonColor={feeling === item ? theme.colors.primary : undefined}
                          textColor={feeling === item ? theme.colors.onPrimary : theme.colors.onSurface}
                        >
                          {item}
                        </PaperButton>
                      ))}
                    </View>

                    <Text style={{ fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: theme.colors.onSurfaceVariant, marginBottom: 10, fontFamily: F.sansSem }}>CÓMO ESTABA LA PISTA</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                      {['SECA', 'MOJADA', 'BARRO', 'PASTO'].map((t) => {
                        const tag = `Pista ${t.toLowerCase()}`;
                        const active = notes === tag;
                        return (
                          <TouchableOpacity
                            key={t}
                            activeOpacity={0.7}
                            onPress={() => setNotes(active ? '' : tag)}
                            style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: active ? theme.colors.primary : theme.colors.surfaceVariant, borderWidth: 1, borderColor: active ? theme.colors.primary : theme.colors.outline }}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: active ? theme.colors.onPrimary : theme.colors.onSurface, fontFamily: F.sansBold }}>{t}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <TextInput
                      style={{ borderRadius: 16, padding: 12, backgroundColor: theme.colors.surfaceVariant, color: theme.colors.onSurface, borderWidth: 1, borderColor: theme.colors.outline, marginBottom: 18, textAlignVertical: 'top', fontFamily: F.sans }}
                      placeholder="Contanos cómo estaba la pista: barro, seca, mojada, pasto alto…"
                      placeholderTextColor={theme.colors.onSurfaceVariant}
                      multiline
                      numberOfLines={3}
                      value={notes}
                      onChangeText={setNotes}
                    />

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <PaperButton
                        mode="outlined"
                        onPress={() => setShowSaveModal(false)}
                        style={{ flex: 1, borderRadius: 999, minHeight: 48, justifyContent: 'center' }}
                        textColor={theme.colors.onSurface}
                      >
                        SEGUIR
                      </PaperButton>
                      <PaperButton
                        mode="contained"
                        onPress={handleSaveRun}
                        style={{ flex: 1, borderRadius: 999, minHeight: 48, justifyContent: 'center' }}
                        buttonColor={theme.colors.primary}
                        textColor={theme.colors.onPrimary}
                      >
                        GUARDAR
                      </PaperButton>
                    </View>
                  </ScrollView>
                </Card>
              </View>
            )}

            {showAuthModal && (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,6,4,0.72)', justifyContent: 'center', padding: 20, zIndex: 66 }]}>
                <Card style={{ borderRadius: 28, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' }}>
                  <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 26 }}>
                    <View style={{ alignItems: 'center', marginBottom: 10 }}>
                      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(215,254,71,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={user ? 'cloud-done' : 'person-circle'} size={28} color={theme.colors.primary} />
                      </View>
                    </View>
                    <Text style={{ fontFamily: F.headingBold, fontSize: 22, fontWeight: '700', letterSpacing: -0.5, color: theme.colors.onSurface, textAlign: 'center' }}>
                      MI CUENTA
                    </Text>
                    <Text style={{ fontSize: 12, lineHeight: 18, color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: 6, marginBottom: 16 }}>
                      {user
                        ? `Sesión iniciada como ${user.email}. Tu historial viaja con la cuenta.`
                        : 'El login es opcional. Sin cuenta, los datos se guardan en este dispositivo.'}
                    </Text>

                    <View style={{ flexDirection: 'row', backgroundColor: theme.colors.surfaceVariant, borderRadius: 999, padding: 4, marginBottom: 16 }}>
                      {['login', 'signup'].map((mode) => (
                        <TouchableOpacity
                          key={mode}
                          onPress={() => { setAuthMode(mode); setAuthError(''); }}
                          style={{ flex: 1, borderRadius: 999, paddingVertical: 9, alignItems: 'center', backgroundColor: authMode === mode ? theme.colors.primary : 'transparent' }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: authMode === mode ? theme.colors.onPrimary : theme.colors.onSurfaceVariant, fontFamily: F.sansBold }}>
                            {mode === 'login' ? 'INICIAR SESIÓN' : 'CREAR CUENTA'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TextInput
                      style={{ borderRadius: 16, padding: 12, backgroundColor: theme.colors.surfaceVariant, color: theme.colors.onSurface, borderWidth: 1, borderColor: theme.colors.outline, marginBottom: 10, fontFamily: F.sans }}
                      placeholder="Email"
                      placeholderTextColor={theme.colors.onSurfaceVariant}
                      value={authEmail}
                      onChangeText={setAuthEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                    />
                    <TextInput
                      style={{ borderRadius: 16, padding: 12, backgroundColor: theme.colors.surfaceVariant, color: theme.colors.onSurface, borderWidth: 1, borderColor: theme.colors.outline, marginBottom: 12, fontFamily: F.sans }}
                      placeholder="Contraseña (mínimo 6 caracteres)"
                      placeholderTextColor={theme.colors.onSurfaceVariant}
                      value={authPassword}
                      onChangeText={setAuthPassword}
                      secureTextEntry
                      autoCapitalize="none"
                    />

                    {authError ? (
                      <Text style={{ fontSize: 12, color: theme.colors.error, textAlign: 'center', marginBottom: 10 }}>⚠️ {authError}</Text>
                    ) : null}

                    <PaperButton
                      mode="contained"
                      onPress={handleAuth}
                      disabled={authBusy}
                      style={{ borderRadius: 999, minHeight: 48, justifyContent: 'center' }}
                      buttonColor={theme.colors.primary}
                      textColor={theme.colors.onPrimary}
                    >
                      {authBusy ? 'PROCESANDO…' : authMode === 'login' ? 'INGRESAR' : 'CREAR CUENTA'}
                    </PaperButton>
                    <PaperButton
                      mode="outlined"
                      onPress={() => setShowAuthModal(false)}
                      style={{ borderRadius: 999, minHeight: 48, justifyContent: 'center', marginTop: 10 }}
                      textColor={theme.colors.onSurface}
                    >
                      CERRAR
                    </PaperButton>
                  </ScrollView>
                </Card>
              </View>
            )}
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </PaperProvider>
  );
}
