import 'react-native-reanimated';
import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors } from './src/theme/designTokens';

/** App root: providers + status bar styling for the true-black theme. */
export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <RootNavigator />
    </SafeAreaProvider>
  );
}
