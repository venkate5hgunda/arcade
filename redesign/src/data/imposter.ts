// Derived from the original js/imposter-words.js catalog.
const catalog = {
  categories: [
    {
      id: 'food',
      label: 'Food & Drinks',
      emoji: '🍕',
      words: [
        {
          word: 'Pizza',
          hint: 'Sliced and shared',
          decoy: 'Flatbread',
        },
        {
          word: 'Burger',
          hint: 'Comes in a bun',
          decoy: 'Hot dog',
        },
        {
          word: 'Sushi',
          hint: 'Rolled and raw',
          decoy: 'Ramen',
        },
        {
          word: 'Pancakes',
          hint: 'Weekend breakfast',
          decoy: 'Waffles',
        },
        {
          word: 'Ice cream',
          hint: 'Melts fast',
          decoy: 'Frozen yogurt',
        },
        {
          word: 'Coffee',
          hint: 'Morning ritual',
          decoy: 'Tea',
        },
        {
          word: 'Spaghetti',
          hint: 'Twirl with a fork',
          decoy: 'Noodles',
        },
        {
          word: 'Tacos',
          hint: 'Folded shell',
          decoy: 'Burrito',
        },
        {
          word: 'Popcorn',
          hint: 'Movie night snack',
          decoy: 'Nachos',
        },
        {
          word: 'Chocolate',
          hint: 'Sweet treat',
          decoy: 'Caramel',
        },
        {
          word: 'Lemon',
          hint: 'Sour citrus',
          decoy: 'Lime',
        },
        {
          word: 'Cupcake',
          hint: 'Party bake',
          decoy: 'Muffin',
        },
        {
          word: 'Sandwich',
          hint: 'Lunchbox staple',
          decoy: 'Wrap',
        },
        {
          word: 'Watermelon',
          hint: 'Summer fruit',
          decoy: 'Cantaloupe',
        },
        {
          word: 'Smoothie',
          hint: 'Blended drink',
          decoy: 'Milkshake',
        },
        {
          word: 'French fries',
          hint: 'Fast-food side',
          decoy: 'Potato wedges',
        },
        {
          word: 'Pineapple',
          hint: 'Spiky outside',
          decoy: 'Mango',
        },
        {
          word: 'Croissant',
          hint: 'Flaky bakery item',
          decoy: 'Bagel',
        },
        {
          word: 'Cheesecake',
          hint: 'Rich dessert',
          decoy: 'Tiramisu',
        },
        {
          word: 'Lemonade',
          hint: 'Stand on the street',
          decoy: 'Iced tea',
        },
        {
          word: 'Honey',
          hint: 'Golden and sticky',
          decoy: 'Maple syrup',
        },
        {
          word: 'Steak',
          hint: 'Cooked rare or well done',
          decoy: 'Pork chop',
        },
        {
          word: 'Avocado',
          hint: 'Green and creamy',
          decoy: 'Pear',
        },
        {
          word: 'Dumplings',
          hint: 'Pinched and steamed',
          decoy: 'Spring rolls',
        },
        {
          word: 'Cereal',
          hint: 'Breakfast bowl',
          decoy: 'Oatmeal',
        },
        {
          word: 'Jam',
          hint: 'Spread on toast',
          decoy: 'Peanut butter',
        },
        {
          word: 'Soup',
          hint: 'Served in a bowl',
          decoy: 'Stew',
        },
        {
          word: 'Donut',
          hint: 'Has a hole',
          decoy: 'Bagel',
        },
        {
          word: 'Salad',
          hint: 'Toss it',
          decoy: 'Coleslaw',
        },
        {
          word: 'Hot chocolate',
          hint: 'Winter mug',
          decoy: 'Coffee',
        },
      ],
    },
    {
      id: 'animals',
      label: 'Animals',
      emoji: '🐾',
      words: [
        {
          word: 'Dog',
          hint: 'Loyal pet',
          decoy: 'Wolf',
        },
        {
          word: 'Cat',
          hint: 'Independent pet',
          decoy: 'Rabbit',
        },
        {
          word: 'Elephant',
          hint: 'Never forgets',
          decoy: 'Rhino',
        },
        {
          word: 'Lion',
          hint: 'Big cat',
          decoy: 'Tiger',
        },
        {
          word: 'Penguin',
          hint: 'Cannot fly',
          decoy: 'Puffin',
        },
        {
          word: 'Dolphin',
          hint: 'Smart swimmer',
          decoy: 'Shark',
        },
        {
          word: 'Giraffe',
          hint: 'Very tall',
          decoy: 'Camel',
        },
        {
          word: 'Kangaroo',
          hint: 'Bounces around',
          decoy: 'Wallaby',
        },
        {
          word: 'Owl',
          hint: 'Night bird',
          decoy: 'Bat',
        },
        {
          word: 'Butterfly',
          hint: 'Colorful wings',
          decoy: 'Moth',
        },
        {
          word: 'Crocodile',
          hint: 'River ambush',
          decoy: 'Alligator',
        },
        {
          word: 'Turtle',
          hint: 'Carries its home',
          decoy: 'Tortoise',
        },
        {
          word: 'Eagle',
          hint: 'Sharp-eyed flyer',
          decoy: 'Hawk',
        },
        {
          word: 'Octopus',
          hint: 'Many arms',
          decoy: 'Squid',
        },
        {
          word: 'Bee',
          hint: 'Tiny worker',
          decoy: 'Wasp',
        },
        {
          word: 'Horse',
          hint: 'Can be ridden',
          decoy: 'Donkey',
        },
        {
          word: 'Panda',
          hint: 'Loves bamboo',
          decoy: 'Koala',
        },
        {
          word: 'Frog',
          hint: 'Jumps and croaks',
          decoy: 'Toad',
        },
        {
          word: 'Parrot',
          hint: 'Can mimic',
          decoy: 'Peacock',
        },
        {
          word: 'Snake',
          hint: 'No legs',
          decoy: 'Lizard',
        },
        {
          word: 'Zebra',
          hint: 'Striped',
          decoy: 'Horse',
        },
        {
          word: 'Gorilla',
          hint: 'Strong primate',
          decoy: 'Chimpanzee',
        },
        {
          word: 'Hedgehog',
          hint: 'Spiky little one',
          decoy: 'Porcupine',
        },
        {
          word: 'Squirrel',
          hint: 'Stores food',
          decoy: 'Chipmunk',
        },
        {
          word: 'Whale',
          hint: 'Ocean giant',
          decoy: 'Dolphin',
        },
        {
          word: 'Fox',
          hint: 'Clever and red',
          decoy: 'Wolf',
        },
        {
          word: 'Peacock',
          hint: 'Shows off',
          decoy: 'Parrot',
        },
        {
          word: 'Camel',
          hint: 'Desert traveler',
          decoy: 'Llama',
        },
        {
          word: 'Spider',
          hint: 'Spins a home',
          decoy: 'Scorpion',
        },
        {
          word: 'Seal',
          hint: 'Barks on rocks',
          decoy: 'Sea lion',
        },
      ],
    },
    {
      id: 'home',
      label: 'Around the House',
      emoji: '🛋️',
      words: [
        {
          word: 'Toothbrush',
          hint: 'Twice a day',
          decoy: 'Hairbrush',
        },
        {
          word: 'Umbrella',
          hint: 'Rainy days',
          decoy: 'Raincoat',
        },
        {
          word: 'Pillow',
          hint: 'Rest your head',
          decoy: 'Cushion',
        },
        {
          word: 'Mirror',
          hint: 'Look at yourself',
          decoy: 'Window',
        },
        {
          word: 'Couch',
          hint: 'Living room seat',
          decoy: 'Armchair',
        },
        {
          word: 'Refrigerator',
          hint: 'Keeps things cold',
          decoy: 'Freezer',
        },
        {
          word: 'Microwave',
          hint: 'Quick heating',
          decoy: 'Oven',
        },
        {
          word: 'Blanket',
          hint: 'Keeps you warm',
          decoy: 'Quilt',
        },
        {
          word: 'Candle',
          hint: 'Small flame',
          decoy: 'Lamp',
        },
        {
          word: 'Scissors',
          hint: 'Cuts things',
          decoy: 'Knife',
        },
        {
          word: 'Alarm clock',
          hint: 'Wakes you up',
          decoy: 'Phone',
        },
        {
          word: 'Vacuum cleaner',
          hint: 'Sucks up mess',
          decoy: 'Broom',
        },
        {
          word: 'Washing machine',
          hint: 'Laundry day',
          decoy: 'Dishwasher',
        },
        {
          word: 'Toaster',
          hint: 'Pops up',
          decoy: 'Sandwich maker',
        },
        {
          word: 'Doorbell',
          hint: 'Someone is here',
          decoy: 'Knocker',
        },
        {
          word: 'Bathtub',
          hint: 'Soak in it',
          decoy: 'Shower',
        },
        {
          word: 'Remote control',
          hint: 'Couch power',
          decoy: 'Game controller',
        },
        {
          word: 'Curtains',
          hint: 'Cover the window',
          decoy: 'Blinds',
        },
        {
          word: 'Kettle',
          hint: 'Whistles when ready',
          decoy: 'Coffee maker',
        },
        {
          word: 'Bookshelf',
          hint: 'Stores stories',
          decoy: 'Cupboard',
        },
        {
          word: 'Ceiling fan',
          hint: 'Spins overhead',
          decoy: 'Air conditioner',
        },
        {
          word: 'Hanger',
          hint: 'In the closet',
          decoy: 'Hook',
        },
        {
          word: 'Rug',
          hint: 'On the floor',
          decoy: 'Doormat',
        },
        {
          word: 'Mug',
          hint: 'Hot drinks',
          decoy: 'Cup',
        },
        {
          word: 'Key',
          hint: 'Opens things',
          decoy: 'Lock',
        },
        {
          word: 'Bed',
          hint: 'Sleep on it',
          decoy: 'Sofa',
        },
        {
          word: 'Trash can',
          hint: 'Throw it away',
          decoy: 'Recycling bin',
        },
        {
          word: 'Iron',
          hint: 'Removes wrinkles',
          decoy: 'Steamer',
        },
        {
          word: 'Plant pot',
          hint: 'Something grows',
          decoy: 'Vase',
        },
        {
          word: 'Light switch',
          hint: 'On or off',
          decoy: 'Dimmer',
        },
      ],
    },
    {
      id: 'places',
      label: 'Places',
      emoji: '📍',
      words: [
        {
          word: 'Beach',
          hint: 'Sand and waves',
          decoy: 'Lake',
        },
        {
          word: 'Airport',
          hint: 'Departures',
          decoy: 'Train station',
        },
        {
          word: 'Library',
          hint: 'Shh, quiet',
          decoy: 'Bookstore',
        },
        {
          word: 'Hospital',
          hint: 'Get better here',
          decoy: 'Clinic',
        },
        {
          word: 'Museum',
          hint: "Look, don't touch",
          decoy: 'Art gallery',
        },
        {
          word: 'Zoo',
          hint: 'Animals on display',
          decoy: 'Aquarium',
        },
        {
          word: 'Restaurant',
          hint: 'Order and eat',
          decoy: 'Cafe',
        },
        {
          word: 'Supermarket',
          hint: 'Weekly shopping',
          decoy: 'Market',
        },
        {
          word: 'Cinema',
          hint: 'Big screen',
          decoy: 'Theater',
        },
        {
          word: 'Stadium',
          hint: 'Crowds cheer',
          decoy: 'Arena',
        },
        {
          word: 'Hotel',
          hint: 'Stay overnight',
          decoy: 'Hostel',
        },
        {
          word: 'School',
          hint: 'Classes and bells',
          decoy: 'College',
        },
        {
          word: 'Gym',
          hint: 'Work out',
          decoy: 'Yoga studio',
        },
        {
          word: 'Park',
          hint: 'Green open space',
          decoy: 'Garden',
        },
        {
          word: 'Castle',
          hint: 'Royal fortress',
          decoy: 'Palace',
        },
        {
          word: 'Bakery',
          hint: 'Fresh bread smell',
          decoy: 'Pastry shop',
        },
        {
          word: 'Amusement park',
          hint: 'Thrill rides',
          decoy: 'Water park',
        },
        {
          word: 'Farm',
          hint: 'Crops and animals',
          decoy: 'Ranch',
        },
        {
          word: 'Bank',
          hint: 'Money business',
          decoy: 'ATM',
        },
        {
          word: 'Post office',
          hint: 'Letters and parcels',
          decoy: 'Courier office',
        },
        {
          word: 'Temple',
          hint: 'Place of worship',
          decoy: 'Church',
        },
        {
          word: 'Campsite',
          hint: 'Tents outdoors',
          decoy: 'Cabin',
        },
        {
          word: 'Bus stop',
          hint: 'Wait for a ride',
          decoy: 'Taxi stand',
        },
        {
          word: 'Hair salon',
          hint: 'New look',
          decoy: 'Barbershop',
        },
        {
          word: 'Lighthouse',
          hint: 'Guides ships',
          decoy: 'Watchtower',
        },
        {
          word: 'Prison',
          hint: 'Locked in',
          decoy: 'Police station',
        },
        {
          word: 'Mall',
          hint: 'Many shops',
          decoy: 'Market',
        },
        {
          word: 'Pharmacy',
          hint: 'Medicines',
          decoy: 'Clinic',
        },
        {
          word: 'Laundromat',
          hint: 'Wash clothes',
          decoy: 'Dry cleaner',
        },
        {
          word: 'Rooftop',
          hint: 'Top of a building',
          decoy: 'Balcony',
        },
      ],
    },
    {
      id: 'jobs',
      label: 'Jobs',
      emoji: '🧑‍🚒',
      words: [
        {
          word: 'Doctor',
          hint: 'Saves lives',
          decoy: 'Nurse',
        },
        {
          word: 'Teacher',
          hint: 'Classroom leader',
          decoy: 'Professor',
        },
        {
          word: 'Firefighter',
          hint: 'Brave rescuer',
          decoy: 'Paramedic',
        },
        {
          word: 'Pilot',
          hint: 'Up in the air',
          decoy: 'Flight attendant',
        },
        {
          word: 'Chef',
          hint: 'Kitchen boss',
          decoy: 'Baker',
        },
        {
          word: 'Police officer',
          hint: 'Keeps order',
          decoy: 'Security guard',
        },
        {
          word: 'Astronaut',
          hint: 'Out of this world',
          decoy: 'Pilot',
        },
        {
          word: 'Dentist',
          hint: 'Check your teeth',
          decoy: 'Doctor',
        },
        {
          word: 'Plumber',
          hint: 'Fixes leaks',
          decoy: 'Electrician',
        },
        {
          word: 'Farmer',
          hint: 'Grows food',
          decoy: 'Gardener',
        },
        {
          word: 'Lawyer',
          hint: 'Argues cases',
          decoy: 'Judge',
        },
        {
          word: 'Photographer',
          hint: 'Captures moments',
          decoy: 'Painter',
        },
        {
          word: 'Magician',
          hint: 'Tricks and illusions',
          decoy: 'Clown',
        },
        {
          word: 'Lifeguard',
          hint: 'Watches the water',
          decoy: 'Coast guard',
        },
        {
          word: 'Detective',
          hint: 'Solves mysteries',
          decoy: 'Journalist',
        },
        {
          word: 'Veterinarian',
          hint: 'Cares for animals',
          decoy: 'Zookeeper',
        },
        {
          word: 'Barber',
          hint: 'Haircuts',
          decoy: 'Hairstylist',
        },
        {
          word: 'Mechanic',
          hint: 'Fixes cars',
          decoy: 'Engineer',
        },
        {
          word: 'Architect',
          hint: 'Designs buildings',
          decoy: 'Builder',
        },
        {
          word: 'Waiter',
          hint: 'Takes your order',
          decoy: 'Bartender',
        },
        {
          word: 'Librarian',
          hint: 'Organizes books',
          decoy: 'Archivist',
        },
        {
          word: 'Postman',
          hint: 'Delivers mail',
          decoy: 'Courier',
        },
        {
          word: 'Scientist',
          hint: 'Runs experiments',
          decoy: 'Inventor',
        },
        {
          word: 'Cashier',
          hint: 'At the counter',
          decoy: 'Bank teller',
        },
        {
          word: 'Tailor',
          hint: 'Stitches clothes',
          decoy: 'Fashion designer',
        },
        {
          word: 'Carpenter',
          hint: 'Works with wood',
          decoy: 'Builder',
        },
        {
          word: 'Taxi driver',
          hint: 'Drives strangers',
          decoy: 'Bus driver',
        },
        {
          word: 'DJ',
          hint: 'Plays the tracks',
          decoy: 'Singer',
        },
        {
          word: 'Soldier',
          hint: 'Serves the country',
          decoy: 'Guard',
        },
        {
          word: 'Actor',
          hint: 'Plays a role',
          decoy: 'Comedian',
        },
      ],
    },
    {
      id: 'sports',
      label: 'Sports',
      emoji: '⚽',
      words: [
        {
          word: 'Soccer',
          hint: "World's game",
          decoy: 'Rugby',
        },
        {
          word: 'Basketball',
          hint: 'Hoops',
          decoy: 'Volleyball',
        },
        {
          word: 'Tennis',
          hint: 'Racket and net',
          decoy: 'Badminton',
        },
        {
          word: 'Cricket',
          hint: 'Bat and wickets',
          decoy: 'Baseball',
        },
        {
          word: 'Swimming',
          hint: 'In the pool',
          decoy: 'Diving',
        },
        {
          word: 'Boxing',
          hint: 'Gloves on',
          decoy: 'Wrestling',
        },
        {
          word: 'Golf',
          hint: 'Quiet on the green',
          decoy: 'Mini golf',
        },
        {
          word: 'Skiing',
          hint: 'Snowy slopes',
          decoy: 'Snowboarding',
        },
        {
          word: 'Surfing',
          hint: 'Ride the wave',
          decoy: 'Skateboarding',
        },
        {
          word: 'Cycling',
          hint: 'Pedal power',
          decoy: 'Running',
        },
        {
          word: 'Marathon',
          hint: 'Long distance',
          decoy: 'Sprint',
        },
        {
          word: 'Table tennis',
          hint: 'Small paddles',
          decoy: 'Tennis',
        },
        {
          word: 'Bowling',
          hint: 'Knock them down',
          decoy: 'Billiards',
        },
        {
          word: 'Archery',
          hint: 'Aim for the center',
          decoy: 'Darts',
        },
        {
          word: 'Ice hockey',
          hint: 'Puck on ice',
          decoy: 'Field hockey',
        },
        {
          word: 'Volleyball',
          hint: 'Spike it',
          decoy: 'Beach ball',
        },
        {
          word: 'Gymnastics',
          hint: 'Flips and balance',
          decoy: 'Ballet',
        },
        {
          word: 'Karate',
          hint: 'Martial art',
          decoy: 'Judo',
        },
        {
          word: 'Rowing',
          hint: 'Oars in water',
          decoy: 'Kayaking',
        },
        {
          word: 'Horse racing',
          hint: 'Jockeys',
          decoy: 'Polo',
        },
        {
          word: 'Chess',
          hint: 'Mind sport',
          decoy: 'Checkers',
        },
        {
          word: 'Rock climbing',
          hint: 'Up the wall',
          decoy: 'Hiking',
        },
        {
          word: 'Fencing',
          hint: 'Swords and masks',
          decoy: 'Archery',
        },
        {
          word: 'Weightlifting',
          hint: 'Heavy lifting',
          decoy: 'Bodybuilding',
        },
        {
          word: 'Kabaddi',
          hint: 'Hold your breath',
          decoy: 'Wrestling',
        },
        {
          word: 'Formula One',
          hint: 'Fast cars',
          decoy: 'Go-karting',
        },
        {
          word: 'Olympics',
          hint: 'Global games',
          decoy: 'World Cup',
        },
        {
          word: 'Referee',
          hint: 'Blows the whistle',
          decoy: 'Coach',
        },
        {
          word: 'Gold medal',
          hint: 'First place',
          decoy: 'Trophy',
        },
        {
          word: 'Penalty kick',
          hint: 'One on one',
          decoy: 'Free kick',
        },
      ],
    },
    {
      id: 'hobbies',
      label: 'Hobbies & Activities',
      emoji: '🎯',
      words: [
        {
          word: 'Camping',
          hint: 'Sleep outdoors',
          decoy: 'Picnic',
        },
        {
          word: 'Yoga',
          hint: 'Stretch and breathe',
          decoy: 'Pilates',
        },
        {
          word: 'Fishing',
          hint: 'Patience by the water',
          decoy: 'Boating',
        },
        {
          word: 'Karaoke',
          hint: 'Sing along',
          decoy: 'Concert',
        },
        {
          word: 'Gardening',
          hint: 'Green thumb',
          decoy: 'Farming',
        },
        {
          word: 'Photography',
          hint: 'Snap snap',
          decoy: 'Painting',
        },
        {
          word: 'Knitting',
          hint: 'Needles and yarn',
          decoy: 'Sewing',
        },
        {
          word: 'Hiking',
          hint: 'Trails',
          decoy: 'Walking',
        },
        {
          word: 'Dancing',
          hint: 'Move to music',
          decoy: 'Aerobics',
        },
        {
          word: 'Cooking',
          hint: 'In the kitchen',
          decoy: 'Baking',
        },
        {
          word: 'Reading',
          hint: 'Turn the page',
          decoy: 'Writing',
        },
        {
          word: 'Painting',
          hint: 'Brush strokes',
          decoy: 'Drawing',
        },
        {
          word: 'Video games',
          hint: 'Controller in hand',
          decoy: 'Board games',
        },
        {
          word: 'Puzzles',
          hint: 'Pieces fit',
          decoy: 'Crosswords',
        },
        {
          word: 'Bird watching',
          hint: 'Binoculars',
          decoy: 'Stargazing',
        },
        {
          word: 'Scrapbooking',
          hint: 'Memories on paper',
          decoy: 'Journaling',
        },
        {
          word: 'Pottery',
          hint: 'Clay on a wheel',
          decoy: 'Sculpting',
        },
        {
          word: 'Skateboarding',
          hint: 'Board tricks',
          decoy: 'Rollerblading',
        },
        {
          word: 'Magic tricks',
          hint: 'Sleight of hand',
          decoy: 'Juggling',
        },
        {
          word: 'Calligraphy',
          hint: 'Fancy writing',
          decoy: 'Sketching',
        },
        {
          word: 'Origami',
          hint: 'Folded paper',
          decoy: 'Paper crafts',
        },
        {
          word: 'Podcasting',
          hint: 'Talk into a mic',
          decoy: 'Blogging',
        },
        {
          word: 'Woodworking',
          hint: 'Saws and sanding',
          decoy: 'Carving',
        },
        {
          word: 'Meditation',
          hint: 'Calm the mind',
          decoy: 'Yoga',
        },
        {
          word: 'Board games',
          hint: 'Around the table',
          decoy: 'Card games',
        },
        {
          word: 'Kite flying',
          hint: 'Up on a string',
          decoy: 'Paragliding',
        },
        {
          word: 'Volunteering',
          hint: 'Help for free',
          decoy: 'Fundraising',
        },
        {
          word: 'Collecting stamps',
          hint: 'Albums of tiny art',
          decoy: 'Collecting coins',
        },
        {
          word: 'Escape room',
          hint: 'Find the way out',
          decoy: 'Treasure hunt',
        },
        {
          word: 'Road trip',
          hint: 'Long drive',
          decoy: 'Train journey',
        },
      ],
    },
    {
      id: 'travel',
      label: 'Travel & Transport',
      emoji: '✈️',
      words: [
        {
          word: 'Airplane',
          hint: 'Wings in the sky',
          decoy: 'Helicopter',
        },
        {
          word: 'Train',
          hint: 'On rails',
          decoy: 'Tram',
        },
        {
          word: 'Bicycle',
          hint: 'Two wheels',
          decoy: 'Scooter',
        },
        {
          word: 'Taxi',
          hint: 'Hail a ride',
          decoy: 'Uber',
        },
        {
          word: 'Cruise ship',
          hint: 'Floating hotel',
          decoy: 'Ferry',
        },
        {
          word: 'Hot air balloon',
          hint: 'Floating basket',
          decoy: 'Blimp',
        },
        {
          word: 'Subway',
          hint: 'Underground ride',
          decoy: 'Train',
        },
        {
          word: 'Motorcycle',
          hint: 'Fast two-wheeler',
          decoy: 'Scooter',
        },
        {
          word: 'Passport',
          hint: 'Needed abroad',
          decoy: 'Visa',
        },
        {
          word: 'Suitcase',
          hint: 'Packed for travel',
          decoy: 'Backpack',
        },
        {
          word: 'Map',
          hint: 'Find your way',
          decoy: 'Compass',
        },
        {
          word: 'Rocket',
          hint: 'Liftoff',
          decoy: 'Space shuttle',
        },
        {
          word: 'Traffic jam',
          hint: 'Going nowhere',
          decoy: 'Rush hour',
        },
        {
          word: 'Gas station',
          hint: 'Fill up',
          decoy: 'Charging station',
        },
        {
          word: 'Ambulance',
          hint: 'Sirens to the rescue',
          decoy: 'Fire truck',
        },
        {
          word: 'Sailboat',
          hint: 'Wind power',
          decoy: 'Canoe',
        },
        {
          word: 'Cable car',
          hint: 'Up the mountain',
          decoy: 'Ski lift',
        },
        {
          word: 'Auto rickshaw',
          hint: 'Three wheels',
          decoy: 'Taxi',
        },
        {
          word: 'Bus',
          hint: 'Many stops',
          decoy: 'Tram',
        },
        {
          word: 'Seatbelt',
          hint: 'Click it',
          decoy: 'Helmet',
        },
        {
          word: 'Tourist',
          hint: 'Takes many photos',
          decoy: 'Explorer',
        },
        {
          word: 'Hostel',
          hint: 'Shared dorm',
          decoy: 'Hotel',
        },
        {
          word: 'Boarding pass',
          hint: 'Show at the gate',
          decoy: 'Ticket',
        },
        {
          word: 'Jet lag',
          hint: 'Wrong time zone',
          decoy: 'Exhaustion',
        },
        {
          word: 'Souvenir',
          hint: 'Bring it home',
          decoy: 'Postcard',
        },
        {
          word: 'Speed bump',
          hint: 'Slow down',
          decoy: 'Pothole',
        },
        {
          word: 'Parking lot',
          hint: 'Find a spot',
          decoy: 'Garage',
        },
        {
          word: 'Lifejacket',
          hint: 'Keeps you afloat',
          decoy: 'Float tube',
        },
        {
          word: 'Submarine',
          hint: 'Deep under',
          decoy: 'Diving',
        },
        {
          word: 'Road map',
          hint: 'Highways on paper',
          decoy: 'GPS',
        },
      ],
    },
    {
      id: 'tech',
      label: 'Tech & Internet',
      emoji: '📱',
      words: [
        {
          word: 'Smartphone',
          hint: 'Always in your pocket',
          decoy: 'Tablet',
        },
        {
          word: 'Laptop',
          hint: 'Portable work',
          decoy: 'Desktop',
        },
        {
          word: 'Selfie',
          hint: 'Pointed at yourself',
          decoy: 'Photo',
        },
        {
          word: 'Emoji',
          hint: 'Tiny faces',
          decoy: 'Sticker',
        },
        {
          word: 'Password',
          hint: 'Keep it secret',
          decoy: 'PIN',
        },
        {
          word: 'WiFi',
          hint: 'Invisible connection',
          decoy: 'Bluetooth',
        },
        {
          word: 'Charger',
          hint: 'Low battery fix',
          decoy: 'Power bank',
        },
        {
          word: 'Headphones',
          hint: 'Private sound',
          decoy: 'Earbuds',
        },
        {
          word: 'Email',
          hint: 'Inbox',
          decoy: 'Text message',
        },
        {
          word: 'Video call',
          hint: 'Face to face online',
          decoy: 'Phone call',
        },
        {
          word: 'Streaming',
          hint: 'Watch online',
          decoy: 'Downloading',
        },
        {
          word: 'Screenshot',
          hint: 'Capture the screen',
          decoy: 'Screen recording',
        },
        {
          word: 'Robot',
          hint: 'Mechanical helper',
          decoy: 'Drone',
        },
        {
          word: 'Keyboard',
          hint: 'Typing',
          decoy: 'Mouse',
        },
        {
          word: 'Smartwatch',
          hint: 'On your wrist',
          decoy: 'Fitness band',
        },
        {
          word: 'Hashtag',
          hint: 'Social tag',
          decoy: 'Mention',
        },
        {
          word: 'Podcast',
          hint: 'Listen on the go',
          decoy: 'Radio',
        },
        {
          word: 'Virtual reality',
          hint: 'Goggles on',
          decoy: 'Augmented reality',
        },
        {
          word: 'Search engine',
          hint: 'Find anything',
          decoy: 'Encyclopedia',
        },
        {
          word: 'Group chat',
          hint: 'Many messages',
          decoy: 'Forum',
        },
        {
          word: 'Printer',
          hint: 'Paper out',
          decoy: 'Scanner',
        },
        {
          word: 'USB drive',
          hint: 'Plug-in storage',
          decoy: 'Memory card',
        },
        {
          word: 'Notification',
          hint: 'Ping',
          decoy: 'Alarm',
        },
        {
          word: 'Online shopping',
          hint: 'Add to cart',
          decoy: 'Delivery',
        },
        {
          word: 'Game console',
          hint: 'Play at home',
          decoy: 'Arcade machine',
        },
        {
          word: 'Cloud storage',
          hint: 'Files online',
          decoy: 'Hard drive',
        },
        {
          word: 'Voice assistant',
          hint: 'Talk to it',
          decoy: 'Chatbot',
        },
        {
          word: 'Spam',
          hint: 'Unwanted',
          decoy: 'Pop-up ad',
        },
        {
          word: 'Meme',
          hint: 'Shared joke',
          decoy: 'GIF',
        },
        {
          word: 'Battery',
          hint: 'Stores power',
          decoy: 'Charger',
        },
      ],
    },
    {
      id: 'music',
      label: 'Music',
      emoji: '🎸',
      words: [
        {
          word: 'Guitar',
          hint: 'Six strings',
          decoy: 'Violin',
        },
        {
          word: 'Piano',
          hint: 'Black and white keys',
          decoy: 'Keyboard',
        },
        {
          word: 'Drums',
          hint: 'Keep the beat',
          decoy: 'Tabla',
        },
        {
          word: 'Microphone',
          hint: 'Amplifies voice',
          decoy: 'Speaker',
        },
        {
          word: 'Concert',
          hint: 'Live show',
          decoy: 'Festival',
        },
        {
          word: 'Violin',
          hint: 'Played with a bow',
          decoy: 'Cello',
        },
        {
          word: 'Trumpet',
          hint: 'Brass blast',
          decoy: 'Saxophone',
        },
        {
          word: 'Flute',
          hint: 'Blow across it',
          decoy: 'Recorder',
        },
        {
          word: 'Choir',
          hint: 'Many voices',
          decoy: 'Band',
        },
        {
          word: 'Lullaby',
          hint: 'Bedtime song',
          decoy: 'Nursery rhyme',
        },
        {
          word: 'Rap',
          hint: 'Rhymes and beats',
          decoy: 'Poetry',
        },
        {
          word: 'Orchestra',
          hint: 'Conductor leads',
          decoy: 'Band',
        },
        {
          word: 'Playlist',
          hint: 'Song lineup',
          decoy: 'Album',
        },
        {
          word: 'Opera',
          hint: 'Dramatic singing',
          decoy: 'Musical',
        },
        {
          word: 'DJ',
          hint: 'Mixes tracks',
          decoy: 'Producer',
        },
        {
          word: 'Harmonica',
          hint: 'Pocket instrument',
          decoy: 'Kazoo',
        },
        {
          word: 'Headliner',
          hint: 'Last on stage',
          decoy: 'Opening act',
        },
        {
          word: 'Encore',
          hint: 'One more',
          decoy: 'Bonus track',
        },
        {
          word: 'Lyrics',
          hint: 'The words',
          decoy: 'Poem',
        },
        {
          word: 'Music video',
          hint: 'Song with visuals',
          decoy: 'Movie trailer',
        },
        {
          word: 'Record player',
          hint: 'Spinning vinyl',
          decoy: 'Cassette',
        },
        {
          word: 'Karaoke',
          hint: 'Sing the screen',
          decoy: 'Talent show',
        },
        {
          word: 'Rock band',
          hint: 'Loud guitars',
          decoy: 'Pop group',
        },
        {
          word: 'Tambourine',
          hint: 'Shake and hit',
          decoy: 'Maracas',
        },
        {
          word: 'Veena',
          hint: 'Classical strings',
          decoy: 'Sitar',
        },
        {
          word: 'Dhol',
          hint: 'Wedding beats',
          decoy: 'Drums',
        },
        {
          word: 'Ballad',
          hint: 'Slow song',
          decoy: 'Love song',
        },
        {
          word: 'Metronome',
          hint: 'Ticks the tempo',
          decoy: 'Clock',
        },
        {
          word: 'Headphones',
          hint: 'Music on your ears',
          decoy: 'Speakers',
        },
        {
          word: 'Talent show',
          hint: 'Judges watch',
          decoy: 'Audition',
        },
      ],
    },
    {
      id: 'screen',
      label: 'Movies & TV',
      emoji: '🎬',
      words: [
        {
          word: 'Superhero',
          hint: 'Saves the day',
          decoy: 'Villain',
        },
        {
          word: 'Cartoon',
          hint: 'Animated',
          decoy: 'Anime',
        },
        {
          word: 'Sequel',
          hint: 'Part two',
          decoy: 'Prequel',
        },
        {
          word: 'Plot twist',
          hint: "Didn't see that coming",
          decoy: 'Cliffhanger',
        },
        {
          word: 'Red carpet',
          hint: 'Glamorous arrival',
          decoy: 'Award show',
        },
        {
          word: 'Horror movie',
          hint: 'Jump scares',
          decoy: 'Thriller',
        },
        {
          word: 'Sitcom',
          hint: 'Laugh track',
          decoy: 'Talk show',
        },
        {
          word: 'Documentary',
          hint: 'Real story',
          decoy: 'News report',
        },
        {
          word: 'Popcorn bucket',
          hint: 'Theater snack',
          decoy: 'Nachos',
        },
        {
          word: 'Trailer',
          hint: 'Sneak peek',
          decoy: 'Teaser',
        },
        {
          word: 'Villain',
          hint: 'The bad guy',
          decoy: 'Monster',
        },
        {
          word: 'Stunt double',
          hint: 'Takes the fall',
          decoy: 'Body double',
        },
        {
          word: 'Reality show',
          hint: 'Unscripted drama',
          decoy: 'Game show',
        },
        {
          word: 'Soundtrack',
          hint: 'Movie music',
          decoy: 'Theme song',
        },
        {
          word: 'Director',
          hint: 'Calls the shots',
          decoy: 'Producer',
        },
        {
          word: 'Wizard',
          hint: 'Spells and robes',
          decoy: 'Witch',
        },
        {
          word: 'Pirate',
          hint: 'Treasure seeker',
          decoy: 'Sailor',
        },
        {
          word: 'Zombie',
          hint: 'Undead walker',
          decoy: 'Vampire',
        },
        {
          word: 'Detective show',
          hint: 'Whodunit',
          decoy: 'Crime drama',
        },
        {
          word: 'Spy',
          hint: 'Undercover agent',
          decoy: 'Detective',
        },
        {
          word: 'Dinosaur film',
          hint: 'Prehistoric chase',
          decoy: 'Monster movie',
        },
        {
          word: 'Space adventure',
          hint: 'Among the stars',
          decoy: 'Alien invasion',
        },
        {
          word: 'Talk show',
          hint: 'Celebrity couch',
          decoy: 'Podcast',
        },
        {
          word: 'Binge watching',
          hint: 'One more episode',
          decoy: 'Marathon',
        },
        {
          word: 'Subtitles',
          hint: 'Read along',
          decoy: 'Dubbing',
        },
        {
          word: 'Box office',
          hint: 'Ticket sales',
          decoy: 'Ratings',
        },
        {
          word: 'Remake',
          hint: 'New version',
          decoy: 'Reboot',
        },
        {
          word: 'Cameo',
          hint: 'Surprise appearance',
          decoy: 'Guest star',
        },
        {
          word: 'Opening credits',
          hint: 'Names roll first',
          decoy: 'End credits',
        },
        {
          word: 'Award show',
          hint: 'Thank you speech',
          decoy: 'Red carpet',
        },
      ],
    },
    {
      id: 'nature',
      label: 'Nature & Weather',
      emoji: '🌋',
      words: [
        {
          word: 'Volcano',
          hint: 'Erupts',
          decoy: 'Geyser',
        },
        {
          word: 'Rainbow',
          hint: 'After the rain',
          decoy: 'Sunset',
        },
        {
          word: 'Thunderstorm',
          hint: 'Loud and wet',
          decoy: 'Hurricane',
        },
        {
          word: 'Desert',
          hint: 'Dry and sandy',
          decoy: 'Savanna',
        },
        {
          word: 'Waterfall',
          hint: 'Falling water',
          decoy: 'River',
        },
        {
          word: 'Forest',
          hint: 'Many trees',
          decoy: 'Jungle',
        },
        {
          word: 'Snowflake',
          hint: 'Unique and cold',
          decoy: 'Hail',
        },
        {
          word: 'Island',
          hint: 'Surrounded by water',
          decoy: 'Peninsula',
        },
        {
          word: 'Mountain',
          hint: 'Climb to the top',
          decoy: 'Hill',
        },
        {
          word: 'Cave',
          hint: 'Dark inside',
          decoy: 'Tunnel',
        },
        {
          word: 'Moon',
          hint: 'Night light',
          decoy: 'Star',
        },
        {
          word: 'Sunrise',
          hint: 'Morning glow',
          decoy: 'Sunset',
        },
        {
          word: 'Earthquake',
          hint: 'Ground shakes',
          decoy: 'Landslide',
        },
        {
          word: 'Tornado',
          hint: 'Spinning wind',
          decoy: 'Hurricane',
        },
        {
          word: 'Ocean',
          hint: 'Vast and salty',
          decoy: 'Sea',
        },
        {
          word: 'Glacier',
          hint: 'Slow ice',
          decoy: 'Iceberg',
        },
        {
          word: 'Fog',
          hint: 'Hard to see',
          decoy: 'Mist',
        },
        {
          word: 'Lightning',
          hint: 'Bright flash',
          decoy: 'Thunder',
        },
        {
          word: 'Coral reef',
          hint: 'Underwater color',
          decoy: 'Seaweed',
        },
        {
          word: 'Cactus',
          hint: 'Prickly plant',
          decoy: 'Aloe vera',
        },
        {
          word: 'Sunflower',
          hint: 'Faces the sun',
          decoy: 'Daisy',
        },
        {
          word: 'Rain',
          hint: 'Falls from clouds',
          decoy: 'Drizzle',
        },
        {
          word: 'River',
          hint: 'Flows to the sea',
          decoy: 'Stream',
        },
        {
          word: 'Meadow',
          hint: 'Grassy field',
          decoy: 'Prairie',
        },
        {
          word: 'Pond',
          hint: 'Small still water',
          decoy: 'Lake',
        },
        {
          word: 'Swamp',
          hint: 'Muddy wetland',
          decoy: 'Marsh',
        },
        {
          word: 'Autumn leaves',
          hint: 'Falling colors',
          decoy: 'Pine needles',
        },
        {
          word: 'Tide',
          hint: 'Comes and goes',
          decoy: 'Wave',
        },
        {
          word: 'Monsoon',
          hint: 'Rainy season',
          decoy: 'Typhoon',
        },
        {
          word: 'Breeze',
          hint: 'Gentle wind',
          decoy: 'Gust',
        },
      ],
    },
    {
      id: 'school',
      label: 'School & Work',
      emoji: '📚',
      words: [
        {
          word: 'Homework',
          hint: 'After class',
          decoy: 'Assignment',
        },
        {
          word: 'Exam',
          hint: 'Test of knowledge',
          decoy: 'Quiz',
        },
        {
          word: 'Field trip',
          hint: 'Class outing',
          decoy: 'Picnic',
        },
        {
          word: 'Recess',
          hint: 'Play break',
          decoy: 'Lunch break',
        },
        {
          word: 'Backpack',
          hint: 'Carries books',
          decoy: 'Briefcase',
        },
        {
          word: 'Report card',
          hint: 'Grades',
          decoy: 'Certificate',
        },
        {
          word: 'Graduation',
          hint: 'Caps in the air',
          decoy: 'Convocation',
        },
        {
          word: 'Detention',
          hint: 'Stay after',
          decoy: 'Suspension',
        },
        {
          word: 'Science fair',
          hint: 'Projects on display',
          decoy: 'Exhibition',
        },
        {
          word: 'Deadline',
          hint: 'Due date',
          decoy: 'Appointment',
        },
        {
          word: 'Coffee break',
          hint: 'Quick pause',
          decoy: 'Lunch break',
        },
        {
          word: 'Meeting',
          hint: 'Agenda',
          decoy: 'Conference call',
        },
        {
          word: 'Promotion',
          hint: 'Moving up',
          decoy: 'Raise',
        },
        {
          word: 'Office gossip',
          hint: 'Whispers',
          decoy: 'Rumor',
        },
        {
          word: 'Calculator',
          hint: 'Crunch numbers',
          decoy: 'Abacus',
        },
        {
          word: 'Whiteboard',
          hint: 'Write and wipe',
          decoy: 'Chalkboard',
        },
        {
          word: 'Uniform',
          hint: 'Everyone matches',
          decoy: 'Dress code',
        },
        {
          word: 'Principal',
          hint: 'Head of school',
          decoy: 'Dean',
        },
        {
          word: 'Group project',
          hint: 'Teamwork',
          decoy: 'Presentation',
        },
        {
          word: 'Pop quiz',
          hint: 'Surprise test',
          decoy: 'Exam',
        },
        {
          word: 'Interview',
          hint: 'First impression',
          decoy: 'Audition',
        },
        {
          word: 'Resume',
          hint: 'Your experience',
          decoy: 'Cover letter',
        },
        {
          word: 'Payday',
          hint: 'Money arrives',
          decoy: 'Bonus',
        },
        {
          word: 'Spelling bee',
          hint: 'Letter by letter',
          decoy: 'Quiz contest',
        },
        {
          word: 'Notebook',
          hint: 'Pages to fill',
          decoy: 'Diary',
        },
        {
          word: 'Pencil case',
          hint: 'Holds supplies',
          decoy: 'Lunchbox',
        },
        {
          word: 'Commute',
          hint: 'Getting to work',
          decoy: 'Road trip',
        },
        {
          word: 'Overtime',
          hint: 'Extra hours',
          decoy: 'Night shift',
        },
        {
          word: 'Intern',
          hint: 'Learning on the job',
          decoy: 'Trainee',
        },
        {
          word: 'Lunchbox',
          hint: 'Packed meal',
          decoy: 'Tiffin',
        },
      ],
    },
    {
      id: 'celebrations',
      label: 'Holidays & Celebrations',
      emoji: '🎉',
      words: [
        {
          word: 'Birthday cake',
          hint: 'Make a wish',
          decoy: 'Cupcake',
        },
        {
          word: 'Fireworks',
          hint: 'Lights up the sky',
          decoy: 'Sparklers',
        },
        {
          word: 'Wedding',
          hint: 'Vows',
          decoy: 'Engagement',
        },
        {
          word: 'Halloween',
          hint: 'Costumes and candy',
          decoy: 'Carnival',
        },
        {
          word: 'Christmas tree',
          hint: 'Decorated evergreen',
          decoy: 'Wreath',
        },
        {
          word: 'Diwali',
          hint: 'Festival of lights',
          decoy: 'Christmas',
        },
        {
          word: 'Holi',
          hint: 'Colors fly',
          decoy: 'Water fight',
        },
        {
          word: 'New Year',
          hint: 'Countdown',
          decoy: 'Birthday',
        },
        {
          word: 'Gift wrap',
          hint: 'Hide the present',
          decoy: 'Gift bag',
        },
        {
          word: 'Balloon',
          hint: 'Floats away',
          decoy: 'Bubble',
        },
        {
          word: 'Surprise party',
          hint: 'Hide and shout',
          decoy: 'Housewarming',
        },
        {
          word: "Valentine's Day",
          hint: 'Love is in the air',
          decoy: 'Anniversary',
        },
        {
          word: 'Sankranti',
          hint: 'Kites and harvest',
          decoy: 'Pongal',
        },
        {
          word: 'Easter egg',
          hint: 'Hidden and found',
          decoy: 'Treasure',
        },
        {
          word: 'Costume party',
          hint: 'Dress up',
          decoy: 'Masquerade',
        },
        {
          word: 'Pinata',
          hint: 'Hit it for candy',
          decoy: 'Gift box',
        },
        {
          word: 'Toast',
          hint: 'Raise your glass',
          decoy: 'Speech',
        },
        {
          word: 'Party hat',
          hint: 'Pointy on your head',
          decoy: 'Crown',
        },
        {
          word: 'Baby shower',
          hint: 'Expecting',
          decoy: 'Gender reveal',
        },
        {
          word: 'Thanksgiving',
          hint: 'Grateful feast',
          decoy: 'Potluck',
        },
        {
          word: 'Carnival',
          hint: 'Parade and rides',
          decoy: 'Fair',
        },
        {
          word: 'Rakhi',
          hint: 'Sibling thread',
          decoy: 'Friendship band',
        },
        {
          word: 'Graduation party',
          hint: 'Celebrate the degree',
          decoy: 'Farewell party',
        },
        {
          word: 'Mehndi',
          hint: 'Henna art',
          decoy: 'Tattoo',
        },
        {
          word: 'Bonfire',
          hint: 'Big outdoor flame',
          decoy: 'Campfire',
        },
        {
          word: 'Confetti',
          hint: 'Tiny paper shower',
          decoy: 'Glitter',
        },
        {
          word: 'Ugadi',
          hint: 'Telugu New Year',
          decoy: 'Sankranti',
        },
        {
          word: 'Garba',
          hint: 'Circle dance',
          decoy: 'Bhangra',
        },
        {
          word: 'Housewarming',
          hint: 'New home',
          decoy: 'Open house',
        },
        {
          word: 'Family reunion',
          hint: 'Everyone together',
          decoy: 'Wedding',
        },
      ],
    },
    {
      id: 'fashion',
      label: 'Fashion & Style',
      emoji: '👗',
      words: [
        {
          word: 'Sneakers',
          hint: 'Comfy shoes',
          decoy: 'Sandals',
        },
        {
          word: 'Sunglasses',
          hint: 'Block the sun',
          decoy: 'Goggles',
        },
        {
          word: 'Jeans',
          hint: 'Denim',
          decoy: 'Trousers',
        },
        {
          word: 'Necklace',
          hint: 'Around your neck',
          decoy: 'Chain',
        },
        {
          word: 'Hoodie',
          hint: 'Has a hood',
          decoy: 'Sweater',
        },
        {
          word: 'Wristwatch',
          hint: 'Tells time',
          decoy: 'Bracelet',
        },
        {
          word: 'Tie',
          hint: 'Formal neckwear',
          decoy: 'Bow tie',
        },
        {
          word: 'High heels',
          hint: 'Tall shoes',
          decoy: 'Boots',
        },
        {
          word: 'Saree',
          hint: 'Six yards of grace',
          decoy: 'Lehenga',
        },
        {
          word: 'Raincoat',
          hint: 'Stay dry',
          decoy: 'Poncho',
        },
        {
          word: 'Scarf',
          hint: 'Wraps around',
          decoy: 'Shawl',
        },
        {
          word: 'Handbag',
          hint: 'Carries essentials',
          decoy: 'Backpack',
        },
        {
          word: 'Pajamas',
          hint: 'Bedtime clothes',
          decoy: 'Tracksuit',
        },
        {
          word: 'Lipstick',
          hint: 'Color your lips',
          decoy: 'Lip gloss',
        },
        {
          word: 'Perfume',
          hint: 'Smell nice',
          decoy: 'Deodorant',
        },
        {
          word: 'Earrings',
          hint: 'On your ears',
          decoy: 'Studs',
        },
        {
          word: 'Cap',
          hint: 'Shades your eyes',
          decoy: 'Hat',
        },
        {
          word: 'Swimsuit',
          hint: 'Pool day',
          decoy: 'Shorts',
        },
        {
          word: 'Gloves',
          hint: 'Warm hands',
          decoy: 'Mittens',
        },
        {
          word: 'Fashion show',
          hint: 'Runway',
          decoy: 'Photoshoot',
        },
        {
          word: 'Kurta',
          hint: 'Long tunic',
          decoy: 'Shirt',
        },
        {
          word: 'Belt',
          hint: 'Holds things up',
          decoy: 'Suspenders',
        },
        {
          word: 'Wedding dress',
          hint: 'Big day outfit',
          decoy: 'Gown',
        },
        {
          word: 'Tuxedo',
          hint: 'Black tie',
          decoy: 'Suit',
        },
        {
          word: 'Flip-flops',
          hint: 'Beach footwear',
          decoy: 'Slippers',
        },
        {
          word: 'Ring',
          hint: 'On a finger',
          decoy: 'Bracelet',
        },
        {
          word: 'Makeup',
          hint: 'Brushes and powder',
          decoy: 'Face paint',
        },
        {
          word: 'Tattoo',
          hint: 'Ink on skin',
          decoy: 'Henna',
        },
        {
          word: 'Wardrobe',
          hint: 'Clothes storage',
          decoy: 'Dresser',
        },
        {
          word: 'Fitting room',
          hint: 'Try it on',
          decoy: 'Changing room',
        },
      ],
    },
    {
      id: 'body',
      label: 'Health & Body',
      emoji: '🫀',
      words: [
        {
          word: 'Heart',
          hint: 'Beats all day',
          decoy: 'Lungs',
        },
        {
          word: 'Brain',
          hint: 'Thinking center',
          decoy: 'Mind',
        },
        {
          word: 'Sneeze',
          hint: 'Achoo',
          decoy: 'Cough',
        },
        {
          word: 'Yawn',
          hint: 'Sleepy sign',
          decoy: 'Stretch',
        },
        {
          word: 'Hiccups',
          hint: "Can't stop",
          decoy: 'Burp',
        },
        {
          word: 'Dentist chair',
          hint: 'Open wide',
          decoy: 'Barber chair',
        },
        {
          word: 'Bandage',
          hint: 'Covers a cut',
          decoy: 'Plaster',
        },
        {
          word: 'Vitamins',
          hint: 'Daily pills',
          decoy: 'Supplements',
        },
        {
          word: 'Fever',
          hint: 'Running hot',
          decoy: 'Cold',
        },
        {
          word: 'Push-up',
          hint: 'Arms and floor',
          decoy: 'Plank',
        },
        {
          word: 'Massage',
          hint: 'Relaxing hands',
          decoy: 'Spa',
        },
        {
          word: 'Nap',
          hint: 'Short sleep',
          decoy: 'Rest',
        },
        {
          word: 'Eyebrows',
          hint: 'Above the eyes',
          decoy: 'Eyelashes',
        },
        {
          word: 'Fingerprint',
          hint: 'Unique pattern',
          decoy: 'Signature',
        },
        {
          word: 'Goosebumps',
          hint: 'Chills',
          decoy: 'Shiver',
        },
        {
          word: 'Heartbeat',
          hint: 'Thump thump',
          decoy: 'Pulse',
        },
        {
          word: 'Stethoscope',
          hint: 'Listen in',
          decoy: 'Thermometer',
        },
        {
          word: 'Ambulance',
          hint: 'Emergency ride',
          decoy: 'Hospital',
        },
        {
          word: 'Sunburn',
          hint: 'Too much sun',
          decoy: 'Rash',
        },
        {
          word: 'Freckles',
          hint: 'Tiny spots',
          decoy: 'Moles',
        },
        {
          word: 'Dimples',
          hint: 'Cute dents',
          decoy: 'Wrinkles',
        },
        {
          word: 'Muscle',
          hint: 'Gets stronger',
          decoy: 'Bone',
        },
        {
          word: 'Allergy',
          hint: 'Body says no',
          decoy: 'Infection',
        },
        {
          word: 'Knee',
          hint: 'Bends the leg',
          decoy: 'Elbow',
        },
        {
          word: 'Skeleton',
          hint: 'All the bones',
          decoy: 'Skull',
        },
        {
          word: 'Belly button',
          hint: 'Center of the belly',
          decoy: 'Navel',
        },
        {
          word: 'Toothache',
          hint: 'Ouch in the mouth',
          decoy: 'Headache',
        },
        {
          word: 'Wheelchair',
          hint: 'Rolling seat',
          decoy: 'Crutches',
        },
        {
          word: 'Blood test',
          hint: 'Small needle',
          decoy: 'Vaccine',
        },
        {
          word: 'Snore',
          hint: 'Noisy sleep',
          decoy: 'Sleep talking',
        },
      ],
    },
    {
      id: 'fantasy',
      label: 'Fantasy & Myth',
      emoji: '🐉',
      words: [
        {
          word: 'Dragon',
          hint: 'Breathes fire',
          decoy: 'Dinosaur',
        },
        {
          word: 'Unicorn',
          hint: 'Single horn',
          decoy: 'Pegasus',
        },
        {
          word: 'Mermaid',
          hint: 'Half fish',
          decoy: 'Siren',
        },
        {
          word: 'Wizard',
          hint: 'Casts spells',
          decoy: 'Witch',
        },
        {
          word: 'Vampire',
          hint: 'Afraid of sunlight',
          decoy: 'Werewolf',
        },
        {
          word: 'Ghost',
          hint: 'See-through',
          decoy: 'Spirit',
        },
        {
          word: 'Fairy',
          hint: 'Tiny with wings',
          decoy: 'Angel',
        },
        {
          word: 'Giant',
          hint: 'Very big person',
          decoy: 'Ogre',
        },
        {
          word: 'Genie',
          hint: 'Grants wishes',
          decoy: 'Fairy godmother',
        },
        {
          word: 'Treasure chest',
          hint: 'Hidden riches',
          decoy: 'Safe',
        },
        {
          word: 'Magic wand',
          hint: 'Waves for spells',
          decoy: 'Staff',
        },
        {
          word: 'Crystal ball',
          hint: 'See the future',
          decoy: 'Tarot cards',
        },
        {
          word: 'Knight',
          hint: 'Armor and honor',
          decoy: 'Samurai',
        },
        {
          word: 'Castle tower',
          hint: 'Princess waits',
          decoy: 'Lighthouse',
        },
        {
          word: 'Troll',
          hint: 'Under the bridge',
          decoy: 'Goblin',
        },
        {
          word: 'Phoenix',
          hint: 'Rises from ashes',
          decoy: 'Firebird',
        },
        {
          word: 'Time machine',
          hint: 'Visit the past',
          decoy: 'Portal',
        },
        {
          word: 'Invisibility cloak',
          hint: "Can't see you",
          decoy: 'Disguise',
        },
        {
          word: 'Haunted house',
          hint: 'Spooky home',
          decoy: 'Graveyard',
        },
        {
          word: 'Alien',
          hint: 'From another planet',
          decoy: 'Robot',
        },
        {
          word: 'Superpower',
          hint: 'Special ability',
          decoy: 'Magic',
        },
        {
          word: 'Flying carpet',
          hint: 'Rides the sky',
          decoy: 'Broomstick',
        },
        {
          word: 'Pirate ship',
          hint: 'Jolly Roger',
          decoy: 'Viking ship',
        },
        {
          word: 'Zombie',
          hint: 'Craves brains',
          decoy: 'Mummy',
        },
        {
          word: 'Mummy',
          hint: 'Wrapped up',
          decoy: 'Skeleton',
        },
        {
          word: 'Elf',
          hint: 'Pointy ears',
          decoy: 'Gnome',
        },
        {
          word: 'Potion',
          hint: 'Magic drink',
          decoy: 'Medicine',
        },
        {
          word: 'Curse',
          hint: 'Bad magic',
          decoy: 'Spell',
        },
        {
          word: 'Prophecy',
          hint: 'Foretold destiny',
          decoy: 'Horoscope',
        },
        {
          word: 'Spell book',
          hint: 'Pages of magic',
          decoy: 'Diary',
        },
      ],
    },
    {
      id: 'childhood',
      label: 'Childhood & Games',
      emoji: '🪁',
      words: [
        {
          word: 'Hide and seek',
          hint: 'Count then find',
          decoy: 'Tag',
        },
        {
          word: 'Kite',
          hint: 'Flies on a string',
          decoy: 'Balloon',
        },
        {
          word: 'Swing',
          hint: 'Back and forth',
          decoy: 'Seesaw',
        },
        {
          word: 'Slide',
          hint: 'Whee down',
          decoy: 'Swing',
        },
        {
          word: 'Teddy bear',
          hint: 'Cuddly toy',
          decoy: 'Doll',
        },
        {
          word: 'Sandcastle',
          hint: 'Built at the beach',
          decoy: 'Snowman',
        },
        {
          word: 'Jump rope',
          hint: 'Skip skip',
          decoy: 'Hopscotch',
        },
        {
          word: 'Bubble wrap',
          hint: 'Pop pop',
          decoy: 'Balloon',
        },
        {
          word: 'Piggy bank',
          hint: 'Save coins',
          decoy: 'Wallet',
        },
        {
          word: 'Treehouse',
          hint: 'Up in the branches',
          decoy: 'Tent',
        },
        {
          word: 'Lego',
          hint: 'Click together',
          decoy: 'Blocks',
        },
        {
          word: 'Yo-yo',
          hint: 'Up and down',
          decoy: 'Spinning top',
        },
        {
          word: 'Marbles',
          hint: 'Tiny glass balls',
          decoy: 'Beads',
        },
        {
          word: 'Crayons',
          hint: 'Color inside the lines',
          decoy: 'Markers',
        },
        {
          word: 'Snowball fight',
          hint: 'Winter battle',
          decoy: 'Pillow fight',
        },
        {
          word: 'Musical chairs',
          hint: 'Grab a seat when it stops',
          decoy: 'Freeze dance',
        },
        {
          word: 'Bedtime story',
          hint: 'Read before sleep',
          decoy: 'Lullaby',
        },
        {
          word: 'Training wheels',
          hint: 'Learning to ride',
          decoy: 'Tricycle',
        },
        {
          word: 'Lemonade stand',
          hint: 'First business',
          decoy: 'Bake sale',
        },
        {
          word: 'Tooth fairy',
          hint: 'Coin under the pillow',
          decoy: 'Santa Claus',
        },
        {
          word: 'Blanket fort',
          hint: 'Indoor hideout',
          decoy: 'Tent',
        },
        {
          word: 'Trampoline',
          hint: 'Bounce high',
          decoy: 'Bouncy castle',
        },
        {
          word: 'Sleepover',
          hint: "Night at a friend's",
          decoy: 'Camping',
        },
        {
          word: 'Rock paper scissors',
          hint: 'Hand battle',
          decoy: 'Coin toss',
        },
        {
          word: 'Water balloon',
          hint: 'Splash attack',
          decoy: 'Water gun',
        },
        {
          word: 'Playdough',
          hint: 'Squish and shape',
          decoy: 'Clay',
        },
        {
          word: 'Comic book',
          hint: 'Panels and heroes',
          decoy: 'Picture book',
        },
        {
          word: 'Ice cream truck',
          hint: 'Music on wheels',
          decoy: 'Food truck',
        },
        {
          word: 'Cartwheel',
          hint: 'Hands then feet',
          decoy: 'Somersault',
        },
        {
          word: 'Gilli danda',
          hint: 'Street stick game',
          decoy: 'Cricket',
        },
      ],
    },
    {
      id: 'desi',
      label: 'Desi Life',
      emoji: '🪔',
      words: [
        {
          word: 'Biryani',
          hint: 'Layered rice',
          decoy: 'Pulao',
        },
        {
          word: 'Chai',
          hint: 'Tea break',
          decoy: 'Coffee',
        },
        {
          word: 'Dosa',
          hint: 'Crispy and thin',
          decoy: 'Uttapam',
        },
        {
          word: 'Idli',
          hint: 'Steamed and soft',
          decoy: 'Dhokla',
        },
        {
          word: 'Samosa',
          hint: 'Triangle snack',
          decoy: 'Kachori',
        },
        {
          word: 'Pani puri',
          hint: 'Burst in the mouth',
          decoy: 'Bhel puri',
        },
        {
          word: 'Cricket match',
          hint: 'National obsession',
          decoy: 'Football match',
        },
        {
          word: 'Auto rickshaw',
          hint: 'Meter or fixed',
          decoy: 'Taxi',
        },
        {
          word: 'Bollywood',
          hint: 'Song and dance',
          decoy: 'Tollywood',
        },
        {
          word: 'Mango pickle',
          hint: 'Spicy jar',
          decoy: 'Lemon pickle',
        },
        {
          word: 'Wedding baraat',
          hint: "Groom's procession",
          decoy: 'Parade',
        },
        {
          word: 'Rangoli',
          hint: 'Colors at the door',
          decoy: 'Mehndi',
        },
        {
          word: 'Temple bells',
          hint: 'Ring when you enter',
          decoy: 'Wind chimes',
        },
        {
          word: 'Street food',
          hint: 'Roadside bites',
          decoy: 'Food court',
        },
        {
          word: 'Pressure cooker',
          hint: 'Whistles',
          decoy: 'Rice cooker',
        },
        {
          word: 'Jalebi',
          hint: 'Sticky spirals',
          decoy: 'Gulab jamun',
        },
        {
          word: 'Lassi',
          hint: 'Yogurt drink',
          decoy: 'Buttermilk',
        },
        {
          word: 'Train journey',
          hint: 'Long rail ride',
          decoy: 'Bus journey',
        },
        {
          word: 'Monsoon',
          hint: 'Rainy season',
          decoy: 'Winter',
        },
        {
          word: 'Tiffin box',
          hint: 'Stacked lunch',
          decoy: 'Lunchbox',
        },
        {
          word: 'Matrimonial ad',
          hint: 'Seeking a match',
          decoy: 'Dating app',
        },
        {
          word: 'Power cut',
          hint: 'Lights out',
          decoy: 'Blackout',
        },
        {
          word: 'Mehendi night',
          hint: 'Henna party',
          decoy: 'Sangeet',
        },
        {
          word: 'Filter coffee',
          hint: 'Steel tumbler',
          decoy: 'Chai',
        },
        {
          word: 'Paan',
          hint: 'After-dinner leaf',
          decoy: 'Mouth freshener',
        },
        {
          word: 'Ayurveda',
          hint: 'Traditional healing',
          decoy: 'Yoga',
        },
        {
          word: 'Bargaining',
          hint: 'Haggle the price',
          decoy: 'Discount',
        },
        {
          word: 'Joint family',
          hint: 'Many generations',
          decoy: 'Neighbors',
        },
        {
          word: 'Cricket bat',
          hint: 'Willow',
          decoy: 'Hockey stick',
        },
        {
          word: 'Dabbawala',
          hint: 'Lunch delivery',
          decoy: 'Courier',
        },
      ],
    },
    {
      id: 'feelings',
      label: 'Feelings & Ideas',
      emoji: '💭',
      words: [
        {
          word: 'Nostalgia',
          hint: 'The good old days',
          decoy: 'Memory',
        },
        {
          word: 'Jealousy',
          hint: 'Green-eyed',
          decoy: 'Envy',
        },
        {
          word: 'Sarcasm',
          hint: 'Not meant literally',
          decoy: 'Irony',
        },
        {
          word: 'Procrastination',
          hint: 'Do it later',
          decoy: 'Laziness',
        },
        {
          word: 'Deja vu',
          hint: 'Happened before',
          decoy: 'Coincidence',
        },
        {
          word: 'Karma',
          hint: 'What goes around',
          decoy: 'Luck',
        },
        {
          word: 'Awkward silence',
          hint: 'Nobody speaks',
          decoy: 'Pause',
        },
        {
          word: 'Peer pressure',
          hint: "Everyone's doing it",
          decoy: 'Influence',
        },
        {
          word: 'Comfort zone',
          hint: 'Safe space',
          decoy: 'Routine',
        },
        {
          word: 'First impression',
          hint: 'Early judgment',
          decoy: 'Reputation',
        },
        {
          word: 'Overthinking',
          hint: "Mind won't stop",
          decoy: 'Worry',
        },
        {
          word: 'Fear of missing out',
          hint: 'Everyone else is there',
          decoy: 'Jealousy',
        },
        {
          word: 'Hindsight',
          hint: 'Easy looking back',
          decoy: 'Regret',
        },
        {
          word: 'Intuition',
          hint: 'Gut feeling',
          decoy: 'Instinct',
        },
        {
          word: 'Common sense',
          hint: 'Obvious wisdom',
          decoy: 'Logic',
        },
        {
          word: 'Boredom',
          hint: 'Nothing to do',
          decoy: 'Laziness',
        },
        {
          word: 'Curiosity',
          hint: 'Wants to know',
          decoy: 'Interest',
        },
        {
          word: 'Courage',
          hint: 'Facing fear',
          decoy: 'Confidence',
        },
        {
          word: 'Guilty pleasure',
          hint: 'Secretly love it',
          decoy: 'Habit',
        },
        {
          word: 'Homesick',
          hint: 'Missing home',
          decoy: 'Lonely',
        },
        {
          word: 'Embarrassment',
          hint: 'Red face',
          decoy: 'Shame',
        },
        {
          word: 'Gratitude',
          hint: 'Thankful',
          decoy: 'Respect',
        },
        {
          word: 'Patience',
          hint: 'Waiting calmly',
          decoy: 'Tolerance',
        },
        {
          word: 'Stage fright',
          hint: 'Nerves before showtime',
          decoy: 'Anxiety',
        },
        {
          word: 'Optimism',
          hint: 'Glass half full',
          decoy: 'Hope',
        },
        {
          word: 'Teamwork',
          hint: 'Together wins',
          decoy: 'Friendship',
        },
        {
          word: 'Ambition',
          hint: 'Big goals',
          decoy: 'Dream',
        },
        {
          word: 'Daydream',
          hint: 'Mind wanders',
          decoy: 'Imagination',
        },
        {
          word: 'Superstition',
          hint: 'Knock on wood',
          decoy: 'Tradition',
        },
        {
          word: 'Small talk',
          hint: 'Weather chat',
          decoy: 'Gossip',
        },
      ],
    },
    {
      id: 'science',
      label: 'Science & Space',
      emoji: '🚀',
      words: [
        {
          word: 'Planet',
          hint: 'Orbits a star',
          decoy: 'Moon',
        },
        {
          word: 'Black hole',
          hint: 'Nothing escapes',
          decoy: 'Wormhole',
        },
        {
          word: 'Microscope',
          hint: 'Tiny world',
          decoy: 'Magnifying glass',
        },
        {
          word: 'Telescope',
          hint: 'Far away view',
          decoy: 'Binoculars',
        },
        {
          word: 'Magnet',
          hint: 'Pulls metal',
          decoy: 'Glue',
        },
        {
          word: 'Gravity',
          hint: 'What goes up',
          decoy: 'Friction',
        },
        {
          word: 'Dinosaur',
          hint: 'Long extinct',
          decoy: 'Dragon',
        },
        {
          word: 'Fossil',
          hint: 'Old remains',
          decoy: 'Skeleton',
        },
        {
          word: 'Astronaut',
          hint: 'Space traveler',
          decoy: 'Pilot',
        },
        {
          word: 'Satellite',
          hint: 'Orbiting machine',
          decoy: 'Space station',
        },
        {
          word: 'Volcano model',
          hint: 'Classic science fair',
          decoy: 'Lava lamp',
        },
        {
          word: 'Electricity',
          hint: 'Powers everything',
          decoy: 'Battery',
        },
        {
          word: 'DNA',
          hint: 'Genetic code',
          decoy: 'Fingerprint',
        },
        {
          word: 'Laboratory',
          hint: 'Experiments happen',
          decoy: 'Kitchen',
        },
        {
          word: 'Comet',
          hint: 'Icy tail',
          decoy: 'Meteor',
        },
        {
          word: 'Eclipse',
          hint: 'Sun or moon blocked',
          decoy: 'Sunset',
        },
        {
          word: 'Thermometer',
          hint: 'Measures heat',
          decoy: 'Barometer',
        },
        {
          word: 'Robotics',
          hint: 'Build machines',
          decoy: 'Coding',
        },
        {
          word: 'Recycling',
          hint: 'Reuse materials',
          decoy: 'Composting',
        },
        {
          word: 'Solar panel',
          hint: 'Catches sunlight',
          decoy: 'Windmill',
        },
        {
          word: 'Atom',
          hint: 'Smallest building block',
          decoy: 'Molecule',
        },
        {
          word: 'Rocket launch',
          hint: 'Countdown to liftoff',
          decoy: 'Fireworks',
        },
        {
          word: 'Constellation',
          hint: 'Star pattern',
          decoy: 'Galaxy',
        },
        {
          word: 'Bacteria',
          hint: 'Tiny life',
          decoy: 'Virus',
        },
        {
          word: 'Rainbow prism',
          hint: 'Splits light',
          decoy: 'Mirror',
        },
        {
          word: 'Vaccine',
          hint: 'Prevention shot',
          decoy: 'Medicine',
        },
        {
          word: 'Laser',
          hint: 'Focused light',
          decoy: 'Flashlight',
        },
        {
          word: 'Earth',
          hint: 'Our home',
          decoy: 'Mars',
        },
        {
          word: 'Periodic table',
          hint: 'Elements chart',
          decoy: 'Multiplication table',
        },
        {
          word: 'Tsunami',
          hint: 'Giant wave',
          decoy: 'Flood',
        },
      ],
    },
  ],
  legacy: [
    {
      word: 'COFFEE',
      hint: 'Hot drink',
    },
    {
      word: 'PIZZA',
      hint: 'Italian food',
    },
    {
      word: 'GUITAR',
      hint: 'String instrument',
    },
    {
      word: 'SOCCER',
      hint: 'Ball sport',
    },
    {
      word: 'LAPTOP',
      hint: 'Portable computer',
    },
    {
      word: 'SUNGLASSES',
      hint: 'Eye wear',
    },
    {
      word: 'BACKPACK',
      hint: 'Carry bag',
    },
    {
      word: 'SMARTPHONE',
      hint: 'Mobile device',
    },
    {
      word: 'BICYCLE',
      hint: 'Two wheels',
    },
    {
      word: 'CAMERA',
      hint: 'Photo device',
    },
    {
      word: 'HEADPHONES',
      hint: 'Audio gear',
    },
    {
      word: 'WALLET',
      hint: 'Money holder',
    },
    {
      word: 'UMBRELLA',
      hint: 'Rain shield',
    },
    {
      word: 'KEYBOARD',
      hint: 'Typing tool',
    },
    {
      word: 'MICROWAVE',
      hint: 'Kitchen appliance',
    },
    {
      word: 'TELESCOPE',
      hint: 'Star viewer',
    },
    {
      word: 'MICROSCOPE',
      hint: 'Tiny viewer',
    },
    {
      word: 'HAMMOCK',
      hint: 'Outdoor bed',
    },
    {
      word: 'LANTERN',
      hint: 'Light source',
    },
    {
      word: 'COMPASS',
      hint: 'Direction finder',
    },
  ],
};
export default catalog;
