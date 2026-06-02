/* eslint-disable no-undef */
// Reanimated provides a Jest mock that no-ops the native layer.
require('react-native-reanimated').setUpTests?.();

// Silence the native animation helper warning in tests.
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}), { virtual: true });
