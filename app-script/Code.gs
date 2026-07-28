// ============================================================
// K for Kids Books Library — Google Apps Script Backend
// ============================================================
// SETUP:
//   1. Verify SPREADSHEET_ID and IMAGE_FOLDER_IDS below.
//   2. Project Settings > Script Properties > Add property:
//        Key: ADMIN_PASSWORD   Value: (your password)
//   3. Run setupImageNames() ONCE from the editor to populate
//      the "Image Name" column in your Books-DB sheet.
//   4. Deploy as Web App (Execute as: Me, Access: Anyone).
// ============================================================

const CONFIG = {
  SPREADSHEET_ID: '18nnveeE4RC9ah5zRQuOOzRJJnyOi8EPN8hrDELNgbFY',
  LEGACY_SPREADSHEET_ID: '1hPnGg26eaRplb-4hQWLyZcJ7pK3hBiJeqfVKdFR9hM0',

  // Tab name in your spreadsheet that holds the book list
  MASTER_SHEET_NAME: 'Books-DB',

  // Google Drive folder IDs containing book cover images
  IMAGE_FOLDER_IDS: [
      '1L7w6aq4U7iWKVQ1msjMfuL00wmlY1ouZ'
  ],

  // Customer DB sheet name
  CUSTOMER_SHEET_NAME: 'Customer DB',
  CUSTOMER_DETAILS_SHEET_NAME: 'Customer-Details'
};

// Header names in the book source sheet. Code resolves these to column positions
// at runtime so sheet columns can be referenced by name instead of fixed indexes.
const MASTER_HEADERS = {
  SR_NO:       'Sr. No.',
  LANGUAGE:    'Language',
  BOOK_NO:     'Book no.',
  AGE_GROUP:   'Age group',
  BOOK_NAME:   'Book name',
  CATEGORY:    'Category',
  ISSUED_TO:   'Issued to',
  AUTHOR:      'Author',
  STATUS:      'Status',
  IMAGE_NAME:  'Image Name'
};

const RESERVATION_ID_HEADER = 'Reservation ID';
const RESERVED_CUSTOMER_ID_HEADER = 'Reserved Customer ID';
const RESERVED_CUSTOMER_NAME_HEADER = 'Reserved Customer Name';
const RESERVED_AT_HEADER = 'Reserved At';
const RESERVATION_UPDATED_AT_HEADER = 'Reservation Updated At';
// Admin can hide a book from end users. Empty/"Visible" = shown; "Hidden" = only
// admins see it (with a Hidden badge) and can unhide.
const VISIBILITY_HEADER = 'Visibility';

// Issue tracking (linked to a customer). Add these columns to Books-DB manually.
const ISSUED_CUSTOMER_ID_HEADER = 'Issued Customer ID';
const ISSUED_AT_HEADER = 'Issued At';
const DUE_DATE_HEADER = 'Due Date';
const LOAN_DAYS = 15; // due date = issued date + 15 days

// Column indices in Customer DB sheet (0-based)
// Header: Sr no | Name | Date of start | Location | Address | Account status | Till date sum
const CUST = {
  SR_NO:         0,
  NAME:          1,
  DATE_START:    2,
  LOCATION:      3,
  ADDRESS:       4,
  STATUS:        5,  // Active / Inactive / Closed
  TILL_DATE_SUM: 6
};

const CUSTOMER_DETAILS_HEADERS = [
  'Customer ID',
  'Legacy Sr No',
  'Name',
  'Date of Start',
  'Location',
  'Address',
  'Account Status',
  'Till Date Sum',
  'Email',
  'Phone',
  'Subscription Plan',
  'Monthly Reservation Limit',
  'Active Reservation Count',
  'Subscription Status',
  'Auth Method',
  'Password Salt',
  'Password Hash',
  'Google Subject ID',
  'Invite Code Hash',
  'Invite Code Expires At',
  'Invite Status',
  'Claimed At',
  'Created At',
  'Approved At',
  'Last Login At',
  'Notes'
];

const LEGACY_CUSTOMER_SOURCE_HEADERS = {
  SR_NO: ['Sr', 'Sr no', 'Sr. No.', 'Sr No'],
  NAME: ['Name'],
  DATE_START: ['Date of start', 'Date of Start'],
  LOCATION: ['Location'],
  ADDRESS: ['Address'],
  STATUS: ['Account status', 'Account Status'],
  TILL_DATE_SUM: ['Till date sum', 'Till Date Sum']
};

