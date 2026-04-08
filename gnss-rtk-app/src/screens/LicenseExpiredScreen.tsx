import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Linking, Alert} from 'react-native';
import {useLicenseStore} from '../store/useLicenseStore';
import {signOut} from '../services/auth-service';

// Web portal URL — update after deploying to Vercel
const PORTAL_URL = 'https://auth.ardusimple-rtk.com/pricing';

export function LicenseExpiredScreen() {
  const profile = useLicenseStore(s => s.profile);
  const setIsLoggedIn = useLicenseStore(s => s.setIsLoggedIn);

  async function handleSignOut() {
    await signOut();
    setIsLoggedIn(false);
  }

  async function handleSubscribe() {
    const supported = await Linking.canOpenURL(PORTAL_URL);
    if (supported) {
      await Linking.openURL(PORTAL_URL);
    } else {
      Alert.alert('Cannot open URL', `Please visit: ${PORTAL_URL}`);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>Trial Expired</Text>
      <Text style={styles.subtitle}>
        Your 10-day free trial has ended. Subscribe to continue using GNSS RTK
        Survey — from €6.58/month.
      </Text>

      {profile && (
        <Text style={styles.email}>Signed in as {profile.email}</Text>
      )}

      <TouchableOpacity style={styles.upgradeBtn} onPress={handleSubscribe}>
        <Text style={styles.upgradeBtnText}>Subscribe Now →</Text>
      </TouchableOpacity>

      <Text style={styles.portalHint}>Opens {PORTAL_URL}</Text>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    color: '#f3f4f6',
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  email: {
    color: '#6b7280',
    fontSize: 13,
  },
  portalHint: {
    color: '#374151',
    fontSize: 11,
    marginTop: -8,
  },
  upgradeBtn: {
    width: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  upgradeBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  signOutBtn: {
    paddingVertical: 10,
  },
  signOutText: {
    color: '#6b7280',
    fontSize: 14,
  },
});
