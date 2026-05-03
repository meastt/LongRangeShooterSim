import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/** Brand colours — shared across all display modes for nav chrome. */
const COLORS = {
  background: '#000000',
  surface: '#050505',
  border: '#151515',
  red: '#FF0000',
  muted: '#333333',
};

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({
  name,
  color,
  size,
}: {
  name: IoniconName;
  color: string;
  size: number;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.red,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          // Slight extra height on iOS for the home indicator.
          paddingBottom: Platform.OS === 'ios' ? 4 : 0,
        },
        tabBarLabelStyle: {
          fontFamily: 'SpaceMono-Regular',
          fontSize: 10,
          letterSpacing: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="field"
        options={{
          title: 'FIELD',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="locate-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profiles"
        options={{
          title: 'PROFILES',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="layers-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="shotplan"
        options={{
          title: 'PLAN',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="map-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'SETTINGS',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="settings-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
