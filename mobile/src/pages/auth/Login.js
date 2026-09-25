import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Dimensions, Animated, Platform } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { Lock, Mail, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react-native';
import Svg, { Line, Rect, Circle, G } from 'react-native-svg';
import { useLanguage } from '../../context/LanguageContext';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');

const SchematicTower = ({ x, width, maxHeight, startProg, progressCount, label }) => {
  const isDrafting = progressCount >= startProg;
  const steelPercent = Math.min(100, Math.max(0, (progressCount - (startProg + 8)) * 3.2));
  const corePercent = Math.min(100, Math.max(0, (progressCount - (startProg + 22)) * 2.5));
  const glassPercent = Math.min(100, Math.max(0, (progressCount - (startProg + 48)) * 2.8));

  const yBase = 460;
  const currentHeight = steelPercent / 100 * maxHeight;
  const coreHeight = corePercent / 100 * (maxHeight * 0.95);
  const glassHeight = glassPercent / 100 * (maxHeight * 0.9);

  const showHUD = progressCount >= startProg + 12 && progressCount < startProg + 85;
  const totalFloors = Math.max(1, Math.round(maxHeight / 34));

  return (
    <G>
      {/* Drafting Guidelines footprint */}
      {isDrafting &&
      <G opacity={Math.max(0.15, 1 - (progressCount - startProg) / 50)}>
          <Line x1={x - width / 2 - 20} y1={yBase} x2={x + width / 2 + 20} y2={yBase} stroke="rgba(148,163,184,0.7)" strokeWidth="1" strokeDasharray="3 3" />
          <Line x1={x} y1={yBase + 10} x2={x} y2={yBase - maxHeight - 20} stroke="rgba(148,163,184,0.55)" strokeWidth="0.8" strokeDasharray="4 4" />
          <Line x1={x - width / 2} y1={yBase} x2={x - width / 2} y2={yBase - maxHeight} stroke="rgba(148,163,184,0.4)" strokeWidth="0.8" strokeDasharray="2 2" />
          <Line x1={x + width / 2} y1={yBase} x2={x + width / 2} y2={yBase - maxHeight} stroke="rgba(148,163,184,0.4)" strokeWidth="0.8" strokeDasharray="2 2" />
        </G>
      }

      {/* Solid Concrete Core rising */}
      {corePercent > 0 &&
      <Rect
        x={x - width / 4}
        y={yBase - coreHeight}
        width={width / 2}
        height={coreHeight}
        fill="rgba(148,163,184,0.12)"
        stroke="rgba(148,163,184,0.4)"
        strokeWidth="1.5" />

      }

      {/* Structural Steel Frame columns & trusses */}
      {steelPercent > 0 &&
      <G>
          <Line x1={x - width / 2} y1={yBase} x2={x - width / 2} y2={yBase - currentHeight} stroke="#1A1A1A" strokeWidth="2" />
          <Line x1={x + width / 2} y1={yBase} x2={x + width / 2} y2={yBase - currentHeight} stroke="#1A1A1A" strokeWidth="2" />
          <Line x1={x} y1={yBase} x2={x} y2={yBase - currentHeight} stroke="rgba(148,163,184,0.4)" strokeWidth="1.2" strokeDasharray="3 3" />

          {/* Horizontal floors & cross diagonals */}
          {Array.from({ length: totalFloors }).map((_, fIdx) => {
          const floorY = yBase - (fIdx + 1) / totalFloors * maxHeight;
          if (yBase - floorY <= currentHeight) {
            return (
              <G key={fIdx}>
                  <Line x1={x - width / 2} y1={floorY} x2={x + width / 2} y2={floorY} stroke="#1A1A1A" strokeWidth="1.5" />
                  <Line x1={x - width / 2} y1={floorY} x2={x + width / 2} y2={floorY + maxHeight / totalFloors} stroke="#64748B" strokeWidth="0.6" strokeOpacity="0.4" />
                  <Line x1={x + width / 2} y1={floorY} x2={x - width / 2} y2={floorY + maxHeight / totalFloors} stroke="#64748B" strokeWidth="0.6" strokeOpacity="0.4" />
                </G>);

          }
          return null;
        })}
        </G>
      }

      {/* Translucent Glass Façades sliding */}
      {glassPercent > 0 &&
      <Rect
        x={x - width / 2 + 2}
        y={yBase - glassHeight}
        width={width - 4}
        height={glassHeight}
        fill="rgba(56, 189, 248, 0.08)"
        stroke="rgba(56, 189, 248, 0.25)"
        strokeWidth="1.2" />

      }

      {/* Climbing Apex tower cranes */}
      {steelPercent > 0 && steelPercent < 100 &&
      <G transform={`translate(${x - 30}, ${yBase - currentHeight - 35})`}>
          <Line x1="30" y1="35" x2="30" y2="0" stroke="rgba(10,37,28,0.6)" strokeWidth="1.2" />
          <Line x1="30" y1="10" x2="70" y2="10" stroke="rgba(10,37,28,0.6)" strokeWidth="1.2" />
          <Line x1="30" y1="10" x2="5" y2="10" stroke="rgba(10,37,28,0.6)" strokeWidth="1.2" />
          <Line x1="60" y1="10" x2="60" y2="28" stroke="rgba(10,37,28,0.4)" strokeWidth="0.8" />
          <Rect x="58" y="28" width="4" height="4" fill="red" />
        </G>
      }

      {/* Red HUD indicators & Curing telemetry */}
      {showHUD &&
      <G>
          <Circle cx={x - width / 2} cy={yBase - currentHeight} r="4" fill="none" stroke="red" strokeWidth="1.2" />
          <Circle cx={x + width / 2} cy={yBase - currentHeight} r="4" fill="none" stroke="red" strokeWidth="1.2" />

          {/* Dotted Flow tracking */}
          <Line
          x1={x - width / 4}
          y1={yBase}
          x2={x - width / 4}
          y2={yBase - coreHeight}
          stroke="red"
          strokeWidth="1.2"
          strokeDasharray="3 3" />
        
        </G>
      }
    </G>);

};

export default function Login() {
  const { t } = useLanguage();
  const { login } = useAuth();
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

  // Splash screen state
  const [splashActive, setSplashActive] = useState(true);
  const [splashExit, setSplashExit] = useState(false);
  const [progressText, setProgressText] = useState('INITIALIZING STRUCTURAL SCHEMATICS...');
  const [progressCount, setProgressCount] = useState(0);

  const splashOpacity = useRef(new Animated.Value(1)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const countInterval = setInterval(() => {

      setProgressCount((prev) => {
        if (prev >= 100) {
          clearInterval(countInterval);
          return 100;
        }
        return prev + 1;
      });
    }, 38);

    const t1 = setTimeout(() => setProgressText('TOWER_CRANE_01 CALIBRATING SLEW GRID...'), 700);
    const t2 = setTimeout(() => setProgressText('JCB_HYDRAULICS ENGAGED - FOUNDATION SCOOP...'), 1400);
    const t3 = setTimeout(() => setProgressText('POURING CONCRETE FOUNDATION SLAB (BAYS 1-5)...'), 2100);
    const t4 = setTimeout(() => setProgressText('CURING STRUCTURAL FRAMES - INTEGRITY 100%...'), 2800);
    const t5 = setTimeout(() => setProgressText('LIFTING SHUTTER GATEWAY...'), 3500);

    const tExit = setTimeout(() => {
      setSplashExit(true);
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true
      }).start();
      Animated.timing(formOpacity, {
        toValue: 1,
        duration: 600,
        delay: 300,
        useNativeDriver: true
      }).start();
    }, 3900);

    const tUnmount = setTimeout(() => {
      setSplashActive(false);
    }, 5100);

    return () => {
      clearInterval(countInterval);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(tExit);
      clearTimeout(tUnmount);
    };
  }, []);

  const handleSubmit = async () => {

    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError('');

    try {
      const sanitizedEmail = email.trim();
      const user = await login(sanitizedEmail, password);
      // Navigation is handled automatically by App.jsx conditional rendering
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {splashActive &&
      <Animated.View style={[styles.splashOverlay, { opacity: splashOpacity }]} pointerEvents={splashExit ? 'none' : 'auto'}>
          <View style={styles.svgContainer}>
            <Svg width="100%" height="100%" viewBox="0 0 1200 500" preserveAspectRatio="xMidYMax slice">
              <Line x1="50" y1="460" x2="1150" y2="460" stroke="#1A1A1A" strokeWidth="2" />
              <Line x1="50" y1="464" x2="1150" y2="464" stroke="rgba(148, 163, 184, 0.15)" strokeWidth="1" />

              <SchematicTower x={220} width={85} maxHeight={260} startProg={10} progressCount={progressCount} label="SYS_BUILD // TWR_A" />
              <SchematicTower x={450} width={120} maxHeight={380} startProg={20} progressCount={progressCount} label="SYS_BUILD // TWR_B" />
              <SchematicTower x={740} width={110} maxHeight={320} startProg={28} progressCount={progressCount} label="SYS_BUILD // TWR_C" />
              <SchematicTower x={980} width={80} maxHeight={230} startProg={36} progressCount={progressCount} label="SYS_BUILD // TWR_D" />
            </Svg>
          </View>

          <View style={styles.techLog}>
            <View style={styles.progressBarWrapper}>
              <View style={[styles.progressBar, { width: `${progressCount}%` }]} />
            </View>
            <Text style={styles.progressText}>{progressText}</Text>
          </View>
        </Animated.View>
      }

      <Animated.View style={[styles.formWrapper, { opacity: formOpacity }]} pointerEvents={splashActive ? 'none' : 'auto'}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={{ fontWeight: '900', fontSize: 24, letterSpacing: -1, color: '#1A1A1A' }}>{t('PM')}</Text>
            </View>
            <Text style={styles.title}>{t('PARAM MARKETING')}</Text>
            <Text style={styles.subtitle}>{t('Param Distributor Management')}</Text>
          </View>

          <View style={styles.form}>
            {error ?
            <View style={styles.errorBox}>
                <AlertCircle size={16} color="#DC2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View> :
            null}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('Email or Customer ID')}</Text>
              <View style={styles.inputWrapper}>
                <Mail size={18} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@company.com or GJT511192"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none" />
                
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('Password')}</Text>
              <View style={styles.inputWrapper}>
                <Lock size={18} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword} />
                
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  {showPassword ? <EyeOff size={18} color="#94A3B8" /> : <Eye size={18} color="#94A3B8" />}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={loading}>
              
              <Text style={styles.btnText}>{loading ? 'AUTHENTICATING...' : 'ESTABLISH SESSION'}</Text>
              {!loading && <ArrowRight size={18} color="#FFF" />}
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </View>);

};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center'
  },
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FAFAFA',
    zIndex: 50
  },
  svgContainer: {
    position: 'absolute',
    bottom: '2%',
    left: 0,
    right: 0,
    height: 500
  },
  techLog: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFF',
    padding: 16,
    borderWidth: 1,
    borderColor: '#1A1A1A'
  },
  progressBarWrapper: {
    width: '100%',
    height: 6,
    backgroundColor: '#E5E5EA',
    marginBottom: 8
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#1A1A1A'
  },
  progressText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center'
  },
  formWrapper: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    zIndex: 10
  },
  card: {
    backgroundColor: '#FFF',
    padding: 32,
    borderWidth: 2,
    borderColor: '#1A1A1A',
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8
  },
  header: {
    alignItems: 'center',
    marginBottom: 32
  },
  logoContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1A1A1A',
    marginBottom: 16
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  form: {
    gap: 20
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
    gap: 8
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'
  },
  inputGroup: {
    gap: 8
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center'
  },
  inputIcon: {
    position: 'absolute',
    left: 16,
    zIndex: 1
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    zIndex: 1,
    padding: 4
  },
  input: {
    borderWidth: 1,
    borderColor: '#1A1A1A',
    height: 48,
    paddingLeft: 44,
    paddingRight: 44,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#1A1A1A',
    backgroundColor: '#FAFAFA'
  },
  btn: {
    backgroundColor: '#1A1A1A',
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4
  },
  btnDisabled: {
    opacity: 0.7
  },
  btnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  }
});