import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  // --- ESTADOS DE RASTREO Y SENSORES ---
  const [isTracking, setIsTracking] = useState(false);
  const [location, setLocation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [distanceKm, setDistanceKm] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [steps, setSteps] = useState(0);
  const [cadence, setCadence] = useState(0);

  // --- ESTADOS DE METAS Y CONFIGURACIÓN ---
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [targetKm, setTargetKm] = useState('5.0');
  const [walkIntervalKm, setWalkIntervalKm] = useState('1.0');
  const [runIntervalKm, setRunIntervalKm] = useState('1.0');

  // --- REFERENCIAS ---
  const locationSubscription = useRef(null);
  const pedometerSubscription = useRef(null);
  const timerRef = useRef(null);

  // --- REPRODUCCIÓN DE SONIDO (PITIDO DE LARGADA / TRANSICIÓN) ---
  const playBeep = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' },
        { shouldPlay: true }
      );
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) sound.unloadAsync();
      });
    } catch (e) {
      console.log('Error al reproducir sonido:', e);
    }
  };

  // --- PEDÓMETRO (PASOS Y CADENCIA) ---
  useEffect(() => {
    let sub;
    if (isTracking) {
      Pedometer.isAvailableAsync().then((available) => {
        if (available) {
          sub = Pedometer.watchStepCount((result) => {
            setSteps(result.steps);
            setSeconds((currentSeconds) => {
              if (currentSeconds > 0) {
                const minutes = currentSeconds / 60;
                setCadence(Math.round(result.steps / minutes));
              }
              return currentSeconds;
            });
          });
          pedometerSubscription.current = sub;
        }
      });
    } else {
      pedometerSubscription.current?.remove();
    }
    return () => sub?.remove();
  }, [isTracking]);

  // --- RASTREO GPS (SOPORTA MODO OFFLINE) ---
  useEffect(() => {
    let sub;
    if (isTracking) {
      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permiso denegado', 'Se requiere acceso al GPS.');
          setIsTracking(false);
          return;
        }

        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 3,
          },
          (newLocation) => {
            const { latitude, longitude } = newLocation.coords;
            const newCoord = { latitude, longitude };

            setLocation(newCoord);
            setRouteCoordinates((prev) => {
              if (prev.length > 0) {
                const lastCoord = prev[prev.length - 1];
                const addedDist = calculateDistance(
                  lastCoord.latitude,
                  lastCoord.longitude,
                  latitude,
                  longitude
                );
                setDistanceKm((d) => d + addedDist);
              }
              return [...prev, newCoord];
            });
          }
        );
        locationSubscription.current = sub;
      })();
    } else {
      locationSubscription.current?.remove();
    }
    return () => sub?.remove();
  }, [isTracking]);

  // --- CRONÓMETRO ---
  useEffect(() => {
    if (isTracking) {
      timerRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isTracking]);

  // --- CÁLCULO DE DISTANCIA (FÓRMULA HAVERSINE) ---
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // --- CONTROLES DE ACTIVIDAD ---
  const handleStartStop = async () => {
    if (!isTracking) {
      // Iniciar actividad
      setRouteCoordinates([]);
      setDistanceKm(0);
      setSeconds(0);
      setSteps(0);
      setCadence(0);
      await playBeep();
      setIsTracking(true);
    } else {
      // Detener y guardar en historial
      setIsTracking(false);
      await playBeep();
      await saveActivityToHistory();
    }
  };

  // --- GUARDADO EN HISTORIAL ---
  const saveActivityToHistory = async () => {
    try {
      const newActivity = {
        id: Date.now().toString(),
        date: new Date().toLocaleString(),
        distanceKm: distanceKm.toFixed(2),
        durationSeconds: seconds,
        steps: steps,
        cadence: cadence,
        targetKm: targetKm,
        route: routeCoordinates,
      };

      const existingData = await AsyncStorage.getItem('@gotrack_history');
      const history = existingData ? JSON.parse(existingData) : [];
      history.unshift(newActivity);
      await AsyncStorage.setItem('@gotrack_history', JSON.stringify(history));

      Alert.alert(
        '¡Entrenamiento Guardado!',
        `Distancia: ${distanceKm.toFixed(2)} km\nPasos: ${steps}\nCadencia: ${cadence} ppm`
      );
    } catch (e) {
      console.log('Error al guardar historial:', e);
    }
  };

  const formatTime = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {/* VISTA MAPA (REGISTRA TRACED EN OFFLINE) */}
      <MapView
        style={styles.map}
        showsUserLocation={true}
        followsUserLocation={true}
        region={
          location
            ? {
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }
            : null
        }
      >
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeWidth={5}
            strokeColor="#1E90FF"
          />
        )}
      </MapView>

      {/* PANEL SUPERIOR DE METAS */}
      <View style={styles.goalBar}>
        <Text style={styles.goalText}>Meta: {targetKm} km</Text>
        <TouchableOpacity
          style={styles.editGoalBtn}
          onPress={() => setShowGoalModal(true)}
        >
          <Text style={styles.editGoalBtnText}>Editar Metas</Text>
        </TouchableOpacity>
      </View>

      {/* PANEL INFERIOR DE MÉTRICAS */}
      <View style={styles.metricsContainer}>
        <View style={styles.row}>
          <View style={styles.metricBox}>
            <Text style={styles.metricValue}>{distanceKm.toFixed(2)}</Text>
            <Text style={styles.metricLabel}>KM</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricValue}>{formatTime(seconds)}</Text>
            <Text style={styles.metricLabel}>TIEMPO</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.metricBox}>
            <Text style={styles.metricValue}>{steps}</Text>
            <Text style={styles.metricLabel}>PASOS</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricValue}>{cadence}</Text>
            <Text style={styles.metricLabel}>CADENCIA (PPM)</Text>
          </View>
        </View>

        {/* BOTÓN INICIAR / PARAR */}
        <TouchableOpacity
          style={[
            styles.actionBtn,
            isTracking ? styles.stopBtn : styles.startBtn,
          ]}
          onPress={handleStartStop}
        >
          <Text style={styles.actionBtnText}>
            {isTracking ? 'DETENER Y GUARDAR' : 'INICIAR ENTRENAMIENTO'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* MODAL CONFIGURACIÓN DE METAS */}
      <Modal visible={showGoalModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Configurar Metas</Text>

            <Text style={styles.inputLabel}>Distancia Total Objetivo (KM):</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={targetKm}
              onChangeText={setTargetKm}
            />

            <Text style={styles.inputLabel}>Intervalo Caminando (KM):</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={walkIntervalKm}
              onChangeText={setWalkIntervalKm}
            />

            <Text style={styles.inputLabel}>Intervalo Corriendo (KM):</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={runIntervalKm}
              onChangeText={setRunIntervalKm}
            />

            <TouchableOpacity
              style={styles.saveGoalBtn}
              onPress={() => setShowGoalModal(false)}
            >
              <Text style={styles.saveGoalBtnText}>Guardar y Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  map: { flex: 1 },
  goalBar: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 4,
  },
  goalText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  editGoalBtn: { backgroundColor: '#007AFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  editGoalBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  metricsContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    elevation: 10,
  },
  row: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15 },
  metricBox: { alignItems: 'center' },
  metricValue: { fontSize: 24, fontWeight: 'bold', color: '#111' },
  metricLabel: { fontSize: 11, color: '#777', marginTop: 2, fontWeight: '600' },
  actionBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 5 },
  startBtn: { backgroundColor: '#28a745' },
  stopBtn: { backgroundColor: '#dc3545' },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  inputLabel: { fontSize: 12, color: '#555', marginTop: 10, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, marginTop: 4, fontSize: 16 },
  saveGoalBtn: { backgroundColor: '#007AFF', borderRadius: 10, padding: 12, marginTop: 20, alignItems: 'center' },
  saveGoalBtnText: { color: '#fff', fontWeight: 'bold' },
});