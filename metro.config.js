const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Bundle the offline map tile set (assets/map/*.pmtiles) as an asset
config.resolver.assetExts.push('pmtiles');

module.exports = config;
