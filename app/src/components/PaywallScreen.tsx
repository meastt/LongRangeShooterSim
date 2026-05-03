/**
 * PaywallScreen — in-app subscription paywall for Aim.
 *
 * Shown as a full-screen modal when a user tries to access a Pro feature
 * without a subscription.
 *
 * Plans:
 *   RangeDOPE Pro  — $24.99/year  (recurring)
 *   RangeDOPE Founders — $79 one-time (limited — capped 2,000 during launch quarter)
 *
 * Features listed below the plans:
 *   Unlimited rifle profiles · ShotPlan hunt planning · Hunter WEZ traffic light
 *   Wind-risk envelope · DOPE PDF export · Offline map areas · All importers
 *
 * RevenueCat handles all billing — this component is billing-provider agnostic.
 * During beta (PAYWALL_ENABLED=false) the modal is never shown.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEntitlement, PRODUCT_IDS } from '../hooks/useEntitlement';
import type { Theme } from '../theme';

const FONT = 'SpaceMono-Regular';

// ─── Feature list ────────────────────────────────────────────────────────────

const PRO_FEATURES = [
  { icon: 'layers-outline',       label: 'Unlimited rifle profiles' },
  { icon: 'map-outline',          label: 'ShotPlan hunt planning' },
  { icon: 'shield-checkmark-outline', label: 'Hunter WEZ traffic light' },
  { icon: 'analytics-outline',    label: 'Wind-risk envelope (winds aloft)' },
  { icon: 'document-text-outline', label: 'DOPE card PDF export' },
  { icon: 'download-outline',     label: 'Offline map areas' },
  { icon: 'swap-horizontal-outline', label: 'Strelok / Hornady importers' },
  { icon: 'qr-code-outline',      label: 'QR profile share' },
] as const;

// ─── Plan card ────────────────────────────────────────────────────────────────

function PlanCard({
  title,
  price,
  period,
  badge,
  selected,
  onSelect,
  theme,
}: {
  title: string;
  price: string;
  period: string;
  badge?: string;
  selected: boolean;
  onSelect: () => void;
  theme: Theme;
}) {
  return (
    <Pressable
      onPress={onSelect}
      style={[
        styles.planCard,
        {
          borderColor: selected ? theme.primary : theme.border,
          backgroundColor: selected ? `${theme.primary}18` : theme.surface,
        },
      ]}
      accessibilityLabel={`Select ${title} plan`}
    >
      {badge && (
        <View style={[styles.badge, { backgroundColor: theme.primary }]}>
          <Text style={[styles.badgeText, { color: theme.bg }]}>{badge}</Text>
        </View>
      )}
      <Text style={[styles.planTitle, { color: theme.primary }]}>{title}</Text>
      <View style={styles.planPriceRow}>
        <Text style={[styles.planPrice, { color: selected ? theme.primary : theme.label }]}>
          {price}
        </Text>
        <Text style={[styles.planPeriod, { color: theme.dim }]}>{period}</Text>
      </View>
      {selected && (
        <Ionicons
          name="checkmark-circle"
          size={20}
          color={theme.primary}
          style={styles.planCheck}
        />
      )}
    </Pressable>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onDismiss: () => void;
  /** Optional feature name shown in the header e.g. "ShotPlan" */
  featureName?: string;
  theme: Theme;
}

