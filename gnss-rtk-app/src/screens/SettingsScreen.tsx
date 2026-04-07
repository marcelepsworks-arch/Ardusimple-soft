import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import {useLicenseStore} from '../store/useLicenseStore';
import {signOut} from '../services/auth-service';

export function SettingsScreen() {
  const status = useLicenseStore(s => s.status);
  const profile = useLicenseStore(s => s.profile);
  const setIsLoggedIn = useLicenseStore(s => s.setIsLoggedIn);

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          setIsLoggedIn(false);
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Account section */}
      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.card}>
        {profile ? (
          <>
            <Text style={styles.name}>{profile.fullName || 'User'}</Text>
            <Text style={styles.email}>{profile.email}</Text>
          </>
        ) : (
          <Text style={styles.email}>Not signed in</Text>
        )}
      </View>

      {/* License section */}
      <Text style={styles.sectionTitle}>Subscription</Text>
      <View style={styles.card}>
        {status?.isLicensed ? (
          <>
            <Text style={styles.licensedText}>Active Subscription</Text>
            {profile?.subscriptionPlan && (
              <Text style={styles.planText}>
                Plan: {profile.subscriptionPlan}
              </Text>
            )}
            {profile?.subscriptionExpiresAt && (
              <Text style={styles.infoSubText}>
                Renews: {new Date(profile.subscriptionExpiresAt).toLocaleDateString()}
              </Text>
            )}
          </>
        ) : status?.isTrial ? (
          <>
            <Text style={styles.trialText}>
              Free Trial — {status.trialDaysRemaining} day
              {status.trialDaysRemaining !== 1 ? 's' : ''} remaining
            </Text>
            <TouchableOpacity style={styles.upgradeBtn}>
              <Text style={styles.upgradeBtnText}>Upgrade to Full Version</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.expiredText}>Trial Expired</Text>
        )}
      </View>

      {/* App info */}
      <Text style={styles.sectionTitle}>About</Text>
      <View style={styles.card}>
        <Text style={styles.infoText}>GNSS RTK App v0.1.0</Text>
        <Text style={styles.infoSubText}>
          GNSS/RTK surveying for ArduSimple receivers
        </Text>
      </View>

      {/* Settings placeholders */}
      <Text style={styles.sectionTitle}>Units & Display</Text>
      <View style={styles.card}>
        <Text style={styles.infoSubText}>
          Coming soon — units, coordinate format, language
        </Text>
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  content: {
    padding: 16,
    gap: 8,
    paddingBottom: 40,
  },
  sectionTitle: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 12,
  },
  card: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 14,
    gap: 6,
  },
  name: {
    color: '#e5e7eb',
    fontSize: 17,
    fontWeight: '700',
  },
  email: {
    color: '#9ca3af',
    fontSize: 14,
  },
  licensedText: {
    color: '#22c55e',
    fontWeight: '700',
    fontSize: 15,
  },
  planText: {
    color: '#d1d5db',
    fontSize: 13,
  },
  trialText: {
    color: '#f59e0b',
    fontWeight: '600',
    fontSize: 14,
  },
  expiredText: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 14,
  },
  upgradeBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  upgradeBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  infoText: {
    color: '#e5e7eb',
    fontSize: 15,
    fontWeight: '600',
  },
  infoSubText: {
    color: '#6b7280',
    fontSize: 13,
  },
  signOutBtn: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#374151',
  },
  signOutText: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 15,
  },
});
