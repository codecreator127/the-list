import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

function useReducedMotion() {
  const [reduced, setReduced] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduced(value); }).catch(() => { if (mounted) setReduced(false); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  return reduced;
}

export function Entrance({ children, delay = 0, style }: PropsWithChildren<{ delay?: number; style?: StyleProp<ViewStyle> }>) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced === null) return;
    if (reduced) { progress.setValue(1); return; }
    const animation = Animated.timing(progress, { toValue: 1, duration: 260, delay, useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [delay, progress, reduced]);
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [9, 0] }) }] }]}>{children}</Animated.View>;
}

type PressableScaleProps = PropsWithChildren<Pick<PressableProps, 'onPress' | 'onPressIn' | 'onPressOut' | 'disabled' | 'accessibilityRole' | 'accessibilityLabel' | 'accessibilityState' | 'hitSlop' | 'testID'>> & { style?: StyleProp<ViewStyle>; hoverStyle?: StyleProp<ViewStyle>; hoverScale?: number };
export function PressableScale({ children, style, hoverStyle, hoverScale = 1.01, disabled, onPress, onPressIn, onPressOut, ...accessibilityProps }: PressableScaleProps) {
  const reduced = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (toValue: number) => {
    if (reduced !== false || disabled) return;
    Animated.spring(scale, { toValue, speed: 32, bounciness: 0, useNativeDriver: Platform.OS !== 'web' }).start();
  };
  return <Animated.View style={{ transform: [{ scale }] }}><Pressable
    {...accessibilityProps}
    disabled={disabled}
    onPress={onPress}
    onPressIn={event => { animate(0.985); onPressIn?.(event); }}
    onPressOut={event => { animate(hovered && Platform.OS === 'web' ? hoverScale : 1); onPressOut?.(event); }}
    onHoverIn={() => { if (Platform.OS === 'web' && !disabled) { setHovered(true); animate(hoverScale); } }}
    onHoverOut={() => { if (Platform.OS === 'web') { setHovered(false); animate(1); } }}
    style={[style, Platform.OS === 'web' && hovered && hoverStyle]}
  >{children}</Pressable></Animated.View>;
}
