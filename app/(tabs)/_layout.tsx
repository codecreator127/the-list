import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { ComponentProps } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, useTheme } from '../../theme';
import { PressableScale } from '../../components/motion';
import { Text } from '../../components/ui';

type IconName = ComponentProps<typeof Ionicons>['name'];

const tabMeta: Record<string, { label: string; icon: IconName; activeIcon: IconName }> = {
  home: { label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  search: { label: 'Search', icon: 'search-outline', activeIcon: 'search' },
  list: { label: 'List', icon: 'list-outline', activeIcon: 'list' },
  profile: { label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
};

function TabBar({ state, descriptors, navigation }: any) {
  useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const styles = makeStyles(width >= 900);

  return <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom + 8, 18) }]}>
    <View style={styles.bar}>
      {state.routes.map((route: any, index: number) => {
        const focused = state.index === index;
        const meta = tabMeta[route.name] ?? { label: descriptors[route.key]?.options?.title ?? route.name, icon: 'ellipse-outline' as IconName, activeIcon: 'ellipse' as IconName };
        return <View key={route.key} style={styles.itemShell}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={meta.label}
            accessibilityState={{ selected: focused }}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            }}
            hoverStyle={styles.itemHover}
            hoverScale={1.015}
            style={[styles.item, focused && styles.itemActive]}
          >
            <Ionicons name={focused ? meta.activeIcon : meta.icon} size={20} color={focused ? colors.accent : colors.textMuted}/>
            <Text size={11} weight="700" color={focused ? colors.accent : colors.textMuted}>{meta.label}</Text>
          </PressableScale>
        </View>;
      })}
    </View>
  </View>;
}

export default function TabLayout() {
  useTheme();
  return <Tabs tabBar={props => <TabBar {...props}/>} screenOptions={{ headerShown: false }}>
    <Tabs.Screen name="home" options={{ title: 'Home' }}/>
    <Tabs.Screen name="search" options={{ title: 'Search' }}/>
    <Tabs.Screen name="list" options={{ title: 'List' }}/>
    <Tabs.Screen name="profile" options={{ title: 'Profile' }}/>
  </Tabs>;
}

const makeStyles = (desktop: boolean) => StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  bar: {
    width: '100%',
    maxWidth: desktop ? 540 : 560,
    minHeight: 76,
    paddingHorizontal: 8,
    paddingTop: 9,
    paddingBottom: 10,
    borderRadius: 3,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    ...Platform.select({ web: shadow, default: { elevation: 10, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 20 } }),
  },
  itemShell: {
    flex: 1,
  },
  item: {
    width: '100%',
    minHeight: 56,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    position: 'relative',
  },
  itemActive: {
    backgroundColor: colors.surfaceHover,
  },
  itemHover: {
    backgroundColor: colors.surfaceHover,
  },
});
