/**
 * Detox configuration for end-to-end tests on a simulator/emulator.
 * Authored for completeness; running it requires a built native app and an
 * iOS Simulator / Android Emulator (not available in the CI container).
 */
module.exports = {
  testRunner: {
    args: { $0: 'jest', config: 'e2e/jest.config.js' },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/Voice2Spec.app',
      build:
        'xcodebuild -workspace ios/Voice2Spec.xcworkspace -scheme Voice2Spec -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
    },
  },
  devices: {
    simulator: { type: 'ios.simulator', device: { type: 'iPhone 15' } },
  },
  configurations: {
    'ios.sim.debug': { device: 'simulator', app: 'ios.debug' },
  },
};
