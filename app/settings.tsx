import Constants from 'expo-constants';
import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import { BackButton, Button, Page, Text } from '../components/ui';
import { firebaseAuth, sendPasswordReset, signOutUser } from '../services/auth';
import { foodService } from '../services/foodService';
import { isFirebaseRepositoryEnabled } from '../services/firebase';
import { colors, radius } from '../theme';

function providerLabel(providerIds: string[]) {
  const providers = new Map([
    ['password', 'Email and password'],
    ['google.com', 'Google'],
    ['apple.com', 'Apple'],
    ['facebook.com', 'Facebook'],
    ['github.com', 'GitHub'],
  ]);
  const labels = providerIds.map(provider => providers.get(provider) ?? provider);
  return labels.length ? [...new Set(labels)].join(', ') : 'Unknown provider';
}

export default function SettingsScreen() {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [provider, setProvider] = useState('');
  const [supportsPasswordReset, setSupportsPasswordReset] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useFocusEffect(useCallback(() => {
    let active = true;
    setError('');
    setSuccess('');
    const authUser = firebaseAuth?.currentUser;
    if (!authUser && isFirebaseRepositoryEnabled) {
      router.replace('/auth');
      return () => { active = false; };
    }
    setEmail(authUser?.email ?? 'Local demo account');
    const providerIds = authUser?.providerData.map(item => item.providerId) ?? [];
    setProvider(authUser ? providerLabel(providerIds) : 'Local demo');
    setSupportsPasswordReset(providerIds.includes('password') && !!authUser?.email);
    const userId = authUser?.uid ?? (isFirebaseRepositoryEnabled ? '' : 'u1');
    if (!userId) { setLoading(false); return () => { active = false; }; }
    setLoading(true);
    foodService.getUser(userId).then(profile => {
      if (active) { setName(profile.name); setUsername(profile.username ?? profile.handle); }
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'Could not load your account information.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));

  async function resetPassword() {
    if (!email || email === 'Local demo account') return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await sendPasswordReset(email);
      setSuccess(`Password reset instructions were sent to ${email}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send password reset instructions.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError('');
    try {
      if (isFirebaseRepositoryEnabled) await signOutUser();
      router.replace('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign out.');
      setBusy(false);
    }
  }

  return <Page maxWidth={620}>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
      <BackButton onPress={() => router.back()}/>
      <Text size={16} weight="600" style={{ marginLeft: 12 }}>Settings</Text>
    </View>
    <Text size={29} weight="700">Account settings</Text>
    <Text size={14} color={colors.muted} style={{ marginTop: 6, marginBottom: 22 }}>Manage your account and sign-in details.</Text>
    <View style={{ padding: 18, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line }}>
      <Text size={17} weight="700">Account information</Text>
      {loading ? <Text size={13} color={colors.muted} style={{ marginTop: 14 }}>Loading account…</Text> : <>
        <AccountRow label="Display name" value={name}/>
        <AccountRow label="Username" value={`@${username}`}/>
        <AccountRow label="Email" value={email}/>
        <AccountRow label="Sign-in method" value={provider}/>
      </>}
    </View>
    {supportsPasswordReset ? <View style={{ marginTop: 22 }}>
      <Text size={18} weight="700">Password</Text>
      <Text size={13} color={colors.muted} style={{ marginTop: 5, marginBottom: 12 }}>We’ll email you a secure link to choose a new password.</Text>
      <Button title={busy ? 'Sending…' : 'Send password reset email'} icon="mail-outline" variant="secondary" loading={busy} disabled={busy || loading} onPress={resetPassword}/>
    </View> : null}
    <View style={{ marginTop: supportsPasswordReset ? 28 : 22 }}>
      <Text size={18} weight="700">Session</Text>
      <Button title={busy ? 'Please wait…' : 'Sign out'} icon="log-out-outline" variant="destructive" loading={busy} disabled={busy} onPress={signOut} style={{ marginTop: 12 }}/>
    </View>
    <View style={{ marginTop: 30, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text size={12} color={colors.muted}>The List</Text>
      <Text size={12} color={colors.muted}>Version {Constants.expoConfig?.version ?? '1.0.0'}</Text>
    </View>
    {error ? <Text size={12} color={colors.danger} accessibilityRole="alert" style={{ marginTop: 14 }}>{error}</Text> : null}
    {success ? <Text size={12} color={colors.success} accessibilityRole="alert" style={{ marginTop: 14 }}>{success}</Text> : null}
  </Page>;
}

function AccountRow({ label, value }: { label: string; value: string }) {
  return <View style={{ marginTop: 15 }}>
    <Text size={11} color={colors.muted}>{label}</Text>
    <Text size={14} weight="600" style={{ marginTop: 3 }}>{value || 'Not set'}</Text>
  </View>;
}
