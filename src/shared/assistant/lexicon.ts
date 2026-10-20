// CA1: the words the offline assistant listens for, in English and Bisaya (Cebuano), already in the
// form normalizeSearch gives (lower case, no accents or punctuation). A phrase matches whole words
// only, so "to" never matches inside "Tiniwisan". Replies stay in English (PRD 0.6).

// "to Y": where the trip ends
export const TO_MARKERS: readonly string[] = [
  'to',
  'going to',
  'paingon sa',
  'paingon',
  'padulong sa',
  'padulong',
  'ngadto sa',
  'ngadto',
  'hangtod sa',
  'hangtod',
  'papunta sa',
  'papunta',
  'padung sa',
  'padung',
  'adto sa',
  'adto',
  'muadto sa',
  'muadto',
];

// The short "pa SM": a to-marker only at the start of a question or right after a ride or fare word
// ("sakay pa SM"), because "pa" also means "still" ("naa pa bay R4?")
export const SHORT_TO_MARKER = 'pa';

// "from X": where the trip starts
export const FROM_MARKERS: readonly string[] = ['from', 'gikan sa', 'gikan', 'galing sa'];

// A question about the fare
// "pila'y" reads as "pila y" once the apostrophe is taken out
export const FARE_WORDS: readonly string[] = [
  'fare',
  'how much',
  'pila',
  'pilay',
  'pila y',
  'plete',
  'pliti',
  'plite',
  'pasahe',
  'pamasahe',
  'bayad',
  'cost',
];

// A question about what to ride
export const RIDE_WORDS: readonly string[] = [
  'unsay sakyan',
  'unsa sakyan',
  'unsa ang sakyan',
  'sakyan',
  'masakyan',
  'kasakyan',
  'musakay',
  'sakay',
  'ride',
  'take',
  'multicab',
  'jeep',
  'jeepney',
];

// Whether a route has multicabs on it now
export const RUNNING_WORDS: readonly string[] = [
  'running',
  'available',
  'operating',
  'naa bay',
  'naa pa bay',
  'aduna bay',
  'naa ba',
  'naay',
  'nidagan',
  'nagdagan',
  'gadagan',
  'biyahe',
  'byahe',
  'gabyahe',
  'status',
];

// "R4", "route 4": the words that may come before a route number
export const ROUTE_WORDS: readonly string[] = ['r', 'route', 'ruta', 'rota'];

// The nearest stop
export const NEAREST_WORDS: readonly string[] = ['nearest', 'closest', 'nearby', 'near me', 'pinakaduol', 'duol', 'hapit'];
export const WHERE_WORDS: readonly string[] = ['where', 'asa', 'diin'];
export const STOP_WORDS: readonly string[] = ['stop', 'stops', 'station', 'sakayan', 'hulatanan', 'hunonganan', 'nauganan', 'paradahan'];

// A slot that means the user's own position
export const HERE_WORDS: readonly string[] = ['here', 'me', 'my location', 'diri', 'dinhi', 'ako', 'nako'];

export const GREETINGS: readonly string[] = [
  'hi',
  'hello',
  'hey',
  'help',
  'tabang',
  'maayong buntag',
  'maayong hapon',
  'maayong gabii',
  'good morning',
  'good afternoon',
  'good evening',
];

// Words taken off either end of a place name typed in a question ("the SM", "sa Libertad ba")
export const FILLER_WORDS: readonly string[] = [
  'a',
  'an',
  'the',
  'i',
  'do',
  'does',
  'can',
  'get',
  'go',
  'how',
  'what',
  'which',
  'is',
  'are',
  'there',
  'any',
  'should',
  'please',
  'pls',
  'much',
  'my',
  'at',
  'in',
  'near',
  'sa',
  'ang',
  'ug',
  'og',
  'nga',
  'ba',
  'bay',
  'pa',
  'naa',
  'unsa',
  'unsay',
  'ko',
  'mo',
  'ka',
  'kay',
  'man',
  'diay',
  'karon',
  'now',
  'today',
];
