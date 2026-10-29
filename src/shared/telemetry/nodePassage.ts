// NM1: the stop passage rule, defined once beside the ingest Edge Function (which can only load files
// from its own folder) and re-exported here for the app, as the config re-exports the server values.
// Pure: it sends nothing.
export { newPassages, type PassPoint, type Passage, type PassStop } from '../../../supabase/functions/_shared/nodePassage.ts';
