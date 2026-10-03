// Metro resolves a bundled asset to a numeric module id (see metro.config.js for the extension)
declare module '*.pmtiles' {
  const assetModule: number;
  export default assetModule;
}

declare module '*.png' {
  const assetModule: number;
  export default assetModule;
}
