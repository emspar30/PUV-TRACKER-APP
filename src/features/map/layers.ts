import baseStyle from '../../../assets/map/style.json';

// Topmost layer of the base map. Route lines are inserted right above it, so markers added
// later (blue dot, pins, trip) always draw over the routes whatever order they load in.
export const BASEMAP_TOP_LAYER_ID: string = baseStyle.layers[baseStyle.layers.length - 1].id;