// ─────────────────────────────────────────────────────────────
// IMAGE MAP  —  single lookup used by setupImageNames().
// Keys are either:
//   • book numbers  e.g. "E0039"  → matched exactly
//   • book titles   e.g. "Horrid Henry- Revenge" → matched by normalised title
// Values are "subfolder/filename.jpg" (only the filename part matters for Drive lookup).
// Run setupImageNames() once to write these to your sheet.
// ─────────────────────────────────────────────────────────────
const IMAGE_MAP = {
  "E0039": "When I feel Impatient.jpg",
  "E0040": "When I feel Bored.jpg",
  "E0042": "When I feel Jelous.jpg",
  "E0043": "When I feel Sad.jpg",
  "E0044": "When I feel Afraid.jpg",
  "E0058": "Disney- Belle and the perfect pearl.jpg",
  "E0061": "The bestChristmas ever.jpg",
  "E0063": "JM- All in one piece.jpg",
  "E0064": "JM- Mr. large in charge.jpg",
  "E0065": "JM- Five minutes peace.jpg",
  "E0066": "Gumboot_s chocolaty day.jpg",
  "E0067": "Whatever next.jpg",
  "E0068": "151 Akbar Birbal Stories_.jpg",
  "E0070": "Peppa pig sports day.jpg",
  "E0071": "151 Jungle tales.jpg",
  "E0074": "The lost shoe.jpg",
  "E0075": "Uncle Moon Forgets counting.jpg",
  "E0084": "When I feel greedy.jpg",
  "E0087": "Good night stories.jpg",
  "E0091": "Lions in a flap.jpg",
  "E0095": "Ganesha.jpg",
  "E0102": "The lazy donkey.jpg",
  "E0104": "One snowy nights.jpg",
  "E0105": "Paw patrol- Big city adventures.jpg",
  "E0108": "Grumpy badger_s chrismas.jpg",
  "E0109": "Padddington and the christmas surprise.jpg",
  "E0110": "Peppa_s first sleepover.jpg",
  "E0111": "Happy birthday Peppa.jpg",
  "E0113": "Posie the kitten pink.jpg",
  "E0114": "We love bunk beds.jpg",
  "E0115": "The cat in the hat.jpg",
  "E0119": "Big city kitty.jpg",
  "E0120": "Bright stanley.jpg",
  "E0121": "Little Rex.jpg",
  "E0124": "Jolly polly octopus.jpg",
  "E0125": "Paw patrol Pups save Ryder_s robot.jpg",
  "E0126": "Peppa pig The Tooth fairy.jpg",
  "E0127": "Peter Pebbles.jpg",
  "E0128": "Peppa pigs family computer.jpg",
  "E0129": "Disney- The pearl of wisdon.jpg",
  "E0130": "The station mouse.jpg",
  "E0132": "Paw patrol- Pups save the party.jpg",
  "E0135": "Paw patrol- All star pups.jpg",
  "E0136": "Mog_s bad thing.jpg",
  "E0137": "Scardy mouse.jpg",
  "E0138": "Harry and the bucketful of dinosour.jpg",
  "E0139": "The tallest mouse on the street.jpg",
  "E0140": "The children_s fete.jpg",
  "E0141": "Little Cariboue.jpg",
  "E0142": "Snow bears.jpg",
  "E0143": "Treasure Island.jpg",
  "E0144": "If I ran a dog show.jpg",
  "E0147": "Mr. Pusskins.jpg",
  "E0149": "Peppa pig- George and the noisy baby.jpg",
  "E0165": "Thomas and the train-The snowy special.jpg",
  "E0173": "Captain Wag and the pirate dog.jpg",
  "E0181": "ORT_Mums new hat.jpg",
  "E0185": "Oxford Reading Tree- Looking after gran.jpg",
  "E0193": "Princess evies ponies - winter (2).jpg",
  "E0198": "Mog and bunny.jpg",
  "E0199": "Wallace the fire dog.jpg",
  "E0201": "Oola the Owl who lost her Hoot.jpg",
  "E0213": "Jack and the beak stalk.jpg",
  "E0216": "The golden goose.jpg",
  "E0218": "The town mouse and the country mouse.jpg",
  "E0220": "Meddlesom polly.jpg",
  "E0222": "The wolf and the seven.jpg",
  "E0223": "The three billy goats.jpg",
  "E0225": "Cathy_s present.jpg",
  "E0227": "Two sqirrels.jpg",
  "E0235": "DK readers- spiderman.jpg",
  "E0236": "Charlie and Tess.jpg",
  "E0240": "Harry and the Dinosours first sleepover.jpg",
  "E0242": "Princess Evies Ponies- Ballet pony.jpg",
  "E0243": "Peppa_s fairy tale(1).jpg",
  "E0248": "So cozy.jpg",
  "E0257": "My dad the hero.jpg",
  "E0259": "Peppa meets father christamas.jpg",
  "E0269": "The other goose.jpg",
  "E0270": "Cheeky Monkey - not available.jpg",
  "E0276": "Miss Naughty worries Mr. worry.jpg",
  "E0279": "Miss bossy saves the zoo.jpg",
  "E0280": "Miss Lucky_s friend.jpg",
  "E0281": "Mr. Strong looks for a job.jpg",
  "E0283": "Mr.Nosey and the excellent idea.jpg",
  "E0286": "Mr. Silly gets the giggles.jpg",
  "E0287": "Mr. Happy at sports day.jpg",
  "E0290": "Little red tractor.jpg",
  "E0292": "Miss trouble changes colour.jpg",
  "E0293": "Harry and the dinosour_s say Raahh.jpg",
  "E0295": "Harry and the dinosour_s go wild.jpg",
  "E0312": "SM- Grandpas bag of stories.jpg",
  "E0313": "SM- How I taught my grandmothr to read.jpg",
  "E0316": "SM- The magical drum.jpg",
  "E0318": "DK readers- Fantastic four.jpg",
  "E0320": "DK readers- Avengers assemble.jpg",
  "E0321": "DK readers-X-men.jpg",
  "E0322": "DK readers- Amazing powers.jpg",
  "E0323": "Peppa pig Recycling fun.jpg",
  "E0329": "The Littlest Yak.jpg",
  "E0330": "DK readers-The infinite collection.jpg",
  "E0336": "The treasure hunt.jpg",
  "E0338": "Mr. bump.jpg",
  "E0339": "Mr. Nonsense.jpg",
  "E0341": "Mr. Chatterbox.jpg",
  "E0342": "Miss Somersault.jpg",
  "E0343": "Mr. Bounce.jpg",
  "E0344": "Miss christman.jpg",
  "E0345": "Mr. Busy.jpg",
  "E0347": "Mr. Good.jpg",
  "E0348": "Nelson.jpg",
  "E0349": "Grandads bench.jpg",
  "E0351": "Famous Five- Five go to Mystery moor.jpg",
  "E0353": "All together now (2).jpg",
  "E0368": "The Wizard of Oz.jpg",
  "E0389": "Famous Five- Half term adventure.jpg",
  "E0398": "Harruy and the Dinosours Christmas wish.jpg",
  "E0402": "Elmer and the tune.jpg",
  "E0406": "VT- Do it yourself.jpg",
  "E0408": "Elmer and wilbur.jpg",
  "E0416": "Mog and the fox night.jpg",
  "E0422": "Enid Blyton- Sneezing dog.jpg",
  "E0426": "Secret seven- Puzle for the SS.jpg",
  "E0427": "Enid Blyton- The Ship of advenure.jpg",
  "E0432": "Enid Blyton- The valley of adventure.jpg",
  "E0449": "Oliver Moons christmas cracker.jpg",
  "E0450": "Elmer and the wind.jpg",
  "E0456": "Diary of a Wimpy Kid- Rodrick rules.png",
  "E0460": "Oxford Reading Tree- Kipper and the giant.jpg",
  "E0462": "Tom Gates- Genuis Ideas.jpg",
  "E0463": "Judy Moody saves the world.jpg",
  "E0465": "RD- BFG.jpg",
  "E0466": "RD- Charlie and the great glass elevator.jpg",
  "E0467": "RD- Witches.jpg",
  "E0469": "Tom Gates- Tremendous Tales.jpg",
  "E0477": "Mog_s ABC.jpg",
  "E0478": "Peppa the mermaid.jpg",
  "E0493": "VS- Oh that_s rude.jpg",
  "E0500": "The Tabitha Stories.jpg",
  "E0502": "Little tigers big surprise.jpg",
  "E0505": "DW- Slime.jpg",
  "E0507": "DW- Grandpa_s great escape.jpg",
  "E0508": "DW- Mr. Stink.jpg",
  "E0509": "DW- The boy in the dress.jpg",
  "E0510": "DW- Awefull auntie.jpg",
  "E0512": "AC- Spy Dog.jpg",
  "E0513": "AC- Spy dog 2.jpg",
  "E0514": "DB- AniMalcolm.jpg",
  "E0515": "DB- Head Kid.jpg",
  "E0516": "DB- Taylor Turbochaser.jpg",
  "E0517": "DB- The person controller.jpg",
  "E0526": "Captain Underpants- Book 1.jpg",
  "E0527": "Captain Underpants- Book 2.jpg",
  "E0529": "Captain Underpants- Book 4.jpg",
  "E0530": "Captain Underpants- Book 5.jpg",
  "E0532": "Captain Underpants- Book 7.jpg",
  "E0534": "Captain Underpants- Book 9.jpg",
  "E0535": "Captain Underpants- Book 10.jpg",
  "E0537": "Captain Underpants- Book 12.jpg",
  "E0538": "Enid Blyton- Faraway tree adventure.jpg",
  "E0539": "Enid Blyton- First term Malory towers.jpg",
  "E0540": "Enid Blyton- Goodbye Malory towers.jpg",
  "E0541": "Enid Blyton- Mr. Icy Cold.jpg",
  "E0542": "Enid Blyton- Peter and the magic shadow.jpg",
  "E0543": "Famous Five- A lazy Afteroon.jpg",
  "E0544": "Enid Blyton- Tell a story Book.jpg",
  "E0545": "Enid Blyton- The Amelia Jane collection.jpg",
  "E0546": "Enid Blyton- The cherry tree farm.jpg",
  "E0547": "The Little Brown Bear.jpg",
  "E0548": "Enid Blyton- The Mistory of the invisible ink.jpg",
  "E0549": "Famous Five- George_s hair is too long.jpg",
  "E0551": "Enid Blyton- The wishing chair collection.jpg",
  "E0552": "Enid Blyton- The wishing chair -single story.jpg",
  "E0553": "Famous Five- Well done famous five.jpg",
  "E0554": "Funny stories for 5 years Old.jpg",
  "E0555": "Funny stories for 6 years Old.jpg",
  "E0556": "Funny stories for 7 years Old.jpg",
  "E0932": "Christopher_s Bicycles.jpg",
  "E0933": "Rivalry at Silver Spires.jpg",
  "E0936": "The runaway pancake.jpg",
  "E0938": "Frozen.jpg",
  "E0939": "Frozen 2.jpg",

  // ── Title-keyed entries (matched by normalised book title) ──
  // ── Horrid Henry ──────────────────────────────────────────
  "Horrid Henry- Revenge":            "Horrid Henry- Revenge.jpg",
  "Horrid Henry- Monster movie":      "Horrid Henry- Monster movie.jpg",
  "Horrid Henry- Gets rich quick":    "Horrid Henry- Gets rich quick.jpg",
  "Horrid Henry- Mega mean time machine": "Horrid Henry- Mega mean time machine.jpg",
  "Horrid Henry- Secret Club":        "Horrid Henry- Secret Club.jpg",
  "Horrid Henry- Double Dare":        "Horrid Henry- Double Dare.jpg",
  "Horrid Henry- Nightmare":          "Horrid Henry- Nightmare.jpg",
  "Horrid Henry- Tricks the tooth fairy": "Horrid Henry- Tricks the tooth fairy.jpg",
  "Horrid Henry- Robs the bank":      "Horrid Henry- Robs the bank.jpg",
  "Horrid Henry- Stinkbomb":          "Horrid Henry- Stinkbomb.jpg",
  "Horrid Henry- Meets the queen":    "Horrid Henry- Meets the queen.jpg",
  "Horrid Henry- Mummy_s curse":      "Horrid Henry- Mummy_s curse.jpg",
  "Horrid Henry- Wakes up dead":      "Horrid Henry- Wakes up dead.jpg",
  "Horrid Henry-  Nits":              "Horrid Henry-  Nits.jpg",
  "Horrid Henry- Football Friend":    "Horrid Henry- Football Friend.jpg",
  "Horrid Henry- The Football friend":"Horrid Henry- The Football friend.jpg",
  "Horrid Henry- Haunted House":      "Horrid Henry- Haunted House.jpg",
  "Horrid Henry- Christmas cracker":  "Horrid Henry- Christmas cracker.jpg",
  "Horrid Henry- Abominable snowman": "Horrid Henry- Abominable snowman.jpg",
  "Horrid Henry- Zombie Vampire":     "Horrid Henry- Zombie Vampire.jpg",
  "Horrid Henry- Horrid Joke book":   "Horrid Henry- Horrid Joke book.jpg",
  "Horrid Henry- Bogey Babysitter":   "Horrid Henry- Bogey Babysitter.jpg",
  "Horrid Henry- Joke Book":          "Horrid Henry- Joke Book.jpg",
  "Horrid Henry- Jolly Joke book":    "Horrid Henry- Jolly Joke book.jpg",
  "Horrid Henry- Favourite joke book":"Horrid Henry- Favourite joke book.jpg",

  // ── Holly Webb ────────────────────────────────────────────
  "HW- The forgotten puppy":          "HW- The forgotten puppy.jpg",
  "HW- Ginger thet stray Kitten":     "HW- Ginger thet stray Kitten.jpg",
  "HW- Lost in the snow":             "HW- Lost in the snow.jpg",
  "HW- Sky the unwanted Kitten":      "HW- Sky the unwanted Kitten.jpg",
  "HW- Harry the homeless puppy":     "HW- Harry the homeless puppy.jpg",
  "HW- Buttons the runaway puppy":    "HW- Buttons the runaway puppy.jpg",
  "HW- Lost in the storm":            "HW- Lost in the storm.jpg",
  "HW- The unwanted puppy":           "HW- The unwanted puppy.jpg",
  "HW- Ellie the homesick puppy":     "HW- Ellie the homesick puppy.jpg",

  // ── Jack Stalwart ─────────────────────────────────────────
  "JS- The puzzle of the missing panda": "JS- The puzzle of the missing panda.jpg",
  "JS- The search of the sunken treasure-Australia": "JS- The search of the sunken treasure-Australia.jpg",
  "JS- Danger on the frozen land Arctic": "JS- Danger on the frozen land Arctic.jpg",
  "JS- The peril at the grand Prix- Italy": "JS- The peril at the grand Prix- Italy.jpg",
  "JS- The theft of the samurai sword- Japan": "JS- The theft of the samurai sword- Japan.jpg",
  "JS- The mission to find max-Egypt": "JS- The mission to find max-Egypt.jpg",
  "JS- The quest of the aztec gold- Mexico": "JS- The quest of the aztec gold- Mexico.jpg",
  "JS- The caper of the crown Jewels- Great Bratain": "JS- The caper of the crown Jewels- Great Bratain.jpg",
  "JS- The escape of the deadly dinosour": "JS- The escape of the deadly dinosour.jpg",

  // ── Famous Five / Secret Seven / Enid Blyton ──────────────
  "Enid Blyton - Famous Five go adventuring again": "Enid Blyton - Famous Five go adventuring again.jpg",
  "Enid Blyton - Go ahead secret seven":            "Enid Blyton - Go ahead secret seven.jpg",
  "Enid Blyton - Three Cheers secret seven":        "Enid Blyton - Three Cheers secret seven.jpg",
  "Famous Five- Where are the secret seven":        "Famous Five- Where are the secret seven.jpg",
  "Enid Blyton- Five on Brexit Island":             "Enid Blyton- Five on Brexit Island.jpg",
  "Enid Blyton- Five go on astrategy away day":     "Enid Blyton- Five go on astrategy away day.jpg",
  "Enid Blyton- Five on a Treasure island":         "Enid Blyton- Five on a Treasure island.jpg",

  // ── Geronimo Stilton ──────────────────────────────────────
  "Geronimo-I am too fond of my fur":           "Geronimo-I am too fond of my fur.jpg",
  "Geronimo-Alien escape":                      "Geronimo-Alien escape.jpg",
  "Geronimo-Four mice deep in the jungle":      "Geronimo-Four mice deep in the jungle.jpg",

  // ── Tom Gates ─────────────────────────────────────────────
  "Tom gates Biscuits bands and big plans":      "Tom gates Biscuits bands and big plans.jpg",
  "Tom Gates- Happy to help":                    "Tom Gates- Happy to help.jpg",
  "Tom gates- A tiny bit lucky":                 "Tom gates- A tiny bit lucky.jpg",
  "Tom gates- Epic Adventure":                   "Tom gates- Epic Adventure.jpg",
  "Tom Gates- Spectacular School Trip":          "Tom Gates- Spectacular School Trip.jpg",
  "Tom Gates- Family Friends and Furry Creatures": "Tom Gates- Family Friends and Furry Creatures.jpg",
  "Tom Gates- Super Good Skills":                "Tom Gates- Super Good Skills.jpg",

  // ── Diary of a Wimpy Kid ──────────────────────────────────
  "Diary of a Wimpy Kid- The last straw":  "Diary of a Wimpy Kid- The last straw.jpg",
  "Diary of a Wimpy Kid- The cabin fever": "Diary of a Wimpy Kid- The cabin fever.jpg",
  "Diary of a Wimpy Kid- The Ugly truth":  "Diary of a Wimpy Kid- The Ugly truth.jpg",

  // ── David Walliams (DW) ───────────────────────────────────
  "DW- Gangsta Granny":                    "DW- Gangsta Granny.jpg",

  // ── Roald Dahl (RD) ───────────────────────────────────────
  "RD- The Twits":                         "RD-  The Twits.jpg",

  // ── Michael Morpurgo ──────────────────────────────────────
  "Michael Morpurgo- Adolphus Tips":            "Michael Morpurgo- Adolphus Tips.jpg",
  "Michael Morpurgo- The nine lives of Montezuma": "Michael Morpurgo- The nine lives of Montezuma.jpg",
  "Michael Morpurgo- Mr Nobody_s eyes":         "Michael Morpurgo- Mr Nobody_s eyes.jpg",

  // ── Other age 7-15 ────────────────────────────────────────
  "The world_s worst teachers":            "The world_s worst teachers.jpg",
  "The world_s worst Pets":               "The world_s worst Pets.jpg",
  "The world_s worst parents":            "The world_s worst parents.jpg",
  "Clanice Beans Spells trouble":          "Clanice Beans Spells trouble.jpg",
  "Clarice beans Dont look now":           "Clarice beans Dont look now.jpg",
  "Clarice beans utterly me":              "Clarice beans utterly me.jpg",
  "Moody Margaret strikes back":           "Moody Margaret strikes back.jpg",
  "How to steal a dragons sword":          "How to steal a dragons sword.jpg",
  "How to speak dragonese":                "How to speak dragonese.jpg",
  "Dork Diaries Pop star":                 "Dork Diaries Pop star.jpg",
  "The 65 story Treehouse":                "The 65 story Treehouse.jpg",
  "The 78 Story Treehouse":                "The 78 Story Treehouse.jpg",
  "The 91 story Treehouse":                "The 91 story Treehouse.jpg",
  "The Lost Island of Tamarind":           "The Lost Island of Tamarind.jpg",
  "The Lost Magician":                     "The Lost Magician.jpg",
  "The Mystery of the Smugglers Wreck":    "The Mystery of the Smugglers Wreck.jpg",
  "the lighthouse keepers Stories":        "the lighthouse keepers Stories.jpg",
  "PugSlay- The puppu place":              "PugSlay- The puppu place.jpg",
  "Racoon Rampage":                        "Racoon Rampage.jpg",
  "Judy Moody declares independence":      "Judy Moody declares independence.jpg",
  "Rivalry at Silver Spires":              "Rivalry at Silver Spires.jpg",
  "Jakes cave":                            "Jakes cave.jpg",
  "Jeremy strong- My brothers famous bottom gets crowned": "Jeremy strong- My brothers famous bottom gets crowned.jpg",
  "Jeremy strong- My brothers hot cross bottom": "Jeremy strong- My brothers hot cross bottom.jpg",
  "Space dog visits planet earth":         "Space dog visits planet earth.jpg",
  "Drawing together":                      "Drawing together.jpg",
  "Grandad_s medal":                       "Grandad_s medal.jpg",
  "Secret seven- well done secrete seven": "Secret seven- well done secrete seven.jpg",
  "Stories for 6 six year old":            "Stories for 6 six year old.jpg",

  // ── Oxford Reading Tree (ORT) ─────────────────────────────
  "Oxford Reading Tree- Bob bug":               "Oxford Reading Tree- Bob bug.jpg",
  "ORT Bob bug":                                "ORT Bob bug.jpg",
  "Oxford Reading Tree- Mums new hat":          "Oxford Reading Tree- Mums new hat.jpg",
  "Oxford Reading Tree- Looking after granny":  "Oxford Reading Tree- Looking after granny.jpg",
  "Oxford Reading Tree- Dads birthday":         "Oxford Reading Tree- Dads birthday.jpg",
  "Oxford Reading Tree- I can trick a tiger":   "Oxford Reading Tree- I can trick a tiger.jpg",
  "Oxford Reading Tree- Holiday in Japan":      "Oxford Reading Tree- Holiday in Japan.jpg",
  "Oxford Reading Tree- The Magic tree":        "Oxford Reading Tree- The Magic tree.jpg",
  "Oxford Reading Tree- The quest":             "Oxford Reading Tree- The quest.jpg",
  "Oxford Reading Tree- The Pancake":           "Oxford Reading Tree- The Pancake.jpg",
  "Oxford Reading Tree- Floppy and the bone":   "Oxford Reading Tree- Floppy and the bone.jpg",
  "Oxford Reading Tree- The palace statue":     "Oxford Reading Tree- The palace statue.jpg",
  "Oxford Reading Tree- Trapped":               "Oxford Reading Tree- Trapped.jpg",
  "Oxford Reading Tree- The Monster hunt":      "Oxford Reading Tree- The Monster hunt.jpg",
  "Oxford Reading Tree- Wet feet":              "Oxford Reading Tree- Wet feet.jpg",
  "Oxford Reading Tree- Drawing adventure":     "Oxford Reading Tree- Drawing adventure.jpg",
  "Oxford Reading Tree- Land of letters":       "Oxford Reading Tree- Land of letters.jpg",
  "Oxford Reading Tree- Egg Fried rice":        "Oxford Reading Tree- Egg Fried rice.jpg",
  "Oxford Reading Tree- Such a fuss":           "Oxford Reading Tree- Such a fuss.jpg",
  "Oxford Reading Tree- Craig saves the day":   "Oxford Reading Tree- Craig saves the day.jpg",
  "Oxford reading free-The bully":              "Oxford reading free-The bully.jpg",
  "Oxford Reading Tree- The Hairy scary monster": "Oxford Reading Tree- The Hairy scary monster.jpg",
  "Oxford Reading Tree- Ouch":                  "Oxford Reading Tree- Ouch.jpg",
  "Kipper collection":                          "Kipper collection.jpg",

  // ── Peppa Pig ─────────────────────────────────────────────
  "Peppa goes skiing":                     "Peppa goes skiing.jpg",
  "Peppa pig and the christmas elf":       "Peppa pig and the christmas elf.jpg",
  "Peppa Pig going swimming":              "Peppa Pig going swimming.jpg",
  "Peppa_s new neighbours":               "Peppa_s new neighbours.jpg",

  // ── Thomas the Train ──────────────────────────────────────
  "Thomas and James":                      "Thomas he train -Thomas and james.jpg",
  "Thomas he train -Trevor":               "Thomas he train -Trevor.jpg",
  "Thomas and the train-creeky cranky":    "Thomas and the train-creeky cranky.jpg",
  "Thomas and the train-Trevot":           "Thomas and the train-Trevot.jpg",

  // ── Disney ────────────────────────────────────────────────
  "Disney- 101 Dalmatians":               "Disney- 101 Dalmatians.jpg",

  // ── When I feel… ──────────────────────────────────────────
  "When I feel Jelous":                    "When I feel Jelous.jpg",
  "When I feel greedy":                    "When I feel greedy.jpg",
  "When I feel Impatient":                 "When I feel Impatient.jpg",
  "When I feel angry":                     "When I feel angry.jpg",

  // ── Mr. Men / Miss... ─────────────────────────────────────
  "Mr. Men":                               "Mr. Men.jpg",
  "Mr Men and Little Miss Treasury":       "Mr Men and Little Miss Treasury.jpg",
  "Mr. Miss Busy":                         "Miss Busy.jpg",
  "Miss contrary":                         "Miss contrary.jpg",
  "Miss trouble changes colour":           "Miss trouble changes colour.jpg",
  "Theprincess ballet":                    "Theprincess ballet.jpg",

  // ── DK Readers ────────────────────────────────────────────
  "DK readers- Avengers":                  "DK readers- Avengers.jpg",
  "DK readers- Thor":                      "DK readers- Thor.jpg",
  "Avengers":                              "Avengers.jpg",
  "Spider-man":                            "Spider-man.jpg",

  // ── age-2-5 misc (new) ────────────────────────────────────
  "Splish Splash Sploosh":                 "Splish Splash Sploosh.jpg",
  "The hungry Otter":                      "The hungry Otter.jpg",
  "DP- Go away":                           "DP- Go away.jpg",
  "DP- It is mine":                        "DP- It is mine.jpg",
  "Harry the highlander":                  "Harry the highlander.jpg",
  "What Mona wants Mona wants":           "What Mona wants Mona wants.jpg",
  "short stories":                         "short stories.jpg",
  "Here comes the crocodile":              "Here comes the crocodile.jpg",
  "Itchy itch itch":                       "Itchy itch itch.jpg",
  "tom and jerry":                         "tom and jerry.jpg",
  "Teddy finds a treasure":                "Teddy finds a treasure.jpg",
  "Happy birthday 3":                      "Happy birthday 3.jpg",
  "Where_s santa_s reindeer":             "Where_s santa_s reindeer.jpg",
  "Boris goes camping":                    "Boris goes camping.jpg",
  "When I grow up":                        "When I grow up.jpg",
  "Shiva":                                 "Shiva.jpg",
  "Recycling fun":                         "Recycling fun.jpg",
  "The bunny bluebell hill":               "The bunny bluebell hill.jpg",
  "Milly and the mermaids":               "Milly and the mermaids.jpg",
  "Chimp with a limp":                     "Chimp with a limp.jpg",
  "Thomas and the train-creeky cranky":    "Thomas and the train-creeky cranky.jpg",

  // ── age-2-5 misc (existing) ───────────────────────────────
  "Elmer again":                           "Elmer again.jpg",
  "Elmer and the stranger":                "Elmer and the stranger.jpg",
  "Down by the cool of the pool":          "Down by the cool of the pool.jpg",
  "Urso Brunov":                           "Urso Brunov.jpg",
  "Mog_s christmas":                      "Mog_s christmas.jpg",
  "Where_s wally the wonder book":        "Where_s wally the wonder book.jpg",
  "Where_s wally the fantastic journey":  "Where_s wally the fantastic journey.jpg",
  "Where_s wally the great picture book": "Where_s wally the great picture book.jpg",
  "Handa_s surprising day":               "Handa_s surprising day.jpg",
  "Teddy Bears Picnic":                    "Teddy Bears Picnic.jpg",
  "The Walloos Big Adventure":             "The Walloos Big Adventure.jpg",
  "Unicorns in Uniforms":                  "Unicorns in Uniforms.jpg",
  "Magnificient Millie":                   "Magnificent Millie.jpg",
  "Luna loves gardening":                  "Luna loves gardening.jpg",
  "Elfa and the box of memories":          "Elfa abd the box of memories.jpg",
  "My friend Grandad":                     "My friend Grandad.jpg",
  "Where_s the unicorn":                  "Where_s the unicorn.jpg",
  "Where_s the sloth":                    "Where_s the sloth.jpg",
  "Where_s the bunny":                    "Where_s the bunny.jpg",
  "The Bunny of Blueberry Hill":           "The Bunny of Blueberry Hill.jpg",
  "Bug in a rug":                          "Bug in a rug.jpg",
  "Dogs day off":                          "Dogs day off.jpg",
  "Happy I am a Hippo":                    "Happy I am a Hippo.jpg",
  "Marchello mouse":                       "Marchello mouse.jpg",
  "5 min bunny tales":                     "5 min bunny tales.jpg",
  "Jacks Little party":                    "Jacks Little party.jpg",
  "Night Flight":                          "Night Flight.jpg",
  "Mac and lauren":                        "Mac and lauren.jpg",
  "Captain America":                       "Captain America.jpg",
  "Small stories":                         "Small stories.jpg",
  "Frozen":                                "Frozen.jpg",
  "Frozen 2":                              "Frozen 2.jpg",
  "Gurraffe in the bath":                  "Gurraffe in the bath.jpg",
  "The very uglu bug":                     "The very uglu bug.jpg",
  "The very sleepy sloth":                 "The very sleepy sloth.jpg",
  "Jack digger helps out":                 "Jack digger helps out.jpg",
  "Princess evie sand pony":               "Princess evie sand pony.jpg",
  "Princess Evie Snow ponie":              "Princess Evie Snow ponie.jpg",
  "Princess evies ponies - sea pony":      "Princess evies ponies - sea pony.jpg",
  "Princess Evies Ponies - Winter":        "Princess Evies Ponies - Winter.jpg",
  "Michael Morpurgo-Escape from ShangriLa": "Michael Morpurgo-Escape from ShangriLa.jpg",
  "VS- What a team":                       "VS- What a team.jpg",
  "Dragon gets by":                        "Dragon gets by.jpg",
  "Norman and the runaway cow":            "Norman and the runaway cow.jpg",
  "Mr. Nosey and the beanstalk":           "Mr. Nosey and the beanstalk.jpg",
  "Spots bedtime book":                    "Spots bedtime book.jpg",
  "Pooh_s grand adventure":              "Pooh_s grand adventure.jpg",
  "The enchanted tree":                    "The enchanted tree.jpg",
  "Ganesha":                               "Ganesha.jpg",
  "Drawing together":                      "Drawing together.jpg"
};

// ─────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('K for Kids Books Library')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ─────────────────────────────────────────────
// ONE-TIME SETUP: Run this from the Apps Script editor
// to write the "Image Name" column into your book source sheet.
// ─────────────────────────────────────────────

function setupImageNames() {
  const { sheet, headerRow, columns } = getSheetAndHeader_();
  const data = sheet.getDataRange().getValues();

  // Ensure "Image Name" header exists
  if (!trim_(data[headerRow][columns.IMAGE_NAME])) {
    sheet.getRange(headerRow + 1, columns.IMAGE_NAME + 1).setValue(MASTER_HEADERS.IMAGE_NAME);
  }

  // Build a normalised-title lookup from IMAGE_MAP (covers both bookNo and title keys)
  const titleMap = {};
  for (const [key, val] of Object.entries(IMAGE_MAP)) {
    titleMap[key.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()] = val;
  }

  let updated = 0;
  const updates = [];

  for (let i = headerRow + 1; i < data.length; i++) {
    const bookNo   = trim_(data[i][columns.BOOK_NO]);
    const bookName = trim_(data[i][columns.BOOK_NAME]);
    if (!bookNo) continue;

    const existing = trim_(data[i][columns.IMAGE_NAME]);
    if (existing) continue; // don't overwrite existing entries

    // 1. Exact bookNo match, 2. Normalised title match
    let imagePath = IMAGE_MAP[bookNo] || '';
    if (!imagePath) {
      const nKey = bookName.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      imagePath = titleMap[nKey] || '';
    }

    if (imagePath) {
      updates.push({ row: i + 1, value: imagePath });
      updated++;
    }
  }

  // Batch-write for performance
  updates.forEach(u => {
    sheet.getRange(u.row, columns.IMAGE_NAME + 1).setValue(u.value);
  });

  // Clear cache so image URLs get rebuilt
  CacheService.getScriptCache().remove(IMAGE_CACHE_KEY);

  Logger.log('✅ setupImageNames: wrote image names for ' + updated + ' books.');
  return { success: true, updated, message: 'Image names written for ' + updated + ' books.' };
}

/**
 * Phase 1 setup/migration. Safe to run more than once.
 *
 * Creates Customer Details in the new WebApp Data spreadsheet, copies legacy
 * Customer DB rows, and adds reservation ownership support to Books-DB.
 * Existing legacy sheets are read-only in this phase.
 */
