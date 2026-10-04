const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Bundle the offline map tile set (assets/map/*.pmtiles) as an asset
config.resolver.assetExts.push('pmtiles');
// and the offline label glyphs (assets/glyphs/glyphs-v<N>/<font>/<range>.pbf), LB1a
config.resolver.assetExts.push('pbf');

module.exports = config;
