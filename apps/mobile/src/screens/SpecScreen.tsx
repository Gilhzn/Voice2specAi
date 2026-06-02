import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/designTokens';
import { SpecDocumentView } from '../components/SpecDocumentView';
import { useAppStore } from '../store/useAppStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Spec'>;

/** Displays the generated specification, or a progress state while pending. */
export function SpecScreen(_props: Props): React.JSX.Element {
  const { spec, specProgress } = useAppStore();

  if (!spec) {
    return (
      <SafeAreaView style={styles.center} testID="spec-pending">
        <Text style={styles.progress}>Generating specification… {Math.round(specProgress * 100)}%</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <SpecDocumentView spec={spec} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  progress: { ...typography.body, color: colors.accent },
});
