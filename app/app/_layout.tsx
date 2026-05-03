import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { db } from '../src/db/client';
import migrations from '../src/db/migrations/migrations';
import seed from '../src/db/seed';
import { getRiflesWithActiveLoad } from '../src/db/queries';

// Keep the splash screen visible until fonts + DB are ready.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
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

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