function setupCustomerReservationSystem(adminCredential, options) {
  try {
    if (!canRunSetup_(adminCredential)) {
      return { success: false, error: 'Setup is restricted to the spreadsheet owner or an active admin session.' };
    }

    const now = new Date();
    const summary = {
      success: true,
      createdSheets: [],
      addedColumns: [],
      copiedCustomers: 0,
      updatedCustomers: 0,
      generatedCustomerIds: 0,
      generatedInviteCodes: 0,
      inviteCodes: [],
      messages: []
    };

    const targetSs = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const legacySs = SpreadsheetApp.openById(CONFIG.LEGACY_SPREADSHEET_ID);

    const booksResult = ensureBooksReservationOwnerColumn_(targetSs);
    if (booksResult.added) summary.addedColumns.push(CONFIG.MASTER_SHEET_NAME + ': reservation linkage columns');

    const customerDetails = ensureSheetWithHeaders_(
      targetSs,
      CONFIG.CUSTOMER_DETAILS_SHEET_NAME,
      CUSTOMER_DETAILS_HEADERS,
      summary
    );
    const customerSetup = migrateLegacyCustomers_(legacySs, customerDetails.sheet, customerDetails.headerRow, now);
    summary.copiedCustomers = customerSetup.copiedCustomers;
    summary.updatedCustomers = customerSetup.updatedCustomers;
    summary.generatedCustomerIds = customerSetup.generatedCustomerIds;
    summary.generatedInviteCodes = customerSetup.generatedInviteCodes;
    summary.inviteCodes = customerSetup.inviteCodes;

    summary.messages.push('Legacy Customer DB was read only and not modified.');
    summary.messages.push('Live reservations use Books-DB only.');
    return summary;
  } catch (err) {
    return reportError_('setupCustomerReservationSystem', err, adminCredential);
  }
}

// ─────────────────────────────────────────────
// Public API (called via google.script.run)
// ─────────────────────────────────────────────

// ── Public books cache (chunked, 5-min TTL) ───────────────────────────────────
const BOOKS_CACHE_KEY   = 'PUBLIC_BOOKS_MASTER_HEADERS_IMAGES_DISPLAY_V1';
const IMAGE_CACHE_KEY   = 'BOOK_IMAGE_MAP_MASTER_HEADERS_V2';
const BOOKS_CACHE_SECS  = 300; // 5 minutes
const CHUNK_SIZE        = 90000; // bytes per CacheService entry (limit 100 KB)
const ADMIN_SESSION_SECS = 7200; // 2 hours
const CUSTOMER_SESSION_SECS = 21600; // 6 hours, CacheService max TTL

// Non-logged-in (anonymous) visitors see only a preview of the catalog. The full
// collection is gated behind login/registration. This keeps the anonymous page
// light (we never ship ~2000 rows to a non-member's browser) and gives people a
// concrete reason to sign in. Logged-in customers and admins always see all books.
const ANON_BOOK_LIMIT = 50;

function getCachedPublicBooks_() {
  const cache  = CacheService.getScriptCache();
  const meta   = cache.get(BOOKS_CACHE_KEY + '_META');
  if (!meta) return null;
  const chunks = parseInt(meta, 10);
  let json = '';
  for (let i = 0; i < chunks; i++) {
    const part = cache.get(BOOKS_CACHE_KEY + '_' + i);
    if (!part) return null;
    json += part;
  }
  try { return JSON.parse(json); } catch(e) { return null; }
}

function setCachedPublicBooks_(books) {
  const cache = CacheService.getScriptCache();
  const json  = JSON.stringify(books);
  const total = Math.ceil(json.length / CHUNK_SIZE);
  const pairs = { [BOOKS_CACHE_KEY + '_META']: String(total) };
  for (let i = 0; i < total; i++) {
    pairs[BOOKS_CACHE_KEY + '_' + i] = json.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
  }
  cache.putAll(pairs, BOOKS_CACHE_SECS);
}

function invalidatePublicBooksCache_() {
  const cache = CacheService.getScriptCache();
  const meta  = cache.get(BOOKS_CACHE_KEY + '_META');
  if (!meta) return;
  const chunks = parseInt(meta, 10);
  const keys   = [BOOKS_CACHE_KEY + '_META'];
  for (let i = 0; i < chunks; i++) keys.push(BOOKS_CACHE_KEY + '_' + i);
  cache.removeAll(keys);
}
// ─────────────────────────────────────────────────────────────────────────────

function getBooks(filters, adminCredential, customerToken) {
  try {
    resetRequestCache_();
    const isAdmin = adminCredential ? verifyAdminCredential_(adminCredential) : false;
    const currentCustomer = customerToken ? verifyCustomerSession_(customerToken) : null;
    // Anonymous = neither admin nor a logged-in customer. Anonymous visitors get
    // a capped preview of the catalog; everyone signed in sees the full list.
    const isAnonymous = !isAdmin && !currentCustomer;

    // Serve public books from cache when possible (admin always bypasses cache).
    // The cache holds the FULL public list; anonymous responses are capped on the
    // way out via anonBooksResponse_ so the preview limit is applied consistently
    // whether we hit the cache or rebuild from the sheet.
    if (!isAdmin && !customerToken && !filters) {
      const cached = getCachedPublicBooks_();
      if (cached) return anonBooksResponse_(cached);
    }

    const { sheet, headerRow, columns } = getSheetAndHeader_();
    const linkColumns = getExistingBookReservationLinkColumns_(sheet, headerRow);
    const visibilityColumn = getBookVisibilityColumn_(sheet, headerRow);
    const issueColumns = getBookIssueColumns_(sheet, headerRow);
    const range    = sheet.getDataRange();
    const displayData = range.getDisplayValues();
    // Raw values for the reservation timestamps — needed so we can format them
    // with time (to the second), not just the sheet's date-only cell display.
    // Read them for admins AND logged-in customers (a customer may see the time
    // on their OWN reservation); not needed for anonymous public visitors.
    const needsRaw = isAdmin || Boolean(currentCustomer);
    const rawData  = needsRaw ? range.getValues() : null;
    const tz       = Session.getScriptTimeZone();
    // Build the image map if the cache is cold so the FIRST getBooks already
    // returns image URLs — avoids the "load once without images, reload with
    // images" flash. The Drive scan only runs on a cold cache (30-min TTL);
    // warm requests are cache hits, and the public books result is cached with
    // the URLs baked in so later visitors get them for free.
    const imageMap = getImageMap_();

    const books = [];
    for (let i = headerRow + 1; i < displayData.length; i++) {
      const displayRow = displayData[i];
      const bookNo     = trim_(displayRow[columns.BOOK_NO]);
      if (!bookNo)  continue;

      // Visibility: hidden books are shown only to admins (with a Hidden badge).
      const hidden = visibilityColumn !== -1 && isBookHidden_(displayRow[visibilityColumn]);
      if (hidden && !isAdmin) continue;

      const language   = trim_(displayRow[columns.LANGUAGE]);
      const ageGroup   = trim_(displayRow[columns.AGE_GROUP]);
      const bookName   = trim_(displayRow[columns.BOOK_NAME]);
      const category   = trim_(displayRow[columns.CATEGORY]);
      const issuedTo   = trim_(displayRow[columns.ISSUED_TO]);
      const author     = trim_(displayRow[columns.AUTHOR]);
      const reservationId = linkColumns.reservationId === -1 ? '' : trim_(displayRow[linkColumns.reservationId]);
      const reservedCustomerId = linkColumns.reservedCustomerId === -1 ? '' : trim_(displayRow[linkColumns.reservedCustomerId]);
      const reservedCustomerName = linkColumns.reservedCustomerName === -1 ? '' : trim_(displayRow[linkColumns.reservedCustomerName]);
      // Admin sees full date+time; these fields aren't sent to non-admins anyway.
      const reservedAt = (rawData && linkColumns.reservedAt !== -1)
        ? formatDateTime_(rawData[i][linkColumns.reservedAt], tz) : '';
      const reservationUpdatedAt = (rawData && linkColumns.reservationUpdatedAt !== -1)
        ? formatDateTime_(rawData[i][linkColumns.reservationUpdatedAt], tz) : '';

      // Issue tracking (customer-linked).
      const issuedCustomerId = issueColumns.issuedCustomerId === -1 ? '' : trim_(displayRow[issueColumns.issuedCustomerId]);
      const issuedAtRaw = (rawData && issueColumns.issuedAt !== -1) ? rawData[i][issueColumns.issuedAt] : '';
      const dueDateRaw  = (rawData && issueColumns.dueDate !== -1) ? rawData[i][issueColumns.dueDate] : '';
      const isMyIssue = Boolean(
        currentCustomer && currentCustomer.customerId && issuedCustomerId === currentCustomer.customerId
      );
      let overdue = false;
      if (dueDateRaw) {
        const due = new Date(dueDateRaw);
        if (!isNaN(due.getTime()) && due.getTime() < Date.now()) overdue = true;
      }

      let status = trim_(displayRow[columns.STATUS]);
      if (!status) status = issuedTo ? 'Issued' : 'Available';
      const effectiveReservationId = reservationId;
      const effectiveReservedCustomerId = reservedCustomerId;
      const isMyReservation = Boolean(
        currentCustomer &&
        currentCustomer.customerId &&
        reservedCustomerId === currentCustomer.customerId
      );

      if (filters) {
        if (filters.language && language.toLowerCase() !== filters.language.toLowerCase()) continue;
        if (filters.status   && status.toLowerCase()   !== filters.status.toLowerCase())   continue;
        if (filters.search) {
          const q = filters.search.toLowerCase();
          if (!bookName.toLowerCase().includes(q) &&
              !author.toLowerCase().includes(q)   &&
              !bookNo.toLowerCase().includes(q))  continue;
        }
      }

      books.push({
        rowIndex: i + 1,
        srNo: displayRow[columns.SR_NO],
        language, bookNo, bookName, author, ageGroup, category,
        status,
        imageUrl:   imageMap[bookNo] || '',
        // Admin-only fields — empty string for non-admin (never reveal who
        // reserved a book, or when, to OTHER customers).
        issuedTo:   isAdmin ? issuedTo   : '',
        reservedBy: isAdmin ? reservedCustomerName : '',
        // reservedAt goes to the admin AND the owner (so they can see when they
        // reserved it), but never to other customers.
        reservedAt: (isAdmin || isMyReservation) ? reservedAt : '',
        reservationUpdatedAt: isAdmin ? reservationUpdatedAt : '',
        phone:      '',
        issueDate:  '',
        notes:      '',
        reservationId: isAdmin || isMyReservation ? effectiveReservationId : '',
        reservedCustomerId: isAdmin || isMyReservation ? effectiveReservedCustomerId : '',
        isMyReservation,
        // Admin-only: whether this book is hidden from end users.
        hidden: isAdmin ? hidden : false,
        // Issue tracking — admin sees full details; the borrower sees their own.
        issuedCustomerId: isAdmin ? issuedCustomerId : '',
        issuedAt: (isAdmin || isMyIssue) ? formatDateTime_(issuedAtRaw, tz) : '',
        dueDate:  (isAdmin || isMyIssue) ? formatDate_(dueDateRaw, tz) : '',
        isMyIssue,
        overdue:  (isAdmin || isMyIssue) ? overdue : false
      });
    }

    // Cache the FULL public result for future visitors (capping happens on the
    // way out, so the cache stays a complete snapshot).
    if (!isAdmin && !customerToken && !filters) {
      try { setCachedPublicBooks_(books); } catch(e) { /* non-fatal */ }
    }

    if (isAnonymous) return anonBooksResponse_(books);
    return { success: true, books };
  } catch (err) {
    return reportError_('getBooks', err, adminCredential);
  }
}

/**
 * Build the getBooks response for an anonymous visitor: show a RANDOM sample of
 * ANON_BOOK_LIMIT books that HAVE a cover image (never the blank-cover ones), so
 * the preview always looks good and changes between visits. Books without an
 * image are excluded from the anonymous preview entirely. The cached public list
 * is the full set; the filter + random pick happen here on each call.
 */
function anonBooksResponse_(books) {
  const list = Array.isArray(books) ? books : [];
  const withImage = list.filter(b => b && b.imageUrl);
  const total = withImage.length;
  const capped = total > ANON_BOOK_LIMIT;
  return {
    success: true,
    books: capped ? randomSample_(withImage, ANON_BOOK_LIMIT) : randomSample_(withImage, total),
    totalCount: total,
    capped: capped,
    previewLimit: ANON_BOOK_LIMIT
  };
}

/**
 * Return a random sample of `count` items from `list` (partial Fisher–Yates on a
 * shallow copy, so the source array is not mutated).
 */
function randomSample_(list, count) {
  const arr = list.slice();
  const n = Math.min(count, arr.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (arr.length - i));
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr.slice(0, n);
}

function warmImageCache() {
  try {
    const imageMap = getImageMap_();
    invalidatePublicBooksCache_();
    return { success: true, imageCount: Object.keys(imageMap).length };
  } catch (err) {
    return reportError_('warmImageCache', err);
  }
}

function reserveBook(bookNo, subscriberName, phone, notes) {
  try {
    resetRequestCache_();
    if (!checkRateLimit_('reserve-book', 5, 300)) {
      return { success: false, error: rateLimitMessage_('Too many reservation attempts.') };
    }
    if (!bookNo || !subscriberName) return { success: false, error: 'Book number and your name are required.' };

    subscriberName = trim_(subscriberName);
    phone          = trim_(phone);
    notes          = trim_(notes);

    if (subscriberName.length > 100) return { success: false, error: 'Name is too long.' };
    if (phone.length > 40)           return { success: false, error: 'Phone number is too long.' };
    if (notes.length > 500)          return { success: false, error: 'Notes are too long.' };

    const lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      // PERF: locate the single book row with TextFinder (1 row read, not the
      // whole sheet), verify inside the lock, write once.
      const ctx = getSheetAndHeader_();
      const sheet = ctx.sheet, headerRow = ctx.headerRow, columns = ctx.columns;
      const linkColumns = getBookReservationLinkColumns_(sheet, headerRow);

      const bookRowNumber = findDataRowByExactValue_(sheet, headerRow, columns.BOOK_NO, bookNo);
      if (!bookRowNumber) return { success: false, error: 'Book not found.' };

      const bookRow  = getSheetRowValues_(sheet, bookRowNumber);
      const status   = trim_(bookRow[columns.STATUS]);
      const issuedTo = trim_(bookRow[columns.ISSUED_TO]);
      if (issuedTo || (status && status !== 'Available')) {
        return {
          success: false,
          code: 'UNAVAILABLE',
          error: 'Sorry, this book is no longer available.',
          bookNo: trim_(bookNo),
          status: issuedTo ? 'Issued' : (status || 'Reserved')
        };
      }

      const now = new Date();
      const reservationId = createReservationId_();

      bookRow[columns.STATUS] = 'Reserved';
      bookRow[linkColumns.reservationId] = reservationId;
      bookRow[linkColumns.reservedCustomerId] = '';
      bookRow[linkColumns.reservedCustomerName] = subscriberName;
      bookRow[linkColumns.reservedAt] = now;
      bookRow[linkColumns.reservationUpdatedAt] = now;
      setSheetRowValues_(sheet, bookRowNumber, bookRow);

      invalidatePublicBooksCache_();
      return { success: true, message: '✅ Book reserved! We will contact you when it\'s ready.', reservationId };
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return reportError_('reserveBook', err);
  }
}

