const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// The offline tile set (assets/map/butuan.pmtiles) is bundled as an asset
config.resolver.assetExts.push('pmtiles');

module.exports = config;
