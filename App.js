import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StatusBar,
  Alert
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import * as Speech from 'expo-speech';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import * as SQLite from 'expo-sqlite';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Cronómetro
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [prepTime, setPrepTime] = useState(3);
  const [countdownValue, setCountdownValue] = useState(null);

  // GPS y Sensores
  const [locationList, setLocationList] = useState([]);
  const [stepCount, setStepCount] = useState(0);
  const [cadence, setCadence] = useState(0);

  // Formulario
  const [notes, setNotes] = useState('');
  const [surface, setSurface] = useState('asfalto');
  const [feeling, setFeeling] = useState('😀 Excelente');
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Datos
  const [history, setHistory] = useState([]);
  const [profile, setProfile] = useState({
    name: 'Atleta GoTrack',
    height: '175',
    weight: '70',
    avatar: '🏃‍♂️',
    bio: 'Entrenando para mi mejor marca personal.',
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Refs
  const startTimeRef = useRef(0);
  const accumulatedTimeRef = useRef(0);
  const requestRef = useRef(null);
  const locationSubRef = useRef(null);
  const pedometerSubRef = useRef(null);
  const webViewRef = useRef(null);
  const dbRef = useRef(null);

  useEffect(() => {
    initDatabase();
    return () => {
      cancelAnimationFrame(requestRef.current);
      stopSensors();
    };
  }, []);

  const initDatabase = async () => {
    try {
      const db = await SQLite.openDatabaseAsync('gotrack.db');
      dbRef.current = db;
      await db.execAsync(`
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
      loadDatabaseRuns();
    } catch (e) {
      console.error('Error inicializando base de datos SQLite', e);
    }
  };

  const loadDatabaseRuns = async () => {
    if (!dbRef.current) return;
    try {
      const allRows = await dbRef.current.getAllAsync('SELECT * FROM runs ORDER BY date DESC;');
      setHistory(allRows);
    } catch (e) {
      console.error('Error cargando historial de SQLite', e);
    }
  };

  // Enviar coordenadas al mapa sin parpadeo (WebView Message)
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
    setIsRunning(true);
    requestRef.current = requestAnimationFrame(updateTimer);
    await activateKeepAwakeAsync();
    startSensors();
  };

  const pauseClock = async () => {
    cancelAnimationFrame(requestRef.current);
    accumulatedTimeRef.current = elapsedTime;
    setIsRunning(false);
    await deactivateKeepAwake();
    stopSensors();
  };

  const stopClockAndReset = async () => {
    cancelAnimationFrame(requestRef.current);
    setIsRunning(false);
    await deactivateKeepAwake();
    stopSensors();
    setShowSaveModal(true);
  };

  const startSensors = async () => {
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

    const isAvailable = await Pedometer.isAvailableAsync();
    if (isAvailable) {
      pedometerSubRef.current = Pedometer.watchStepCount((result) => {
        setStepCount(result.steps);
        if (elapsedTime > 0) {
          const minutes = elapsedTime / 60000;
          setCadence(Math.round(result.steps / minutes));
        }
      });
    }
  };

  const stopSensors = () => {
    if (locationSubRef.current) locationSubRef.current.remove();
    if (pedometerSubRef.current) pedometerSubRef.current.remove();
  };

  // Conteo regresivo sincronizado
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
        setCountdownValue(null);
        Speech.stop();
        Speech.speak('¡Ya!', { language: 'es-AR', rate: 1.2 });
        startClock();
      }
    }, 1000);
  };

  const handleSaveRun = async () => {
    const id = Date.now().toString();
    const date = new Date().toISOString();
    const locationsJson = JSON.stringify(locationList);

    if (dbRef.current) {
      try {
        await dbRef.current.runAsync(
          'INSERT INTO runs (id, date, duration, surface, feeling, notes, steps, locations) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [id, date, elapsedTime, surface, feeling, notes, stepCount, locationsJson]
        );
        loadDatabaseRuns();
      } catch (e) {
        console.error('Error insertando carrera en SQLite', e);
      }
    }

    setNotes('');
    setElapsedTime(0);
    setStepCount(0);
    setCadence(0);
    setLocationList([]);
    accumulatedTimeRef.current = 0;
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
          if (dbRef.current) {
            await dbRef.current.runAsync('DELETE FROM runs WHERE id = ?', [id]);
            loadDatabaseRuns();
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

  // HTML Dinámico del Mapa
  const mapHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; background: ${isDarkMode ? '#0F0F11' : '#FFFFFF'}; }
        #map { width: 100vw; height: 100vh; ${isDarkMode ? 'filter: invert(90%) hue-rotate(180deg);' : ''} }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        let map, polyline, marker;
        map = L.map('map', { zoomControl: false }).setView([-34.9214, -57.9545], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

        document.addEventListener("message", function(event) {
          const data = JSON.parse(event.data);
          if (data.type === 'UPDATE_LOCATIONS' && data.coords.length > 0) {
            const coords = data.coords;
            const lastCoord = coords[coords.length - 1];

            if (!polyline) {
              polyline = L.polyline(coords, { color: '#FF4D00', weight: 5 }).addTo(map);
              marker = L.marker(lastCoord).addTo(map);
            } else {
              polyline.setLatLngs(coords);
              marker.setLatLng(lastCoord);
            }
            map.setView(lastCoord);
          }
        });
      </script>
    </body>
    </html>
  `;

  const theme = isDarkMode ? darkStyles : lightStyles;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />

        <View style={[styles.topHeader, { backgroundColor: theme.cardBg }]}>
          <Text style={[styles.brandTitle, { color: theme.text }]}>
            GO<Text style={{ color: '#FF4D00' }}>TRACK</Text>
          </Text>
          <TouchableOpacity style={styles.themeToggleBtn} onPress={() => setIsDarkMode(!isDarkMode)}>
            <Text style={styles.themeToggleText}>{isDarkMode ? '☀️ Claro' : '🌙 Oscuro'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.mainContent}>
          {activeTab === 'home' && (
            <View style={styles.fullScreenView}>
              <View style={StyleSheet.absoluteFill}>
                <WebView
                  ref={webViewRef}
                  originWhitelist={['*']}
                  source={{ html: mapHTML }}
                  scrollEnabled={false}
                />
              </View>

              <View style={styles.topClockOverlay}>
                <View style={[styles.clockDisplayCard, { backgroundColor: theme.cardOverlay }]}>
                  <Text style={styles.clockTimeText}>{formatTimeFull(elapsedTime)}</Text>
                  <Text style={styles.clockSubText}>
                    {isRunning ? 'EN CARRERA' : elapsedTime > 0 ? 'EN PAUSA' : 'LISTO PARA EMPEZAR'}
                  </Text>

                  <View style={styles.metricsRow}>
                    <Text style={[styles.metricText, { color: theme.text }]}>👟 PASOS: {stepCount}</Text>
                    <Text style={[styles.metricText, { color: theme.text }]}>⚡ CADENCIA: {cadence} SPM</Text>
                  </View>
                </View>
              </View>

              {countdownValue !== null && (
                <View style={styles.countdownOverlay}>
                  <View style={styles.countdownCircle}>
                    <Text style={styles.countdownNumber}>{countdownValue}</Text>
                    <Text style={styles.countdownSub}>PREPARATE</Text>
                  </View>
                </View>
              )}

              {isLocked && (
                <TouchableOpacity style={styles.lockOverlay} activeOpacity={0.9} onLongPress={() => setIsLocked(false)}>
                  <Text style={styles.lockIcon}>🔒</Text>
                  <Text style={styles.lockTitle}>PANTALLA BLOQUEADA</Text>
                  <Text style={styles.lockSub}>Mantené presionado para desbloquear</Text>
                </TouchableOpacity>
              )}

              {!isLocked && countdownValue === null && (
                <View style={[styles.bottomControlCard, { backgroundColor: theme.cardOverlay }]}>
                  {elapsedTime === 0 && !isRunning && (
                    <View style={styles.prepRow}>
                      <Text style={[styles.prepLabel, { color: theme.subText }]}>CUENTA REGRESIVA DE SALIDA:</Text>
                      <View style={styles.prepButtons}>
                        {[0, 3, 5, 10].map((val) => (
                          <TouchableOpacity
                            key={val}
                            style={[styles.prepChip, prepTime === val && styles.prepChipActive]}
                            onPress={() => setPrepTime(val)}>
                            <Text style={[styles.prepChipText, prepTime === val && styles.prepChipTextActive]}>
                              {val}s
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  <View style={styles.actionRow}>
                    {!isRunning && elapsedTime === 0 && (
                      <TouchableOpacity style={styles.primaryBtn} onPress={handleStartCountdown}>
                        <Text style={styles.primaryBtnText}>▶ INICIAR CARRERA</Text>
                      </TouchableOpacity>
                    )}

                    {isRunning && (
                      <>
                        <TouchableOpacity style={styles.secondaryBtn} onPress={pauseClock}>
                          <Text style={styles.btnText}>⏸ PAUSAR</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.lockBtn} onPress={() => setIsLocked(true)}>
                          <Text style={styles.btnText}>🔒 BLOQUEAR</Text>
                        </TouchableOpacity>
                      </>
                    )}

                    {!isRunning && elapsedTime > 0 && (
                      <>
                        <TouchableOpacity style={styles.primaryBtn} onPress={startClock}>
                          <Text style={styles.primaryBtnText}>▶ REANUDAR</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.dangerBtn} onPress={stopClockAndReset}>
                          <Text style={styles.btnText}>⏹ FINALIZAR</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              )}

              {showSaveModal && (
                <View style={styles.modalOverlay}>
                  <View style={[styles.modalCard, { backgroundColor: theme.cardBg }]}>
                    <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                      <Text style={[styles.modalTitle, { color: theme.text }]}>GUARDAR ENTRENAMIENTO</Text>
                      <Text style={styles.modalTime}>{formatTimeFull(elapsedTime)}</Text>

                      <Text style={[styles.fieldLabel, { color: theme.subText }]}>SUPERFICIE</Text>
                      <View style={styles.surfaceRow}>
                        {['asfalto', 'pista', 'tierra'].map((item) => (
                          <TouchableOpacity
                            key={item}
                            style={[styles.surfaceBtn, surface === item && styles.surfaceBtnActive]}
                            onPress={() => setSurface(item)}>
                            <Text style={[styles.surfaceText, surface === item && styles.surfaceTextActive]}>
                              {item.toUpperCase()}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Text style={[styles.fieldLabel, { color: theme.subText }]}>SENSACIÓN AL TERMINAR</Text>
                      <View style={styles.surfaceRow}>
                        {['😀 Excelente', '😐 Normal', '😫 Agotado'].map((item) => (
                          <TouchableOpacity
                            key={item}
                            style={[styles.surfaceBtn, feeling === item && styles.surfaceBtnActive]}
                            onPress={() => setFeeling(item)}>
                            <Text style={[styles.surfaceText, feeling === item && styles.surfaceTextActive]}>
                              {item}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Text style={[styles.fieldLabel, { color: theme.subText }]}>OBSERVACIONES</Text>
                      <TextInput
                        style={[styles.modalInput, { color: theme.text, backgroundColor: theme.inputBg }]}
                        placeholder="Escribí notas del recorrido..."
                        placeholderTextColor="#888"
                        multiline
                        numberOfLines={3}
                        value={notes}
                        onChangeText={setNotes}
                      />

                      <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveRun}>
                        <Text style={styles.primaryBtnText}>GUARDAR REGISTRO</Text>
                      </TouchableOpacity>
                    </ScrollView>
                  </View>
                </View>
              )}
            </View>
          )}

          {activeTab === 'history' && (
            <ScrollView contentContainerStyle={styles.scrollPage}>
              <Text style={[styles.pageTitle, { color: theme.text }]}>HISTORIAL DE CARRERAS (SQLITE)</Text>
              {history.length === 0 ? (
                <Text style={styles.emptyText}>No tenés entrenamientos guardados.</Text>
              ) : (
                history.map((item) => (
                  <View key={item.id} style={[styles.historyCard, { backgroundColor: theme.cardBg }]}>
                    <View style={styles.historyHeader}>
                      <Text style={[styles.historyDate, { color: theme.subText }]}>
                        {new Date(item.date).toLocaleDateString()} - {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      <TouchableOpacity onPress={() => handleDeleteRun(item.id)}>
                        <Text style={styles.deleteBtnText}>🗑️ Borrar</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.historyTime}>{formatTimeFull(item.duration)}</Text>
                    <Text style={[styles.historyTag, { color: theme.text }]}>
                      SUPERFICIE: {item.surface.toUpperCase()} | SENSACIÓN: {item.feeling || 'Sin especificar'}
                    </Text>

                    <TouchableOpacity style={styles.exportBtn} onPress={() => exportToGPX(item)}>
                      <Text style={styles.exportBtnText}>📤 Exportar GPX</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          )}

          {activeTab === 'profile' && (
            <ScrollView contentContainerStyle={styles.scrollPage}>
              <Text style={[styles.pageTitle, { color: theme.text }]}>MI PERFIL</Text>

              <View style={[styles.profileBox, { backgroundColor: theme.cardBg }]}>
                <View style={styles.profileAvatarRow}>
                  <Text style={styles.avatarDisplay}>{profile.avatar}</Text>
                  <View style={{ flex: 1, marginLeft: 15 }}>
                    <Text style={[styles.profileName, { color: theme.text }]}>{profile.name}</Text>
                    <Text style={[styles.profileSub, { color: theme.subText }]}>{profile.bio}</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                {!isEditingProfile ? (
                  <>
                    <View style={styles.statsRow}>
                      <View style={styles.statBox}>
                        <Text style={styles.statValue}>{profile.height} cm</Text>
                        <Text style={[styles.statLabel, { color: theme.subText }]}>ESTATURA</Text>
                      </View>
                      <View style={styles.statBox}>
                        <Text style={styles.statValue}>{profile.weight} kg</Text>
                        <Text style={[styles.statLabel, { color: theme.subText }]}>PESO</Text>
                      </View>
                      <View style={styles.statBox}>
                        <Text style={styles.statValue}>{history.length}</Text>
                        <Text style={[styles.statLabel, { color: theme.subText }]}>CARRERAS</Text>
                      </View>
                    </View>

                    <TouchableOpacity style={styles.secondaryBtn} onPress={() => setIsEditingProfile(true)}>
                      <Text style={styles.btnText}>✏️ EDITAR PERFIL</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={{ gap: 10 }}>
                    <Text style={[styles.fieldLabel, { color: theme.subText }]}>AVATAR (EMOJI)</Text>
                    <TextInput
                      style={[styles.modalInput, { color: theme.text, backgroundColor: theme.inputBg }]}
                      value={profile.avatar}
                      onChangeText={(val) => setProfile({ ...profile, avatar: val })}
                    />

                    <Text style={[styles.fieldLabel, { color: theme.subText }]}>NOMBRE</Text>
                    <TextInput
                      style={[styles.modalInput, { color: theme.text, backgroundColor: theme.inputBg }]}
                      value={profile.name}
                      onChangeText={(val) => setProfile({ ...profile, name: val })}
                    />

                    <Text style={[styles.fieldLabel, { color: theme.subText }]}>ESTATURA (CM)</Text>
                    <TextInput
                      style={[styles.modalInput, { color: theme.text, backgroundColor: theme.inputBg }]}
                      keyboardType="numeric"
                      value={profile.height}
                      onChangeText={(val) => setProfile({ ...profile, height: val })}
                    />

                    <Text style={[styles.fieldLabel, { color: theme.subText }]}>PESO (KG)</Text>
                    <TextInput
                      style={[styles.modalInput, { color: theme.text, backgroundColor: theme.inputBg }]}
                      keyboardType="numeric"
                      value={profile.weight}
                      onChangeText={(val) => setProfile({ ...profile, weight: val })}
                    />

                    <TouchableOpacity style={styles.primaryBtn} onPress={() => setIsEditingProfile(false)}>
                      <Text style={styles.primaryBtnText}>GUARDAR CAMBIOS</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </View>

        <View style={[styles.tabBar, { backgroundColor: theme.cardBg }]}>
          <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab('home')}>
            <Text style={styles.tabIcon}>⏱️</Text>
            <Text style={[styles.tabLabel, activeTab === 'home' && styles.tabLabelActive]}>PRINCIPAL</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab('history')}>
            <Text style={styles.tabIcon}>📜</Text>
            <Text style={[styles.tabLabel, activeTab === 'history' && styles.tabLabelActive]}>HISTORIAL</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab('profile')}>
            <Text style={styles.tabIcon}>👤</Text>
            <Text style={[styles.tabLabel, activeTab === 'profile' && styles.tabLabelActive]}>PERFIL</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const darkStyles = {
  bg: '#0F0F11',
  cardBg: '#1A1A1E',
  cardOverlay: 'rgba(26, 26, 30, 0.95)',
  inputBg: '#2A2A2E',
  text: '#FFFFFF',
  subText: '#888888',
};

const lightStyles = {
  bg: '#F4F4F6',
  cardBg: '#FFFFFF',
  cardOverlay: 'rgba(255, 255, 255, 0.95)',
  inputBg: '#EAEAEA',
  text: '#1A1A1E',
  subText: '#666666',
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  brandTitle: { fontSize: 20, fontWeight: '900', letterSpacing: 1.5 },
  themeToggleBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(255, 77, 0, 0.15)' },
  themeToggleText: { color: '#FF4D00', fontWeight: '800', fontSize: 12 },
  mainContent: { flex: 1 },
  fullScreenView: { flex: 1, position: 'relative' },
  topClockOverlay: { position: 'absolute', top: 15, left: 15, right: 15, zIndex: 10 },
  clockDisplayCard: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  clockTimeText: { fontSize: 40, fontWeight: '900', color: '#FF4D00', fontVariant: ['tabular-nums'] },
  clockSubText: { color: '#888', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  metricsRow: { flexDirection: 'row', gap: 15, marginTop: 6 },
  metricText: { fontSize: 11, fontWeight: '800' },
  bottomControlCard: {
    position: 'absolute',
    bottom: 15,
    left: 15,
    right: 15,
    padding: 15,
    borderRadius: 16,
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  prepRow: { marginBottom: 10 },
  prepLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  prepButtons: { flexDirection: 'row', gap: 8 },
  prepChip: { flex: 1, paddingVertical: 8, backgroundColor: '#2A2A2E', borderRadius: 8, alignItems: 'center' },
  prepChipActive: { backgroundColor: '#FF4D00' },
  prepChipText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
  prepChipTextActive: { color: '#0F0F11' },
  actionRow: { flexDirection: 'row', gap: 10 },
  primaryBtn: { flex: 1, backgroundColor: '#FF4D00', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  primaryBtnText: { color: '#0F0F11', fontWeight: '900', fontSize: 14 },
  secondaryBtn: { flex: 1, backgroundColor: '#2A2A2E', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  lockBtn: { width: 100, backgroundColor: '#2A2A2E', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  dangerBtn: { flex: 1, backgroundColor: '#D32F2F', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,15,17,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  countdownCircle: { width: 150, height: 150, borderRadius: 75, backgroundColor: '#FF4D00', justifyContent: 'center', alignItems: 'center' },
  countdownNumber: { fontSize: 64, fontWeight: '900', color: '#0F0F11' },
  countdownSub: { fontSize: 11, fontWeight: '900', color: '#0F0F11' },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 15, 17, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
  },
  lockIcon: { fontSize: 48, marginBottom: 10 },
  lockTitle: { color: '#FFF', fontSize: 20, fontWeight: '900' },
  lockSub: { color: '#FF4D00', fontSize: 12, fontWeight: '700', marginTop: 5 },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    padding: 20,
    zIndex: 40,
  },
  modalCard: { maxHeight: '80%', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  modalTime: { color: '#FF4D00', fontSize: 32, fontWeight: '900', textAlign: 'center', marginVertical: 10 },
  fieldLabel: { fontSize: 11, fontWeight: '800', marginTop: 10, marginBottom: 6 },
  surfaceRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  surfaceBtn: { flex: 1, paddingVertical: 10, backgroundColor: '#2A2A2E', borderRadius: 8, alignItems: 'center' },
  surfaceBtnActive: { backgroundColor: '#FF4D00' },
  surfaceText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  surfaceTextActive: { color: '#0F0F11' },
  modalInput: { borderRadius: 8, padding: 10, textAlignVertical: 'top', marginBottom: 15 },
  scrollPage: { padding: 20 },
  pageTitle: { fontSize: 20, fontWeight: '900', marginBottom: 15 },
  emptyText: { color: '#666', textAlign: 'center', marginTop: 40 },
  historyCard: { padding: 15, borderRadius: 12, marginBottom: 10 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  historyDate: { fontSize: 11 },
  deleteBtnText: { color: '#FF4D00', fontSize: 11, fontWeight: '700' },
  historyTime: { color: '#FF4D00', fontSize: 24, fontWeight: '900', marginVertical: 4 },
  historyTag: { fontSize: 11, fontWeight: '700' },
  exportBtn: { backgroundColor: '#2A2A2E', padding: 8, borderRadius: 6, marginTop: 8, alignItems: 'center' },
  exportBtnText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  profileBox: { padding: 20, borderRadius: 16 },
  profileAvatarRow: { flexDirection: 'row', alignItems: 'center' },
  avatarDisplay: { fontSize: 48 },
  profileName: { fontSize: 20, fontWeight: '900' },
  profileSub: { fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: 'rgba(128,128,128,0.2)', marginVertical: 15 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15 },
  statBox: { alignItems: 'center' },
  statValue: { color: '#FF4D00', fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '800', marginTop: 2 },
  tabBar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.2)', paddingVertical: 10 },
  tabButton: { flex: 1, alignItems: 'center' },
  tabIcon: { fontSize: 18, marginBottom: 2 },
  tabLabel: { color: '#666', fontSize: 10, fontWeight: '800' },
  tabLabelActive: { color: '#FF4D00' },
});