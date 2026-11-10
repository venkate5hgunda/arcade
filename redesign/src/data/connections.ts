export interface ConnectionsPuzzle {
  id: string;
  groups: { name: string; words: string[] }[];
}

// Original authored sets, bundled for offline play. Stable IDs and word order
// are part of the checkpoint/wire contract. Daily puzzles cycle every 24 days.
const sets = [
  [
    ['Things with keys', 'PIANO ORGAN KEYBOARD TYPEWRITER'],
    ['Kinds of bean', 'KIDNEY PINTO NAVY LIMA'],
    ['Words before "board"', 'SURF SKATE DASH CUP'],
    ['Move quickly', 'BOLT SPRINT RACE HURRY'],
  ],
  [
    ['Parts of a book', 'SPINE COVER INDEX PREFACE'],
    ['Breakfast grains', 'OATS GRITS MUESLI PORRIDGE'],
    ['Kinds of wave', 'TIDAL RADIO SOUND HEAT'],
    ['Words before "light"', 'FLASH SPOT MOON TRAFFIC'],
  ],
  [
    ['Things you can tie', 'KNOT LACE RIBBON NECKTIE'],
    ['Chess pieces', 'ROOK BISHOP PAWN KNIGHT'],
    ['Words after "sea"', 'HORSE SHELL WEED LION'],
    ['Types of pitch', 'SALES MUSICAL BASEBALL ROOF'],
  ],
  [
    ['Units of time', 'SECOND MINUTE HOUR WEEK'],
    ['Parts of a plant', 'ROOT STEM LEAF FLOWER'],
    ['Words before "cake"', 'PAN CUP CHEESE SHORT'],
    ['Things with a head', 'COIN NAIL DRUM CABBAGE'],
  ],
  [
    ['Kitchen measures', 'CUP PINT QUART GALLON'],
    ['Things in an orchestra', 'OBOE CELLO HARP TUBA'],
    ['Words after "rain"', 'BOW COAT DROP FOREST'],
    ['Computer actions', 'COPY PASTE SAVE UNDO'],
  ],
  [
    ['Ways to cook eggs', 'POACH SCRAMBLE FRY BOIL'],
    ['Kinds of tree', 'ELM OAK PINE BIRCH'],
    ['Words before "ball"', 'SNOW FOOT EYE FIRE'],
    ['Things that have a tongue', 'SHOE BELL WAGON PERSON'],
  ],
  [
    ['Gardening tools', 'RAKE HOE TROWEL SHEARS'],
    ['Things you can draw', 'BATH CARD CURTAIN PICTURE'],
    ['Words after "book"', 'WORM MARK CASE END'],
    ['Weather instruments', 'BAROMETER ANEMOMETER THERMOMETER HYGROMETER'],
  ],
  [
    ['Things in a sewing kit', 'NEEDLE THREAD THIMBLE BOBBIN'],
    ['Shades of blue', 'AZURE COBALT CERULEAN INDIGO'],
    ['Words before "house"', 'GREEN LIGHT WARE TREE'],
    ['Kinds of roll', 'BREAD DRUM HONOR CAMERA'],
  ],
  [
    ['Places to keep money', 'BANK WALLET SAFE VAULT'],
    ['Things with scales', 'FISH DRAGON PIANO MAP'],
    ['Words after "sun"', 'RISE SET FLOWER DIAL'],
    ['Still bodies of water', 'LAKE POND POOL PUDDLE'],
  ],
  [
    ['Parts of a bicycle', 'SADDLE PEDAL SPOKE HANDLEBAR'],
    ['Kinds of nut', 'PECAN ALMOND CASHEW WALNUT'],
    ['Words before "drop"', 'GUM TEAR BACK DEW'],
    ['Things you can break', 'PROMISE RECORD SILENCE HABIT'],
  ],
  [
    ['Things in a deck of cards', 'ACE JACK QUEEN KING'],
    ['Types of pasta', 'PENNE FUSILLI RIGATONI ORZO'],
    ['Words after "tooth"', 'BRUSH PASTE PICK ACHE'],
    ['Go around', 'ORBIT CIRCLE ENCIRCLE SURROUND'],
  ],
  [
    ['Kinds of hat', 'BERET FEDORA BEANIE BONNET'],
    ['Things that can be sharp', 'KNIFE WIT CHEDDAR TURN'],
    ['Words before "work"', 'HOME FRAME CLOCK NET'],
    ['Parts of a stage', 'APRON WINGS TRAPDOOR BACKDROP'],
  ],
  [
    ['Things on an envelope', 'STAMP ADDRESS POSTMARK FLAP'],
    ['Kinds of berry', 'BLUEBERRY RASPBERRY GOOSEBERRY BLACKBERRY'],
    ['Words after "fire"', 'FLY PLACE PROOF FIGHTER'],
    ['Ways to walk', 'STROLL STRIDE SAUNTER TRUDGE'],
  ],
  [
    ['Types of bridge', 'ARCH BEAM SUSPENSION CANTILEVER'],
    ['Kinds of pepper', 'BELL CAYENNE JALAPENO HABANERO'],
    ['Words before "line"', 'DEAD HEAD LIFE PUNCH'],
    ['Things you can cast', 'VOTE SHADOW SPELL DOUBT'],
  ],
  [
    ['Parts of a shoe', 'SOLE HEEL TOE INSOLE'],
    ['Things made by bees', 'HONEY WAX PROPOLIS ROYAL-JELLY'],
    ['Words after "snow"', 'MAN FLAKE FALL PLOW'],
    ['Ways to fasten', 'ZIP BUTTON BUCKLE CLASP'],
  ],
  [
    ['Types of cloud', 'CIRRUS CUMULUS STRATUS NIMBUS'],
    ['Things you can fold', 'PAPER LAUNDRY ARMS OMELET'],
    ['Words before "fish"', 'STAR JELLY SWORD CAT'],
    ['Kinds of dance', 'WALTZ TANGO POLKA SALSA'],
  ],
  [
    ['Parts of a camera', 'LENS SHUTTER SENSOR VIEWFINDER'],
    ['Kinds of melon', 'CANTALOUPE HONEYDEW WATERMELON GALIA'],
    ['Words after "hand"', 'SHAKE STAND BAG CUFF'],
    ['Things you can plant', 'SEED FLAG IDEA EVIDENCE'],
  ],
  [
    ['Things with rings', 'SATURN TREE BINDER TELEPHONE'],
    ['Baking ingredients', 'FLOUR YEAST SUGAR BUTTER'],
    ['Words before "way"', 'HIGH FREE SUB RUN'],
    ['Ways to look', 'GLANCE PEEK STARE GAZE'],
  ],
  [
    ['Parts of a river', 'SOURCE MOUTH BANK TRIBUTARY'],
    ['Things you can serve', 'TENNIS DINNER NOTICE SENTENCE'],
    ['Words after "ear"', 'RING DRUM WAX WIG'],
    ['Types of fabric', 'LINEN DENIM VELVET TWEED'],
  ],
  [
    ['Kinds of citrus', 'LEMON LIME ORANGE GRAPEFRUIT'],
    ['Things with teeth', 'COMB SAW ZIPPER GEAR'],
    ['Words before "room"', 'BED BATH CLASS BALL'],
    ['Ways to laugh', 'CHUCKLE GIGGLE GUFFAW SNICKER'],
  ],
  [
    ['Parts of a sailboat', 'MAST BOOM RUDDER KEEL'],
    ['Things you can crack', 'EGG CODE JOKE KNUCKLE'],
    ['Words after "door"', 'BELL MAT KNOB STEP'],
    ['Types of knot', 'BOWLINE CLOVE-HITCH REEF SHEET-BEND'],
  ],
  [
    ['Things in a first-aid kit', 'BANDAGE GAUZE ANTISEPTIC TWEEZERS'],
    ['Kinds of shoe', 'LOAFER BROGUE SANDAL CLOG'],
    ['Words before "stone"', 'MILE KEY LIME GEM'],
    ['Things that can be flat', 'TIRE NOTE PANCAKE SCREEN'],
  ],
  [
    ['Types of triangle', 'ISOSCELES EQUILATERAL SCALENE RIGHT'],
    ['Things you can run', 'MARATHON ERRAND BUSINESS BATH'],
    ['Words after "paper"', 'CLIP CUT BACK WEIGHT'],
    ['Ways to close', 'SHUT SEAL LATCH BOLT'],
  ],
  [
    ['Things with a crown', 'KING TOOTH TREE HAT'],
    ['Kinds of soup', 'BISQUE CHOWDER CONSOMME GAZPACHO'],
    ['Words before "time"', 'BED HALF SOME SPRING'],
    ['Ways to turn', 'PIVOT SPIN ROTATE SWIVEL'],
  ],
];

export const CONNECTIONS_PUZZLES: ConnectionsPuzzle[] = sets.map(
  (groups, index) => ({
    id: `connections-${String(index + 1).padStart(2, '0')}`,
    groups: groups.map(([name, words]) => ({ name, words: words.split(' ') })),
  }),
);
