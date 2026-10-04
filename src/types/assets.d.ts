// Metro resolves these files as bundled assets (see metro.config.js) and gives each a numeric id
declare module '*.pmtiles' {
  const asset: number;
  export default asset;
}

declare module '*.pbf' {
  const asset: number;
  export default asset;
}
