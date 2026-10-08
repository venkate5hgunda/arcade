// Imposter word catalog. Each entry is "Word|Hint|Decoy":
// - Hint: a vague nudge an imposter may be shown in Classic mode.
// - Decoy: a close-but-different word imposters receive in Pair mode.
// Original curation; references only informed the category mix.

const RAW = {
  food: ['Food & Drinks', '🍕', `
Pizza|Sliced and shared|Flatbread
Burger|Comes in a bun|Hot dog
Sushi|Rolled and raw|Ramen
Pancakes|Weekend breakfast|Waffles
Ice cream|Melts fast|Frozen yogurt
Coffee|Morning ritual|Tea
Spaghetti|Twirl with a fork|Noodles
Tacos|Folded shell|Burrito
Popcorn|Movie night snack|Nachos
Chocolate|Sweet treat|Caramel
Lemon|Sour citrus|Lime
Cupcake|Party bake|Muffin
Sandwich|Lunchbox staple|Wrap
Watermelon|Summer fruit|Cantaloupe
Smoothie|Blended drink|Milkshake
French fries|Fast-food side|Potato wedges
Pineapple|Spiky outside|Mango
Croissant|Flaky bakery item|Bagel
Cheesecake|Rich dessert|Tiramisu
Lemonade|Stand on the street|Iced tea
Honey|Golden and sticky|Maple syrup
Steak|Cooked rare or well done|Pork chop
Avocado|Green and creamy|Pear
Dumplings|Pinched and steamed|Spring rolls
Cereal|Breakfast bowl|Oatmeal
Jam|Spread on toast|Peanut butter
Soup|Served in a bowl|Stew
Donut|Has a hole|Bagel
Salad|Toss it|Coleslaw
Hot chocolate|Winter mug|Coffee`],
  animals: ['Animals', '🐾', `
Dog|Loyal pet|Wolf
Cat|Independent pet|Rabbit
Elephant|Never forgets|Rhino
Lion|Big cat|Tiger
Penguin|Cannot fly|Puffin
Dolphin|Smart swimmer|Shark
Giraffe|Very tall|Camel
Kangaroo|Bounces around|Wallaby
Owl|Night bird|Bat
Butterfly|Colorful wings|Moth
Crocodile|River ambush|Alligator
Turtle|Carries its home|Tortoise
Eagle|Sharp-eyed flyer|Hawk
Octopus|Many arms|Squid
Bee|Tiny worker|Wasp
Horse|Can be ridden|Donkey
Panda|Loves bamboo|Koala
Frog|Jumps and croaks|Toad
Parrot|Can mimic|Peacock
Snake|No legs|Lizard
Zebra|Striped|Horse
Gorilla|Strong primate|Chimpanzee
Hedgehog|Spiky little one|Porcupine
Squirrel|Stores food|Chipmunk
Whale|Ocean giant|Dolphin
Fox|Clever and red|Wolf
Peacock|Shows off|Parrot
Camel|Desert traveler|Llama
Spider|Spins a home|Scorpion
Seal|Barks on rocks|Sea lion`],
  home: ['Around the House', '🛋️', `
Toothbrush|Twice a day|Hairbrush
Umbrella|Rainy days|Raincoat
Pillow|Rest your head|Cushion
Mirror|Look at yourself|Window
Couch|Living room seat|Armchair
Refrigerator|Keeps things cold|Freezer
Microwave|Quick heating|Oven
Blanket|Keeps you warm|Quilt
Candle|Small flame|Lamp
Scissors|Cuts things|Knife
Alarm clock|Wakes you up|Phone
Vacuum cleaner|Sucks up mess|Broom
Washing machine|Laundry day|Dishwasher
Toaster|Pops up|Sandwich maker
Doorbell|Someone is here|Knocker
Bathtub|Soak in it|Shower
Remote control|Couch power|Game controller
Curtains|Cover the window|Blinds
Kettle|Whistles when ready|Coffee maker
Bookshelf|Stores stories|Cupboard
Ceiling fan|Spins overhead|Air conditioner
Hanger|In the closet|Hook
Rug|On the floor|Doormat
Mug|Hot drinks|Cup
Key|Opens things|Lock
Bed|Sleep on it|Sofa
Trash can|Throw it away|Recycling bin
Iron|Removes wrinkles|Steamer
Plant pot|Something grows|Vase
Light switch|On or off|Dimmer`],
  places: ['Places', '📍', `
Beach|Sand and waves|Lake
Airport|Departures|Train station
Library|Shh, quiet|Bookstore
Hospital|Get better here|Clinic
Museum|Look, don't touch|Art gallery
Zoo|Animals on display|Aquarium
Restaurant|Order and eat|Cafe
Supermarket|Weekly shopping|Market
Cinema|Big screen|Theater
Stadium|Crowds cheer|Arena
Hotel|Stay overnight|Hostel
School|Classes and bells|College
Gym|Work out|Yoga studio
Park|Green open space|Garden
Castle|Royal fortress|Palace
Bakery|Fresh bread smell|Pastry shop
Amusement park|Thrill rides|Water park
Farm|Crops and animals|Ranch
Bank|Money business|ATM
Post office|Letters and parcels|Courier office
Temple|Place of worship|Church
Campsite|Tents outdoors|Cabin
Bus stop|Wait for a ride|Taxi stand
Hair salon|New look|Barbershop
Lighthouse|Guides ships|Watchtower
Prison|Locked in|Police station
Mall|Many shops|Market
Pharmacy|Medicines|Clinic
Laundromat|Wash clothes|Dry cleaner
Rooftop|Top of a building|Balcony`],
  jobs: ['Jobs', '🧑‍🚒', `
Doctor|Saves lives|Nurse
Teacher|Classroom leader|Professor
Firefighter|Brave rescuer|Paramedic
Pilot|Up in the air|Flight attendant
Chef|Kitchen boss|Baker
Police officer|Keeps order|Security guard
Astronaut|Out of this world|Pilot
Dentist|Check your teeth|Doctor
Plumber|Fixes leaks|Electrician
Farmer|Grows food|Gardener
Lawyer|Argues cases|Judge
Photographer|Captures moments|Painter
Magician|Tricks and illusions|Clown
Lifeguard|Watches the water|Coast guard
Detective|Solves mysteries|Journalist
Veterinarian|Cares for animals|Zookeeper
Barber|Haircuts|Hairstylist
Mechanic|Fixes cars|Engineer
Architect|Designs buildings|Builder
Waiter|Takes your order|Bartender
Librarian|Organizes books|Archivist
Postman|Delivers mail|Courier
Scientist|Runs experiments|Inventor
Cashier|At the counter|Bank teller
Tailor|Stitches clothes|Fashion designer
Carpenter|Works with wood|Builder
Taxi driver|Drives strangers|Bus driver
DJ|Plays the tracks|Singer
Soldier|Serves the country|Guard
Actor|Plays a role|Comedian`],
  sports: ['Sports', '⚽', `
Soccer|World's game|Rugby
Basketball|Hoops|Volleyball
Tennis|Racket and net|Badminton
Cricket|Bat and wickets|Baseball
Swimming|In the pool|Diving
Boxing|Gloves on|Wrestling
Golf|Quiet on the green|Mini golf
Skiing|Snowy slopes|Snowboarding
Surfing|Ride the wave|Skateboarding
Cycling|Pedal power|Running
Marathon|Long distance|Sprint
Table tennis|Small paddles|Tennis
Bowling|Knock them down|Billiards
Archery|Aim for the center|Darts
Ice hockey|Puck on ice|Field hockey
Volleyball|Spike it|Beach ball
Gymnastics|Flips and balance|Ballet
Karate|Martial art|Judo
Rowing|Oars in water|Kayaking
Horse racing|Jockeys|Polo
Chess|Mind sport|Checkers
Rock climbing|Up the wall|Hiking
Fencing|Swords and masks|Archery
Weightlifting|Heavy lifting|Bodybuilding
Kabaddi|Hold your breath|Wrestling
Formula One|Fast cars|Go-karting
Olympics|Global games|World Cup
Referee|Blows the whistle|Coach
Gold medal|First place|Trophy
Penalty kick|One on one|Free kick`],
  hobbies: ['Hobbies & Activities', '🎯', `
Camping|Sleep outdoors|Picnic
Yoga|Stretch and breathe|Pilates
Fishing|Patience by the water|Boating
Karaoke|Sing along|Concert
Gardening|Green thumb|Farming
Photography|Snap snap|Painting
Knitting|Needles and yarn|Sewing
Hiking|Trails|Walking
Dancing|Move to music|Aerobics
Cooking|In the kitchen|Baking
Reading|Turn the page|Writing
Painting|Brush strokes|Drawing
Video games|Controller in hand|Board games
Puzzles|Pieces fit|Crosswords
Bird watching|Binoculars|Stargazing
Scrapbooking|Memories on paper|Journaling
Pottery|Clay on a wheel|Sculpting
Skateboarding|Board tricks|Rollerblading
Magic tricks|Sleight of hand|Juggling
Calligraphy|Fancy writing|Sketching
Origami|Folded paper|Paper crafts
Podcasting|Talk into a mic|Blogging
Woodworking|Saws and sanding|Carving
Meditation|Calm the mind|Yoga
Board games|Around the table|Card games
Kite flying|Up on a string|Paragliding
Volunteering|Help for free|Fundraising
Collecting stamps|Albums of tiny art|Collecting coins
Escape room|Find the way out|Treasure hunt
Road trip|Long drive|Train journey`],
  travel: ['Travel & Transport', '✈️', `
Airplane|Wings in the sky|Helicopter
Train|On rails|Tram
Bicycle|Two wheels|Scooter
Taxi|Hail a ride|Uber
Cruise ship|Floating hotel|Ferry
Hot air balloon|Floating basket|Blimp
Subway|Underground ride|Train
Motorcycle|Fast two-wheeler|Scooter
Passport|Needed abroad|Visa
Suitcase|Packed for travel|Backpack
Map|Find your way|Compass
Rocket|Liftoff|Space shuttle
Traffic jam|Going nowhere|Rush hour
Gas station|Fill up|Charging station
Ambulance|Sirens to the rescue|Fire truck
Sailboat|Wind power|Canoe
Cable car|Up the mountain|Ski lift
Auto rickshaw|Three wheels|Taxi
Bus|Many stops|Tram
Seatbelt|Click it|Helmet
Tourist|Takes many photos|Explorer
Hostel|Shared dorm|Hotel
Boarding pass|Show at the gate|Ticket
Jet lag|Wrong time zone|Exhaustion
Souvenir|Bring it home|Postcard
Speed bump|Slow down|Pothole
Parking lot|Find a spot|Garage
Lifejacket|Keeps you afloat|Float tube
Submarine|Deep under|Diving
Road map|Highways on paper|GPS`],
  tech: ['Tech & Internet', '📱', `
Smartphone|Always in your pocket|Tablet
Laptop|Portable work|Desktop
Selfie|Pointed at yourself|Photo
Emoji|Tiny faces|Sticker
Password|Keep it secret|PIN
WiFi|Invisible connection|Bluetooth
Charger|Low battery fix|Power bank
Headphones|Private sound|Earbuds
Email|Inbox|Text message
Video call|Face to face online|Phone call
Streaming|Watch online|Downloading
Screenshot|Capture the screen|Screen recording
Robot|Mechanical helper|Drone
Keyboard|Typing|Mouse
Smartwatch|On your wrist|Fitness band
Hashtag|Social tag|Mention
Podcast|Listen on the go|Radio
Virtual reality|Goggles on|Augmented reality
Search engine|Find anything|Encyclopedia
Group chat|Many messages|Forum
Printer|Paper out|Scanner
USB drive|Plug-in storage|Memory card
Notification|Ping|Alarm
Online shopping|Add to cart|Delivery
Game console|Play at home|Arcade machine
Cloud storage|Files online|Hard drive
Voice assistant|Talk to it|Chatbot
Spam|Unwanted|Pop-up ad
Meme|Shared joke|GIF
Battery|Stores power|Charger`],
  music: ['Music', '🎸', `
Guitar|Six strings|Violin
Piano|Black and white keys|Keyboard
Drums|Keep the beat|Tabla
Microphone|Amplifies voice|Speaker
Concert|Live show|Festival
Violin|Played with a bow|Cello
Trumpet|Brass blast|Saxophone
Flute|Blow across it|Recorder
Choir|Many voices|Band
Lullaby|Bedtime song|Nursery rhyme
Rap|Rhymes and beats|Poetry
Orchestra|Conductor leads|Band
Playlist|Song lineup|Album
Opera|Dramatic singing|Musical
DJ|Mixes tracks|Producer
Harmonica|Pocket instrument|Kazoo
Headliner|Last on stage|Opening act
Encore|One more|Bonus track
Lyrics|The words|Poem
Music video|Song with visuals|Movie trailer
Record player|Spinning vinyl|Cassette
Karaoke|Sing the screen|Talent show
Rock band|Loud guitars|Pop group
Tambourine|Shake and hit|Maracas
Veena|Classical strings|Sitar
Dhol|Wedding beats|Drums
Ballad|Slow song|Love song
Metronome|Ticks the tempo|Clock
Headphones|Music on your ears|Speakers
Talent show|Judges watch|Audition`],
  screen: ['Movies & TV', '🎬', `
Superhero|Saves the day|Villain
Cartoon|Animated|Anime
Sequel|Part two|Prequel
Plot twist|Didn't see that coming|Cliffhanger
Red carpet|Glamorous arrival|Award show
Horror movie|Jump scares|Thriller
Sitcom|Laugh track|Talk show
Documentary|Real story|News report
Popcorn bucket|Theater snack|Nachos
Trailer|Sneak peek|Teaser
Villain|The bad guy|Monster
Stunt double|Takes the fall|Body double
Reality show|Unscripted drama|Game show
Soundtrack|Movie music|Theme song
Director|Calls the shots|Producer
Wizard|Spells and robes|Witch
Pirate|Treasure seeker|Sailor
Zombie|Undead walker|Vampire
Detective show|Whodunit|Crime drama
Spy|Undercover agent|Detective
Dinosaur film|Prehistoric chase|Monster movie
Space adventure|Among the stars|Alien invasion
Talk show|Celebrity couch|Podcast
Binge watching|One more episode|Marathon
Subtitles|Read along|Dubbing
Box office|Ticket sales|Ratings
Remake|New version|Reboot
Cameo|Surprise appearance|Guest star
Opening credits|Names roll first|End credits
Award show|Thank you speech|Red carpet`],
  nature: ['Nature & Weather', '🌋', `
Volcano|Erupts|Geyser
Rainbow|After the rain|Sunset
Thunderstorm|Loud and wet|Hurricane
Desert|Dry and sandy|Savanna
Waterfall|Falling water|River
Forest|Many trees|Jungle
Snowflake|Unique and cold|Hail
Island|Surrounded by water|Peninsula
Mountain|Climb to the top|Hill
Cave|Dark inside|Tunnel
Moon|Night light|Star
Sunrise|Morning glow|Sunset
Earthquake|Ground shakes|Landslide
Tornado|Spinning wind|Hurricane
Ocean|Vast and salty|Sea
Glacier|Slow ice|Iceberg
Fog|Hard to see|Mist
Lightning|Bright flash|Thunder
Coral reef|Underwater color|Seaweed
Cactus|Prickly plant|Aloe vera
Sunflower|Faces the sun|Daisy
Rain|Falls from clouds|Drizzle
River|Flows to the sea|Stream
Meadow|Grassy field|Prairie
Pond|Small still water|Lake
Swamp|Muddy wetland|Marsh
Autumn leaves|Falling colors|Pine needles
Tide|Comes and goes|Wave
Monsoon|Rainy season|Typhoon
Breeze|Gentle wind|Gust`],
  school: ['School & Work', '📚', `
Homework|After class|Assignment
Exam|Test of knowledge|Quiz
Field trip|Class outing|Picnic
Recess|Play break|Lunch break
Backpack|Carries books|Briefcase
Report card|Grades|Certificate
Graduation|Caps in the air|Convocation
Detention|Stay after|Suspension
Science fair|Projects on display|Exhibition
Deadline|Due date|Appointment
Coffee break|Quick pause|Lunch break
Meeting|Agenda|Conference call
Promotion|Moving up|Raise
Office gossip|Whispers|Rumor
Calculator|Crunch numbers|Abacus
Whiteboard|Write and wipe|Chalkboard
Uniform|Everyone matches|Dress code
Principal|Head of school|Dean
Group project|Teamwork|Presentation
Pop quiz|Surprise test|Exam
Interview|First impression|Audition
Resume|Your experience|Cover letter
Payday|Money arrives|Bonus
Spelling bee|Letter by letter|Quiz contest
Notebook|Pages to fill|Diary
Pencil case|Holds supplies|Lunchbox
Commute|Getting to work|Road trip
Overtime|Extra hours|Night shift
Intern|Learning on the job|Trainee
Lunchbox|Packed meal|Tiffin`],
  celebrations: ['Holidays & Celebrations', '🎉', `
Birthday cake|Make a wish|Cupcake
Fireworks|Lights up the sky|Sparklers
Wedding|Vows|Engagement
Halloween|Costumes and candy|Carnival
Christmas tree|Decorated evergreen|Wreath
Diwali|Festival of lights|Christmas
Holi|Colors fly|Water fight
New Year|Countdown|Birthday
Gift wrap|Hide the present|Gift bag
Balloon|Floats away|Bubble
Surprise party|Hide and shout|Housewarming
Valentine's Day|Love is in the air|Anniversary
Sankranti|Kites and harvest|Pongal
Easter egg|Hidden and found|Treasure
Costume party|Dress up|Masquerade
Pinata|Hit it for candy|Gift box
Toast|Raise your glass|Speech
Party hat|Pointy on your head|Crown
Baby shower|Expecting|Gender reveal
Thanksgiving|Grateful feast|Potluck
Carnival|Parade and rides|Fair
Rakhi|Sibling thread|Friendship band
Graduation party|Celebrate the degree|Farewell party
Mehndi|Henna art|Tattoo
Bonfire|Big outdoor flame|Campfire
Confetti|Tiny paper shower|Glitter
Ugadi|Telugu New Year|Sankranti
Garba|Circle dance|Bhangra
Housewarming|New home|Open house
Family reunion|Everyone together|Wedding`],
  fashion: ['Fashion & Style', '👗', `
Sneakers|Comfy shoes|Sandals
Sunglasses|Block the sun|Goggles
Jeans|Denim|Trousers
Necklace|Around your neck|Chain
Hoodie|Has a hood|Sweater
Wristwatch|Tells time|Bracelet
Tie|Formal neckwear|Bow tie
High heels|Tall shoes|Boots
Saree|Six yards of grace|Lehenga
Raincoat|Stay dry|Poncho
Scarf|Wraps around|Shawl
Handbag|Carries essentials|Backpack
Pajamas|Bedtime clothes|Tracksuit
Lipstick|Color your lips|Lip gloss
Perfume|Smell nice|Deodorant
Earrings|On your ears|Studs
Cap|Shades your eyes|Hat
Swimsuit|Pool day|Shorts
Gloves|Warm hands|Mittens
Fashion show|Runway|Photoshoot
Kurta|Long tunic|Shirt
Belt|Holds things up|Suspenders
Wedding dress|Big day outfit|Gown
Tuxedo|Black tie|Suit
Flip-flops|Beach footwear|Slippers
Ring|On a finger|Bracelet
Makeup|Brushes and powder|Face paint
Tattoo|Ink on skin|Henna
Wardrobe|Clothes storage|Dresser
Fitting room|Try it on|Changing room`],
  body: ['Health & Body', '🫀', `
Heart|Beats all day|Lungs
Brain|Thinking center|Mind
Sneeze|Achoo|Cough
Yawn|Sleepy sign|Stretch
Hiccups|Can't stop|Burp
Dentist chair|Open wide|Barber chair
Bandage|Covers a cut|Plaster
Vitamins|Daily pills|Supplements
Fever|Running hot|Cold
Push-up|Arms and floor|Plank
Massage|Relaxing hands|Spa
Nap|Short sleep|Rest
Eyebrows|Above the eyes|Eyelashes
Fingerprint|Unique pattern|Signature
Goosebumps|Chills|Shiver
Heartbeat|Thump thump|Pulse
Stethoscope|Listen in|Thermometer
Ambulance|Emergency ride|Hospital
Sunburn|Too much sun|Rash
Freckles|Tiny spots|Moles
Dimples|Cute dents|Wrinkles
Muscle|Gets stronger|Bone
Allergy|Body says no|Infection
Knee|Bends the leg|Elbow
Skeleton|All the bones|Skull
Belly button|Center of the belly|Navel
Toothache|Ouch in the mouth|Headache
Wheelchair|Rolling seat|Crutches
Blood test|Small needle|Vaccine
Snore|Noisy sleep|Sleep talking`],
  fantasy: ['Fantasy & Myth', '🐉', `
Dragon|Breathes fire|Dinosaur
Unicorn|Single horn|Pegasus
Mermaid|Half fish|Siren
Wizard|Casts spells|Witch
Vampire|Afraid of sunlight|Werewolf
Ghost|See-through|Spirit
Fairy|Tiny with wings|Angel
Giant|Very big person|Ogre
Genie|Grants wishes|Fairy godmother
Treasure chest|Hidden riches|Safe
Magic wand|Waves for spells|Staff
Crystal ball|See the future|Tarot cards
Knight|Armor and honor|Samurai
Castle tower|Princess waits|Lighthouse
Troll|Under the bridge|Goblin
Phoenix|Rises from ashes|Firebird
Time machine|Visit the past|Portal
Invisibility cloak|Can't see you|Disguise
Haunted house|Spooky home|Graveyard
Alien|From another planet|Robot
Superpower|Special ability|Magic
Flying carpet|Rides the sky|Broomstick
Pirate ship|Jolly Roger|Viking ship
Zombie|Craves brains|Mummy
Mummy|Wrapped up|Skeleton
Elf|Pointy ears|Gnome
Potion|Magic drink|Medicine
Curse|Bad magic|Spell
Prophecy|Foretold destiny|Horoscope
Spell book|Pages of magic|Diary`],
  childhood: ['Childhood & Games', '🪁', `
Hide and seek|Count then find|Tag
Kite|Flies on a string|Balloon
Swing|Back and forth|Seesaw
Slide|Whee down|Swing
Teddy bear|Cuddly toy|Doll
Sandcastle|Built at the beach|Snowman
Jump rope|Skip skip|Hopscotch
Bubble wrap|Pop pop|Balloon
Piggy bank|Save coins|Wallet
Treehouse|Up in the branches|Tent
Lego|Click together|Blocks
Yo-yo|Up and down|Spinning top
Marbles|Tiny glass balls|Beads
Crayons|Color inside the lines|Markers
Snowball fight|Winter battle|Pillow fight
Musical chairs|Grab a seat when it stops|Freeze dance
Bedtime story|Read before sleep|Lullaby
Training wheels|Learning to ride|Tricycle
Lemonade stand|First business|Bake sale
Tooth fairy|Coin under the pillow|Santa Claus
Blanket fort|Indoor hideout|Tent
Trampoline|Bounce high|Bouncy castle
Sleepover|Night at a friend's|Camping
Rock paper scissors|Hand battle|Coin toss
Water balloon|Splash attack|Water gun
Playdough|Squish and shape|Clay
Comic book|Panels and heroes|Picture book
Ice cream truck|Music on wheels|Food truck
Cartwheel|Hands then feet|Somersault
Gilli danda|Street stick game|Cricket`],
  desi: ['Desi Life', '🪔', `
Biryani|Layered rice|Pulao
Chai|Tea break|Coffee
Dosa|Crispy and thin|Uttapam
Idli|Steamed and soft|Dhokla
Samosa|Triangle snack|Kachori
Pani puri|Burst in the mouth|Bhel puri
Cricket match|National obsession|Football match
Auto rickshaw|Meter or fixed|Taxi
Bollywood|Song and dance|Tollywood
Mango pickle|Spicy jar|Lemon pickle
Wedding baraat|Groom's procession|Parade
Rangoli|Colors at the door|Mehndi
Temple bells|Ring when you enter|Wind chimes
Street food|Roadside bites|Food court
Pressure cooker|Whistles|Rice cooker
Jalebi|Sticky spirals|Gulab jamun
Lassi|Yogurt drink|Buttermilk
Train journey|Long rail ride|Bus journey
Monsoon|Rainy season|Winter
Tiffin box|Stacked lunch|Lunchbox
Matrimonial ad|Seeking a match|Dating app
Power cut|Lights out|Blackout
Mehendi night|Henna party|Sangeet
Filter coffee|Steel tumbler|Chai
Paan|After-dinner leaf|Mouth freshener
Ayurveda|Traditional healing|Yoga
Bargaining|Haggle the price|Discount
Joint family|Many generations|Neighbors
Cricket bat|Willow|Hockey stick
Dabbawala|Lunch delivery|Courier`],
  feelings: ['Feelings & Ideas', '💭', `
Nostalgia|The good old days|Memory
Jealousy|Green-eyed|Envy
Sarcasm|Not meant literally|Irony
Procrastination|Do it later|Laziness
Deja vu|Happened before|Coincidence
Karma|What goes around|Luck
Awkward silence|Nobody speaks|Pause
Peer pressure|Everyone's doing it|Influence
Comfort zone|Safe space|Routine
First impression|Early judgment|Reputation
Overthinking|Mind won't stop|Worry
Fear of missing out|Everyone else is there|Jealousy
Hindsight|Easy looking back|Regret
Intuition|Gut feeling|Instinct
Common sense|Obvious wisdom|Logic
Boredom|Nothing to do|Laziness
Curiosity|Wants to know|Interest
Courage|Facing fear|Confidence
Guilty pleasure|Secretly love it|Habit
Homesick|Missing home|Lonely
Embarrassment|Red face|Shame
Gratitude|Thankful|Respect
Patience|Waiting calmly|Tolerance
Stage fright|Nerves before showtime|Anxiety
Optimism|Glass half full|Hope
Teamwork|Together wins|Friendship
Ambition|Big goals|Dream
Daydream|Mind wanders|Imagination
Superstition|Knock on wood|Tradition
Small talk|Weather chat|Gossip`],
  science: ['Science & Space', '🚀', `
Planet|Orbits a star|Moon
Black hole|Nothing escapes|Wormhole
Microscope|Tiny world|Magnifying glass
Telescope|Far away view|Binoculars
Magnet|Pulls metal|Glue
Gravity|What goes up|Friction
Dinosaur|Long extinct|Dragon
Fossil|Old remains|Skeleton
Astronaut|Space traveler|Pilot
Satellite|Orbiting machine|Space station
Volcano model|Classic science fair|Lava lamp
Electricity|Powers everything|Battery
DNA|Genetic code|Fingerprint
Laboratory|Experiments happen|Kitchen
Comet|Icy tail|Meteor
Eclipse|Sun or moon blocked|Sunset
Thermometer|Measures heat|Barometer
Robotics|Build machines|Coding
Recycling|Reuse materials|Composting
Solar panel|Catches sunlight|Windmill
Atom|Smallest building block|Molecule
Rocket launch|Countdown to liftoff|Fireworks
Constellation|Star pattern|Galaxy
Bacteria|Tiny life|Virus
Rainbow prism|Splits light|Mirror
Vaccine|Prevention shot|Medicine
Laser|Focused light|Flashlight
Earth|Our home|Mars
Periodic table|Elements chart|Multiplication table
Tsunami|Giant wave|Flood`],
};