export function PaywallScreen({ visible, onDismiss, featureName, theme }: Props) {
  const { purchase, restore, loading } = useEntitlement();
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'lifetime'>('annual');

  async function handleSubscribe() {
    try {
      const productId = selectedPlan === 'annual'
        ? PRODUCT_IDS.annual
        : PRODUCT_IDS.lifetime;
      const success = await purchase(productId);
      if (success) {
        Alert.alert('Welcome to RangeDOPE Pro! 🎯', 'All Pro features are now unlocked.');
        onDismiss();
      }
    } catch (e) {
      Alert.alert('Purchase failed', String(e));
    }
  }

  async function handleRestore() {
    try {
      await restore();
      Alert.alert('Restored', 'Your purchases have been restored.');
      onDismiss();
    } catch (e) {
      Alert.alert('Restore failed', String(e));
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onDismiss}
    >
      <View style={[styles.root, { backgroundColor: theme.bg }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={onDismiss} hitSlop={12} accessibilityLabel="Close paywall">
            <Ionicons name="close" size={22} color={theme.label} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.primary }]}>RANGEDOPE PRO</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={styles.hero}>
            <Ionicons name="radio-button-on-outline" size={48} color={theme.primary} />
            <Text style={[styles.heroTitle, { color: theme.primary }]}>
              {featureName ? `Unlock ${featureName}` : 'Go Pro'}
            </Text>
            <Text style={[styles.heroBody, { color: theme.dim }]}>
              Everything a serious hunter needs.{'\n'}
              Zero cloud. Zero account. All on your phone.
            </Text>
          </View>

          {/* Feature list */}
          <View style={[styles.featureCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {PRO_FEATURES.map((f) => (
              <View key={f.label} style={styles.featureRow}>
                <Ionicons name={f.icon as keyof typeof Ionicons.glyphMap} size={16} color={theme.primary} />
                <Text style={[styles.featureLabel, { color: theme.label }]}>{f.label}</Text>
              </View>
            ))}
          </View>

          {/* Plan selector */}
          <Text style={[styles.sectionLabel, { color: theme.dim }]}>CHOOSE A PLAN</Text>
          <View style={styles.planRow}>
            <PlanCard
              title="RANGEDOPE PRO"
              price="$24.99"
              period="/year"
              selected={selectedPlan === 'annual'}
              onSelect={() => setSelectedPlan('annual')}
              theme={theme}
            />
            <PlanCard
              title="FOUNDERS"
              price="$79"
              period="one-time"
              badge="LIMITED"
              selected={selectedPlan === 'lifetime'}
              onSelect={() => setSelectedPlan('lifetime')}
              theme={theme}
            />
          </View>

          <Text style={[styles.trialNote, { color: theme.dim }]}>
            Cancel anytime. Apple / Google handle billing.{'\n'}
            Your data never leaves your phone.
          </Text>

          {/* CTA */}
          <Pressable
            onPress={handleSubscribe}
            disabled={loading}
            style={[styles.cta, { backgroundColor: theme.primary }]}
            accessibilityLabel="Subscribe to RangeDOPE Pro"
          >
            {loading
              ? <ActivityIndicator color={theme.bg} />
              : (
                <Text style={[styles.ctaText, { color: theme.bg }]}>
                  {selectedPlan === 'annual' ? 'GO PRO — $24.99/yr' : 'GET FOUNDERS — $79'}
                </Text>
              )}
          </Pressable>

          <Pressable
            onPress={handleRestore}
            disabled={loading}
            style={styles.restoreBtn}
            accessibilityLabel="Restore previous purchases"
          >
            <Text style={[styles.restoreText, { color: theme.dim }]}>Restore purchases</Text>
          </Pressable>

          <Text style={[styles.legal, { color: theme.dim }]}>
            Payment charged to your Apple ID / Google account at purchase confirmation.
            Annual subscription renews automatically. Cancel at any time in your device
            subscription settings. Founders pass is a one-time non-recurring purchase.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Gate wrapper ────────────────────────────────────────────────────────────

/**
 * Convenience hook — returns a `gate(featureName)` function that shows the
 * paywall and resolves to true if the user is pro (or becomes pro after purchase).
 *
 * Usage:
 *   const { isPro, showPaywall, PaywallModal } = useProGate(theme);
 *   // In JSX: <PaywallModal />
 *   // In handler: if (!isPro) { showPaywall('ShotPlan'); return; }
 */
export function useProGate(theme: Theme) {
  const entitlement = useEntitlement();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [featureName, setFeatureName] = useState<string | undefined>();

  function showPaywall(name?: string) {
    setFeatureName(name);
    setPaywallVisible(true);
  }

  const PaywallModal = () => (
    <PaywallScreen
      visible={paywallVisible}
      onDismiss={() => setPaywallVisible(false)}
      featureName={featureName}
      theme={theme}
    />
  );

  return {
    isPro: entitlement.isPro,
    loading: entitlement.loading,
    showPaywall,
    PaywallModal,
  };
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontFamily: FONT, fontSize: 13, letterSpacing: 2 },
  scroll: { padding: 20, gap: 16, paddingBottom: 48 },

  // Hero
  hero: { alignItems: 'center', gap: 10, paddingVertical: 12 },
  heroTitle: { fontFamily: FONT, fontSize: 24, letterSpacing: 1 },
  heroBody: { fontFamily: FONT, fontSize: 12, textAlign: 'center', lineHeight: 20 },

  // Feature list
  featureCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureLabel: { fontFamily: FONT, fontSize: 12 },

  // Plans
  sectionLabel: { fontFamily: FONT, fontSize: 9, letterSpacing: 2, marginTop: 4 },
  planRow: { flexDirection: 'row', gap: 12 },
  planCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    gap: 4,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: { fontFamily: FONT, fontSize: 8, letterSpacing: 1 },
  planTitle: { fontFamily: FONT, fontSize: 10, letterSpacing: 1 },
  planPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 },
  planPrice: { fontFamily: FONT, fontSize: 22 },
  planPeriod: { fontFamily: FONT, fontSize: 10 },
  planCheck: { position: 'absolute', top: 12, right: 12 },

  trialNote: {
    fontFamily: FONT,
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 16,
  },

  // CTA
  cta: {
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontFamily: FONT, fontSize: 14, letterSpacing: 1 },

  restoreBtn: { alignItems: 'center', paddingVertical: 8 },
  restoreText: { fontFamily: FONT, fontSize: 11 },

  legal: {
    fontFamily: FONT,
    fontSize: 9,
    lineHeight: 15,
    textAlign: 'center',
    opacity: 0.7,
  },
});
