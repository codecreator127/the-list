import { Dimensions, Image, Platform, Text, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { colors, radius } from '../theme';
import { subscribePhotoViewport } from './photoViewport';

export function ReviewPhoto({ uri, label = 'Photo attached to review' }: { uri: string; label?: string }) {
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(false);
  const wrapper = useRef<View>(null);
  const measure = () => wrapper.current?.measureInWindow((_x, y, width, height) => { if (width > 0 && height > 0 && y < Dimensions.get('window').height && y + height > 0) setVisible(true); });
  useEffect(() => { setFailed(false); }, [uri]);
  useEffect(() => {
    if (Platform.OS === 'web' || visible) return;
    const unsubscribe = subscribePhotoViewport(measure);
    const resize = Dimensions.addEventListener('change', measure);
    measure();
    return () => { unsubscribe(); resize.remove(); };
  }, [visible]);
  if (failed) return <View style={{ marginTop: 12, padding: 12, backgroundColor: colors.surface }}><Text style={{ fontSize: 12, color: colors.muted }}>Photo unavailable</Text></View>;
  if (Platform.OS === 'web') return <img src={uri} alt={label} loading="lazy" decoding="async" onError={() => setFailed(true)} style={{ display: 'block', width: '100%', maxHeight: 360, objectFit: 'contain', borderRadius: 12, marginTop: 12 }} />;
  return <View ref={wrapper} collapsable={false} onLayout={measure} style={{ width: '100%', height: 240, marginTop: 12 }}>
    {visible ? <Image source={{ uri }} accessibilityLabel={label} onError={() => setFailed(true)} resizeMode="contain" style={{ width: '100%', height: 240, borderRadius: radius.md }} /> : null}
  </View>;
}
