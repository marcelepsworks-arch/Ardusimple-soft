import React, {useEffect, useState} from 'react';
import {StatusBar, View, Text, ActivityIndicator, StyleSheet} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import {AppNavigator} from './src/navigation/AppNavigator';
import {LoginScreen} from './src/screens/LoginScreen';
import {RegisterScreen} from './src/screens/RegisterScreen';
import {LicenseExpiredScreen} from './src/screens/LicenseExpiredScreen';
import {useLicenseStore} from './src/store/useLicenseStore';
import {checkAuthAndLicense} from './src/services/auth-service';
import {registerAllCS} from './src/lib/coordinate-systems';

// Register all coordinate system definitions at startup
registerAllCS();

type AuthScreen = 'login' | 'register';

function App() {
  const {status, isLoggedIn, loading, setStatus, setProfile, setIsLoggedIn, setLoading} =
    useLicenseStore();
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');

  async function loadAuth() {
    setLoading(true);
    try {
      const result = await checkAuthAndLicense();
      setStatus(result.status);
      setProfile(result.profile);
      setIsLoggedIn(result.isLoggedIn);
    } catch {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAuth();
  }, []);

  if (loading) {
    return (
      <View style={styles.loading}>
        <StatusBar barStyle="light-content" backgroundColor="#111827" />
        <ActivityIndicator color="#3b82f6" size="large" />
      </View>
    );
  }

  // Not logged in — show auth screens
  if (!isLoggedIn) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#111827" />
        {authScreen === 'login' ? (
          <LoginScreen
            onLoginSuccess={loadAuth}
            onGoToRegister={() => setAuthScreen('register')}
          />
        ) : (
          <RegisterScreen
            onRegisterSuccess={() => setAuthScreen('login')}
            onGoToLogin={() => setAuthScreen('login')}
          />
        )}
      </SafeAreaProvider>
    );
  }

  // Trial expired / subscription ended
  if (status && status.trialExpired && !status.isLicensed) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#111827" />
        <LicenseExpiredScreen />
      </SafeAreaProvider>
    );
  }

  // Logged in + valid trial or license
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <NavigationContainer
        theme={{
          dark: true,
          colors: {
            primary: '#3b82f6',
            background: '#111827',
            card: '#0a0a0a',
            text: '#e5e7eb',
            border: '#1f2937',
            notification: '#ef4444',
          },
          fonts: {
            regular: {fontFamily: 'System', fontWeight: '400'},
            medium: {fontFamily: 'System', fontWeight: '500'},
            bold: {fontFamily: 'System', fontWeight: '700'},
            heavy: {fontFamily: 'System', fontWeight: '900'},
          },
        }}>
        {/* Trial banner */}
        {status?.isTrial && !status.trialExpired && (
          <View
            style={[
              styles.trialBanner,
              status.trialDaysRemaining <= 3 && styles.trialBannerUrgent,
            ]}>
            <Text style={styles.trialText}>
              Trial: {status.trialDaysRemaining} day
              {status.trialDaysRemaining !== 1 ? 's' : ''} remaining
            </Text>
          </View>
        )}
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trialBanner: {
    backgroundColor: 'rgba(37, 99, 235, 0.3)',
    paddingVertical: 4,
    alignItems: 'center',
  },
  trialBannerUrgent: {
    backgroundColor: 'rgba(245, 158, 11, 0.3)',
  },
  trialText: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default App;
