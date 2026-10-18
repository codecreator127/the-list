import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { View } from 'react-native';
import { Avatar, BackButton, Button, Input, Page, Text } from '../components/ui';
import { foodService } from '../services/foodService';
import { firebaseAuth, watchAuthState } from '../services/auth';
import { isFirebaseRepositoryEnabled } from '../services/firebase';
import { deletePreviousProfilePhoto, deleteProfilePhoto, uploadProfilePhoto } from '../services/profilePhoto';
import type { User } from '../types/models';
import { colors, radius } from '../theme';

const validUsername = /^[a-z0-9][a-z0-9_]{2,19}$/;
const errorMessage = (cause: unknown, fallback: string) => cause instanceof Error ? cause.message : fallback;

export default function EditProfileScreen() {
  const [user, setUser] = useState<User>();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [photo, setPhoto] = useState<ImagePickerAsset>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useFocusEffect(useCallback(() => {
    let active = true;
    const unsubscribe = watchAuthState(authUser => {
      if (!authUser && isFirebaseRepositoryEnabled) {
        if (active) router.replace('/auth');
        return;
      }
      const id = authUser?.uid ?? (isFirebaseRepositoryEnabled ? '' : 'u1');
      if (!id) return;
      setLoading(true);
      foodService.getUser(id).then(profile => {
        if (active) {
          setUser(profile);
          setUsername(profile.username ?? profile.handle);
          setDisplayName(profile.name);
          setError('');
        }
      }).catch(cause => {
        if (active) setError(errorMessage(cause, 'Could not load your profile.'));
      }).finally(() => { if (active) setLoading(false); });
    });
    return () => { active = false; unsubscribe(); };
  }, []));

  const normalizedUsername = username.trim().toLowerCase();
  const usernameError = !normalizedUsername
    ? 'A username is required.'
    : !validUsername.test(normalizedUsername)
      ? 'Use 3–20 letters, numbers, or underscores; start with a letter or number.'
      : '';
  const nameError = !displayName.trim()
    ? 'A display name is required.'
    : displayName.trim().length > 40
      ? 'Display names can be at most 40 characters.'
      : '';
  const changed = useMemo(() => !!user && (
    normalizedUsername !== (user.username ?? user.handle).toLowerCase()
    || displayName.trim() !== user.name
    || !!photo
  ), [user, normalizedUsername, displayName, photo]);

  async function selectPhoto() {
    setError('');
    setSuccess('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset || asset.type === 'video') throw new Error('Choose an image file for your profile picture.');
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) throw new Error('Choose a profile picture smaller than 5 MB.');
      setPhoto(asset);
    } catch (cause) {
      setError(errorMessage(cause, 'Could not open your photo library.'));
    }
  }

  async function saveProfile() {
    setError('');
    setSuccess('');
    if (!user) return;
    if (!normalizedUsername || !validUsername.test(normalizedUsername)) {
      setError('Choose a valid username: 3–20 letters, numbers, or underscores, starting with a letter or number.');
      return;
    }
    if (!displayName.trim() || displayName.trim().length > 40) {
      setError('Display names must be between 1 and 40 characters.');
      return;
    }
    setSaving(true);
    let stagedPhoto: { path: string; url: string } | undefined;
    try {
      if (photo) {
        const userId = firebaseAuth?.currentUser?.uid;
        if (!userId) throw new Error('Sign in again before changing your profile picture.');
        stagedPhoto = await uploadProfilePhoto(userId, photo);
      }
      await foodService.saveCurrentUserProfile(normalizedUsername, displayName.trim(), stagedPhoto?.url);
      const previousAvatarUrl = user.avatarUrl;
      const updated = {
        ...user,
        name: displayName.trim(),
        handle: normalizedUsername,
        username: normalizedUsername,
        usernameNormalized: normalizedUsername,
        ...(stagedPhoto ? { avatarUrl: stagedPhoto.url } : {}),
        updatedAt: new Date(),
      };
      setUser(updated);
      setUsername(normalizedUsername);
      setDisplayName(displayName.trim());
      setPhoto(undefined);
      setSuccess('Your profile has been updated.');
      if (stagedPhoto && previousAvatarUrl && previousAvatarUrl !== stagedPhoto.url) {
        try {
          await deletePreviousProfilePhoto(user.id, previousAvatarUrl);
        } catch (cause) {
          setError(`Your profile was saved, but the previous picture could not be removed: ${errorMessage(cause, 'Storage cleanup failed.')}`);
        }
      }
    } catch (cause) {
      let message = errorMessage(cause, 'Could not save your profile.');
      if (stagedPhoto) {
        try {
          await deleteProfilePhoto(stagedPhoto.path);
        } catch (cleanupCause) {
          message += ` The uploaded image could not be cleaned up: ${errorMessage(cleanupCause, 'Storage cleanup failed.')}`;
        }
      }
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return <Page maxWidth={620}>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
      <BackButton onPress={() => router.back()} />
      <Text size={16} weight="600" style={{ marginLeft: 12 }}>Edit profile</Text>
    </View>
    <Text size={29} weight="700">Make it yours</Text>
    <Text size={14} color={colors.muted} style={{ marginTop: 6, marginBottom: 22 }}>Your name and picture appear with your reviews and in your friends’ lists.</Text>
    {loading ? <Text size={13} color={colors.muted}>Loading your profile…</Text> : user ? <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 17, marginBottom: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md }}>
        <Avatar user={photo ? { ...user, avatarUrl: photo.uri } : user} size={70}/>
        <View style={{ flex: 1 }}>
          <Text size={14} weight="600">Profile picture</Text>
          <Text size={12} color={colors.muted} style={{ marginTop: 4 }}>Square images, up to 5 MB.</Text>
          {isFirebaseRepositoryEnabled ? <Button title={photo ? 'Choose a different photo' : 'Upload photo'} icon="image-outline" variant="secondary" size="small" disabled={saving} onPress={selectPhoto} style={{ alignSelf: 'flex-start', marginTop: 10 }}/> : <Text size={11} color={colors.muted} style={{ marginTop: 8 }}>Photo uploads are available for Firebase accounts.</Text>}
        </View>
      </View>
      <Text size={12} weight="600" style={{ marginBottom: 6 }}>Display name</Text>
      <Input value={displayName} editable={!saving} onChangeText={value => { setDisplayName(value); setSuccess(''); setError(''); }} autoComplete="name" maxLength={40} placeholder="Your name" style={{ marginBottom: 5 }}/>
      {nameError ? <Text size={11} color={colors.danger} style={{ marginBottom: 13 }}>{nameError}</Text> : <View style={{ height: 13 }}/>}
      <Text size={12} weight="600" style={{ marginBottom: 6 }}>Username</Text>
      <Input value={username} editable={!saving} onChangeText={value => { setUsername(value); setSuccess(''); setError(''); }} autoCapitalize="none" autoCorrect={false} maxLength={20} placeholder="your_username"/>
      <Text size={11} color={usernameError ? colors.danger : colors.muted} style={{ marginTop: 6, marginBottom: 17 }}>{usernameError || '3–20 characters. Usernames are case-insensitive and must be unique.'}</Text>
      {error ? <Text size={12} color={colors.danger} accessibilityRole="alert" style={{ marginBottom: 12 }}>{error}</Text> : null}
      {success ? <Text size={12} color={colors.success} accessibilityRole="alert" style={{ marginBottom: 12 }}>{success}</Text> : null}
      <Button title={saving ? 'Saving…' : 'Save changes'} loading={saving} disabled={saving || !changed || !!usernameError || !!nameError} onPress={saveProfile}/>
    </> : <View style={{ padding: 18, backgroundColor: colors.white }}>
      <Text size={14} color={colors.danger}>{error || 'Could not load your profile.'}</Text>
      <Button title="Back to profile" variant="secondary" onPress={() => router.back()} style={{ marginTop: 14 }}/>
    </View>}
  </Page>;
}
