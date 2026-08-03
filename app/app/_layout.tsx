import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as Sentry from '@sentry/react-native';

import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { db } from '../src/db/client';
import migrations from '../src/db/migrations/migrations';
import seed from '../src/db/seed';
import { getRiflesWithActiveLoad } from '../src/db/queries';

// Keep the splash screen visible until fonts + DB are ready.
SplashScreen.preventAutoHideAsync();

// ─── Sentry crash reporting ─────────────────────────────────────────────
Sentry.init({
  dsn: process.env['EXPO_PUBLIC_SENTRY_DSN'],
  // Capture 100% of errors during beta — reduce to 0.2 post-launch
  tracesSampleRate: 1.0,
  // We collect no PII — keep this false
  sendDefaultPii: false,
  environment: __DEV__ ? 'development' : 'production',
  // Mute noisy logs in production
  debug: __DEV__,
  // Belt-and-suspenders PII scrub (CLAUDE.md: no profile names, GPS coords,
  // or shot logs may ever leave the device in crash reports).
  beforeSend(event) {
    delete event.user;
    if (event.contexts && 'geo' in event.contexts) delete event.contexts['geo'];
    return event;
  },
  beforeBreadcrumb(breadcrumb) {
    // Breadcrumbs can capture console logs / fetch URLs containing lat/lon.
    const data = breadcrumb.data as Record<string, unknown> | undefined;
    const url = typeof data?.['url'] === 'string' ? (data['url'] as string) : null;
    if (url && /latitude=|longitude=/.test(url)) {
      breadcrumb.data = { ...data, url: url.replace(/(latitude|longitude)=[-\d.]+/g, '$1=REDACTED') };
    }
    return breadcrumb;
  },
});

// ─── RevenueCat initialisation ────────────────────────────────────────────────
// Called once at app startup. RC docs specify configure() must be called before
// any other Purchases method. We call it here, before any screen mounts.
// Using a lazy require so the app doesn't crash in Expo Go (no native module).

const RC_APPLE_KEY  = process.env['EXPO_PUBLIC_RC_APPLE_KEY']  ?? '';
const RC_GOOGLE_KEY = process.env['EXPO_PUBLIC_RC_GOOGLE_KEY'] ?? '';

function initRevenueCat() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RC = require('react-native-purchases') as Record<string, unknown>;
    const Purchases = (RC.default ?? RC) as {
      configure: (opts: { apiKey: string }) => void;
      isConfigured: boolean;
    };

    // Guard against double-configure on HMR reloads in dev
    if (Purchases.isConfigured) {
      console.log('[RangeDOPE] RevenueCat already configured — skipping.');
      return;
    }

    const apiKey = Platform.OS === 'ios' ? RC_APPLE_KEY : RC_GOOGLE_KEY;
    if (!apiKey) {
      console.warn('[RangeDOPE] RevenueCat API key not set — paywall disabled.');
      return;
    }

    Purchases.configure({ apiKey });
    console.log('[RangeDOPE] RevenueCat configured.');
  } catch {
    // Expo Go or simulator without native build — degrade gracefully.
    console.log('[RangeDOPE] RevenueCat native module not available (Expo Go).');
  }
}

// Initialise immediately at module load — before any component mounts.
initRevenueCat();

// ─── Root layout ──────────────────────────────────────────────────────────────

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    // Monospace for ballistic numbers — crisp in all three display modes.
    'SpaceMono-Regular': require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  const [dbSuccess, setDbSuccess] = useState(false);
  const [dbError, setDbError] = useState<Error | null>(null);

  useEffect(() => {
    migrate(db, migrations)
      .then(async () => {
        // If no rifles exist, seed the DB with the Fierce Firearms collection
        const existing = await getRiflesWithActiveLoad();
        if (existing.length === 0) {
          await seed();
        }
        setDbSuccess(true);
      })
      .catch((err) => {
        console.error('[RootLayout] DB init failed:', err);
        setDbError(err);
      });
  }, []);

  useEffect(() => {
    // Hide splash screen when both fonts and DB migrations are resolved
    if ((fontsLoaded || fontError) && (dbSuccess || dbError)) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, dbSuccess, dbError]);

  // Prevent rendering until critical assets and data are ready
  if (!fontsLoaded && !fontError) return null;
  if (!dbSuccess && !dbError) return null;

  // DB init failed — show a recovery message instead of a permanent blank screen.
  if (dbError) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
        <Text style={{ color: '#EF4444', fontSize: 18 }}>Database failed to initialize</Text>
        <Text style={{ color: '#999', fontSize: 13, textAlign: 'center' }}>
          Close and reopen the app. If this keeps happening, reinstall — your
          profiles can be restored from a backup file via Settings.
        </Text>
        <Text style={{ color: '#555', fontSize: 11, textAlign: 'center' }}>{String(dbError)}</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

// Wrap with Sentry so unhandled JS errors and native crashes are captured.
export default Sentry.wrap(RootLayout);