function reserveBookForCustomer(bookNo, customerToken) {
  const __t0 = Date.now();
  const __lap = (label) => Logger.log('[PERF reserveBookForCustomer] ' + label + ': +' + (Date.now() - __t0) + 'ms');
  try {
    resetRequestCache_();
    if (!checkRateLimit_('customer-reserve-book', 8, 300)) {
      return { success: false, error: rateLimitMessage_('Too many reservation attempts.') };
    }
    __lap('rateLimit');

    const sessionCustomer = verifyCustomerSession_(customerToken);
    if (!sessionCustomer) return { success: false, error: 'Please log in to reserve a book.' };
    __lap('sessionVerify');

    // PERF: use the session-cached customer for the limit check — NO Customer-
    // Details sheet open on the hot path. The session already carries
    // accountStatus, monthlyReservationLimit and activeReservationCount.
    let customer = sessionCustomer;

    if (trim_(customer.accountStatus).toLowerCase() !== 'active') {
      // The session snapshot can lag behind an admin approval (sessions live up
      // to 6h). Before rejecting, re-read the authoritative row from the sheet —
      // if the admin has since approved this customer, refresh the session and
      // let the reservation proceed. This is off the hot path (only pending /
      // inactive customers pay this cost).
      const context = getCustomerRowContextById_(customer.customerId);
      if (context && trim_(context.customer.accountStatus).toLowerCase() === 'active') {
        customer = context.customer;
        sessionCustomer.accountStatus = customer.accountStatus;
        sessionCustomer.subscriptionStatus = customer.subscriptionStatus;
        sessionCustomer.subscriptionPlan = customer.subscriptionPlan;
        sessionCustomer.monthlyReservationLimit = customer.monthlyReservationLimit;
        persistSession_(customerToken, sessionCustomer);
      } else {
        return { success: false, error: 'Your account is pending approval. You can reserve books once the library admin activates your subscription.' };
      }
    }

    const monthlyLimit = parseMonthlyReservationLimit_(customer);
    if (!monthlyLimit) {
      return { success: false, error: 'Monthly reservation limit is not set for your account. Please contact the library admin.' };
    }

    // PERF (Option A): the limit check reads the customer's reservation list
    // straight from the session cache — NO Books-DB scan. Only a cold session
    // (no cached list) triggers a one-time scan that then populates the cache.
    //
    // Correctness: this list is only a POLICY gate (how many books you may hold)
    // and the modal display. It never guards a book's availability — that is
    // enforced under the lock with a fresh read on every write.
    const sessionReservations = getSessionReservations_(customerToken, sessionCustomer);
    const activeReservationCount = sessionReservations.length;
    __lap('limitCheck');
    if (activeReservationCount >= monthlyLimit) {
      // Served entirely from cache — the "unreserve one" list included.
      __lap('LIMIT_REACHED_DONE (from session cache)');
      return {
        success: false,
        code: 'LIMIT_REACHED',
        error: 'You already have ' + activeReservationCount + ' active reservation(s). Please unreserve one before reserving another book.',
        monthlyLimit,
        activeReservationCount,
        reservations: sessionReservations
      };
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(5000);
    __lap('lockAcquired');
    try {
      // PERF: locate the single book row with TextFinder (reads 1 row, not the
      // whole ~2000-row sheet) and read just that row inside the lock.
      const ctx = getSheetAndHeader_();
      const sheet = ctx.sheet, headerRow = ctx.headerRow, columns = ctx.columns;
      const linkColumns = getBookReservationLinkColumns_(sheet, headerRow);
      __lap('linkColumns');

      const bookRowNumber = findDataRowByExactValue_(sheet, headerRow, columns.BOOK_NO, bookNo);
      if (!bookRowNumber) return { success: false, error: 'Book not found.' };
      const bookRow = getSheetRowValues_(sheet, bookRowNumber);
      __lap('bookRowRead');

      const now = new Date();
      const status = trim_(bookRow[columns.STATUS]);
      const issuedTo = trim_(bookRow[columns.ISSUED_TO]);
      if (issuedTo || (status && status !== 'Available')) {
        return {
          success: false,
          code: 'UNAVAILABLE',
          error: 'Sorry, this book is no longer available.',
          bookNo: trim_(bookNo),
          status: issuedTo ? 'Issued' : (status || 'Reserved')
        };
      }

      const normalizedBookNo = trim_(bookNo);
      const bookName = trim_(bookRow[columns.BOOK_NAME]);
      const reservationId = createReservationId_();

      bookRow[columns.STATUS] = 'Reserved';
      bookRow[linkColumns.reservationId] = reservationId;
      bookRow[linkColumns.reservedCustomerId] = customer.customerId;
      bookRow[linkColumns.reservedCustomerName] = customer.name;
      bookRow[linkColumns.reservedAt] = now;
      bookRow[linkColumns.reservationUpdatedAt] = now;
      setSheetRowValues_(sheet, bookRowNumber, bookRow);
      __lap('rowWritten');

      // Option A: update the session reservation index only (keeps the count
      // exact in-memory). We do NOT write the count to Customer-Details on the
      // hot path — that ~700ms sheet-open is off the critical path now that the
      // limit check reads from the session cache. The sheet column reconciles
      // lazily via getMyReservations; a cold session rebuilds from a scan, not
      // from that column, so a stale column is harmless.
      addSessionReservation_(customerToken, sessionCustomer, {
        reservationId, bookNo: normalizedBookNo, bookName
      });
      __lap('sessionUpdated');

      invalidatePublicBooksCache_();
      __lap('cacheInvalidated_DONE');
      return {
        success: true,
        message: '✅ Book reserved for ' + customer.name + '.',
        reservationId,
        bookNo: normalizedBookNo,
        reservedCustomerId: customer.customerId,
        status: 'Reserved'
      };
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return reportError_('reserveBookForCustomer', err);
  }
}

function getMyReservations(customerToken) {
  const __t0 = Date.now();
  const __lap = (label) => Logger.log('[PERF getMyReservations] ' + label + ': +' + (Date.now() - __t0) + 'ms');
  try {
    resetRequestCache_();
    const sessionCustomer = verifyCustomerSession_(customerToken);
    if (!sessionCustomer) return { success: false, error: 'Please log in first.' };
    __lap('sessionVerify');

    // Option A reconcile point: this is the ONE place we do an authoritative
    // Books-DB scan and refresh the session cache + durable count from truth.
    const reservations = getActiveReservationsForCustomer_(sessionCustomer.customerId);
    __lap('booksScan(' + reservations.length + ' reservations)');
    setSessionReservations_(customerToken, sessionCustomer, reservations);
    adjustCustomerActiveReservationCountByIdTo_(sessionCustomer.customerId, reservations.length);
    __lap('countPersisted_DONE');

    return {
      success: true,
      monthlyLimit: parseMonthlyReservationLimit_(sessionCustomer),
      reservations
    };
  } catch (err) {
    return reportError_('getMyReservations', err);
  }
}

function debugMyReservationForBook(bookNo, customerToken) {
  try {
    const customer = verifyCustomerSession_(customerToken);
    const result = {
      success: true,
      hasCustomerSession: Boolean(customer),
      customerId: customer ? customer.customerId : '',
      bookNo: trim_(bookNo),
      normalizedBookKey: reservationBookKey_(bookNo),
      booksDb: {},
      activeReservations: []
    };
    if (!customer) return result;

    const { sheet, headerRow, columns } = getSheetAndHeader_();
    const linkColumns = getExistingBookReservationLinkColumns_(sheet, headerRow);
    const bookRowNumber = findDataRowByExactValue_(sheet, headerRow, columns.BOOK_NO, bookNo);
    result.booksDb.rowNumber = bookRowNumber || '';
    result.booksDb.hasReservationIdColumn = linkColumns.reservationId !== -1;
    result.booksDb.hasReservedCustomerIdColumn = linkColumns.reservedCustomerId !== -1;
    if (bookRowNumber) {
      const row = getSheetRowValues_(sheet, bookRowNumber);
      result.booksDb.bookNo = trim_(row[columns.BOOK_NO]);
      result.booksDb.status = trim_(row[columns.STATUS]);
      result.booksDb.reservationId = linkColumns.reservationId === -1 ? '' : trim_(row[linkColumns.reservationId]);
      result.booksDb.reservedCustomerId = linkColumns.reservedCustomerId === -1 ? '' : trim_(row[linkColumns.reservedCustomerId]);
    }

    result.activeReservations = getActiveReservationsForCustomer_(customer.customerId).map(reservation => ({
      reservationId: reservation.reservationId,
      bookNo: reservation.bookNo,
      normalizedBookKey: reservationBookKey_(reservation.bookNo),
      bookName: reservation.bookName,
      status: reservation.status
    }));
    result.matchFromBookReservations = result.activeReservations.some(reservation => reservation.normalizedBookKey === result.normalizedBookKey);
    return result;
  } catch (err) {
    Logger.log('debugMyReservationForBook error: ' + (err && err.stack ? err.stack : err));
    return {
      success: false,
      error: 'Debug failed.',
      debugError: err && err.message ? err.message : String(err),
      debugStack: err && err.stack ? String(err.stack) : ''
    };
  }
}

function unreserveMyBook(reservationId, customerToken, bookNo) {
  const __t0 = Date.now();
  const __lap = (label) => Logger.log('[PERF unreserveMyBook] ' + label + ': +' + (Date.now() - __t0) + 'ms');
  try {
    resetRequestCache_();
    const sessionCustomer = verifyCustomerSession_(customerToken);
    if (!sessionCustomer) return { success: false, error: 'Please log in first.' };
    reservationId = trim_(reservationId);
    if (!reservationId) return { success: false, error: 'Reservation ID is required.' };
    __lap('sessionVerify');

    const lock = LockService.getScriptLock();
    lock.waitLock(5000);
    __lap('lockAcquired');
    try {
      // PERF: locate the single row with TextFinder (by bookNo when provided,
      // else by reservationId) — reads 1 row, not the whole sheet.
      const ctx = getSheetAndHeader_();
      const sheet = ctx.sheet, headerRow = ctx.headerRow, columns = ctx.columns;
      const linkColumns = getBookReservationLinkColumns_(sheet, headerRow);
      __lap('linkColumns');

      const bookRowNumber = bookNo
        ? findDataRowByExactValue_(sheet, headerRow, columns.BOOK_NO, bookNo)
        : findReservedBookRowByReservationId_(sheet, headerRow, linkColumns, reservationId);
      if (!bookRowNumber) return { success: false, error: 'Reservation not found.' };

      const row = getSheetRowValues_(sheet, bookRowNumber);
      __lap('bookRowRead');
      const now = new Date();
      const currentReservationId = trim_(row[linkColumns.reservationId]);
      const reservedCustomerId = trim_(row[linkColumns.reservedCustomerId]);

      if (currentReservationId !== reservationId) {
        return { success: false, error: 'Reservation not found.' };
      }
      if (reservedCustomerId !== sessionCustomer.customerId) {
        return { success: false, error: 'You can only unreserve your own books.' };
      }
      if (trim_(row[columns.STATUS]) !== 'Reserved') {
        return { success: false, error: 'This reservation is no longer active.' };
      }

      const normalizedBookNo = trim_(row[columns.BOOK_NO]);
      row[columns.STATUS] = 'Available';
      row[linkColumns.reservationId] = '';
      row[linkColumns.reservedCustomerId] = '';
      row[linkColumns.reservedCustomerName] = '';
      row[linkColumns.reservedAt] = '';
      row[linkColumns.reservationUpdatedAt] = now;
      setSheetRowValues_(sheet, bookRowNumber, row);
      __lap('rowWritten');

      // Option A: update the session reservation index only. No Customer-Details
      // write on the hot path (see reserveBookForCustomer for the rationale).
      removeSessionReservation_(customerToken, sessionCustomer, reservationId, normalizedBookNo);
      __lap('sessionUpdated');

      invalidatePublicBooksCache_();
      __lap('cacheInvalidated_DONE');
      return { success: true, message: 'Reservation cancelled.', bookNo: normalizedBookNo, reservationId };
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return reportError_('unreserveMyBook', err);
  }
}

// Issue a book to a specific customer (linked by customer id). Records Issued
// to (name), Issued Customer ID, Issued At (now), Due Date (now + LOAN_DAYS).
// If the book is currently reserved by a DIFFERENT customer, that reservation
// is cancelled first (the caller/admin confirms this on the client).
function issueBook(bookNo, customerId, customerName, adminCredential) {
  try {
    if (!verifyAdminCredential_(adminCredential)) return { success: false, error: 'Admin session expired. Please log in again.' };
    bookNo = trim_(bookNo);
    customerId = trim_(customerId);
    customerName = trim_(customerName);
    if (!bookNo) return { success: false, error: 'Book number is required.' };
    if (!customerId || !customerName) return { success: false, error: 'Please select the customer to issue this book to.' };

    const { sheet, headerRow, columns } = getSheetAndHeader_();
    const linkColumns = getBookReservationLinkColumns_(sheet, headerRow);
    const issueColumns = getBookIssueColumns_(sheet, headerRow);
    const bookRowNumber = findDataRowByExactValue_(sheet, headerRow, columns.BOOK_NO, bookNo);
    if (!bookRowNumber) return { success: false, error: 'Book not found.' };

    const row      = getSheetRowValues_(sheet, bookRowNumber);
    const now      = new Date();
    const dueDate  = new Date(now.getTime() + LOAN_DAYS * 24 * 60 * 60 * 1000);
    const bookName = trim_(row[columns.BOOK_NAME]);
    const priorReserverId = linkColumns.reservedCustomerId === -1 ? '' : trim_(row[linkColumns.reservedCustomerId]);

    // Reservation handling: clearing the reservation link releases the book to
    // the issue. If it was reserved by a DIFFERENT customer, that person's count
    // must be decremented (their reservation is being cancelled).
    row[columns.ISSUED_TO] = customerName;
    row[columns.STATUS] = 'Issued';
    if (issueColumns.issuedCustomerId !== -1) row[issueColumns.issuedCustomerId] = customerId;
    if (issueColumns.issuedAt !== -1)         row[issueColumns.issuedAt] = now;
    if (issueColumns.dueDate !== -1)          row[issueColumns.dueDate] = dueDate;
    if (linkColumns.reservationId !== -1)        row[linkColumns.reservationId] = '';
    if (linkColumns.reservedCustomerId !== -1)   row[linkColumns.reservedCustomerId] = '';
    if (linkColumns.reservedCustomerName !== -1) row[linkColumns.reservedCustomerName] = '';
    if (linkColumns.reservedAt !== -1)           row[linkColumns.reservedAt] = '';
    if (linkColumns.reservationUpdatedAt !== -1) row[linkColumns.reservationUpdatedAt] = now;
    setSheetRowValues_(sheet, bookRowNumber, row);

    // Release the prior reserver's count when we cancelled/consumed a reservation.
    if (priorReserverId) {
      try { adjustCustomerActiveReservationCountById_(priorReserverId, -1); } catch (e) { /* non-fatal */ }
    }

    // Log to customer's named tab
    logIssueToCustTab_(customerName, bookNo, bookName, now);

    invalidatePublicBooksCache_();
    return {
      success: true,
      message: '✅ Book issued to ' + customerName + '. Due ' + formatDate_(dueDate, Session.getScriptTimeZone()) + '.'
    };
  } catch (err) {
    return reportError_('issueBook', err, adminCredential);
  }
}

function returnBook(bookNo, adminCredential) {
  try {
    if (!verifyAdminCredential_(adminCredential)) return { success: false, error: 'Admin session expired. Please log in again.' };

    const { sheet, headerRow, columns } = getSheetAndHeader_();
    const linkColumns = getBookReservationLinkColumns_(sheet, headerRow);
    const issueColumns = getBookIssueColumns_(sheet, headerRow);
    const bookRowNumber = findDataRowByExactValue_(sheet, headerRow, columns.BOOK_NO, bookNo);
    if (!bookRowNumber) return { success: false, error: 'Book not found.' };

    const row = getSheetRowValues_(sheet, bookRowNumber);
    const issuedTo = trim_(row[columns.ISSUED_TO]);
    const ownerCustomerId = linkColumns.reservedCustomerId === -1 ? '' : trim_(row[linkColumns.reservedCustomerId]);

    // Clear issue (incl. the issue-tracking columns) AND any lingering
    // reservation link so an available row never carries stale fields.
    row[columns.ISSUED_TO] = '';
    row[columns.STATUS] = 'Available';
    if (issueColumns.issuedCustomerId !== -1) row[issueColumns.issuedCustomerId] = '';
    if (issueColumns.issuedAt !== -1)         row[issueColumns.issuedAt] = '';
    if (issueColumns.dueDate !== -1)          row[issueColumns.dueDate] = '';
    if (linkColumns.reservationId !== -1)        row[linkColumns.reservationId] = '';
    if (linkColumns.reservedCustomerId !== -1)   row[linkColumns.reservedCustomerId] = '';
    if (linkColumns.reservedCustomerName !== -1) row[linkColumns.reservedCustomerName] = '';
    if (linkColumns.reservedAt !== -1)           row[linkColumns.reservedAt] = '';
    if (linkColumns.reservationUpdatedAt !== -1) row[linkColumns.reservationUpdatedAt] = new Date();
    setSheetRowValues_(sheet, bookRowNumber, row);

    if (ownerCustomerId) {
      try { adjustCustomerActiveReservationCountById_(ownerCustomerId, -1); } catch (e) { /* non-fatal */ }
    }

    // Log return to customer's named tab
    if (issuedTo) {
      logReturnToCustTab_(issuedTo, bookNo.trim(), new Date());
    }

    invalidatePublicBooksCache_();
    return { success: true, message: '✅ Book marked as returned and available.' };
  } catch (err) {
    return reportError_('returnBook', err, adminCredential);
  }
}

function cancelReservation(bookNo, adminCredential) {
  try {
    if (!verifyAdminCredential_(adminCredential)) return { success: false, error: 'Admin session expired. Please log in again.' };

    const { sheet, headerRow, columns } = getSheetAndHeader_();
    const linkColumns = getBookReservationLinkColumns_(sheet, headerRow);
    const bookRowNumber = findDataRowByExactValue_(sheet, headerRow, columns.BOOK_NO, bookNo);
    if (!bookRowNumber) return { success: false, error: 'Book not found.' };

    const row = getSheetRowValues_(sheet, bookRowNumber);
    // Remember whose reservation this was, so we can decrement their count.
    const ownerCustomerId = linkColumns.reservedCustomerId === -1 ? '' : trim_(row[linkColumns.reservedCustomerId]);

    // Set Available AND clear the whole reservation link — never leave stale
    // reservation fields on an available row (that's what caused the "reserved
    // fields present but status Available" inconsistency).
    row[columns.STATUS] = 'Available';
    if (linkColumns.reservationId !== -1)        row[linkColumns.reservationId] = '';
    if (linkColumns.reservedCustomerId !== -1)   row[linkColumns.reservedCustomerId] = '';
    if (linkColumns.reservedCustomerName !== -1) row[linkColumns.reservedCustomerName] = '';
    if (linkColumns.reservedAt !== -1)           row[linkColumns.reservedAt] = '';
    if (linkColumns.reservationUpdatedAt !== -1) row[linkColumns.reservationUpdatedAt] = new Date();
    setSheetRowValues_(sheet, bookRowNumber, row);

    // Keep the owner's active-reservation count honest (best-effort).
    if (ownerCustomerId) {
      try { adjustCustomerActiveReservationCountById_(ownerCustomerId, -1); } catch (e) { /* non-fatal */ }
    }

    invalidatePublicBooksCache_();
    return { success: true, message: '✅ Reservation cancelled.' };
  } catch (err) {
    return reportError_('cancelReservation', err, adminCredential);
  }
}

// Admin: hide a book from end users (visible=false) or unhide it (visible=true).
// Hidden books are still visible to admins in the list (with a Hidden badge).
function setBookVisibility(bookNo, visible, adminCredential) {
  try {
    if (!verifyAdminCredential_(adminCredential)) return { success: false, error: 'Admin session expired. Please log in again.' };
    bookNo = trim_(bookNo);
    if (!bookNo) return { success: false, error: 'Book number is required.' };

    const { sheet, headerRow, columns } = getSheetAndHeader_();
    const bookRowNumber = findDataRowByExactValue_(sheet, headerRow, columns.BOOK_NO, bookNo);
    if (!bookRowNumber) return { success: false, error: 'Book not found.' };

    const visibilityColumn = ensureBookVisibilityColumn_(sheet, headerRow);
    sheet.getRange(bookRowNumber, visibilityColumn + 1).setValue(visible ? 'Visible' : 'Hidden');

    invalidatePublicBooksCache_();
    return {
      success: true,
      hidden: !visible,
      message: visible ? '✅ Book is now visible to everyone.' : '✅ Book hidden from end users.'
    };
  } catch (err) {
    return reportError_('setBookVisibility', err, adminCredential);
  }
}

/**
 * ONE-TIME REPAIR — run from the Apps Script editor.
 * Fixes rows left in an inconsistent state (Status = Available but reservation
 * link fields still populated) — e.g. from the old cancelReservation that only
 * flipped the status. Clears the stale link fields on every such row and
 * reconciles each affected customer's active-reservation count.
 */
function repairStaleReservationLinks() {
  const { sheet, headerRow, columns } = getSheetAndHeader_();
  const linkColumns = getBookReservationLinkColumns_(sheet, headerRow);
  const data = sheet.getDataRange().getValues();
  const affectedCustomerIds = {};
  let fixed = 0;

  for (let i = headerRow + 1; i < data.length; i++) {
    const row = data[i];
    if (!trim_(row[columns.BOOK_NO])) continue;
    const status = trim_(row[columns.STATUS]);
    const hasLink =
      (linkColumns.reservationId !== -1 && trim_(row[linkColumns.reservationId])) ||
      (linkColumns.reservedCustomerId !== -1 && trim_(row[linkColumns.reservedCustomerId])) ||
      (linkColumns.reservedCustomerName !== -1 && trim_(row[linkColumns.reservedCustomerName])) ||
      (linkColumns.reservedAt !== -1 && trim_(row[linkColumns.reservedAt]));

    // Inconsistent = not currently Reserved, yet carrying reservation link data.
    if (status !== 'Reserved' && hasLink) {
      const ownerId = linkColumns.reservedCustomerId === -1 ? '' : trim_(row[linkColumns.reservedCustomerId]);
      if (ownerId) affectedCustomerIds[ownerId] = true;
      if (linkColumns.reservationId !== -1)        row[linkColumns.reservationId] = '';
      if (linkColumns.reservedCustomerId !== -1)   row[linkColumns.reservedCustomerId] = '';
      if (linkColumns.reservedCustomerName !== -1) row[linkColumns.reservedCustomerName] = '';
      if (linkColumns.reservedAt !== -1)           row[linkColumns.reservedAt] = '';
      setSheetRowValues_(sheet, i + 1, row);
      fixed++;
    }
  }

  // Reconcile each affected customer's active count to their true Reserved rows.
  // Reset the request cache so the reconcile scan reads the rows we just wrote.
  REQUEST_CACHE_.masterData = null;
  const reconciled = [];
  Object.keys(affectedCustomerIds).forEach(customerId => {
    const trueCount = getActiveReservationsForCustomer_(customerId).length;
    try { adjustCustomerActiveReservationCountByIdTo_(customerId, trueCount); } catch (e) {}
    reconciled.push(customerId + '=' + trueCount);
  });

  invalidatePublicBooksCache_();
  const msg = 'Repaired ' + fixed + ' stale row(s). Reconciled counts: ' + (reconciled.join(', ') || 'none');
  Logger.log(msg);
  return { success: true, fixed, reconciled, message: msg };
}

// ─────────────────────────────────────────────
// Customer Auth (Phase 2)
// ─────────────────────────────────────────────

function claimExistingCustomer(customerId, inviteCode, email, password, phone) {
  try {
    if (!checkRateLimit_('customer-claim', 8, 300)) {
      return { success: false, error: rateLimitMessage_('Too many attempts to join.') };
    }

    customerId = trim_(customerId).toUpperCase();
    inviteCode = trim_(inviteCode).toUpperCase();
    email = normalizeEmail_(email);
    phone = normalizePhone_(phone);

    const validation = validateCustomerAuthInputs_(email, phone, password);
    if (!customerId || !inviteCode) return { success: false, error: 'Customer ID and invite code are required.' };
    if (!validation.success) return validation;

    const details = getCustomerDetailsSheetAndColumns_();
    const data = details.sheet.getDataRange().getValues();
    const rowInfo = findCustomerDetailsRow_(data, details.headerRow, details.columns, { customerId });
    if (!rowInfo) return { success: false, error: 'Customer account not found.' };

    const row = rowInfo.values.slice();
    const inviteStatus = trim_(row[details.columns.inviteStatus]);
    if (inviteStatus === 'Claimed' || trim_(row[details.columns.claimedAt])) {
      return { success: false, error: 'This account has already been claimed. Please log in.' };
    }

    const storedInviteHash = trim_(row[details.columns.inviteCodeHash]);
    if (!storedInviteHash || storedInviteHash !== hashInviteCode_(customerId, inviteCode)) {
      return { success: false, error: 'Invalid customer ID or invite code.' };
    }

    const existingEmailRow = email ? findCustomerDetailsRow_(data, details.headerRow, details.columns, { email }) : null;
    if (existingEmailRow && existingEmailRow.rowNumber !== rowInfo.rowNumber) {
      return { success: false, error: 'This email is already linked to another customer.' };
    }
    const existingPhoneRow = phone ? findCustomerDetailsRow_(data, details.headerRow, details.columns, { phone }) : null;
    if (existingPhoneRow && existingPhoneRow.rowNumber !== rowInfo.rowNumber) {
      return { success: false, error: 'This phone number is already linked to another customer.' };
    }

    const now = new Date();
    const salt = Utilities.getUuid();
    row[details.columns.email] = email;
    if (details.columns.phone !== -1) row[details.columns.phone] = phone;
    row[details.columns.authMethod] = 'password';
    row[details.columns.passwordSalt] = salt;
    row[details.columns.passwordHash] = hashPassword_(password, salt);
    row[details.columns.inviteCodeHash] = '';
    if (details.columns.inviteCodeExpiresAt !== -1) row[details.columns.inviteCodeExpiresAt] = '';
    row[details.columns.inviteStatus] = 'Claimed';
    row[details.columns.claimedAt] = now;
    row[details.columns.lastLoginAt] = now;

    writeCustomerDetailsRow_(details.sheet, rowInfo.rowNumber, row);

    const token = createCustomerSession_(row, details.columns);
    return { success: true, token, customer: publicCustomerFromRow_(row, details.columns), message: 'Account claimed successfully.' };
  } catch (err) {
    return reportError_('claimExistingCustomer', err);
  }
}

/**
 * Public self-signup: a new visitor registers with name, phone, email and a
 * password. The account is created in a PENDING state — it can log in and browse
 * the full catalog immediately, but cannot reserve books until an admin approves
 * it (Account Status → Active). Returns a session token so the user is logged in
 * right after signing up.
 */
function selfSignupCustomer(name, email, phone, password) {
  try {
    if (!checkRateLimit_('customer-signup', 6, 300)) {
      return { success: false, error: rateLimitMessage_('Too many sign-up attempts.') };
    }

    name = trim_(name);
    email = normalizeEmail_(email);
    phone = normalizePhone_(phone);

    if (!name) return { success: false, error: 'Please enter your name.' };
    const validation = validateCustomerAuthInputs_(email, phone, password);
    if (!validation.success) return validation;

    const lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      const details = getCustomerDetailsSheetAndColumns_();
      const columns = details.columns;
      const data = details.sheet.getDataRange().getValues();

      // Reject duplicates so signups don't fork an existing customer's account.
      if (email && findCustomerDetailsRow_(data, details.headerRow, columns, { email })) {
        return { success: false, error: 'An account with this email already exists. Please log in instead.' };
      }
      if (phone && findCustomerDetailsRow_(data, details.headerRow, columns, { phone })) {
        return { success: false, error: 'An account with this phone number already exists. Please log in instead.' };
      }

      // Unique Customer ID from the names already present.
      const usedCustomerIds = {};
      for (let i = details.headerRow + 1; i < data.length; i++) {
        const id = trim_(data[i][columns.customerId]);
        if (id) usedCustomerIds[id] = true;
      }
      const customerId = generateCustomerId_(name, usedCustomerIds);

      const now = new Date();
      const salt = Utilities.getUuid();
      const width = details.sheet.getLastColumn();
      const row = new Array(width).fill('');

      row[columns.customerId] = customerId;
      row[columns.name] = name;
      row[columns.email] = email;
      if (columns.phone !== -1) row[columns.phone] = phone;
      // PENDING until an admin approves — reserveBookForCustomer gates on this.
      row[columns.accountStatus] = 'Pending';
      row[columns.subscriptionStatus] = 'Pending';
      if (columns.activeReservationCount !== -1) row[columns.activeReservationCount] = 0;
      row[columns.authMethod] = 'password';
      row[columns.passwordSalt] = salt;
      row[columns.passwordHash] = hashPassword_(password, salt);
      row[columns.inviteStatus] = 'Self-Signup';
      row[columns.claimedAt] = now;
      row[columns.lastLoginAt] = now;

      // Stamp Created At if that column exists (not part of the auth column set).
      const createdAtCol = getHeaderIndex_(getHeaderMap_(data[details.headerRow]), 'Created At');
      if (createdAtCol !== -1) row[createdAtCol] = now;

      details.sheet.appendRow(row);

      const token = createCustomerSession_(row, columns);
      return {
        success: true,
        token,
        customer: publicCustomerFromRow_(row, columns),
        message: 'Welcome! Your account is pending approval — you can browse all books now, and reserve once approved.'
      };
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return reportError_('selfSignupCustomer', err);
  }
}

// Unified login entry: one form for both admins and customers. Tries admin
// credentials first (ADMIN_USERNAME + ADMIN_PASSWORD); otherwise falls through
// to customer login. Returns `role: 'admin' | 'customer'` so the client knows
// which mode to enter.
function login(identifier, password) {
  try {
    if (!checkRateLimit_('login', 12, 300)) {
      return { success: false, error: rateLimitMessage_('Too many login attempts.') };
    }
    if (!trim_(identifier) || !password) {
      return { success: false, error: 'Username/email/phone and password are required.' };
    }

    // Admin path (explicit username + password).
    if (verifyAdminCredentials_(identifier, password)) {
      const token = Utilities.getUuid() + Utilities.getUuid();
      CacheService.getScriptCache().put(adminSessionKey_(token), '1', ADMIN_SESSION_SECS);
      return { success: true, role: 'admin', token };
    }

    // Customer path.
    const res = loginCustomer(identifier, password);
    if (res && res.success) res.role = 'customer';
    return res;
  } catch (err) {
    return reportError_('login', err);
  }
}

function loginCustomer(identifier, password) {
  try {
    if (!checkRateLimit_('customer-login', 10, 300)) {
      return { success: false, error: rateLimitMessage_('Too many login attempts.') };
    }

    const loginId = trim_(identifier);
    if (!loginId || !password) return { success: false, error: 'Email or phone and password are required.' };

    const details = getCustomerDetailsSheetAndColumns_();
    const data = details.sheet.getDataRange().getValues();
    const rowInfo = findCustomerDetailsRow_(data, details.headerRow, details.columns, loginQueryFromIdentifier_(loginId));
    if (!rowInfo) return { success: false, error: 'Invalid email/phone or password.' };

    const row = rowInfo.values.slice();
    const authMethod = trim_(row[details.columns.authMethod]);
    const salt = trim_(row[details.columns.passwordSalt]);
    const passwordHash = trim_(row[details.columns.passwordHash]);
    const hasPasswordLogin = authMethod === 'password' || authMethod === 'both';
    if (!hasPasswordLogin || !salt || !passwordHash || hashPassword_(password, salt) !== passwordHash) {
      return { success: false, error: 'Invalid email/phone or password.' };
    }

    row[details.columns.lastLoginAt] = new Date();
    writeCustomerDetailsRow_(details.sheet, rowInfo.rowNumber, row);

    const token = createCustomerSession_(row, details.columns);
    return { success: true, token, customer: publicCustomerFromRow_(row, details.columns), message: 'Logged in successfully.' };
  } catch (err) {
    return reportError_('loginCustomer', err);
  }
}

function logoutCustomer(token) {
  try {
    if (token) CacheService.getScriptCache().remove(customerSessionKey_(token));
  } catch (err) {
    Logger.log('logoutCustomer error: ' + err.message);
  }
  return { success: true };
}

function getCurrentCustomer(token) {
  try {
    const session = verifyCustomerSession_(token);
    if (!session) return { success: false, error: 'Not logged in.' };
    return { success: true, customer: session };
  } catch (err) {
    return reportError_('getCurrentCustomer', err);
  }
}

function generateInviteCodeForCustomer(customerId, adminCredential) {
  try {
    if (!canRunSetup_(adminCredential)) {
      return { success: false, error: 'Invite code generation is restricted to the spreadsheet owner or an active admin session.' };
    }

    customerId = trim_(customerId).toUpperCase();
    if (!customerId) return { success: false, error: 'Customer ID is required.' };

    const details = getCustomerDetailsSheetAndColumns_();
    const data = details.sheet.getDataRange().getValues();
    const rowInfo = findCustomerDetailsRow_(data, details.headerRow, details.columns, { customerId });
    if (!rowInfo) return { success: false, error: 'Customer account not found.' };

    const row = rowInfo.values.slice();
    const claimed = trim_(row[details.columns.claimedAt]) || trim_(row[details.columns.inviteStatus]) === 'Claimed';
    if (claimed) {
      return { success: false, error: 'This account is already claimed. Invite code was not regenerated.' };
    }

    const inviteCode = generateInviteCode_();
    row[details.columns.inviteCodeHash] = hashInviteCode_(customerId, inviteCode);
    if (details.columns.inviteCodeExpiresAt !== -1) row[details.columns.inviteCodeExpiresAt] = '';
    row[details.columns.inviteStatus] = 'Regenerated';
    row[details.columns.authMethod] = 'invite_pending';
    writeCustomerDetailsRow_(details.sheet, rowInfo.rowNumber, row);

    const message = 'Invite code for ' + customerId + ' (' + trim_(row[details.columns.name]) + '): ' + inviteCode;
    Logger.log(message);
    return { success: true, customerId, name: trim_(row[details.columns.name]), inviteCode, message };
  } catch (err) {
    return reportError_('generateInviteCodeForCustomer', err);
  }
}

function generateInviteCodesForAllCustomers(adminCredential) {
  try {
    if (!canRunSetup_(adminCredential)) {
      return { success: false, error: 'Invite code generation is restricted to the spreadsheet owner or an active admin session.' };
    }

    const details = getCustomerDetailsSheetAndColumns_();
    const data = details.sheet.getDataRange().getValues();
    const width = details.sheet.getLastColumn();
    const generated = [];
    const skippedClaimed = [];
    const skippedMissingId = [];

    for (let i = details.headerRow + 1; i < data.length; i++) {
      const row = data[i].slice(0, width);
      while (row.length < width) row.push('');

      const customerId = trim_(row[details.columns.customerId]).toUpperCase();
      const name = trim_(row[details.columns.name]);
      if (!customerId && !name) continue;
      if (!customerId) {
        skippedMissingId.push({ rowNumber: i + 1, name });
        continue;
      }

      const claimed = trim_(row[details.columns.claimedAt]) || trim_(row[details.columns.inviteStatus]) === 'Claimed';
      if (claimed) {
        skippedClaimed.push({ customerId, name });
        continue;
      }

      const inviteCode = generateInviteCode_();
      row[details.columns.inviteCodeHash] = hashInviteCode_(customerId, inviteCode);
      if (details.columns.inviteCodeExpiresAt !== -1) row[details.columns.inviteCodeExpiresAt] = '';
      row[details.columns.inviteStatus] = 'Regenerated';
      row[details.columns.authMethod] = 'invite_pending';
      details.sheet.getRange(i + 1, 1, 1, width).setValues([row]);

      const entry = { customerId, name, inviteCode };
      generated.push(entry);
      Logger.log('Invite code for ' + customerId + ' (' + name + '): ' + inviteCode);
    }

    Logger.log('Generated invite codes for ' + generated.length + ' customer(s). Skipped claimed: ' + skippedClaimed.length + '. Missing customer id: ' + skippedMissingId.length + '.');
    return {
      success: true,
      generated,
      skippedClaimed,
      skippedMissingId,
      message: 'Generated invite codes for ' + generated.length + ' customer(s).'
    };
  } catch (err) {
    return reportError_('generateInviteCodesForAllCustomers', err);
  }
}

// ─────────────────────────────────────────────
// Customer Management (Admin only)
// ─────────────────────────────────────────────

// Resolve the admin-list column indices from the Customer-Details header row.
function getCustomerAdminColumns_(headerMap) {
  return {
    customerId:              getHeaderIndex_(headerMap, 'Customer ID'),
    legacySrNo:              getHeaderIndex_(headerMap, 'Legacy Sr No'),
    name:                    getHeaderIndex_(headerMap, 'Name'),
    dateStart:               getHeaderIndex_(headerMap, 'Date of Start'),
    location:                getHeaderIndex_(headerMap, 'Location'),
    address:                 getHeaderIndex_(headerMap, 'Address'),
    accountStatus:           getHeaderIndex_(headerMap, 'Account Status'),
    subscriptionStatus:      getHeaderIndex_(headerMap, 'Subscription Status'),
    subscriptionPlan:        getHeaderIndex_(headerMap, 'Subscription Plan'),
    email:                   getHeaderIndex_(headerMap, 'Email'),
    phone:                   getHeaderIndex_(headerMap, 'Phone'),
    inviteStatus:            getHeaderIndex_(headerMap, 'Invite Status'),
    tillDateSum:             getHeaderIndex_(headerMap, 'Till Date Sum'),
    monthlyReservationLimit: getHeaderIndex_(headerMap, 'Monthly Reservation Limit'),
    activeReservationCount:  getHeaderIndex_(headerMap, 'Active Reservation Count'),
    createdAt:               getHeaderIndex_(headerMap, 'Created At')
  };
}

function getCustomers(adminCredential) {
  try {
    if (!verifyAdminCredential_(adminCredential)) return { success: false, error: 'Admin session expired. Please log in again.' };

    // Read from the live Customer-Details sheet (header-resolved), not the
    // legacy fixed-column Customer DB.
    const details = getCustomerDetailsSheetAndColumns_();
    const data = details.sheet.getDataRange().getValues();
    const headerMap = getHeaderMap_(data[details.headerRow]);
    const cols = getCustomerAdminColumns_(headerMap);
    const tz = Session.getScriptTimeZone();

    const customers = [];
    for (let i = details.headerRow + 1; i < data.length; i++) {
      const name = trim_(getRowValue_(data[i], cols.name));
      if (!name) continue;
      customers.push({
        customerId:              trim_(getRowValue_(data[i], cols.customerId)),
        srNo:                    trim_(getRowValue_(data[i], cols.legacySrNo)),
        name,
        dateStart:               formatDate_(getRowValue_(data[i], cols.dateStart), tz),
        location:                trim_(getRowValue_(data[i], cols.location)),
        address:                 trim_(getRowValue_(data[i], cols.address)),
        status:                  trim_(getRowValue_(data[i], cols.accountStatus)) || 'Active',
        subscriptionStatus:      cols.subscriptionStatus === -1 ? '' : trim_(getRowValue_(data[i], cols.subscriptionStatus)),
        subscriptionPlan:        cols.subscriptionPlan === -1 ? '' : trim_(getRowValue_(data[i], cols.subscriptionPlan)),
        email:                   cols.email === -1 ? '' : trim_(getRowValue_(data[i], cols.email)),
        phone:                   cols.phone === -1 ? '' : trim_(getRowValue_(data[i], cols.phone)),
        inviteStatus:            cols.inviteStatus === -1 ? '' : trim_(getRowValue_(data[i], cols.inviteStatus)),
        tillDateSum:             trim_(getRowValue_(data[i], cols.tillDateSum)),
        monthlyReservationLimit: trim_(getRowValue_(data[i], cols.monthlyReservationLimit)),
        activeReservationCount:  trim_(getRowValue_(data[i], cols.activeReservationCount))
      });
    }
    return { success: true, customers };
  } catch (err) {
    return reportError_('getCustomers', err, adminCredential);
  }
}

function addCustomer(name, dateStart, location, address, adminCredential) {
  try {
    if (!verifyAdminCredential_(adminCredential)) return { success: false, error: 'Admin session expired. Please log in again.' };
    name = trim_(name);
    if (!name) return { success: false, error: 'Customer name is required.' };

    // Create a complete Customer-Details row: Customer ID, defaults, and an
    // invite code so the customer can later claim their login.
    const details = getCustomerDetailsSheetAndColumns_();
    const sheet = details.sheet;
    const headerRow = details.headerRow;
    const headerValues = sheet.getRange(headerRow + 1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headerMap = getHeaderMap_(headerValues);
    const columns = buildCustomerDetailsColumns_(headerMap);
    const existing = readExistingCustomerDetails_(sheet, headerRow, columns);

    // Next legacy Sr No (kept for continuity with the migrated data).
    const data = sheet.getDataRange().getValues();
    let maxSrNo = 0;
    for (let i = headerRow + 1; i < data.length; i++) {
      const sr = parseInt(getRowValue_(data[i], columns.legacySrNo), 10) || 0;
      if (sr > maxSrNo) maxSrNo = sr;
    }

    const width = sheet.getLastColumn();
    const row = new Array(width).fill('');
    const now = new Date();
    const customerId = generateCustomerId_(name, existing.usedCustomerIds);
    const inviteCode = generateInviteCode_();

    setCustomerDetailValue_(row, columns.customerId, customerId);
    setCustomerDetailValue_(row, columns.legacySrNo, maxSrNo + 1);
    setCustomerDetailValue_(row, columns.name, name);
    setCustomerDetailValue_(row, columns.dateStart, dateStart ? new Date(dateStart) : now);
    setCustomerDetailValue_(row, columns.location, trim_(location));
    setCustomerDetailValue_(row, columns.address, trim_(address));
    setCustomerDetailValue_(row, columns.accountStatus, 'Active');
    setCustomerDetailValue_(row, columns.activeReservationCount, 0);
    setCustomerDetailValue_(row, columns.subscriptionStatus, 'NA');
    setCustomerDetailValue_(row, columns.authMethod, 'invite_pending');
    setCustomerDetailValue_(row, columns.inviteCodeHash, hashInviteCode_(customerId, inviteCode));
    setCustomerDetailValue_(row, columns.inviteStatus, 'Pending');
    setCustomerDetailValue_(row, columns.createdAt, now);

    sheet.appendRow(row);
    return {
      success: true,
      message: '✅ Customer "' + name + '" added.',
      customerId,
      inviteCode
    };
  } catch (err) {
    return reportError_('addCustomer', err, adminCredential);
  }
}

/**
 * Approve a self-signup (or otherwise pending) customer. Flips Account Status to
 * Active and Subscription Status to Active, sets the plan + monthly reservation
 * limit, and stamps Approved At. After this the customer can reserve books; their
 * cached session picks up the change lazily via the sheet re-check in
 * reserveBookForCustomer (no forced re-login needed).
 */
function approveCustomer(customerId, subscriptionPlan, monthlyLimit, adminCredential) {
  try {
    if (!verifyAdminCredential_(adminCredential)) return { success: false, error: 'Admin session expired. Please log in again.' };
    customerId = trim_(customerId);
    if (!customerId) return { success: false, error: 'Customer ID is required.' };

    const limit = parseInt(monthlyLimit, 10);
    if (!(limit > 0)) return { success: false, error: 'Please set a positive monthly reservation limit.' };

    const details = getCustomerDetailsSheetAndColumns_();
    const columns = details.columns;
    const rowNumber = findDataRowByExactValue_(details.sheet, details.headerRow, columns.customerId, customerId);
    if (!rowNumber) return { success: false, error: 'Customer not found.' };

    const row = getSheetRowValues_(details.sheet, rowNumber);
    row[columns.accountStatus] = 'Active';
    row[columns.subscriptionStatus] = 'Active';
    if (columns.subscriptionPlan !== -1) row[columns.subscriptionPlan] = trim_(subscriptionPlan);
    if (columns.monthlyReservationLimit !== -1) row[columns.monthlyReservationLimit] = limit;

    // Stamp Approved At if the column exists.
    const headerMap = getHeaderMap_(getSheetRowValues_(details.sheet, details.headerRow + 1));
    const approvedAtCol = getHeaderIndex_(headerMap, 'Approved At');
    if (approvedAtCol !== -1) row[approvedAtCol] = new Date();

    setSheetRowValues_(details.sheet, rowNumber, row);
    return { success: true, message: '✅ ' + trim_(row[columns.name]) + ' approved (limit ' + limit + '/month).' };
  } catch (err) {
    return reportError_('approveCustomer', err, adminCredential);
  }
}

function updateCustomerStatus(customerName, newStatus, adminCredential) {
  try {
    if (!verifyAdminCredential_(adminCredential)) return { success: false, error: 'Admin session expired. Please log in again.' };
    if (!customerName || !newStatus)  return { success: false, error: 'Customer name and status required.' };

    const valid = ['Active', 'Inactive', 'Closed'];
    if (!valid.includes(newStatus)) return { success: false, error: 'Invalid status.' };

    const details = getCustomerDetailsSheetAndColumns_();
    const data = details.sheet.getDataRange().getValues();
    const headerMap = getHeaderMap_(data[details.headerRow]);
    const cols = getCustomerAdminColumns_(headerMap);
    if (cols.name === -1 || cols.accountStatus === -1) {
      return { success: false, error: 'Customer-Details is missing Name or Account Status column.' };
    }

    for (let i = details.headerRow + 1; i < data.length; i++) {
      if (trim_(data[i][cols.name]).toLowerCase() === customerName.toLowerCase()) {
        details.sheet.getRange(i + 1, cols.accountStatus + 1).setValue(newStatus);
        return { success: true, message: '✅ Status updated to "' + newStatus + '" for ' + customerName };
      }
    }
    return { success: false, error: 'Customer "' + customerName + '" not found.' };
  } catch (err) {
    return reportError_('updateCustomerStatus', err, adminCredential);
  }
}

// ─────────────────────────────────────────────
// Customer Tab Helpers (private)
// ─────────────────────────────────────────────

/**
 * Finds the customer's named sheet tab.
 * Tries exact match, then case-insensitive, then partial.
 */
function findCustomerSheet_(customerName) {
  const ss     = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheets = ss.getSheets();
  const name   = customerName.trim().toLowerCase();

  // Exact match (case-insensitive)
  for (const s of sheets) {
    if (s.getName().toLowerCase() === name) return s;
  }
  // Partial match
  for (const s of sheets) {
    const sName = s.getName().toLowerCase();
    if (sName.includes(name) || name.includes(sName)) return s;
  }
  return null;
}

/**
 * Appends an issue record to the customer's named tab.
 * Tab structure: Row1=location, Row2=headers, Row3+=data
 * Columns: A=empty, B=BookNo, C=BookName, D=IssuedDate, E=ReturnDate, F=Status
 */
function logIssueToCustTab_(customerName, bookNo, bookName, issueDate) {
  try {
    const custSheet = findCustomerSheet_(customerName);
    if (!custSheet) {
      Logger.log('Customer tab not found for: ' + customerName);
      return;
    }
    const date = (issueDate instanceof Date) ? issueDate : (issueDate ? new Date(issueDate) : new Date());
    custSheet.appendRow(['', bookNo, bookName, date, '', 'Issued']);
  } catch (e) {
    Logger.log('logIssueToCustTab_ error: ' + e.message);
  }
}

/**
 * Updates the return date and status in the customer's tab for a given book.
 * Searches from the bottom up to find the last 'Issued' entry for the book.
 */
function logReturnToCustTab_(customerName, bookNo, returnDate) {
  try {
    const custSheet = findCustomerSheet_(customerName);
    if (!custSheet) {
      Logger.log('Customer tab not found for: ' + customerName);
      return;
    }
    const data = custSheet.getDataRange().getValues();
    const date = (returnDate instanceof Date) ? returnDate : (returnDate ? new Date(returnDate) : new Date());

    // Columns B=index 1 (BookNo), E=index 4 (ReturnDate), F=index 5 (Status)
    for (let i = data.length - 1; i >= 0; i--) {
      const rowBookNo = trim_(data[i][1]);
      const rowStatus = trim_(data[i][5]);
      if (rowBookNo === bookNo && (rowStatus === 'Issued' || rowStatus === '')) {
        custSheet.getRange(i + 1, 5).setValue(date);       // Col E: Return Date
        custSheet.getRange(i + 1, 6).setValue('Returned'); // Col F: Status
        return;
      }
    }
    Logger.log('No open issued record for book ' + bookNo + ' in tab for ' + customerName);
  } catch (e) {
    Logger.log('logReturnToCustTab_ error: ' + e.message);
  }
}

function loginAdmin(password) {
  try {
    if (!checkRateLimit_('admin-login', 10, 300)) {
      return { success: false, error: rateLimitMessage_('Too many login attempts.') };
    }
    if (!verifyAdmin_(password)) return { success: false, error: 'Incorrect admin password.' };

    const token = Utilities.getUuid() + Utilities.getUuid();
    CacheService.getScriptCache().put(adminSessionKey_(token), '1', ADMIN_SESSION_SECS);
    return { success: true, token };
  } catch (err) {
    return reportError_('loginAdmin', err);
  }
}

function logoutAdminSession(token) {
  try {
    if (token) CacheService.getScriptCache().remove(adminSessionKey_(token));
  } catch (err) {
    Logger.log('logoutAdminSession error: ' + err.message);
  }
  return { success: true };
}

function verifyAdminPassword(password) {
  if (!checkRateLimit_('admin-password-check', 10, 300)) return false;
  return verifyAdmin_(password);
}

function changeAdminPassword(currentPassword, newPassword) {
  if (!checkRateLimit_('admin-password-change', 5, 300)) return { success: false, error: rateLimitMessage_('Too many attempts.') };
  if (!verifyAdmin_(currentPassword))     return { success: false, error: 'Current password incorrect.' };
  if (!newPassword || newPassword.length < 6) return { success: false, error: 'New password must be at least 6 characters.' };
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD', newPassword);
  return { success: true, message: 'Password updated.' };
}

// ─────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────

function canRunSetup_(adminCredential) {
  if (verifyAdminCredential_(adminCredential)) return true;
  try {
    const activeEmail = trim_(Session.getActiveUser().getEmail()).toLowerCase();
    const effectiveEmail = trim_(Session.getEffectiveUser().getEmail()).toLowerCase();
    return Boolean(activeEmail && effectiveEmail && activeEmail === effectiveEmail);
  } catch (e) {
    return false;
  }
}

function getCustomerDetailsSheetAndColumns_() {
  if (REQUEST_CACHE_.customerDetails) return REQUEST_CACHE_.customerDetails;

  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(CONFIG.CUSTOMER_DETAILS_SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + CONFIG.CUSTOMER_DETAILS_SHEET_NAME + '" not found. Run setupCustomerReservationSystem() first.');

  const data = getHeaderSearchValues_(sheet);
  const headerRow = findHeaderRowByAnyHeader_(data, CUSTOMER_DETAILS_HEADERS);
  if (headerRow === -1) throw new Error('Could not find header row in "' + CONFIG.CUSTOMER_DETAILS_SHEET_NAME + '".');

  const headerMap = getHeaderMap_(data[headerRow]);
  REQUEST_CACHE_.customerDetails = { sheet, headerRow, columns: buildCustomerAuthColumns_(headerMap) };
  return REQUEST_CACHE_.customerDetails;
}

function buildCustomerAuthColumns_(headerMap) {
  const columns = {
    customerId: getHeaderIndex_(headerMap, 'Customer ID'),
    name: getHeaderIndex_(headerMap, 'Name'),
    accountStatus: getHeaderIndex_(headerMap, 'Account Status'),
    email: getHeaderIndex_(headerMap, 'Email'),
    phone: getHeaderIndex_(headerMap, 'Phone'),
    subscriptionPlan: getHeaderIndex_(headerMap, 'Subscription Plan'),
    monthlyReservationLimit: getHeaderIndex_(headerMap, 'Monthly Reservation Limit'),
    activeReservationCount: getHeaderIndex_(headerMap, 'Active Reservation Count'),
    subscriptionStatus: getHeaderIndex_(headerMap, 'Subscription Status'),
    authMethod: getHeaderIndex_(headerMap, 'Auth Method'),
    passwordSalt: getHeaderIndex_(headerMap, 'Password Salt'),
    passwordHash: getHeaderIndex_(headerMap, 'Password Hash'),
    inviteCodeHash: getHeaderIndex_(headerMap, 'Invite Code Hash'),
    inviteCodeExpiresAt: getHeaderIndex_(headerMap, 'Invite Code Expires At'),
    inviteStatus: getHeaderIndex_(headerMap, 'Invite Status'),
    claimedAt: getHeaderIndex_(headerMap, 'Claimed At'),
    lastLoginAt: getHeaderIndex_(headerMap, 'Last Login At')
  };

  Object.keys(columns).forEach(key => {
    if (columns[key] === -1 && key !== 'phone' && key !== 'subscriptionPlan' && key !== 'monthlyReservationLimit' && key !== 'activeReservationCount' && key !== 'inviteCodeExpiresAt') {
      throw new Error('Customer Details is missing required auth column: ' + key);
    }
  });
  return columns;
}

function findCustomerDetailsRow_(data, headerRow, columns, query) {
  const customerId = trim_(query.customerId).toUpperCase();
  const email = normalizeEmail_(query.email);
  const phone = normalizePhone_(query.phone);

  for (let i = headerRow + 1; i < data.length; i++) {
    const row = data[i];
    if (customerId && trim_(row[columns.customerId]).toUpperCase() === customerId) {
      return { rowNumber: i + 1, values: row };
    }
    if (email && normalizeEmail_(row[columns.email]) === email) {
      return { rowNumber: i + 1, values: row };
    }
    if (phone && columns.phone !== -1 && normalizePhone_(row[columns.phone]) === phone) {
      return { rowNumber: i + 1, values: row };
    }
  }
  return null;
}

function writeCustomerDetailsRow_(sheet, rowNumber, rowValues) {
  const width = sheet.getLastColumn();
  const values = rowValues.slice(0, width);
  while (values.length < width) values.push('');
  sheet.getRange(rowNumber, 1, 1, width).setValues([values]);
}

function validateCustomerAuthInputs_(email, phone, password) {
  if (!email && !phone) {
    return { success: false, error: 'Please enter either an email address or phone number.' };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: 'Please enter a valid email address.' };
  }
  if (phone && phone.length < 10) {
    return { success: false, error: 'Please enter a valid phone number.' };
  }
  if (!password || String(password).length < 8) {
    return { success: false, error: 'Password must be at least 8 characters.' };
  }
  return { success: true };
}

function normalizeEmail_(email) {
  return trim_(email).toLowerCase();
}

function normalizePhone_(phone) {
  return trim_(phone).replace(/[^\d+]/g, '');
}

function loginQueryFromIdentifier_(identifier) {
  const value = trim_(identifier);
  if (value.indexOf('@') !== -1) return { email: value };
  return { phone: value };
}

function hashPassword_(password, salt) {
  return sha256Hex_(String(salt || '') + ':' + String(password || ''));
}

function createCustomerSession_(row, columns) {
  const token = Utilities.getUuid() + Utilities.getUuid();
  const customer = publicCustomerFromRow_(row, columns);
  CacheService.getScriptCache().put(customerSessionKey_(token), JSON.stringify(customer), CUSTOMER_SESSION_SECS);
  return token;
}

function verifyCustomerSession_(token) {
  if (!token) return null;
  const cache = CacheService.getScriptCache();
  const key = customerSessionKey_(token);
  const cached = cache.get(key);
  if (!cached) return null;

  try {
    const customer = JSON.parse(cached);
    cache.put(key, cached, CUSTOMER_SESSION_SECS);
    return customer;
  } catch (e) {
    cache.remove(key);
    return null;
  }
}

function customerSessionKey_(token) {
  return 'CUSTOMER_SESSION_' + String(token || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 100);
}

function publicCustomerFromRow_(row, columns) {
  return {
    customerId: trim_(row[columns.customerId]),
    name: trim_(row[columns.name]),
    email: normalizeEmail_(row[columns.email]),
    phone: columns.phone === -1 ? '' : trim_(row[columns.phone]),
    accountStatus: trim_(row[columns.accountStatus]) || 'Active',
    subscriptionPlan: columns.subscriptionPlan === -1 ? '' : trim_(row[columns.subscriptionPlan]),
    monthlyReservationLimit: columns.monthlyReservationLimit === -1 ? '' : trim_(row[columns.monthlyReservationLimit]),
    activeReservationCount: columns.activeReservationCount === -1 ? '' : trim_(row[columns.activeReservationCount]),
    subscriptionStatus: trim_(row[columns.subscriptionStatus]),
    authMethod: trim_(row[columns.authMethod])
  };
}

function getCustomerRowContextById_(customerId) {
  const details = getCustomerDetailsSheetAndColumns_();
  const rowNumber = findDataRowByExactValue_(details.sheet, details.headerRow, details.columns.customerId, customerId);
  if (!rowNumber) return null;
  const rowInfo = { rowNumber, values: getSheetRowValues_(details.sheet, rowNumber) };
  return { details, rowInfo, customer: publicCustomerFromRow_(rowInfo.values, details.columns) };
}

function getCustomerActiveReservationCount_(customer, context) {
  const countColumn = context.details.columns.activeReservationCount;
  if (countColumn === -1) return getActiveReservationsForCustomer_(customer.customerId).length;

  const count = parseInt(context.rowInfo.values[countColumn], 10);
  if (count >= 0) return count;

  const actualCount = getActiveReservationsForCustomer_(customer.customerId).length;
  context.details.sheet.getRange(context.rowInfo.rowNumber, countColumn + 1).setValue(actualCount);
  context.rowInfo.values[countColumn] = actualCount;
  return actualCount;
}

function adjustCustomerActiveReservationCount_(context, delta) {
  const countColumn = context.details.columns.activeReservationCount;
  if (countColumn === -1) return;

  const current = parseInt(context.rowInfo.values[countColumn], 10) || 0;
  const next = Math.max(0, current + delta);
  setCustomerActiveReservationCount_(context, next);
}

function setCustomerActiveReservationCount_(context, count) {
  const countColumn = context.details.columns.activeReservationCount;
  if (countColumn === -1) return;

  const next = Math.max(0, parseInt(count, 10) || 0);
  context.details.sheet.getRange(context.rowInfo.rowNumber, countColumn + 1).setValue(next);
  context.rowInfo.values[countColumn] = next;
}

/**
 * PERF: adjust a customer's Active Reservation Count by delta using a targeted
 * TextFinder lookup of just that customer's row (no full-sheet read). Returns
 * the new count, or null if the count column / row can't be resolved.
 */
function adjustCustomerActiveReservationCountById_(customerId, delta) {
  const details = getCustomerDetailsSheetAndColumns_();
  const countColumn = details.columns.activeReservationCount;
  if (countColumn === -1) return null;

  const rowNumber = findDataRowByExactValue_(details.sheet, details.headerRow, details.columns.customerId, customerId);
  if (!rowNumber) return null;

  const cell = details.sheet.getRange(rowNumber, countColumn + 1);
  const current = parseInt(cell.getValue(), 10) || 0;
  const next = Math.max(0, current + delta);
  cell.setValue(next);
  return next;
}

/**
 * Set a customer's Active Reservation Count to an absolute value via a targeted
 * TextFinder lookup (used by the reconcile path). Returns the value written, or
 * null if the column/row can't be resolved.
 */
function adjustCustomerActiveReservationCountByIdTo_(customerId, count) {
  const details = getCustomerDetailsSheetAndColumns_();
  const countColumn = details.columns.activeReservationCount;
  if (countColumn === -1) return null;

  const rowNumber = findDataRowByExactValue_(details.sheet, details.headerRow, details.columns.customerId, customerId);
  if (!rowNumber) return null;

  const next = Math.max(0, parseInt(count, 10) || 0);
  details.sheet.getRange(rowNumber, countColumn + 1).setValue(next);
  return next;
}

/**
 * PERF: rewrite the customer session cache with a refreshed active count so the
 * next reserve can trust it without re-opening Customer-Details. Mutates the
 * passed sessionCustomer object too so this request sees the new value.
 */
function updateSessionActiveCount_(token, sessionCustomer, count) {
  if (!token || !sessionCustomer) return;
  const next = Math.max(0, parseInt(count, 10) || 0);
  sessionCustomer.activeReservationCount = next;
  persistSession_(token, sessionCustomer);
}

// ─────────────────────────────────────────────────────────────
// Option A — per-customer reservation index cached in the session
//
// sessionCustomer.reservations is the authoritative in-session list of the
// customer's ACTIVE reservations: [{ reservationId, bookNo, bookName }].
// activeReservationCount is always kept equal to reservations.length.
//
// This is a POLICY/display cache only. It never governs a book's availability —
// that is enforced under the lock with a fresh Books-DB read on every write.
// If the cache is ever missing (cold session), we scan Books-DB ONCE to build
// it, then all subsequent reads are cache hits (~5 ms, zero sheet access).
// ─────────────────────────────────────────────────────────────

function persistSession_(token, sessionCustomer) {
  if (!token || !sessionCustomer) return;
  try {
    CacheService.getScriptCache().put(customerSessionKey_(token), JSON.stringify(sessionCustomer), CUSTOMER_SESSION_SECS);
  } catch (e) { /* non-fatal: next read will re-scan and re-cache */ }
}

/**
 * Returns the customer's active reservations from the session cache when
 * present; otherwise scans Books-DB ONCE, caches the result in the session, and
 * returns it. Also keeps activeReservationCount in sync.
 */
function getSessionReservations_(token, sessionCustomer) {
  if (sessionCustomer && Array.isArray(sessionCustomer.reservations)) {
    return sessionCustomer.reservations;
  }
  const list = getActiveReservationsForCustomer_(sessionCustomer.customerId).map(r => ({
    reservationId: r.reservationId,
    bookNo: r.bookNo,
    bookName: r.bookName
  }));
  setSessionReservations_(token, sessionCustomer, list);
  return list;
}

/** Replace the whole cached reservation list (e.g. after a reconciling scan). */
function setSessionReservations_(token, sessionCustomer, list) {
  if (!sessionCustomer) return;
  const clean = (list || []).map(r => ({
    reservationId: trim_(r.reservationId),
    bookNo: trim_(r.bookNo),
    bookName: trim_(r.bookName)
  }));
  sessionCustomer.reservations = clean;
  sessionCustomer.activeReservationCount = clean.length;
  persistSession_(token, sessionCustomer);
}

/** Add one reservation to the cached list (no-op if bookNo already present). */
function addSessionReservation_(token, sessionCustomer, reservation) {
  const list = getSessionReservations_(token, sessionCustomer).slice();
  const key = trim_(reservation.bookNo);
  if (!list.some(r => trim_(r.bookNo) === key)) {
    list.push({
      reservationId: trim_(reservation.reservationId),
      bookNo: key,
      bookName: trim_(reservation.bookName)
    });
  }
  setSessionReservations_(token, sessionCustomer, list);
  return list;
}

/** Remove one reservation from the cached list, matched by reservationId or bookNo. */
function removeSessionReservation_(token, sessionCustomer, reservationId, bookNo) {
  const list = getSessionReservations_(token, sessionCustomer);
  const rid = trim_(reservationId);
  const bno = trim_(bookNo);
  const next = list.filter(r =>
    !((rid && trim_(r.reservationId) === rid) || (bno && trim_(r.bookNo) === bno))
  );
  setSessionReservations_(token, sessionCustomer, next);
  return next;
}

function parseMonthlyReservationLimit_(customer) {
  const explicitLimit = parseInt(customer.monthlyReservationLimit, 10);
  if (explicitLimit > 0) return explicitLimit;

  const planMatch = trim_(customer.subscriptionPlan).match(/\d+/);
  const planLimit = planMatch ? parseInt(planMatch[0], 10) : 0;
  return planLimit > 0 ? planLimit : 0;
}

function findDataRowByExactValue_(sheet, headerRow, columnIndex, value) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= headerRow + 1) return null;

  const range = sheet.getRange(headerRow + 2, columnIndex + 1, lastRow - headerRow - 1, 1);
  const match = range.createTextFinder(String(value || '').trim()).matchEntireCell(true).findNext();
  return match ? match.getRow() : null;
}

function getSheetRowValues_(sheet, rowNumber) {
  return sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function setSheetRowValues_(sheet, rowNumber, values) {
  const width = sheet.getLastColumn();
  const rowValues = values.slice(0, width);
  while (rowValues.length < width) rowValues.push('');
  sheet.getRange(rowNumber, 1, 1, width).setValues([rowValues]);
}

function getHeaderSearchValues_(sheet) {
  const rows = Math.min(Math.max(sheet.getLastRow(), 1), 10);
  const cols = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(1, 1, rows, cols).getValues();
}

function getActiveReservationsForCustomer_(customerId) {
  // PERF: reuse the single request-scoped read of Books-DB instead of
  // re-opening the spreadsheet and doing another full getDisplayValues scan.
  const master = getMasterData_();
  const { headerRow, columns, linkColumns, values } = master;
  if (linkColumns.reservedCustomerId === -1 || linkColumns.reservationId === -1) return [];

  const tz = Session.getScriptTimeZone();
  const reservations = [];

  for (let i = headerRow + 1; i < values.length; i++) {
    const row = values[i];
    if (trim_(row[linkColumns.reservedCustomerId]) !== customerId) continue;
    if (trim_(row[columns.STATUS]) !== 'Reserved') continue;

    reservations.push({
      reservationId: trim_(row[linkColumns.reservationId]),
      bookNo: trim_(row[columns.BOOK_NO]),
      bookName: trim_(row[columns.BOOK_NAME]),
      reservedAt: linkColumns.reservedAt === -1 ? '' : formatDateTime_(row[linkColumns.reservedAt], tz),
      status: trim_(row[columns.STATUS])
    });
  }

  return reservations;
}

function reservationBookKey_(bookNo) {
  return trim_(bookNo).toUpperCase().replace(/\s+/g, '');
}

function createReservationId_() {
  return 'RES-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss') + '-' +
    Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
}

function getBookReservationLinkColumns_(sheet, headerRow) {
  let added = false;
  let headerValues = sheet.getRange(headerRow + 1, 1, 1, sheet.getLastColumn()).getValues()[0];
  let headerMap = getHeaderMap_(headerValues);
  [
    RESERVATION_ID_HEADER,
    RESERVED_CUSTOMER_ID_HEADER,
    RESERVED_CUSTOMER_NAME_HEADER,
    RESERVED_AT_HEADER,
    RESERVATION_UPDATED_AT_HEADER
  ].forEach(header => {
    if (getHeaderIndex_(headerMap, header) !== -1) return;
    sheet.getRange(headerRow + 1, sheet.getLastColumn() + 1).setValue(header);
    added = true;
  });
  if (added) headerValues = sheet.getRange(headerRow + 1, 1, 1, sheet.getLastColumn()).getValues()[0];
  headerMap = getHeaderMap_(headerValues);
  return {
    reservationId: getHeaderIndex_(headerMap, RESERVATION_ID_HEADER),
    reservedCustomerId: getHeaderIndex_(headerMap, RESERVED_CUSTOMER_ID_HEADER),
    reservedCustomerName: getHeaderIndex_(headerMap, RESERVED_CUSTOMER_NAME_HEADER),
    reservedAt: getHeaderIndex_(headerMap, RESERVED_AT_HEADER),
    reservationUpdatedAt: getHeaderIndex_(headerMap, RESERVATION_UPDATED_AT_HEADER),
    added
  };
}

/**
 * PERF helper: ensures the reservation link columns exist on Books-DB (creating
 * them once if a legacy sheet is missing them), then clears the cached master
 * read so the next getMasterData_() reflects any newly added columns. In a
 * normal setup the columns already exist and this is a no-op after the header
 * read. Must be called inside the reservation lock when a write will follow.
 */
function ensureMasterLinkColumns_() {
  const ctx = getSheetAndHeader_();
  const linkColumns = getBookReservationLinkColumns_(ctx.sheet, ctx.headerRow);
  if (linkColumns.added) {
    REQUEST_CACHE_.masterData = null;
    REQUEST_CACHE_.masterSheet = null;
  }
}

function getExistingBookReservationLinkColumns_(sheet, headerRow) {
  const headerValues = sheet.getRange(headerRow + 1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const headerMap = getHeaderMap_(headerValues);
  return {
    reservationId: getHeaderIndex_(headerMap, RESERVATION_ID_HEADER),
    reservedCustomerId: getHeaderIndex_(headerMap, RESERVED_CUSTOMER_ID_HEADER),
    reservedCustomerName: getHeaderIndex_(headerMap, RESERVED_CUSTOMER_NAME_HEADER),
    reservedAt: getHeaderIndex_(headerMap, RESERVED_AT_HEADER),
    reservationUpdatedAt: getHeaderIndex_(headerMap, RESERVATION_UPDATED_AT_HEADER)
  };
}

// Read the Visibility column index (no create). -1 if the column doesn't exist.
function getBookVisibilityColumn_(sheet, headerRow) {
  const headerValues = sheet.getRange(headerRow + 1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return getHeaderIndex_(getHeaderMap_(headerValues), VISIBILITY_HEADER);
}

// Resolve the issue-tracking columns by header name (-1 if a column is absent).
function getBookIssueColumns_(sheet, headerRow) {
  const headerMap = getHeaderMap_(sheet.getRange(headerRow + 1, 1, 1, sheet.getLastColumn()).getValues()[0]);
  return {
    issuedCustomerId: getHeaderIndex_(headerMap, ISSUED_CUSTOMER_ID_HEADER),
    issuedAt: getHeaderIndex_(headerMap, ISSUED_AT_HEADER),
    dueDate: getHeaderIndex_(headerMap, DUE_DATE_HEADER)
  };
}

// Ensure the Visibility column exists (create it once if missing) and return its
// index. Clears cached master reads if a column was added.
function ensureBookVisibilityColumn_(sheet, headerRow) {
  let idx = getBookVisibilityColumn_(sheet, headerRow);
  if (idx === -1) {
    sheet.getRange(headerRow + 1, sheet.getLastColumn() + 1).setValue(VISIBILITY_HEADER);
    idx = getBookVisibilityColumn_(sheet, headerRow);
    REQUEST_CACHE_.masterData = null;
    REQUEST_CACHE_.masterSheet = null;
  }
  return idx;
}

// A book is hidden only when its Visibility cell explicitly says "Hidden".
// Empty / "Visible" / anything else = shown.
function isBookHidden_(value) {
  return trim_(value).toLowerCase() === 'hidden';
}

function clearBookReservationLink_(bookNo, reservationId) {
  const { sheet, headerRow, columns } = getSheetAndHeader_();
  const linkColumns = getBookReservationLinkColumns_(sheet, headerRow);
  const bookRowNumber = findDataRowByExactValue_(sheet, headerRow, columns.BOOK_NO, bookNo);
  if (!bookRowNumber) return;

  const row = getSheetRowValues_(sheet, bookRowNumber);
  if (trim_(row[linkColumns.reservationId]) && trim_(row[linkColumns.reservationId]) !== reservationId) return;

  row[columns.STATUS] = 'Available';
  row[linkColumns.reservationId] = '';
  row[linkColumns.reservedCustomerId] = '';
  row[linkColumns.reservedCustomerName] = '';
  row[linkColumns.reservedAt] = '';
  row[linkColumns.reservationUpdatedAt] = new Date();
  setSheetRowValues_(sheet, bookRowNumber, row);
}

function findReservedBookRowByReservationId_(sheet, headerRow, linkColumns, reservationId) {
  const rowNumber = findDataRowByExactValue_(sheet, headerRow, linkColumns.reservationId, reservationId);
  return rowNumber || null;
}

/**
 * PERF: locate a row by reservation id within an already-loaded values array.
 * Returns the 0-based array index, or -1 when not found.
 */
function findReservedRowIndexByReservationId_(values, headerRow, linkColumns, reservationId) {
  if (linkColumns.reservationId === -1) return -1;
  return findRowIndexInValues_(values, headerRow, linkColumns.reservationId, reservationId);
}

function ensureBooksReservationOwnerColumn_(ss) {
  const sheet = ss.getSheetByName(CONFIG.MASTER_SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + CONFIG.MASTER_SHEET_NAME + '" not found.');

  const data = getHeaderSearchValues_(sheet);
  let headerRow = -1;
  for (let i = 0; i < data.length; i++) {
    if (rowHasMasterHeaders_(data[i])) { headerRow = i; break; }
  }
  if (headerRow === -1) throw new Error('Could not find header row in "' + CONFIG.MASTER_SHEET_NAME + '".');

  const linkColumns = getBookReservationLinkColumns_(sheet, headerRow);
  return { sheet, headerRow, added: linkColumns.added };
}

function ensureSheetWithHeaders_(ss, sheetName, headers, summary) {
  let sheet = ss.getSheetByName(sheetName);
  let created = false;
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    created = true;
  }

  if (created || sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    if (summary) summary.createdSheets.push(sheetName);
    return { sheet, headerRow: 0, columns: getHeaderMap_(headers) };
  }

  const data = sheet.getDataRange().getValues();
  let headerRow = findHeaderRowByAnyHeader_(data, headers);
  if (headerRow === -1) {
    const firstRowBlank = data.length === 1 && data[0].every(value => !trim_(value));
    if (!firstRowBlank) throw new Error('Could not find header row in "' + sheetName + '".');
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return { sheet, headerRow: 0, columns: getHeaderMap_(headers) };
  }

  headers.forEach(header => {
    const added = ensureHeaderColumn_(sheet, headerRow, header);
    if (added && summary) summary.addedColumns.push(sheetName + ': ' + header);
  });

  const headerValues = sheet.getRange(headerRow + 1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return { sheet, headerRow, columns: getHeaderMap_(headerValues) };
}

function ensureHeaderColumn_(sheet, headerRow, headerName) {
  const width = Math.max(sheet.getLastColumn(), 1);
  const headerValues = sheet.getRange(headerRow + 1, 1, 1, width).getValues()[0];
  const normalized = headerValues.map(normalizeHeader_);
  if (normalized.includes(normalizeHeader_(headerName))) return false;

  const nextCol = sheet.getLastColumn() + 1;
  sheet.getRange(headerRow + 1, nextCol).setValue(headerName);
  return true;
}

function findHeaderRowByAnyHeader_(data, expectedHeaders) {
  const expected = expectedHeaders.map(normalizeHeader_);
  for (let i = 0; i < data.length; i++) {
    const normalized = data[i].map(normalizeHeader_);
    const matches = expected.filter(header => normalized.includes(header)).length;
    if (matches >= Math.min(3, expected.length)) return i;
  }
  return -1;
}

function getHeaderMap_(headerRowValues) {
  const map = {};
  headerRowValues.forEach((header, index) => {
    const normalized = normalizeHeader_(header);
    if (normalized && map[normalized] == null) map[normalized] = index;
  });
  return map;
}

function getHeaderIndex_(headerMap, headerName) {
  const idx = headerMap[normalizeHeader_(headerName)];
  return idx == null ? -1 : idx;
}

function getHeaderIndexByAliases_(headerMap, aliases) {
  for (const alias of aliases) {
    const idx = getHeaderIndex_(headerMap, alias);
    if (idx !== -1) return idx;
  }
  return -1;
}

function migrateLegacyCustomers_(legacySs, targetSheet, targetHeaderRow, now) {
  const legacySheet = legacySs.getSheetByName(CONFIG.CUSTOMER_SHEET_NAME);
  if (!legacySheet) throw new Error('Legacy sheet "' + CONFIG.CUSTOMER_SHEET_NAME + '" not found.');

  const legacyData = legacySheet.getDataRange().getValues();
  const legacyHeaderRow = findLegacyCustomerHeaderRow_(legacyData);
  if (legacyHeaderRow === -1) throw new Error('Could not find header row in legacy Customer DB.');

  const legacyHeaderMap = getHeaderMap_(legacyData[legacyHeaderRow]);
  const legacyColumns = {
    srNo: getHeaderIndexByAliases_(legacyHeaderMap, LEGACY_CUSTOMER_SOURCE_HEADERS.SR_NO),
    name: getHeaderIndexByAliases_(legacyHeaderMap, LEGACY_CUSTOMER_SOURCE_HEADERS.NAME),
    dateStart: getHeaderIndexByAliases_(legacyHeaderMap, LEGACY_CUSTOMER_SOURCE_HEADERS.DATE_START),
    location: getHeaderIndexByAliases_(legacyHeaderMap, LEGACY_CUSTOMER_SOURCE_HEADERS.LOCATION),
    address: getHeaderIndexByAliases_(legacyHeaderMap, LEGACY_CUSTOMER_SOURCE_HEADERS.ADDRESS),
    status: getHeaderIndexByAliases_(legacyHeaderMap, LEGACY_CUSTOMER_SOURCE_HEADERS.STATUS),
    tillDateSum: getHeaderIndexByAliases_(legacyHeaderMap, LEGACY_CUSTOMER_SOURCE_HEADERS.TILL_DATE_SUM)
  };
  if (legacyColumns.name === -1) throw new Error('Legacy Customer DB is missing the Name column.');

  const targetHeaderValues = targetSheet.getRange(targetHeaderRow + 1, 1, 1, targetSheet.getLastColumn()).getValues()[0];
  const targetHeaderMap = getHeaderMap_(targetHeaderValues);
  const targetColumns = buildCustomerDetailsColumns_(targetHeaderMap);
  const existing = readExistingCustomerDetails_(targetSheet, targetHeaderRow, targetColumns);

  let copiedCustomers = 0;
  let updatedCustomers = 0;
  let generatedCustomerIds = 0;
  let generatedInviteCodes = 0;
  const inviteCodes = [];
  const width = targetSheet.getLastColumn();

  for (let i = legacyHeaderRow + 1; i < legacyData.length; i++) {
    const sourceRow = legacyData[i];
    const name = trim_(getRowValue_(sourceRow, legacyColumns.name));
    if (!name) continue;

    const legacySr = trim_(getRowValue_(sourceRow, legacyColumns.srNo));
    const nameKey = normalizeCustomerNameKey_(name);
    const rowRecord = (legacySr && existing.byLegacySr[legacySr]) || existing.byName[nameKey] || null;
    const rowValues = rowRecord ? rowRecord.values.slice(0, width) : new Array(width).fill('');
    while (rowValues.length < width) rowValues.push('');

    setCustomerDetailValue_(rowValues, targetColumns.legacySrNo, legacySr);
    setCustomerDetailValue_(rowValues, targetColumns.name, name);
    setCustomerDetailValue_(rowValues, targetColumns.dateStart, getRowValue_(sourceRow, legacyColumns.dateStart));
    setCustomerDetailValue_(rowValues, targetColumns.location, getRowValue_(sourceRow, legacyColumns.location));
    setCustomerDetailValue_(rowValues, targetColumns.address, getRowValue_(sourceRow, legacyColumns.address));
    setCustomerDetailValue_(rowValues, targetColumns.accountStatus, trim_(getRowValue_(sourceRow, legacyColumns.status)) || 'Active');
    setCustomerDetailValue_(rowValues, targetColumns.tillDateSum, getRowValue_(sourceRow, legacyColumns.tillDateSum));
    setDefaultCustomerDetailValue_(rowValues, targetColumns.activeReservationCount, 0);
    setDefaultCustomerDetailValue_(rowValues, targetColumns.subscriptionStatus, 'NA');
    setDefaultCustomerDetailValue_(rowValues, targetColumns.authMethod, 'invite_pending');
    setDefaultCustomerDetailValue_(rowValues, targetColumns.inviteStatus, 'Pending');
    setDefaultCustomerDetailValue_(rowValues, targetColumns.createdAt, now);

    let customerId = trim_(rowValues[targetColumns.customerId]);
    if (!customerId) {
      customerId = generateCustomerId_(name, existing.usedCustomerIds);
      setCustomerDetailValue_(rowValues, targetColumns.customerId, customerId);
      generatedCustomerIds++;
    }
    existing.usedCustomerIds[customerId] = true;

    const inviteStatus = trim_(rowValues[targetColumns.inviteStatus]);
    if (!trim_(rowValues[targetColumns.inviteCodeHash]) && inviteStatus !== 'Claimed') {
      const inviteCode = generateInviteCode_();
      setCustomerDetailValue_(rowValues, targetColumns.inviteCodeHash, hashInviteCode_(customerId, inviteCode));
      setDefaultCustomerDetailValue_(rowValues, targetColumns.inviteStatus, 'Pending');
      inviteCodes.push({ customerId, name, inviteCode });
      generatedInviteCodes++;
    }

    if (rowRecord) {
      targetSheet.getRange(rowRecord.rowNumber, 1, 1, width).setValues([rowValues.slice(0, width)]);
      updatedCustomers++;
    } else {
      targetSheet.appendRow(rowValues.slice(0, width));
      copiedCustomers++;
    }

    existing.customerIdByName[nameKey] = customerId;
    if (legacySr) existing.byLegacySr[legacySr] = { rowNumber: rowRecord ? rowRecord.rowNumber : targetSheet.getLastRow(), values: rowValues };
    existing.byName[nameKey] = { rowNumber: rowRecord ? rowRecord.rowNumber : targetSheet.getLastRow(), values: rowValues };
  }

  return {
    copiedCustomers,
    updatedCustomers,
    generatedCustomerIds,
    generatedInviteCodes,
    inviteCodes,
    customerIdByName: existing.customerIdByName
  };
}

function findLegacyCustomerHeaderRow_(data) {
  for (let i = 0; i < data.length; i++) {
    const headerMap = getHeaderMap_(data[i]);
    if (getHeaderIndexByAliases_(headerMap, LEGACY_CUSTOMER_SOURCE_HEADERS.NAME) !== -1) return i;
  }
  return -1;
}

function buildCustomerDetailsColumns_(headerMap) {
  const columns = {
    customerId: getHeaderIndex_(headerMap, 'Customer ID'),
    legacySrNo: getHeaderIndex_(headerMap, 'Legacy Sr No'),
    name: getHeaderIndex_(headerMap, 'Name'),
    dateStart: getHeaderIndex_(headerMap, 'Date of Start'),
    location: getHeaderIndex_(headerMap, 'Location'),
    address: getHeaderIndex_(headerMap, 'Address'),
    accountStatus: getHeaderIndex_(headerMap, 'Account Status'),
    tillDateSum: getHeaderIndex_(headerMap, 'Till Date Sum'),
    activeReservationCount: getHeaderIndex_(headerMap, 'Active Reservation Count'),
    subscriptionStatus: getHeaderIndex_(headerMap, 'Subscription Status'),
    authMethod: getHeaderIndex_(headerMap, 'Auth Method'),
    inviteCodeHash: getHeaderIndex_(headerMap, 'Invite Code Hash'),
    inviteStatus: getHeaderIndex_(headerMap, 'Invite Status'),
    createdAt: getHeaderIndex_(headerMap, 'Created At')
  };

  Object.keys(columns).forEach(key => {
    if (columns[key] === -1) throw new Error('Customer Details is missing required column: ' + key);
  });
  return columns;
}

function readExistingCustomerDetails_(sheet, headerRow, columns) {
  const data = sheet.getDataRange().getValues();
  const byLegacySr = {};
  const byName = {};
  const usedCustomerIds = {};
  const customerIdByName = {};

  for (let i = headerRow + 1; i < data.length; i++) {
    const row = data[i];
    const name = trim_(row[columns.name]);
    if (!name) continue;

    const rowNumber = i + 1;
    const legacySr = trim_(row[columns.legacySrNo]);
    const customerId = trim_(row[columns.customerId]);
    const nameKey = normalizeCustomerNameKey_(name);
    const record = { rowNumber, values: row };

    if (legacySr) byLegacySr[legacySr] = record;
    byName[nameKey] = record;
    if (customerId) {
      usedCustomerIds[customerId] = true;
      customerIdByName[nameKey] = customerId;
    }
  }

  return { byLegacySr, byName, usedCustomerIds, customerIdByName };
}

function setCustomerDetailValue_(rowValues, index, value) {
  if (index !== -1) rowValues[index] = value == null ? '' : value;
}

function setDefaultCustomerDetailValue_(rowValues, index, value) {
  if (index !== -1 && !trim_(rowValues[index])) rowValues[index] = value;
}

function getRowValue_(row, index) {
  return index === -1 ? '' : row[index];
}

function generateCustomerId_(name, usedCustomerIds) {
  const segments = customerIdNameSegments_(name);
  for (let attempts = 0; attempts < 200; attempts++) {
    const suffix = String(Math.floor(10000 + Math.random() * 90000));
    const id = 'KFK-' + segments.first + '-' + segments.last + '-' + suffix;
    if (!usedCustomerIds[id]) return id;
  }
  throw new Error('Could not generate a unique customer id for ' + name + '.');
}

function customerIdNameSegments_(name) {
  const cleaned = trim_(name)
    .toUpperCase()
    .replace(/[^A-Z ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = cleaned ? cleaned.split(' ') : [];
  const first = (parts[0] || 'CUSTOMER').slice(0, 10);
  const last = (parts.length > 1 ? parts[parts.length - 1] : 'CUSTOMER').slice(0, 10);
  return { first, last };
}

function generateInviteCode_() {
  const bytes = Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase();
  return 'KFK-' + bytes.slice(0, 5) + '-' + bytes.slice(5);
}

function hashInviteCode_(customerId, inviteCode) {
  return sha256Hex_(String(customerId || '') + ':' + String(inviteCode || ''));
}

function sha256Hex_(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8);
  return bytes.map(byte => {
    const unsigned = byte < 0 ? byte + 256 : byte;
    return ('0' + unsigned.toString(16)).slice(-2);
  }).join('');
}

function normalizeCustomerNameKey_(name) {
  return normalizeHeader_(name);
}

// ─────────────────────────────────────────────────────────────
// Request-scoped cache (PERF)
// Apps Script runs each web-app call as a single, isolated execution,
// so module-level state lives for exactly one request and resets on the
// next. We use it to open the spreadsheet ONCE and resolve header/column
// layouts ONCE per request instead of on every helper call.
// ─────────────────────────────────────────────────────────────
var REQUEST_CACHE_ = {};

function resetRequestCache_() {
  REQUEST_CACHE_ = {};
}

function getSpreadsheet_() {
  if (!REQUEST_CACHE_.spreadsheet) {
    REQUEST_CACHE_.spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  }
  return REQUEST_CACHE_.spreadsheet;
}

function getSheetAndHeader_() {
  if (REQUEST_CACHE_.masterSheet) return REQUEST_CACHE_.masterSheet;

  const ss    = getSpreadsheet_();
  const sheet = ss.getSheetByName(CONFIG.MASTER_SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + CONFIG.MASTER_SHEET_NAME + '" not found.');

  const data = getHeaderSearchValues_(sheet);
  let headerRow = -1;
  for (let i = 0; i < data.length; i++) {
    if (rowHasMasterHeaders_(data[i])) { headerRow = i; break; }
  }
  if (headerRow === -1) throw new Error('Could not find header row in "' + CONFIG.MASTER_SHEET_NAME + '".');

  const columns = getMasterColumnMap_(data[headerRow]);

  REQUEST_CACHE_.masterSheet = { sheet, headerRow, columns };
  return REQUEST_CACHE_.masterSheet;
}

/**
 * Reads the full Books-DB data range ONCE per request (raw values) and caches
 * it. Callers that need to find/mutate a book row should use this instead of
 * separate getLastRow + TextFinder + getRange reads. Returns { headerRow,
 * columns, linkColumns, values } where values is the full 2-D array.
 */
function getMasterData_() {
  if (REQUEST_CACHE_.masterData) return REQUEST_CACHE_.masterData;

  const __t = Date.now();
  const ctx = getSheetAndHeader_();
  const linkColumns = getExistingBookReservationLinkColumns_(ctx.sheet, ctx.headerRow);
  const values = ctx.sheet.getDataRange().getValues();
  Logger.log('[PERF getMasterData_] full read of ' + values.length + ' rows: ' + (Date.now() - __t) + 'ms');

  REQUEST_CACHE_.masterData = {
    sheet: ctx.sheet,
    headerRow: ctx.headerRow,
    columns: ctx.columns,
    linkColumns,
    values
  };
  return REQUEST_CACHE_.masterData;
}

/**
 * Finds the 0-based index within a loaded values array whose column matches the
 * given value exactly (after trim). Returns -1 when not found.
 */
function findRowIndexInValues_(values, headerRow, columnIndex, value) {
  const needle = trim_(value);
  for (let i = headerRow + 1; i < values.length; i++) {
    if (trim_(values[i][columnIndex]) === needle) return i;
  }
  return -1;
}

/**
 * Writes a single row (given by its 0-based array index) back to the sheet from
 * an in-memory values array. One setValues round-trip.
 */
function writeMasterRow_(master, rowArrayIndex) {
  const width = master.values[rowArrayIndex].length;
  master.sheet.getRange(rowArrayIndex + 1, 1, 1, width).setValues([master.values[rowArrayIndex].slice(0, width)]);
}

function rowHasMasterHeaders_(row) {
  const normalized = row.map(normalizeHeader_);
  const requiredHeaders = [
    MASTER_HEADERS.SR_NO,
    MASTER_HEADERS.LANGUAGE,
    MASTER_HEADERS.BOOK_NO,
    MASTER_HEADERS.AGE_GROUP,
    MASTER_HEADERS.BOOK_NAME,
    MASTER_HEADERS.CATEGORY,
    MASTER_HEADERS.ISSUED_TO,
    MASTER_HEADERS.AUTHOR,
    MASTER_HEADERS.STATUS
  ];
  return requiredHeaders.every(header => normalized.includes(normalizeHeader_(header)));
}

function getMasterColumnMap_(headerRowValues) {
  const columns = {};
  const normalizedHeaders = headerRowValues.map(normalizeHeader_);
  const missingHeaders = [];

  Object.keys(MASTER_HEADERS).forEach(key => {
    const headerName = MASTER_HEADERS[key];
    const idx = normalizedHeaders.indexOf(normalizeHeader_(headerName));
    if (idx === -1) {
      missingHeaders.push(headerName);
      return;
    }
    columns[key] = idx;
  });

  if (missingHeaders.length) {
    throw new Error('Missing book source column(s): ' + missingHeaders.join(', '));
  }

  return columns;
}

function normalizeHeader_(value) {
  return trim_(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Builds bookNo → thumbnail URL map.
 * 1. Scans Drive folders for filename → fileId map.
 * 2. Reads "Image Name" column from sheet.
 * 3. Joins them: bookNo → thumbnail URL.
 * Cached for 30 minutes.
 */
function getImageMap_() {
  const cache  = CacheService.getScriptCache();
  const cached = cache.get(IMAGE_CACHE_KEY);
  if (cached) return JSON.parse(cached);

  // Step 1: filename (lowercase) and normalized filename → fileId
  const fileIdMap = {};
  const normalizedFileIdMap = {};
  CONFIG.IMAGE_FOLDER_IDS.forEach(folderId => {
    try {
      const folder = DriveApp.getFolderById(folderId);
      recordImageFilesInFolder_(folder, fileIdMap, normalizedFileIdMap);
    } catch (e) { Logger.log('Drive folder error: ' + e.message); }
  });

  // Step 2: Read Image Name column from sheet
  const { sheet, headerRow, columns } = getSheetAndHeader_();
  const data = sheet.getDataRange().getDisplayValues();

  const map = {};
  for (let i = headerRow + 1; i < data.length; i++) {
    const bookNo    = trim_(data[i][columns.BOOK_NO]);
    const bookName  = trim_(data[i][columns.BOOK_NAME]);
    const imagePath = trim_(data[i][columns.IMAGE_NAME]) || IMAGE_MAP[bookNo] || '';  // e.g. "Horrid Henry- Revenge.jpg"
    if (!bookNo) continue;

    const fileId = findImageFileId_(imagePath, bookName, bookNo, fileIdMap, normalizedFileIdMap);
    if (fileId) {
      map[bookNo] = buildDriveThumbnailUrl_(fileId);
    }
  }

  try { cache.put(IMAGE_CACHE_KEY, JSON.stringify(map), 1800); } catch (e) {}
  return map;
}

function getCachedImageMap_() {
  const cached = CacheService.getScriptCache().get(IMAGE_CACHE_KEY);
  if (!cached) return {};
  try {
    return JSON.parse(cached);
  } catch (e) {
    CacheService.getScriptCache().remove(IMAGE_CACHE_KEY);
    return {};
  }
}

function recordImageFilesInFolder_(folder, fileIdMap, normalizedFileIdMap) {
  const files = folder.getFiles();
  while (files.hasNext()) {
    recordImageFile_(files.next(), fileIdMap, normalizedFileIdMap);
  }

  const subFolders = folder.getFolders();
  while (subFolders.hasNext()) {
    recordImageFilesInFolder_(subFolders.next(), fileIdMap, normalizedFileIdMap);
  }
}

function recordImageFile_(file, fileIdMap, normalizedFileIdMap) {
  const fileName = trim_(file.getName());
  const fileId = file.getId();
  fileIdMap[fileName.toLowerCase()] = fileId;
  const normalizedName = normalizeImageFileName_(fileName);
  if (normalizedName && !normalizedFileIdMap[normalizedName]) {
    normalizedFileIdMap[normalizedName] = fileId;
  }
}

function findImageFileId_(imagePath, bookName, bookNo, fileIdMap, normalizedFileIdMap) {
  const imageFileName = trim_(imagePath).split('/').pop();
  const exactKey = imageFileName.toLowerCase();
  return fileIdMap[exactKey] ||
         normalizedFileIdMap[normalizeImageFileName_(imageFileName)] ||
         normalizedFileIdMap[normalizeImageFileName_(bookName)] ||
         normalizedFileIdMap[normalizeHeader_(bookNo)] ||
         '';
}

function buildDriveThumbnailUrl_(fileId) {
  return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(fileId) + '&sz=w400';
}

function normalizeImageFileName_(fileName) {
  return normalizeHeader_(String(fileName || '').replace(/\.[^.]+$/, ''));
}

function verifyAdmin_(password) {
  const stored = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  return Boolean(stored) && password === stored;
}

// True when the given identifier + password match the configured admin
// credentials (ADMIN_USERNAME + ADMIN_PASSWORD script properties).
function verifyAdminCredentials_(identifier, password) {
  const props = PropertiesService.getScriptProperties();
  const storedUser = trim_(props.getProperty('ADMIN_USERNAME'));
  const storedPass = props.getProperty('ADMIN_PASSWORD');
  if (!storedUser || !storedPass) return false;
  return trim_(identifier).toLowerCase() === storedUser.toLowerCase() && password === storedPass;
}

function verifyAdminCredential_(credential) {
  if (!credential) return false;
  const key = adminSessionKey_(credential);
  const cache = CacheService.getScriptCache();
  if (cache.get(key) !== '1') return false;

  // Sliding expiry while the admin is actively using the app.
  cache.put(key, '1', ADMIN_SESSION_SECS);
  return true;
}

function adminSessionKey_(token) {
  return 'ADMIN_SESSION_' + String(token || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 100);
}

/**
 * Sliding-window rate limit. Backward compatible: returns a boolean that is
 * truthy when the caller may proceed. When blocked it returns `false`, and the
 * seconds-until-retry are stashed on `checkRateLimit_.lastRetryAfter` so callers
 * can build a precise "try again in N" message (see rateLimitMessage_).
 *
 * We store the window START time with the count so we can compute how long is
 * left in the window (CacheService doesn't expose TTL).
 */
function checkRateLimit_(scope, maxAttempts, windowSeconds) {
  const cache = CacheService.getScriptCache();
  const key   = 'RATE_' + scope + '_' + callerKey_();
  const now   = Date.now();

  let count = 0;
  let windowStart = now;
  const raw = cache.get(key);
  if (raw) {
    const parts = raw.split('|'); // "count|windowStartMillis"
    count = parseInt(parts[0], 10) || 0;
    windowStart = parseInt(parts[1], 10) || now;
  }

  const elapsedSec = Math.floor((now - windowStart) / 1000);
  const remainingSec = Math.max(0, windowSeconds - elapsedSec);

  if (count >= maxAttempts) {
    checkRateLimit_.lastRetryAfter = remainingSec > 0 ? remainingSec : windowSeconds;
    return false;
  }

  // Preserve the original window start (so the counter expires as one window),
  // and re-put with the remaining TTL so cache eviction matches the window.
  cache.put(key, (count + 1) + '|' + windowStart, remainingSec > 0 ? remainingSec : windowSeconds);
  checkRateLimit_.lastRetryAfter = 0;
  return true;
}

// Human-friendly "try again in …" text from the last rate-limit block.
function rateLimitMessage_(prefix) {
  const secs = Math.max(1, parseInt(checkRateLimit_.lastRetryAfter, 10) || 0);
  let when;
  if (secs < 60) {
    when = 'in ' + secs + ' second' + (secs === 1 ? '' : 's');
  } else {
    const mins = Math.ceil(secs / 60);
    when = 'in about ' + mins + ' minute' + (mins === 1 ? '' : 's');
  }
  return (prefix || 'Too many attempts.') + ' Please try again ' + when + '.';
}

function callerKey_() {
  try {
    return Session.getTemporaryActiveUserKey() || 'anonymous';
  } catch (e) {
    return 'anonymous';
  }
}

// Standard error response. Always logs the real error. When adminCredential is
// a valid admin session, the real message is also returned to the client (in
// `error` + `adminDetail`) so config/sheet issues are diagnosable in-app; for
// everyone else the message stays generic (no internal details leak).
function reportError_(context, err, adminCredential) {
  const detail = (err && err.message) ? err.message : String(err);
  Logger.log(context + ' error: ' + detail + (err && err.stack ? '\n' + err.stack : ''));

  if (adminCredential && verifyAdminCredential_(adminCredential)) {
    return { success: false, error: '[' + context + '] ' + detail, adminDetail: detail };
  }
  return { success: false, error: 'Something went wrong. Please try again.' };
}

function trim_(val) {
  return String(val == null ? '' : val).trim();
}

function formatDate_(val, tz) {
  if (!val || val === '') return '';
  try { return Utilities.formatDate(new Date(val), tz, 'dd/MM/yyyy'); }
  catch (e) { return String(val); }
}

// Date + time down to seconds, e.g. "26/07/2026 19:43:07".
function formatDateTime_(val, tz) {
  if (val === '' || val == null) return '';
  try { return Utilities.formatDate(new Date(val), tz, 'dd/MM/yyyy HH:mm:ss'); }
  catch (e) { return String(val); }
}
