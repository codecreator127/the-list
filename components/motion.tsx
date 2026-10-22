import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme';

export function useReducedMotion() {
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

export function Float({ children, style, distance = 8, duration = 3000 }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; distance?: number; duration?: number }>) {
  const reduced = useReducedMotion();
  const offset = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced === null) return;
    if (reduced) { offset.setValue(0); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(offset, { toValue: -distance, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(offset, { toValue: 0, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [distance, duration, offset, reduced]);
  return <Animated.View style={[style, { transform: [{ translateY: offset }] }]}>{children}</Animated.View>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
type PressableScaleProps = PropsWithChildren<Pick<PressableProps, 'onPress' | 'onPressIn' | 'onPressOut' | 'disabled' | 'accessibilityRole' | 'accessibilityLabel' | 'accessibilityState' | 'hitSlop' | 'testID'>> & { style?: StyleProp<ViewStyle>; hoverStyle?: StyleProp<ViewStyle>; hoverScale?: number };
export function PressableScale({ children, style, hoverStyle, hoverScale = 1.01, disabled, onPress, onPressIn, onPressOut, accessibilityState, ...accessibilityProps }: PressableScaleProps) {
  const reduced = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (disabled || reduced !== false) {
      scale.stopAnimation();
      scale.setValue(1);
      setHovered(false);
    }
  }, [disabled, reduced, scale]);
  const animate = (toValue: number) => {
    if (reduced !== false || disabled) return;
    Animated.spring(scale, { toValue, speed: 32, bounciness: 0, useNativeDriver: Platform.OS !== 'web' }).start();
  };
  // Animate the press target itself so flex, width, alignment and margins apply
  // to the actual child of the screen's layout, including equal-width actions.
  return <AnimatedPressable
    {...accessibilityProps}
    accessibilityState={Platform.OS === 'web' ? undefined : accessibilityState}
    {...(Platform.OS === 'web' && accessibilityState ? {
      'aria-checked': accessibilityState.checked,
      'aria-pressed': accessibilityProps.accessibilityRole === 'button' ? accessibilityState.selected : undefined,
      'aria-selected': accessibilityProps.accessibilityRole !== 'button' ? accessibilityState.selected : undefined,
      'aria-disabled': accessibilityState.disabled,
      'aria-busy': accessibilityState.busy,
      'aria-expanded': accessibilityState.expanded,
    } : {})}
    disabled={disabled}
    onPress={onPress}
    onPressIn={event => { animate(0.985); onPressIn?.(event); }}
    onPressOut={event => { animate(hovered && Platform.OS === 'web' ? hoverScale : 1); onPressOut?.(event); }}
    onHoverIn={() => { if (Platform.OS === 'web' && !disabled) { setHovered(true); animate(hoverScale); } }}
    onHoverOut={() => { if (Platform.OS === 'web') { setHovered(false); animate(1); } }}
    onFocus={() => setFocused(true)}
    onBlur={() => { setFocused(false); animate(1); }}
    style={[style, Platform.OS === 'web' && hovered && !disabled && hoverStyle,
      Platform.OS === 'web' && focused && !disabled && { outlineColor: colors.focus, outlineStyle: 'solid', outlineWidth: 2, outlineOffset: 3 } as any,
      { transform: [...(StyleSheet.flatten(style)?.transform ?? []), { scale }] } as any]}
  >{children}</AnimatedPressable>;
}