export const IMPOSTER_CATEGORIES = Object.entries(RAW).map(([id, [label, emoji, body]]) => ({
  id, label, emoji,
  words: body.trim().split('\n').map(line => {
    const [word, hint, decoy] = line.split('|').map(part => part.trim());
    return { word, hint, decoy };
  }),
}));

export const WORD_CATEGORY_IDS = IMPOSTER_CATEGORIES.map(category => category.id);

// Word list used before categories existed; kept so old saved rounds resume.
export const LEGACY_EVERYDAY = [
  ['COFFEE', 'Hot drink'], ['PIZZA', 'Italian food'], ['GUITAR', 'String instrument'],
  ['SOCCER', 'Ball sport'], ['LAPTOP', 'Portable computer'], ['SUNGLASSES', 'Eye wear'],
  ['BACKPACK', 'Carry bag'], ['SMARTPHONE', 'Mobile device'], ['BICYCLE', 'Two wheels'],
  ['CAMERA', 'Photo device'], ['HEADPHONES', 'Audio gear'], ['WALLET', 'Money holder'],
  ['UMBRELLA', 'Rain shield'], ['KEYBOARD', 'Typing tool'], ['MICROWAVE', 'Kitchen appliance'],
  ['TELESCOPE', 'Star viewer'], ['MICROSCOPE', 'Tiny viewer'], ['HAMMOCK', 'Outdoor bed'],
  ['LANTERN', 'Light source'], ['COMPASS', 'Direction finder'],
].map(([word, hint]) => ({ word, hint }));
