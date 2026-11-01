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
  // CA1.1
  'towards',
  'toward',
];

// CA1.1: "for Y" ("what route should I board for Robinsons?"), a destination only when the question
// has no other to-marker, so "the fare for SM to Ampayon" still ends at Ampayon
export const WEAK_TO_MARKERS: readonly string[] = ['for'];

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
  // CA1.1: the words round a destination in a plain English question ("which multicab should we take")
  'route',
  'routes',
  'we',
  'board',
  'on',
  'need',
  'want',
  'you',
];

// Commuter guide (2026-11-02): the words of a question about how to ride, for a visitor or a first-time
// rider. Checked before a trip, in this order, so "what do I say to the driver" is not a trip "to the
// driver". Each list avoids words that are place names or part of a trip question ("stop", "board",
// "sakay"), and "gabii" alone (it is in "maayong gabii").
export const GUIDE_WORDS = {
  getOff: ['get off', 'getting off', 'get down', 'alight', 'drop me', 'drop off', 'para', 'lugar lang', 'diri lang', 'manaog', 'monaog', 'naog', 'stop the multicab', 'stop the jeep', 'stop the vehicle', 'driver to stop', 'want to stop', 'tap', 'tap a coin', 'knock', 'signal the driver', 'signal to stop'],
  askDriver: ['ask the driver', 'say to the driver', 'tell the driver', 'talk to the driver', 'what do i say', 'what to say', 'what should i say', 'moagi', 'muagi', 'agi ba'],
  pay: ['pay', 'paying', 'payment', 'how to bayad', 'unsaon pagbayad', 'pagbayad', 'sukli', 'barya', 'change', 'coins', 'pass the fare', 'pasa', 'ipasa', 'usa ra', 'duha'],
  flag: ['flag', 'hail', 'wave', 'catch a multicab', 'catch a jeep', 'how do i board', 'how to board', 'get on', 'get in', 'unsaon pagsakay', 'pagsakay'],
  fareRules: ['discount', 'discounts', 'student fare', 'senior fare', 'pwd fare', 'minimum fare', 'base fare', 'fare rules', 'fare matrix', 'how is the fare', 'fare computed', 'fare computation'],
  lost: ['lost', 'wrong multicab', 'wrong jeep', 'wrong route', 'wrong ride', 'missed my stop', 'passed my stop', 'nawala', 'sayop', 'nasayop'],
  safety: ['safe', 'safety', 'danger', 'dangerous', 'pickpocket', 'snatcher', 'thief', 'stolen', 'emergency', 'police', '911'],
  night: ['night', 'at night', 'late', 'midnight', 'evening', 'sa gabii', 'gabii na', 'what time', 'hours', 'schedule', 'first trip', 'last trip'],
  etiquette: ['etiquette', 'manners', 'polite', 'rude', 'where to sit', 'where do i sit', 'seat', 'seats', 'priority', 'usog', 'bag', 'bags', 'luggage', 'eat', 'food', 'kadiyot'],
  phrases: ['phrase', 'phrases', 'words', 'bisaya', 'cebuano', 'binisaya', 'language', 'translate', 'how do i say', 'how to say', 'thank you', 'salamat'],
  visitor: ['tourist', 'foreigner', 'visitor', 'first time', 'new here', 'not from here', 'tips', 'guide', 'how to commute', 'how do i commute', 'commuting', 'how does it work'],
  multicab: ['what is a multicab', 'what is multicab', 'what s a multicab', 'what are multicabs', 'jeepney', 'jeep'],
} as const satisfies Record<string, readonly string[]>;
