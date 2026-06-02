const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro config. `watchFolders` includes the monorepo root so the
 * @voice2spec/shared-types workspace package resolves correctly.
 */
const path = require('path');

const config = {
  watchFolders: [path.resolve(__dirname, '../..')],
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
