import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors, typography } from '../theme/designTokens';
import { RecordingScreen } from '../screens/RecordingScreen';
import { SpecScreen } from '../screens/SpecScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.background,
    text: colors.textPrimary,
    primary: colors.accent,
    border: colors.border,
    notification: colors.accent,
  },
};

/** Root stack: Recording → Spec → Settings. */
export function RootNavigator(): React.JSX.Element {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        initialRouteName="Recording"
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.textPrimary, ...typography.title },
          headerTintColor: colors.accent,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="Recording"
          component={RecordingScreen}
          options={{ title: 'Voice2Spec AI' }}
        />
        <Stack.Screen name="Spec" component={SpecScreen} options={{ title: 'Specification' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
