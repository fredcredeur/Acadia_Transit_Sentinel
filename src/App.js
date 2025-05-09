import React, { useState, useEffect, useRef, useMemo } from 'react';
import "tailwindcss/tailwind.css";
import "./App.css"; // contains the .coin rules

// --- Constants ---
const GAME_MUSIC_TRACKS = [
  '/sounds/GamplayMusic1.mp3',
  '/sounds/GameplayMusic2.mp3',
  '/sounds/GameplayMusic3.mp3',
  '/sounds/intense_gameplay_music.mp3',
  '/sounds/furelise_gameplay_music.mp3',
  '/sounds/north_gamplay_music.mp3'
];
const MENU_MUSIC_URL = '/sounds/Game-Menu.mp3';
const COUNTDOWN_SOUND_URL = '/sounds/countdown.mp3';
const COIN_SOUND_URL = '/sounds/foley_money_coin_drop.mp3';
const BUTTON_CLICK_SOUND_URL = '/sounds/button_click.mp3';
const GAMEOVER_WIN_SOUND_URL = '/sounds/gameover_win.mp3';
const GAMEOVER_LOSE_SOUND_URL = '/sounds/gameover_lose.mp3';

const pickRandomGameTrack = () =>
  GAME_MUSIC_TRACKS[Math.floor(Math.random() * GAME_MUSIC_TRACKS.length)];

const createNewSaveData = (playerName = 'New Game') => ({
  saveId: Date.now(),
  lastPlayed: Date.now(),
  playerName,
  credits: 250,
  purchasedTopics: ['colorNames', 'fruitNames', 'animalNames'],
  currentTopic: 'colorNames',
  hintTokens: 3,
  timeExtensions: 2,
  highScore: 0,
  totalWordsFound: 0,
  gamesPlayed: 0,
  hintsUsedTotal: 0,
  timeUsedTotal: 0,
  boostersUsedTotal: 0,
  creditBoosters: 0,
});

const loadAllSaves = () =>
  JSON.parse(localStorage.getItem('topicLingoSaves')) || [];

// --- Hoisted Static Data ---
const topicWords = {
// BEGINNER LEVEL
colorNames: [
    'red', 'blue', 'green', 'yellow', 'purple', 'orange', 'black', 'white', 'pink', 'brown',
    'gray', 'cyan', 'magenta', 'violet', 'indigo', 'teal', 'beige', 'maroon', 'lavender', 'turquoise',
    'gold', 'silver', 'crimson', 'navy', 'lime', 'amber', 'coral', 'peach', 'olive', 'mint',
    'salmon', 'tan', 'khaki', 'plum', 'burgundy', 'charcoal', 'emerald', 'ruby', 'sapphire', 'ivory',
    'chocolate', 'coffee', 'cream', 'mauve', 'periwinkle', 'rust', 'slate', 'taupe', 'aqua', 'fuchsia'
],
numberWords: [
    'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
    'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'thousand', 'million',
    'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
    'dozen', 'pair', 'triple', 'quarter', 'half', 'double', 'zero', 'once', 'twice', 'thrice'
],
geometricShapes: [
    'circle', 'square', 'triangle', 'rectangle', 'oval', 'diamond', 'star', 'heart', 'hexagon', 'octagon',
    'pentagon', 'crescent', 'cube', 'sphere', 'cone', 'cylinder', 'pyramid', 'arrow', 'cross', 'spiral',
    'trapezoid', 'semicircle', 'parallelogram', 'rhombus', 'arch', 'zigzag', 'ring', 'dot', 'line', 'curve',
    'prism', 'teardrop', 'hourglass', 'wave', 'pillar', 'ring', 'horseshoe', 'crown', 'shield', 'clover',
    'snowflake', 'asteroid', 'starburst', 'lattice', 'corkscrew', 'polygon', 'decagon', 'ellipse', 'arc', 'grid'
],
partsOfTheBody: [
    'arm', 'leg', 'hand', 'foot', 'eye', 'nose', 'ear', 'mouth', 'hair', 'finger',
    'toe', 'knee', 'elbow', 'shoulder', 'neck', 'back', 'chest', 'stomach', 'ankle', 'wrist',
    'chin', 'cheek', 'eyebrow', 'lip', 'hip', 'heart', 'lung', 'kidney', 'muscle', 'brain',
    'liver', 'intestine', 'bone', 'skull', 'spine', 'rib', 'pelvis', 'thumb', 'palm', 'knuckle',
    'forehead', 'eyelash', 'eyelid', 'tongue', 'tooth', 'gum', 'jaw', 'throat', 'waist', 'thigh'
],
fruitNames: [
    'apple', 'banana', 'orange', 'mango', 'pineapple', 'strawberry', 'blueberry', 'peach', 'pear', 'kiwi',
    'grapes', 'watermelon', 'cherry', 'papaya', 'plum', 'lemon', 'lime', 'grapefruit', 'apricot', 'coconut',
    'blackberry', 'raspberry', 'fig', 'pomegranate', 'melon', 'avocado', 'guava', 'passionfruit', 'lychee', 'dragonfruit',
    'cranberry', 'tangerine', 'nectarine', 'persimmon', 'starfruit', 'mulberry', 'boysenberry', 'elderberry', 'gooseberry', 'durian',
    'jackfruit', 'kumquat', 'clementine', 'cantaloupe', 'honeydew', 'quince', 'rhubarb', 'date', 'plantain', 'breadfruit'
],
vegetableNames: [
    'carrot', 'broccoli', 'potato', 'spinach', 'lettuce', 'tomato', 'onion', 'cucumber', 'pepper', 'cauliflower',
    'celery', 'eggplant', 'garlic', 'cabbage', 'mushroom', 'asparagus', 'radish', 'beet', 'corn', 'squash',
    'peas', 'zucchini', 'kale', 'sweetpotato', 'brusselssprout', 'pumpkin', 'artichoke', 'leek', 'greenbean', 'okra',
    'turnip', 'parsnip', 'rutabaga', 'shallot', 'scallion', 'arugula', 'endive', 'fennel', 'bokchoy', 'watercress',
    'collardgreens', 'mustardgreens', 'kohlrabi', 'daikon', 'tomatillo', 'jicama', 'ginger', 'horseradish', 'rhubarb', 'chayote'
],
animalNames: [
    'lion', 'tiger', 'elephant', 'giraffe', 'monkey', 'zebra', 'panda', 'rhino', 'bear', 'hippo',
    'flamingo', 'gorilla', 'kangaroo', 'penguin', 'lemur', 'camel', 'ostrich', 'wolf', 'jaguar', 'cheetah',
    'koala', 'alligator', 'antelope', 'otter', 'chimpanzee', 'sloth', 'meerkat', 'armadillo', 'porcupine', 'seal',
    'dolphin', 'whale', 'shark', 'octopus', 'turtle', 'crocodile', 'squirrel', 'rabbit', 'deer', 'fox',
    'raccoon', 'hedgehog', 'badger', 'beaver', 'bison', 'buffalo', 'eagle', 'hawk', 'owl', 'parrot'
],
insectsAndBugs: [
    'ant', 'bee', 'butterfly', 'caterpillar', 'cricket', 'dragonfly', 'fly', 'grasshopper', 'ladybug', 'mosquito',
    'moth', 'spider', 'wasp', 'beetle', 'cockroach', 'flea', 'termite', 'tick', 'aphid', 'cicada',
    'firefly', 'gnat', 'hornet', 'centipede', 'millipede', 'mantis', 'silverfish', 'earwig', 'scorpion', 'pillbug',
    'snail', 'slug', 'worm', 'maggot', 'mealworm', 'weevil', 'mite', 'locust', 'silkworm', 'honeybee',
    'bumblebee', 'doodlebug', 'stinkbug', 'walkingstick', 'monarch', 'swallowtail', 'tarantula', 'blackwidow', 'housefly', 'bedbug'
],
clothingItems: [
    'shirt', 'pants', 'socks', 'jacket', 'shoes', 'dress', 'skirt', 'hat', 'gloves', 'scarf',
    'sweater', 'shorts', 'belt', 'coat', 'tie', 'suit', 'boots', 'sandals', 'hoodie', 'vest',
    'jeans', 'cap', 'sunglasses', 'swimsuit', 'pajamas', 'tshirt', 'underwear', 'cardigan', 'raincoat', 'leggings',
    'blazer', 'blouse', 'sweatshirt', 'sweatpants', 'polo', 'turtleneck', 'tanktop', 'robe', 'slippers', 'bra',
    'boxers', 'briefs', 'bowtie', 'cufflinks', 'earmuffs', 'headband', 'kilt', 'mittens', 'poncho', 'suspenders'
],
weatherTerms: [
    'rain', 'snow', 'sunshine', 'cloud', 'wind', 'storm', 'thunder', 'lightning', 'fog', 'hail',
    'sleet', 'frost', 'ice', 'blizzard', 'hurricane', 'tornado', 'cyclone', 'typhoon', 'drought', 'flood',
    'rainbow', 'temperature', 'humidity', 'pressure', 'breeze', 'gust', 'shower', 'downpour', 'drizzle', 'mist',
    'dew', 'overcast', 'clear', 'sunny', 'cloudy', 'rainy', 'snowy', 'windy', 'stormy', 'freezing',
    'heatwave', 'monsoon', 'sandstorm', 'avalanche', 'forecast', 'meteorology', 'climate', 'season', 'front', 'precipitation'
],
childrensToys: [
    'doll', 'ball', 'block', 'puzzle', 'teddy', 'car', 'truck', 'train', 'robot', 'kite',
    'yoyo', 'frisbee', 'top', 'slinky', 'marbles', 'dominoes', 'balloon', 'bubbles', 'playdough', 'lego',
    'bicycle', 'skateboard', 'scooter', 'rollerblades', 'jumprope', 'hula-hoop', 'puppet', 'rattle', 'stuffed-animal', 'action-figure',
    'dollhouse', 'rocking-horse', 'drum', 'whistle', 'harmonica', 'chalk', 'crayon', 'marker', 'paint', 'clay',
    'spinner', 'magnet', 'telescope', 'microscope', 'binoculars', 'compass', 'kaleidoscope', 'board-game', 'card-game', 'video-game'
],

// INTERMEDIATE LEVEL
kitchenUtensils: [
    'spoon', 'knife', 'fork', 'plate', 'cup', 'pan', 'pot', 'blender', 'mixer', 'oven',
    'refrigerator', 'microwave', 'cuttingboard', 'measuringcup', 'whisk', 'ladle', 'spatula', 'grater', 'colander', 'toaster',
    'kettle', 'dishwasher', 'freezer', 'apron', 'peeler', 'canopener', 'tongs', 'rollingpin', 'timer', 'bowl',
    'strainer', 'sieve', 'scale', 'thermometer', 'chopsticks', 'corkscrew', 'funnel', 'garlic-press', 'grinder', 'juicer',
    'mandoline', 'masher', 'mortar', 'pestle', 'nutcracker', 'oven-mitt', 'potholder', 'shears', 'skewer', 'trivet'
],
beachItems: [
    'sand', 'shell', 'crab', 'seaweed', 'umbrella', 'towel', 'sandcastle', 'wave', 'surfboard', 'sunglasses',
    'flipflops', 'sunscreen', 'seagull', 'bucket', 'palmtree', 'snorkel', 'starfish', 'lifeguard', 'cooler', 'volleyball',
    'frisbee', 'jellyfish', 'paddleboard', 'kite', 'boat', 'hat', 'coral', 'driftwood', 'pebbles', 'fishingrod',
    'swimsuit', 'trunks', 'bikini', 'shoreline', 'tide', 'current', 'reef', 'lighthouse', 'pier', 'dock',
    'marina', 'buoy', 'sailboat', 'yacht', 'kayak', 'dolphin', 'shark', 'turtle', 'clam', 'oyster'
],
desserts: [
    'cake', 'pie', 'cookie', 'brownie', 'icecream', 'cupcake', 'donut', 'cheesecake', 'pudding', 'tiramisu',
    'mousse', 'muffin', 'eclair', 'pastry', 'custard', 'gelato', 'sundae', 'tart', 'macaron', 'cobbler',
    'sorbet', 'parfait', 'strudel', 'baklava', 'crepe', 'cannoli', 'flan', 'churro', 'popsicle', 'trifle',
    'brittle', 'fudge', 'truffle', 'praline', 'meringue', 'pavlova', 'biscotti', 'scone', 'croissant', 'cinnamon-roll',
    'fritter', 'dumpling', 'souffle', 'waffle', 'pancake', 'milkshake', 'smoothie', 'shortcake', 'crumble', 'bread-pudding'
],
transportation: [
    'car', 'bus', 'train', 'airplane', 'bicycle', 'motorcycle', 'boat', 'subway', 'helicopter', 'scooter',
    'tram', 'ship', 'skateboard', 'rollerblades', 'ferry', 'van', 'tractor', 'rv', 'segway', 'ambulance',
    'truck', 'taxi', 'hotairballoon', 'spaceship', 'gondola', 'horse', 'jetski', 'snowmobile', 'canoe', 'kayak',
    'hovercraft', 'submarine', 'rocket', 'drone', 'zeppelin', 'monorail', 'cablecar', 'escalator', 'elevator', 'parachute',
    'hangglider', 'paraglider', 'camel', 'elephant', 'rickshaw', 'dogsled', 'skis', 'snowshoes', 'unicycle', 'forklift'
],
furnitureItems: [
    'chair', 'table', 'sofa', 'bed', 'desk', 'dresser', 'bookshelf', 'cabinet', 'nightstand', 'stool',
    'ottoman', 'armchair', 'bench', 'futon', 'couch', 'loveseat', 'recliner', 'wardrobe', 'hutch', 'vanity',
    'crib', 'cradle', 'highchair', 'footstool', 'barstool', 'buffet', 'sideboard', 'china-cabinet', 'coffee-table', 'end-table',
    'dining-table', 'bunk-bed', 'hammock', 'bean-bag', 'rocking-chair', 'folding-chair', 'deck-chair', 'chaise-lounge', 'daybed', 'trundle-bed',
    'four-poster', 'canopy-bed', 'waterbed', 'console', 'entertainment-center', 'credenza', 'curio-cabinet', 'file-cabinet', 'safe', 'coat-rack'
],
schoolSubjects: [
    'math', 'science', 'english', 'history', 'geography', 'art', 'music', 'chemistry', 'biology', 'physics',
    'spanish', 'french', 'drama', 'economics', 'algebra', 'calculus', 'literature', 'psychology', 'philosophy', 'computerscience',
    'geometry', 'civics', 'sociology', 'health', 'pe', 'homeeconomics', 'business', 'anthropology', 'astronomy', 'engineering',
    'statistics', 'accounting', 'marketing', 'journalism', 'photography', 'filmmaking', 'architecture', 'agriculture', 'automotive', 'woodshop',
    'electronics', 'robotics', 'debate', 'latin', 'german', 'chinese', 'japanese', 'italian', 'russian', 'arabic'
],
emotions: [
    'happy', 'sad', 'angry', 'scared', 'excited', 'bored', 'confused', 'surprised', 'nervous', 'proud',
    'calm', 'peaceful', 'worried', 'frustrated', 'disappointed', 'jealous', 'curious', 'grateful', 'lonely', 'embarrassed',
    'guilty', 'content', 'anxious', 'hopeful', 'confident', 'annoyed', 'disgusted', 'amused', 'nostalgic', 'shy',
    'joyful', 'indifferent', 'enthusiastic', 'optimistic', 'pessimistic', 'sympathetic', 'overwhelmed', 'relieved', 'satisfied', 'cheerful',
    'depressed', 'stressed', 'shocked', 'determined', 'delighted', 'tense', 'alarmed', 'inspired', 'miserable', 'ecstatic'
],
musicalInstruments: [
    'guitar', 'piano', 'violin', 'trumpet', 'flute', 'drums', 'saxophone', 'clarinet', 'harp', 'cello',
    'trombone', 'tuba', 'banjo', 'bass', 'viola', 'harmonica', 'accordion', 'mandolin', 'ukulele', 'synthesizer',
    'recorder', 'xylophone', 'marimba', 'oboe', 'bassoon', 'organ', 'cymbals', 'tambourine', 'conga', 'bagpipes',
    'triangle', 'timpani', 'castanets', 'bongos', 'djembe', 'sitar', 'koto', 'shamisen', 'erhu', 'dulcimer',
    'lyre', 'ocarina', 'panpipes', 'theremin', 'keytar', 'balalaika', 'didgeridoo', 'glockenspiel', 'kalimba', 'hurdy-gurdy'
],
toolsAndHardware: [
    'hammer', 'screwdriver', 'wrench', 'pliers', 'saw', 'drill', 'level', 'tape-measure', 'chisel', 'clamp',
    'vise', 'crowbar', 'shovel', 'rake', 'wheelbarrow', 'ladder', 'scissors', 'utility-knife', 'sandpaper', 'wire-cutters',
    'socket-wrench', 'allen-key', 'mallet', 'handsaw', 'circular-saw', 'jigsaw', 'nail-gun', 'staple-gun', 'glue-gun', 'caulking-gun',
    'soldering-iron', 'blowtorch', 'grinder', 'buffer', 'router', 'plane', 'trowel', 'awl', 'file', 'rasp',
    'square', 'protractor', 'compass', 'chalk-line', 'spirit-level', 'stud-finder', 'wire-stripper', 'multimeter', 'hacksaw', 'pipe-wrench'
],
sports: [
    'soccer', 'basketball', 'baseball', 'tennis', 'golf', 'hockey', 'rugby', 'cricket', 'boxing', 'volleyball',
    'swimming', 'football', 'lacrosse', 'badminton', 'bowling', 'gymnastics', 'surfing', 'skating', 'skiing', 'snowboarding',
    'cycling', 'diving', 'wrestling', 'running', 'archery', 'judo', 'karate', 'fencing', 'sailing', 'tabletennis',
    'handball', 'squash', 'polo', 'rowing', 'canoeing', 'kayaking', 'climbing', 'parkour', 'skateboarding', 'bmx',
    'motocross', 'triathlon', 'marathon', 'weightlifting', 'crossfit', 'curling', 'darts', 'billiards', 'snooker', 'softball'
],

// ADVANCED LEVEL
boardGames: [
    'monopoly', 'chess', 'checkers', 'scrabble', 'risk', 'clue', 'sorry', 'battleship', 'candyland', 'life',
    'guesswho', 'operation', 'stratego', 'pictionary', 'uno', 'connectfour', 'trouble', 'yahtzee', 'chutesandladders', 'applestoapples',
    'trivialpursuit', 'tickettoride', 'jenga', 'twister', 'catan', 'pandemic', 'carcassonne', 'scattergories', 'boggle', 'taboo',
    'dominion', 'splendor', 'azul', 'codenames', 'dixit', 'mysterium', 'terraforming-mars', 'gloomhaven', 'wingspan', 'everdell',
    'munchkin', 'smallworld', 'betrayal', 'cosmic-encounter', 'kingdomino', 'sagrada', 'sushi-go', 'hanabi', 'patchwork', 'cribbage'
],
movieGenres: [
    'comedy', 'horror', 'romance', 'action', 'thriller', 'adventure', 'scifi', 'fantasy', 'animation', 'documentary',
    'western', 'mystery', 'crime', 'historical', 'drama', 'musical', 'family', 'biography', 'war', 'disaster',
    'sports', 'teen', 'psychological', 'superhero', 'noir', 'anime', 'independent', 'spy', 'epic', 'satire',
    'mockumentary', 'slasher', 'zombie', 'vampire', 'monster', 'supernatural', 'dystopian', 'postapocalyptic', 'cyberpunk', 'steampunk',
    'heist', 'courtroom', 'political', 'comingofage', 'period', 'silent', 'experimental', 'anthology', 'found-footage', 'parody'
],
famousCities: [
    'newyork', 'london', 'tokyo', 'paris', 'rome', 'sydney', 'moscow', 'dubai', 'beijing', 'losangeles',
    'rio', 'toronto', 'madrid', 'mumbai', 'berlin', 'seoul', 'bangkok', 'istanbul', 'amsterdam', 'mexicocity',
    'singapore', 'hongkong', 'cairo', 'athens', 'barcelona', 'capetown', 'buenosaires', 'dublin', 'shanghai', 'chicago',
    'sanfrancisco', 'boston', 'seattle', 'miami', 'vancouver', 'montreal', 'vienna', 'prague', 'budapest', 'stockholm',
    'copenhagen', 'helsinki', 'oslo', 'zurich', 'brussels', 'lisbon', 'warsaw', 'kyiv', 'melbourne', 'auckland'
],
professions: [
    'doctor', 'teacher', 'engineer', 'chef', 'artist', 'nurse', 'farmer', 'pilot', 'policeofficer', 'firefighter',
    'lawyer', 'actor', 'writer', 'musician', 'dentist', 'carpenter', 'electrician', 'plumber', 'veterinarian', 'architect',
    'accountant', 'scientist', 'journalist', 'athlete', 'mechanic', 'pharmacist', 'librarian', 'photographer', 'therapist', 'coach',
    'programmer', 'designer', 'baker', 'barber', 'cashier', 'cleaner', 'consultant', 'detective', 'driver', 'florist',
    'gardener', 'hairdresser', 'illustrator', 'judge', 'lifeguard', 'manager', 'model', 'optician', 'painter', 'receptionist'
],
spaceObjects: [
    'star', 'planet', 'moon', 'asteroid', 'comet', 'meteor', 'galaxy', 'nebula', 'satellite', 'blackhole',
    'supernova', 'telescope', 'astronaut', 'rocket', 'shuttle', 'orbit', 'solarsystem', 'mars', 'venus', 'jupiter',
    'saturn', 'uranus', 'neptune', 'pluto', 'mercury', 'spacestation', 'alien', 'crater', 'gravity', 'universe',
    'constellation', 'quasar', 'pulsar', 'cosmos', 'eclipse', 'astronomer', 'observatory', 'spacewalk', 'launchpad', 'mission',
    'lander', 'rover', 'probe', 'module', 'capsule', 'exoplanet', 'starcluster', 'milkyway', 'andromeda', 'lightyear'
],
fastFoodChains: [
    'mcdonalds', 'burgerking', 'wendys', 'tacobell', 'subway', 'kfc', 'chickfila', 'arbys', 'pizzahut', 'dominos',
    'popeyes', 'chipotle', 'sonic', 'innout', 'dairyqueen', 'culvers', 'carlsjr', 'shakeshack', 'fiveguys', 'pandaexpress',
    'churchschicken', 'zaxbys', 'jerseymikes', 'wingstop', 'littlecaesars', 'whataburger', 'checkers', 'raisingcanes', 'jimmyjohns', 'panerabread',
    'dunkindonuts', 'starbucks', 'jamba', 'smoothieking', 'baskinrobbins', 'coldstone', 'krispykreme', 'cinnabon', 'auntieannes', 'pretzelmaker',
    'papajohns', 'moes', 'qdoba', 'bojangles', 'jackinthebox', 'hardees', 'deltaco', 'elpolloloco', 'firehouse', 'jasonsdeli'
],
countries: [
    'canada', 'brazil', 'australia', 'india', 'china', 'japan', 'germany', 'france', 'italy', 'spain',
    'mexico', 'argentina', 'egypt', 'russia', 'nigeria', 'kenya', 'turkey', 'greece', 'norway', 'sweden',
    'finland', 'portugal', 'thailand', 'vietnam', 'indonesia', 'newzealand', 'colombia', 'peru', 'southkorea', 'morocco',
    'singapore', 'malaysia', 'philippines', 'ireland', 'scotland', 'denmark', 'netherlands', 'belgium', 'switzerland', 'austria',
    'poland', 'ukraine', 'hungary', 'croatia', 'serbia', 'romania', 'bulgaria', 'czechia', 'slovakia', 'iceland'
],
worldLandmarks: [
    'eiffel-tower', 'statue-of-liberty', 'great-wall', 'pyramids', 'taj-mahal', 'colosseum', 'big-ben', 'grand-canyon', 'mount-rushmore', 'stonehenge',
    'machu-picchu', 'christ-redeemer', 'sydney-opera-house', 'brandenburg-gate', 'leaning-tower', 'angkor-wat', 'petra', 'mount-fuji', 'golden-gate-bridge', 'times-square',
    'parthenon', 'notre-dame', 'louvre', 'kremlin', 'red-square', 'burj-khalifa', 'palm-islands', 'moai', 'mount-kilimanjaro', 'niagara-falls',
    'great-barrier-reef', 'amazon-rainforest', 'sahara-desert', 'hagia-sophia', 'blue-mosque', 'mount-everest', 'empire-state', 'buckingham-palace', 'hollywood-sign', 'vatican',
    'acropolis', 'sagrada-familia', 'forbidden-city', 'terracotta-army', 'st-basils', 'chichen-itza', 'bora-bora', 'windmills', 'lake-como', 'mount-vesuvius'
],
technology: [
    'computer', 'smartphone', 'internet', 'software', 'hardware', 'robot', 'algorithm', 'database', 'network', 'cloud',
    'laptop', 'tablet', 'server', 'keyboard', 'mouse', 'monitor', 'printer', 'scanner', 'speaker', 'microphone',
    'webcam', 'router', 'modem', 'firewall', 'bluetooth', 'wifi', 'ethernet', 'processor', 'memory', 'storage',
    'harddrive', 'ssd', 'usb', 'hdmi', 'battery', 'charger', 'adapter', 'cable', 'headphones', 'earbuds',
    'smartwatch', 'drone', 'virtual-reality', 'augmented-reality', 'artificial-intelligence', 'machinelearning', 'blockchain', 'cryptocurrency', 'biometrics', 'encryption'
],
mythology: [
    'zeus', 'apollo', 'athena', 'poseidon', 'hades', 'hercules', 'medusa', 'minotaur', 'pegasus', 'chimera',
    'phoenix', 'dragon', 'unicorn', 'mermaid', 'centaur', 'cyclops', 'griffin', 'hydra', 'kraken', 'cerberus',
    'odin', 'thor', 'loki', 'freya', 'valkyrie', 'ymir', 'valhalla', 'ragnarok', 'fenrir', 'jormungandr',
    'anubis', 'ra', 'isis', 'osiris', 'horus', 'seth', 'bastet', 'thoth', 'sobek', 'hathor',
    'vishnu', 'shiva', 'brahma', 'ganesha', 'lakshmi', 'kali', 'durga', 'hanuman', 'indra', 'agni'
],
architecture: [
    'skyscraper', 'cathedral', 'castle', 'temple', 'palace', 'museum', 'bridge', 'tower', 'arch', 'monument',
    'mosque', 'pagoda', 'pyramid', 'theater', 'stadium', 'chapel', 'mansion', 'lighthouse', 'windmill', 'obelisk',
    'dome', 'column', 'colonnade', 'spire', 'buttress', 'balcony', 'courtyard', 'portico', 'facade', 'gallery',
    'vault', 'pillar', 'steeple', 'gargoyle', 'frieze', 'cornice', 'pediment', 'atrium', 'rotunda', 'pavilion',
    'arcade', 'aqueduct', 'battlement', 'belfry', 'citadel', 'cloister', 'mausoleum', 'ziggurat', 'alcove', 'terrace'
],
scienceTerms: [
    'atom', 'molecule', 'cell', 'dna', 'chromosome', 'enzyme', 'protein', 'nucleus', 'electron', 'neutron',
    'proton', 'element', 'compound', 'reaction', 'acid', 'base', 'catalyst', 'photosynthesis', 'evolution', 'gravity',
    'relativity', 'quantum', 'energy', 'force', 'mass', 'velocity', 'acceleration', 'wavelength', 'frequency', 'spectrum',
    'ecosystem', 'biodiversity', 'climate', 'polymer', 'isotope', 'entropy', 'genetic', 'neuron', 'synapse', 'hormone',
    'bacteria', 'virus', 'fungus', 'parasite', 'hypothesis', 'theory', 'experiment', 'observation', 'variable', 'control'
],
artStyles: [
    'painting', 'sculpture', 'drawing', 'portrait', 'landscape', 'mural', 'mosaic', 'pottery', 'ceramics', 'collage',
    'watercolor', 'acrylic', 'oil', 'charcoal', 'pastel', 'ink', 'pencil', 'canvas', 'fresco', 'statue',
    'bust', 'relief', 'installation', 'mixed-media', 'printmaking', 'lithograph', 'etching', 'woodcut', 'engraving', 'silkscreen',
    'abstract', 'cubism', 'impressionism', 'surrealism', 'renaissance', 'baroque', 'modernism', 'expressionism', 'minimalism', 'pop-art',
    'realism', 'romanticism', 'rococo', 'gothic', 'dada', 'futurism', 'conceptual', 'performance', 'calligraphy', 'graffiti'
],
danceStyles: [
    'ballet', 'jazz', 'tap', 'hiphop', 'contemporary', 'ballroom', 'salsa', 'tango', 'waltz', 'swing',
    'breakdance', 'flamenco', 'folk', 'square', 'line', 'belly', 'samba', 'rumba', 'merengue', 'cha-cha',
    'foxtrot', 'quickstep', 'jive', 'disco', 'popping', 'locking', 'krumping', 'vogue', 'clog', 'irish',
    'bollywood', 'bhangra', 'kathak', 'ballet-folklorico', 'polka', 'cossack', 'hopak', 'highland', 'tarantella', 'lambada',
    'zumba', 'dancehall', 'polynesian', 'hula', 'capoeira', 'morris', 'jitterbug', 'lindy-hop', 'charleston', 'twerk'
],
literaryTerms: [
    'novel', 'poem', 'play', 'short-story', 'essay', 'biography', 'autobiography', 'memoir', 'journal', 'diary',
    'fable', 'myth', 'legend', 'folktale', 'fairytale', 'parable', 'epic', 'tragedy', 'comedy', 'satire',
    'romance', 'thriller', 'mystery', 'fantasy', 'science-fiction', 'horror', 'western', 'drama', 'fiction', 'non-fiction',
    'sonnet', 'haiku', 'limerick', 'ode', 'elegy', 'ballad', 'iambic', 'narrative', 'prose', 'verse',
    'alliteration', 'metaphor', 'simile', 'personification', 'onomatopoeia', 'hyperbole', 'irony', 'symbolism', 'theme', 'motif'
],
marineLife: [
    'tide', 'wave', 'current', 'reef', 'atoll', 'lagoon', 'bay', 'gulf', 'strait', 'channel',
    'pacific', 'atlantic', 'indian', 'arctic', 'southern', 'coral', 'seaweed', 'plankton', 'kelp', 'algae',
    'dolphin', 'whale', 'shark', 'squid', 'octopus', 'jellyfish', 'seahorse', 'stingray', 'eel', 'clownfish',
    'tuna', 'marlin', 'swordfish', 'barracuda', 'lobster', 'crab', 'shrimp', 'oyster', 'mussel', 'clam',
    'starfish', 'sea-urchin', 'sea-cucumber', 'barnacle', 'shipwreck', 'trench', 'gyre', 'seamount', 'hydrothermal-vent', 'abyssal-plain'
],
herbsAndSpices: [
    'basil', 'oregano', 'thyme', 'rosemary', 'sage', 'mint', 'parsley', 'cilantro', 'dill', 'chives',
    'tarragon', 'marjoram', 'bay-leaf', 'lavender', 'fennel', 'lemongrass', 'chamomile', 'coriander', 'cumin', 'turmeric',
    'cardamom', 'saffron', 'anise', 'clove', 'nutmeg', 'cinnamon', 'vanilla', 'peppermint', 'spearmint', 'savory',
    'sorrel', 'chervil', 'borage', 'arugula', 'catnip', 'comfrey', 'lovage', 'licorice', 'echinacea', 'ginger',
    'garlic', 'stevia', 'hyssop', 'lemon-balm', 'rue', 'angelica', 'calendula', 'horehound', 'nettle', 'valerian'
],
worldCurrencies: [
    'dollar', 'euro', 'pound', 'yen', 'yuan', 'rupee', 'peso', 'franc', 'krona', 'ruble',
    'real', 'lira', 'won', 'rand', 'ringgit', 'baht', 'hryvnia', 'dirham', 'shekel', 'dinar',
    'zloty', 'forint', 'krone', 'bitcoin', 'ethereum', 'litecoin', 'dogecoin', 'ripple', 'tether', 'cardano',
    'rupiah', 'leu', 'bolivar', 'dong', 'tenge', 'som', 'leone', 'shilling', 'denar', 'birr',
    'florin', 'manat', 'guilder', 'metical', 'naira', 'kina', 'quetzal', 'dalasi', 'cedi', 'tugrik'
],
gemstones: [
    'diamond', 'ruby', 'emerald', 'sapphire', 'amethyst', 'opal', 'pearl', 'topaz', 'garnet', 'aquamarine',
    'jade', 'turquoise', 'citrine', 'peridot', 'tanzanite', 'moonstone', 'amber', 'malachite', 'lapis-lazuli', 'onyx',
    'carnelian', 'jasper', 'agate', 'aventurine', 'beryl', 'chrysoberyl', 'coral', 'kunzite', 'labradorite', 'obsidian',
    'rhodochrosite', 'rhodonite', 'spinel', 'sunstone', 'tiger-eye', 'tourmaline', 'zircon', 'alexandrite', 'chalcedony', 'hematite',
    'howlite', 'iolite', 'pyrite', 'quartz', 'sodalite', 'sphene', 'sugilite', 'tsavorite', 'unakite', 'zoisite'
],
climatesAndBiomes: [
    'tropical', 'desert', 'savanna', 'mediterranean', 'humid', 'arid', 'arctic', 'tundra', 'temperate', 'continental',
    'maritime', 'rainforest', 'alpine', 'subarctic', 'oceanic', 'monsoon', 'equatorial', 'polar', 'semi-arid', 'highland',
    'boreal', 'taiga', 'steppe', 'chaparral', 'subtropical', 'microclimate', 'maritime', 'insular', 'montane', 'coastal',
    'woodland', 'grassland', 'wetland', 'mangrove', 'coral-reef', 'forest', 'shrubland', 'desert-scrub', 'peatland', 'permafrost',
    'ice-sheet', 'glacier', 'ice-cap', 'sea-ice', 'fjord', 'lagoon', 'estuary', 'delta', 'floodplain', 'watershed'
],
birdSpecies: [
    'eagle', 'hawk', 'falcon', 'owl', 'sparrow', 'robin', 'cardinal', 'bluejay', 'finch', 'canary',
    'pigeon', 'dove', 'crow', 'raven', 'magpie', 'woodpecker', 'hummingbird', 'toucan', 'parrot', 'macaw',
    'flamingo', 'swan', 'duck', 'goose', 'penguin', 'ostrich', 'emu', 'kiwi', 'seagull', 'pelican',
    'albatross', 'crane', 'heron', 'stork', 'peacock', 'turkey', 'chicken', 'pheasant', 'quail', 'loon',
    'sandpiper', 'kingfisher', 'mockingbird', 'nightingale', 'swallow', 'thrush', 'warbler', 'chickadee', 'starling', 'vulture'
],
computerTerms: [
    'keyboard', 'mouse', 'monitor', 'printer', 'scanner', 'webcam', 'microphone', 'speaker', 'headphones', 'processor',
    'memory', 'ram', 'harddrive', 'ssd', 'motherboard', 'graphics-card', 'power-supply', 'fan', 'heatsink', 'case',
    'usb', 'hdmi', 'ethernet', 'wifi', 'bluetooth', 'firewall', 'antivirus', 'browser', 'email', 'password',
    'desktop', 'laptop', 'tablet', 'smartphone', 'server', 'database', 'cloud', 'software', 'hardware', 'operating-system',
    'program', 'app', 'game', 'website', 'virus', 'malware', 'backup', 'download', 'upload', 'streaming'
],
dinosaurSpecies: [
    'tyrannosaurus', 'velociraptor', 'triceratops', 'stegosaurus', 'brachiosaurus', 'diplodocus', 'ankylosaurus', 'pterodactyl', 'spinosaurus', 'allosaurus',
    'apatosaurus', 'parasaurolophus', 'carnotaurus', 'iguanodon', 'compsognathus', 'archaeopteryx', 'dilophosaurus', 'gallimimus', 'pachycephalosaurus', 'protoceratops',
    'oviraptor', 'deinonychus', 'utahraptor', 'baryonyx', 'styracosaurus', 'maiasaura', 'kentrosaurus', 'edmontosaurus', 'plateosaurus', 'coelophysis',
    'argentinosaurus', 'giganotosaurus', 'microraptor', 'psittacosaurus', 'mapusaurus', 'carcharodontosaurus', 'pachyrhinosaurus', 'dreadnoughtus', 'therizinosaurus', 'torosaurus',
    'ouranosaurus', 'corythosaurus', 'ceratosaurus', 'dimetrodon', 'yutyrannus', 'albertosaurus', 'sinosaurus', 'anchisaurus', 'titanosaurus', 'megaraptor'
],
treeVarieties: [
    'oak', 'maple', 'pine', 'birch', 'willow', 'cedar', 'spruce', 'elm', 'ash', 'fir',
    'redwood', 'sequoia', 'aspen', 'poplar', 'cherry', 'apple', 'pear', 'beech', 'walnut', 'hickory',
    'palm', 'eucalyptus', 'cypress', 'magnolia', 'sycamore', 'cottonwood', 'juniper', 'hemlock', 'alder', 'tamarack',
    'dogwood', 'hawthorn', 'larch', 'locust', 'baobab', 'banyan', 'joshua', 'ginkgo', 'mahogany', 'teak',
    'bamboo', 'olive', 'balsa', 'chestnut', 'hazel', 'acacia', 'catalpa', 'linden', 'holly', 'sassafras'
],
medicalTerms: [
    'antibiotic', 'vaccine', 'anesthetic', 'antiseptic', 'analgesic', 'antiviral', 'antifungal', 'antihistamine', 'insulin', 'aspirin',
    'ibuprofen', 'acetaminophen', 'steroid', 'anticoagulant', 'decongestant', 'expectorant', 'laxative', 'diuretic', 'sedative', 'stimulant',
    'stethoscope', 'syringe', 'thermometer', 'bandage', 'gauze', 'cast', 'splint', 'crutch', 'wheelchair', 'stretcher',
    'scalpel', 'forceps', 'clamp', 'suture', 'catheter', 'ventilator', 'defibrillator', 'pacemaker', 'x-ray', 'mri',
    'ct-scan', 'ultrasound', 'ecg', 'eeg', 'prescription', 'dose', 'diagnosis', 'prognosis', 'symptoms', 'treatment'
],
foodTypes: [
    'pizza', 'burger', 'pasta', 'sushi', 'taco', 'burrito', 'soup', 'salad', 'sandwich', 'rice',
    'bread', 'noodle', 'curry', 'steak', 'chicken', 'fish', 'pork', 'beef', 'lamb', 'seafood',
    'egg', 'toast', 'pancake', 'waffle', 'cereal', 'yogurt', 'cheese', 'butter', 'cream', 'milk',
    'juice', 'soda', 'coffee', 'tea', 'water', 'beer', 'wine', 'cocktail', 'smoothie', 'milkshake',
    'fries', 'chips', 'popcorn', 'pretzel', 'nachos', 'chocolate', 'candy', 'cookie', 'cake', 'pie'
],
worldLanguages: [
  'english', 'spanish', 'mandarin', 'hindi', 'arabic', 'portuguese', 'bengali', 'russian', 'japanese', 'german',
  'french', 'punjabi', 'italian', 'turkish', 'korean', 'vietnamese', 'tamil', 'urdu', 'polish', 'ukrainian',
  'dutch', 'greek', 'swahili', 'swedish', 'hebrew', 'thai', 'czech', 'hungarian', 'finnish', 'danish',
  'norwegian', 'romanian', 'indonesian', 'malay', 'tagalog', 'latin', 'sanskrit', 'tibetan', 'welsh', 'gaelic',
  'zulu', 'xhosa', 'yoruba', 'hausa', 'amharic', 'azerbaijani', 'kazakh', 'farsi', 'basque', 'catalan'
],
musicGenres: [
  'piano', 'guitar', 'violin', 'drums', 'flute', 'saxophone', 'trumpet', 'harmonica', 'cello', 'harp',
  'bass', 'clarinet', 'trombone', 'oboe', 'accordion', 'banjo', 'ukulele', 'mandolin', 'synthesizer', 'organ',
  'rock', 'pop', 'jazz', 'classical', 'blues', 'rap', 'country', 'folk', 'reggae', 'electronic',
  'melody', 'harmony', 'rhythm', 'tempo', 'beat', 'chord', 'scale', 'note', 'key', 'pitch',
  'orchestra', 'band', 'concert', 'album', 'song', 'lyric', 'chorus', 'verse', 'solo', 'duet'
],
inventions: [
  'wheel', 'compass', 'printing-press', 'lightbulb', 'telephone', 'television', 'computer', 'internet', 'airplane', 'automobile',
  'steam-engine', 'refrigerator', 'camera', 'microwave', 'radio', 'transistor', 'battery', 'clock', 'microscope', 'telescope',
  'electricity', 'antibiotics', 'vaccine', 'x-ray', 'laser', 'satellite', 'nuclear-power', 'pacemaker', 'microchip', 'robot',
  'plastic', 'nylon', 'velcro', 'zipper', 'calculator', 'typewriter', 'elevator', 'escalator', 'ball-point-pen', 'sticky-note',
  'barcode', 'credit-card', 'gps', 'solar-panel', 'wind-turbine', '3d-printer', 'drone', 'smartphone', 'tablet', 'e-reader'
]
};


// Shop items (Moved outside component)
const shopItems = [
  { id: 'hint', name: 'Word Hint', description: 'Reveals a random word', price: 50, icon: '🔍' },
  { id: 'time', name: 'Extra Time', description: 'Adds 30 seconds to the timer', price: 75, icon: '⏱️' },
  { id: 'double', name: '2× Credits', description: 'Double credits **this round**', price: 90, icon: '✨×2' }
];

// Helper function to format topic names (Moved outside component)
const formatTopicName = (topicKey) => {
  const nameMap = {
    colorNames: 'Color Names',
    numberWords: 'Number Words',
    geometricShapes: 'Geometric Shapes',
    partsOfTheBody: 'Parts of the Body',
    fruitNames: 'Fruit Names',
    vegetableNames: 'Vegetable Names',
    animalNames: 'Animal Names',
    insectsAndBugs: 'Insects and Bugs',
    clothingItems: 'Clothing Items',
    weatherTerms: 'Weather Terms',
    childrensToys: 'Children\'s Toys',
    kitchenUtensils: 'Kitchen Utensils',
    beachItems: 'Beach Items',
    desserts: 'Desserts',
    transportation: 'Transportation',
    furnitureItems: 'Furniture Items',
    schoolSubjects: 'School Subjects',
    emotions: 'Emotions',
    musicalInstruments: 'Musical Instruments',
    toolsAndHardware: 'Tools and Hardware',
    sports: 'Sports',
    boardGames: 'Board Games',
    movieGenres: 'Movie Genres',
    famousCities: 'Famous Cities',
    professions: 'Professions',
    spaceObjects: 'Space Objects',
    fastFoodChains: 'Fast Food Chains',
    countries: 'Countries',
    worldLandmarks: 'World Landmarks',
    technology: 'Technology',
    mythology: 'Mythology',
    architecture: 'Architecture',
    scienceTerms: 'Science Terms',
    artStyles: 'Art Styles',
    danceStyles: 'Dance Styles',
    literaryTerms: 'Literary Terms',
    marineLife: 'Marine Life',
    herbsAndSpices: 'Herbs and Spices',
    worldCurrencies: 'World Currencies',
    gemstones: 'Gemstones',
    climatesAndBiomes: 'Climates and Biomes',
    birdSpecies: 'Bird Species',
    computerTerms: 'Computer Terms',
    dinosaurSpecies: 'Dinosaur Species',
    treeVarieties: 'Tree Varieties',
    medicalTerms: 'Medical Terms',
    foodTypes: 'Food Types',
    worldLanguages: 'World Languages',
    musicGenres: 'Music Genres',
    inventions: 'Inventions'
  };
  return nameMap[topicKey] || topicKey.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
};

// --- End Hoisted Data ---

const getExistingSaves = () => {
  try {
    return JSON.parse(localStorage.getItem('topicLingoSaves')) || [];
  } catch {
    return [];
  }
};

// Save System Component
const SaveSystem = ({
  onLoad,
  onNewGame,
  onClose,
  currentGameData,
  setShowPlayerNameEntry,
  playButtonSound
}) => {
  const [saves, setSaves] = useState([]);
  const [selectedSave, setSelectedSave] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [playerNameForRename, setPlayerNameForRename] = useState(''); // Renamed state to avoid conflict
  const [showRenameInput, setShowRenameInput] = useState(false);

  useEffect(() => {
    setSaves(getExistingSaves());
  }, []);

  const loadSavesFromStorage = () => { // This function seems unused but kept for now
    try {
      const savedGames = JSON.parse(localStorage.getItem('topicLingoSaves')) || [];
      setSaves(savedGames);
    } catch (error) {
      console.error('Error loading saves:', error);
      setSaves([]);
    }
  };

  const saveGame = (saveIndex) => { // This function seems unused directly by SaveSystem UI but kept
    if (!currentGameData) return;
    const updatedGameData = { ...currentGameData, lastPlayed: Date.now() };
    const updatedSaves = [...saves];
    if (saveIndex !== undefined && saveIndex >= 0 && saveIndex < saves.length) {
      updatedGameData.saveId = saves[saveIndex].saveId;
      updatedSaves[saveIndex] = updatedGameData;
    } else {
      if (saves.length >= 3) {
        alert('Maximum of 3 save slots. Please overwrite an existing save.');
        return;
      }
      updatedSaves.push(updatedGameData);
    }
    localStorage.setItem('topicLingoSaves', JSON.stringify(updatedSaves));
    setSaves(updatedSaves);
    setSelectedSave(null);
    onClose();
  };

  const createNewGameHandler = () => { // Renamed to avoid conflict with onNewGame prop
    playButtonSound();
    onClose();
    window.setTimeout(() => setShowPlayerNameEntry(true), 0);
  };

  const loadGameHandler = (saveIndex) => { // Renamed
    playButtonSound();
    onLoad(saves[saveIndex]);
    onClose();
  };

  const deleteGameHandler = (saveIndex) => { // Renamed
    playButtonSound();
    const updatedSaves = saves.filter((_, i) => i !== saveIndex);
    localStorage.setItem('topicLingoSaves', JSON.stringify(updatedSaves));
    setSaves(updatedSaves);
    setShowDeleteConfirm(false);
    setSelectedSave(null);
  };

  const renameGameHandler = (saveIndex) => { // Renamed
    playButtonSound();
    if (!playerNameForRename.trim()) return;
    const updatedSaves = [...saves];
    updatedSaves[saveIndex] = {
      ...updatedSaves[saveIndex],
      playerName: playerNameForRename.trim()
    };
    localStorage.setItem('topicLingoSaves', JSON.stringify(updatedSaves));
    setSaves(updatedSaves);
    setShowRenameInput(false);
    setPlayerNameForRename('');
  };

  const formatDate = (timestamp) => new Date(timestamp).toLocaleString();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold text-indigo-600 mb-4">Game Saves</h2>
        <div className="space-y-3 mb-6">
          {saves.length === 0 ? (
            <div className="text-gray-500 text-center py-4">No saved games found</div>
          ) : (
            saves.map((save, index) => (
              <div
                key={save.saveId}
                className={`border p-3 rounded-lg cursor-pointer transition ${
                  selectedSave === index ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'
                }`}
                onClick={() => setSelectedSave(selectedSave === index ? null : index)}
              >
                <div className="flex justify-between">
                  <h3 className="font-bold">{save.playerName}</h3>
                  <span className="text-amber-500 font-semibold">💰 {save.credits}</span>
                </div>
                <div className="text-sm text-gray-500">
                  Last played: {formatDate(save.lastPlayed)}
                </div>
                <div className="text-sm">
                  {save.purchasedTopics.length} topics, {save.gamesPlayed} games played
                </div>
                {selectedSave === index && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => loadGameHandler(index)}
                      className="px-3 py-1 bg-indigo-600 text-white rounded text-sm"
                    >
                      Play
                    </button>
                    <button
                      onClick={() => {
                        playButtonSound();
                        setPlayerNameForRename(save.playerName);
                        setShowRenameInput(true);
                      }}
                      className="px-3 py-1 bg-amber-600 text-white rounded text-sm"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => {
                        playButtonSound();
                        setShowDeleteConfirm(true);
                      }}
                      className="px-3 py-1 bg-red-600 text-white rounded text-sm"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={createNewGameHandler}
            className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700"
          >
            New Game
          </button>
          <button
            onClick={() => {
              playButtonSound();
              onClose();
            }}
            className="flex-1 py-2 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700"
          >
            Cancel
          </button>
        </div>
        {showDeleteConfirm && selectedSave !== null && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-60">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full">
              <h3 className="text-xl font-bold mb-4">Confirm Delete</h3>
              <p className="mb-6">Are you sure you want to delete this save? This cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => deleteGameHandler(selectedSave)}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold"
                >
                  Delete
                </button>
                <button
                  onClick={() => {
                    playButtonSound();
                    setShowDeleteConfirm(false);
                  }}
                  className="flex-1 py-2 bg-gray-600 text-white rounded-lg font-bold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        {showRenameInput && selectedSave !== null && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-60">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full">
              <h3 className="text-xl font-bold mb-4">Rename Save</h3>
              <input
                type="text"
                value={playerNameForRename}
                onChange={(e) => setPlayerNameForRename(e.target.value)}
                className="w-full p-2 border-2 border-indigo-300 rounded-lg mb-4"
                placeholder="Enter new name"
                maxLength={15}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => renameGameHandler(selectedSave)}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    playButtonSound();
                    setShowRenameInput(false);
                    setPlayerNameForRename('');
                  }}
                  className="flex-1 py-2 bg-gray-600 text-white rounded-lg font-bold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


// NEW COMPONENT: Continue Game Prompt
const ContinueGamePrompt = ({ onContinue, onNewGame, playButtonSound }) => {
  const [saves, setSaves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const existingSaves = getExistingSaves();
    setSaves(existingSaves);
    setLoading(false);
  }, []);

  const mostRecentSave = useMemo(() => {
    if (saves.length === 0) return null;
    return saves.sort((a, b) => b.lastPlayed - a.lastPlayed)[0];
  }, [saves]);

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  if (!mostRecentSave) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold text-indigo-600 mb-4">Welcome Back!</h2>
        <div className="border p-3 rounded-lg border-indigo-200 bg-indigo-50 mb-6">
          <div className="flex justify-between">
            <h3 className="font-bold">{mostRecentSave.playerName}</h3>
            <span className="text-amber-500 font-semibold">💰 {mostRecentSave.credits}</span>
          </div>
          <div className="text-sm text-gray-500">
            Last played: {formatDate(mostRecentSave.lastPlayed)}
          </div>
          <div className="text-sm">
            {mostRecentSave.purchasedTopics.length} topics, {mostRecentSave.gamesPlayed} games played
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              playButtonSound();
              onContinue(mostRecentSave);
            }}
            className="py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"
          >
            Continue Game
          </button>
          <button
            onClick={() => {
              playButtonSound();
              onNewGame();
            }}
            className="py-3 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700 transition-colors"
          >
            New Game
          </button>
        </div>
      </div>
    </div>
  );
};

const TopicLingo = () => {
  const [gameState, setGameState] = useState('menu');
  const [credits, setCredits] = useState(250);
  const [currentTopic, setCurrentTopic] = useState('colorNames');
  const [purchasedTopics, setPurchasedTopics] = useState(['colorNames', 'fruitNames', 'animalNames']);
  const [hintTokens, setHintTokens] = useState(3);
  const [timeExtensions, setTimeExtensions] = useState(2);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [playerName, setPlayerName] = useState('New Game');
  const [highScore, setHighScore] = useState(0);
  const [totalWordsFound, setTotalWordsFound] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [hintsUsedTotal, setHintsUsedTotal] = useState(0);
  const [timeUsedTotal, setTimeUsedTotal] = useState(0);
  const [boostersUsedTotal, setBoostersUsedTotal] = useState(0);
  const [currentSaveId, setCurrentSaveId] = useState(null);
  const [showPlayerNameEntry, setShowPlayerNameEntry] = useState(false);
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);
  const [currentLetters, setCurrentLetters] = useState([]);
  const [possibleWords, setPossibleWords] = useState([]);
  const [wordsFound, setWordsFound] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [creditsEarned, setCreditsEarned] = useState(0);
  const [message, setMessage] = useState('');
  const [revealedMissedWords, setRevealedMissedWords] = useState(false);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [showCoinAnimation, setShowCoinAnimation] = useState(false);
  const [coins, setCoins] = useState([]);
  const [lastRoundEarned, setLastRoundEarned] = useState(0);
  const [creditBoosters, setCreditBoosters] = useState(0);
  const [doubleCreditsActive, setDoubleCreditsActive] = useState(false);

  useEffect(() => {
    const existing = getExistingSaves();
    if (existing.length === 0) {
      setShowPlayerNameEntry(true);
    } else {
      setShowContinuePrompt(true);
    }
  }, []);

  const PlayerNameEntry = ({ onSubmit, onCancel, initialName }) => {
    const [name, setName] = useState(initialName || '');
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 max-w-sm w-full">
          <h3 className="text-xl font-bold mb-4">Enter Your Name</h3>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border-2 border-indigo-300 rounded-lg mb-4"
            placeholder="Your name"
            maxLength={15}
          />
          <div className="flex gap-3">
            <button
              onClick={() => {
                playButtonSound();
                onSubmit(name.trim() || 'New Game');
              }}
              className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold"
            >
              Save
            </button>
            <button
              onClick={() => {
                playButtonSound();
                onCancel();
              }}
              className="flex-1 py-2 bg-gray-600 text-white rounded-lg font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const countdownAudioRef = useRef(null);
  const coinSoundRef = useRef(null);
  const gameOverWinSoundRef = useRef(null); // Replaced endOfGameSoundRef
  const gameOverLoseSoundRef = useRef(null); // Added
  const countdownTimeoutRef = useRef(null);
  const creditsEarnedRef = useRef(0);
  const gameMusicRef = useRef(null);
  const menuMusicRef = useRef(null);
  const buttonClickSoundRef = useRef(null);

  const [musicEnabled, setMusicEnabled] = useState(true);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [language, setLanguage] = useState('english');
  const [soundEnabled, setSoundEnabled] = useState(true);

  const playButtonSound = () => {
    if (soundEnabled && buttonClickSoundRef.current) {
      buttonClickSoundRef.current.currentTime = 0;
      buttonClickSoundRef.current.play().catch(e => console.error("Button sound play failed:", e));
    }
  };

  useEffect(() => {
    creditsEarnedRef.current = creditsEarned;
  }, [creditsEarned]);

  const lockedTopics = useMemo(() => Object.keys(topicWords).filter(topic => !purchasedTopics.includes(topic)), [purchasedTopics]);

  const capitalizeFirstLetter = (string) => string.charAt(0).toUpperCase() + string.slice(1);

  const shuffleArray = (array) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const findRandomLetters = (topic) => {
    const words = topicWords[topic];
    const validWords = words.filter(word => word.length >= 3);
    if (validWords.length === 0) return ['a', 'b'];
    let attempts = 0;
    while (attempts < 50) {
      const randomWord = validWords[Math.floor(Math.random() * validWords.length)];
      const uniqueLetters = [...new Set(randomWord.split(''))];
      if (uniqueLetters.length >= 2) {
        const shuffled = shuffleArray(uniqueLetters);
        return [shuffled[0], shuffled[1]];
      }
      attempts++;
    }
    return ['a', 'b'];
  };

  const findPossibleWords = (letters, topic) => {
    const words = topicWords[topic];
    if (!words) return [];
    const [letter1, letter2] = letters;
    return words.filter(word =>
      word.includes(letter1) &&
      word.includes(letter2) &&
      word.length >= 3
    );
  };

  const getCurrentGameData = () => ({
    saveId: currentSaveId || Date.now(),
    lastPlayed: Date.now(),
    playerName,
    credits,
    purchasedTopics,
    currentTopic,
    hintTokens,
    timeExtensions,
    highScore,
    totalWordsFound,
    gamesPlayed,
    hintsUsedTotal,
    timeUsedTotal,
    boostersUsedTotal,
    creditBoosters,
  });

  const loadGame = (saveData) => {
    playButtonSound();
    setCurrentSaveId(saveData.saveId);
    setPlayerName(saveData.playerName || 'New Game');
    setCredits(saveData.credits || 0);
    setPurchasedTopics(saveData.purchasedTopics || ['colorNames', 'fruitNames', 'animalNames']);
    setCurrentTopic(saveData.currentTopic || 'colorNames');
    setHintTokens(saveData.hintTokens || 0); // Ensure 0 if undefined
    setTimeExtensions(saveData.timeExtensions || 0); // Ensure 0 if undefined
    setHighScore(saveData.highScore || 0);
    setTotalWordsFound(saveData.totalWordsFound || 0);
    setGamesPlayed(saveData.gamesPlayed || 0);
    setHintsUsedTotal(saveData.hintsUsedTotal || 0);
    setTimeUsedTotal(saveData.timeUsedTotal || 0);
    setBoostersUsedTotal(saveData.boostersUsedTotal || 0);
    setCreditBoosters(saveData.creditBoosters || 0);
    setGameState('menu');
  };

  const startNewGame = (name = 'New Game') => {
    playButtonSound();
    const newGameData = createNewSaveData(name);
    loadGame(newGameData); // Use loadGame to set all states from newGameData

    // Save the new game skeleton to localStorage if slots available
    try {
      const saves = getExistingSaves();
      if (saves.length < 3) {
        const existingIndex = saves.findIndex(save => save.saveId === newGameData.saveId);
        if (existingIndex === -1) {
          saves.push(newGameData);
          localStorage.setItem('topicLingoSaves', JSON.stringify(saves));
        }
      } else {
         console.warn("Could not save new game skeleton: Maximum save slots reached.");
      }
    } catch (error) {
      console.error("Error saving new game skeleton:", error);
    }
  };

  const saveCurrentGameState = () => { // This is primarily called by the auto-save useEffect
    if (!currentSaveId) return;
    try {
      const currentSaveData = getCurrentGameData();
      const saves = getExistingSaves();
      const saveIndex = saves.findIndex(save => save.saveId === currentSaveId);
      if (saveIndex !== -1) {
        saves[saveIndex] = currentSaveData;
      } else if (saves.length < 3) { // If new profile, add it if space
        saves.push(currentSaveData);
      } else {
        console.warn("Could not save: No existing slot for currentSaveId and no empty slots.");
        return; // Don't overwrite unrelated save if something went wrong
      }
      localStorage.setItem('topicLingoSaves', JSON.stringify(saves));
    } catch (error) {
      console.error("Error in saveCurrentGameState:", error);
    }
  };

  // NEW HELPER FUNCTION for triggering coin animation and results state
  const triggerCoinAnimationAndResults = () => {
    const earnedInRound = creditsEarnedRef.current; // Get final earned credits

    if (earnedInRound > 0 && animationsEnabled) {
      const coinCount = Math.min(Math.floor(earnedInRound / 2), 30) || 1;
      const newCoins = [];
      for (let i = 0; i < coinCount; i++) {
        const left = Math.random() * 100;
        const duration = 1.5 + Math.random() * 1.5;
        const delay = Math.random() * 0.5;
        const size = 25 + (Math.random() * 15);
        newCoins.push({
          id: `coin-${i}-${Date.now()}`,
          style: { left: `${left}%`, width: `${size}px`, height: `${size}px`, fontSize: `${size}px`, animationDuration: `${duration}s`, animationDelay: `${delay}s` }
        });
      }
      setCoins(newCoins);
      setShowCoinAnimation(true); // Show container

      // Play coin sound *when* the animation visually starts
      if (soundEnabled && coinSoundRef.current) {
        coinSoundRef.current.currentTime = 0;
        coinSoundRef.current.play().catch(e => console.error("Coin sound play failed:", e));
      }

      // After the animation duration, hide coins and change state
      setTimeout(() => {
          if (coinSoundRef.current && !coinSoundRef.current.paused) {
              coinSoundRef.current.pause();
              coinSoundRef.current.currentTime = 0;
          }
          setShowCoinAnimation(false);
          setGameState('results'); // Transition to results screen
      }, 2000); // Duration for coins to fall (adjust as needed)

    } else {
      // If no credits earned or animations are off, just transition state
      // A very small delay can sometimes feel smoother than an instant transition
      setTimeout(() => {
           setGameState('results');
      }, 50);
    }
  };

  // Updated endGame function
  const endGame = () => {
    // 1. Clear Game Timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const earnedInRound = creditsEarnedRef.current; // Use ref for final value
    setLastRoundEarned(earnedInRound); // For results display

    // 2. Update Statistics
    setGamesPlayed(prev => prev + 1);
    setTotalWordsFound(prev => prev + wordsFound.length);
    setHighScore(prev => Math.max(prev, wordsFound.length));

    // 3. Add earned credits to the player's total credits
    setCredits(prevTotalCredits => prevTotalCredits + earnedInRound);

    // 4. Handle Conditional End of Game Sound and Subsequent Actions
    if (soundEnabled) {
       // Ensure other sounds are stopped
      if (countdownAudioRef.current && !countdownAudioRef.current.paused) {
          countdownAudioRef.current.pause();
          countdownAudioRef.current.currentTime = 0;
      }
       // Ensure game music is explicitly paused if necessary
       if (gameMusicRef.current && !gameMusicRef.current.paused) gameMusicRef.current.pause();

       // --- Select the correct sound ---
       let soundToPlay = null;
       if (earnedInRound > 0) {
         soundToPlay = gameOverWinSoundRef.current;
         console.log("Playing WIN sound");
       } else {
         soundToPlay = gameOverLoseSoundRef.current;
         console.log("Playing LOSE sound");
       }
       // --- End Sound Selection ---

       if (soundToPlay) { // Check if the selected sound ref exists
            // --- Setup the event listener ---
            const handleEndSound = () => {
                console.log("End of game sound finished.");
                // Clean up listeners immediately
                soundToPlay.onended = null;
                soundToPlay.onerror = null;
                // Trigger the next step
                triggerCoinAnimationAndResults(); // Use the helper function
            };

            const handleError = (e) => {
                console.error("Game Over sound error:", e);
                // Clean up listeners
                soundToPlay.onended = null;
                soundToPlay.onerror = null;
                // Trigger the next step anyway as a fallback
                triggerCoinAnimationAndResults();
            }

            // Assign the listeners
            soundToPlay.onended = handleEndSound;
            soundToPlay.onerror = handleError;

            // Play the selected sound
            soundToPlay.currentTime = 0;
            soundToPlay.play().catch(handleError); // Use handleError for play() rejection
       } else {
         // Fallback if the specific sound ref wasn't ready
         console.warn("Selected game over sound ref not ready, triggering next step immediately.");
         triggerCoinAnimationAndResults();
       }

    } else {
      // If sound is disabled, trigger the next step directly
      console.log("Sound disabled, skipping end sound wait.");
      triggerCoinAnimationAndResults(); // Use the helper function
    }
  };


  const ensureProfileSelected = () => {
    if (!currentSaveId) {
      setShowSaveMenu(true);
      return false;
    }
    return true;
  };

  const startGame = () => {
    playButtonSound();
    if (!ensureProfileSelected()) return;
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdownTimeoutRef.current) clearTimeout(countdownTimeoutRef.current);

    const letters = findRandomLetters(currentTopic);
    setCurrentLetters(letters);
    const wordsList = findPossibleWords(letters, currentTopic);
    setPossibleWords(wordsList);

    setWordsFound([]);
    setTimeLeft(60);
    setCreditsEarned(0); // Reset for the round
    creditsEarnedRef.current = 0; // Sync ref
    setInputValue('');
    setMessage('');
    setRevealedMissedWords(false);
    setLastRoundEarned(0);
    setCoins([]);
    setShowCoinAnimation(false);
    setDoubleCreditsActive(false); // Reset booster
    setGameState('game');
  };

  useEffect(() => {
    if (gameState === 'game') {
      setIsCountingDown(true);
      if (!countdownAudioRef.current && soundEnabled) {
        countdownAudioRef.current = new Audio(COUNTDOWN_SOUND_URL);
        countdownAudioRef.current.loop = false;
      }
      setTimeout(() => {
        if (soundEnabled && countdownAudioRef.current && gameState === 'game') {
          countdownAudioRef.current.currentTime = 0;
          countdownAudioRef.current.play().catch(e => console.error("Countdown audio play failed:", e));
        }
      }, 50);

      countdownTimeoutRef.current = setTimeout(() => {
        setIsCountingDown(false);
        if (gameState === 'game') {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
              if (prev <= 1) {
                clearInterval(timerRef.current);
                timerRef.current = null;
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
          if (inputRef.current) inputRef.current.focus();
        }
        countdownTimeoutRef.current = null;
      }, animationsEnabled ? 4000 : 500); // Shorter countdown if animations off
    }
    return () => {
      if (countdownTimeoutRef.current) {
        clearTimeout(countdownTimeoutRef.current);
        countdownTimeoutRef.current = null;
      }
      if (gameState !== 'game') {
        setIsCountingDown(false);
        if (countdownAudioRef.current && !countdownAudioRef.current.paused) {
          countdownAudioRef.current.pause();
          countdownAudioRef.current.currentTime = 0;
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    };
  }, [gameState, animationsEnabled, soundEnabled]);

  useEffect(() => {
    if (timeLeft === 0 && gameState === 'game' && !isCountingDown) {
      endGame();
    }
  }, [timeLeft, gameState, isCountingDown]);


  // +++ SCORING LOGIC CHANGES START HERE +++
  const calculateWordScore = (word) => {
    const baseScore = 5;
    // Length bonus: +3 for each letter over 2 (so a 3-letter word gets +3, 4-letter gets +6, etc.)
    const lengthBonus = Math.max(0, word.length - 2) * 3;
    let score = baseScore + lengthBonus;
    return score;
  };

  const checkWord = () => {
    playButtonSound();
    const word = inputValue.toLowerCase().trim();

    if (word.length < 3) {
      setMessage('Too short! (min 3 letters)');
      setTimeout(() => setMessage(''), 2000);
      return;
    }

    if (!word.includes(currentLetters[0]) || !word.includes(currentLetters[1])) {
      setMessage(`Must use both '${currentLetters[0]}' and '${currentLetters[1]}'!`);
      setTimeout(() => setMessage(''), 2000);
      return;
    }

    if (wordsFound.includes(word)) {
      setMessage('Already found!');
      setTimeout(() => setMessage(''), 2000);
      return;
    }

    if (possibleWords.includes(word)) {
      const newWordsFound = [...wordsFound, word].sort();
      setWordsFound(newWordsFound);

      let earnedForThisWord = calculateWordScore(word);

      if (doubleCreditsActive) {
        earnedForThisWord *= 2;
      }

      setCreditsEarned(prev => prev + earnedForThisWord);
      // creditsEarnedRef.current is updated by its own useEffect

      if (newWordsFound.length === possibleWords.length) {
        const baseAllWordsBonus = 25;
        const dynamicBonusPart = possibleWords.length * 2;
        let totalAllWordsBonus = baseAllWordsBonus + dynamicBonusPart;

        if (doubleCreditsActive) {
          totalAllWordsBonus *= 2;
        }

        setCreditsEarned(prev => prev + totalAllWordsBonus);
        setMessage(`All words found! +${totalAllWordsBonus} bonus credits`);
        setTimeout(() => {
          endGame();
        }, 1500);
      } else {
        setMessage(`Word found! +${earnedForThisWord} credits`);
        setTimeout(() => setMessage(''), 2000);
      }
    } else {
      setMessage('Not in list!');
      setTimeout(() => setMessage(''), 2000);
    }
    setInputValue('');
  };

  const useHint = () => {
    playButtonSound();
    if (hintTokens <= 0) return;

    const unguessedWords = possibleWords.filter(word => !wordsFound.includes(word));
    if (unguessedWords.length === 0) {
      setMessage('No more words!');
      setTimeout(() => setMessage(''), 2000);
      return;
    }

    setHintTokens(prev => prev - 1);
    setHintsUsedTotal(prev => prev + 1);

    const randomWord = unguessedWords[Math.floor(Math.random() * unguessedWords.length)];

    // Calculate score for hinted word (including potential 2x booster) then halve it
    let scoreForHintedWord = calculateWordScore(randomWord);
    if (doubleCreditsActive) {
      scoreForHintedWord *= 2;
    }
    const finalHintCredits = Math.round(scoreForHintedWord / 2); // Halve the points

    setCreditsEarned(prev => prev + finalHintCredits);
    // creditsEarnedRef.current is updated by its own useEffect

    setWordsFound(prev => {
      const newWordsFound = [...prev, randomWord].sort();
      if (newWordsFound.length === possibleWords.length) {
         // If hint completes the game, the "all words found" bonus will be handled by endGame
         // triggered from here, or by checkWord if it was the last typed word.
         // The "all words found" bonus should not be awarded *within* useHint itself
         // to avoid double-counting if the hint is the last word.
        setTimeout(() => {
          endGame();
        }, 1500);
      }
      return newWordsFound;
    });
    setMessage(`Hint: "${randomWord}" found! +${finalHintCredits} credits (half points).`);
    setTimeout(() => setMessage(''), 3000);
  };
  // +++ SCORING LOGIC CHANGES END HERE +++

  const useTimeExtension = () => {
    playButtonSound();
    if (timeExtensions <= 0) return;
    setTimeExtensions(prev => prev - 1);
    setTimeUsedTotal(prev => prev + 1);
    setTimeLeft(prev => prev + 30);
    setMessage('Time extended! +30 seconds');
    setTimeout(() => setMessage(''), 2000);
  };

  const buyShopItem = (item) => {
    playButtonSound();
    if (credits < item.price) {
      setMessage('Not enough credits!');
      setTimeout(() => setMessage(''), 2000);
      return;
    }
    setCredits(prev => prev - item.price);
    switch (item.id) {
      case 'hint':
        setHintTokens(prev => prev + 1);
        setMessage('Hint purchased!');
        break;
      case 'time':
        setTimeExtensions(prev => prev + 1);
        setMessage('Time extension purchased!');
        break;
      case 'double':
        setCreditBoosters(prev => prev + 1);
        setMessage('2× Credits booster purchased!');
        break;
      default:
        break;
    }
    setTimeout(() => setMessage(''), 2000);
  };

  const createCoins = (count) => {
    const coinCount = Math.min(count, 50);
    if (coinCount <= 0) {
      setCoins([]);
      return;
    }
    const newCoins = [];
    for (let i = 0; i < coinCount; i++) {
      const left = Math.random() * 100;
      const duration = 1 + Math.random() * 1.5;
      const delay = Math.random() * 0.5;
      const size = 20 + (Math.random() * 15);
      newCoins.push({
        id: `coin-${i}-${Date.now()}`,
        style: {
          left: `${left}%`,
          top: '-60px',
          width: `${size}px`,
          height:`${size}px`,
          fontSize:`${size}px`,
          animationDuration:`${duration}s`,
          animationDelay:`${delay}s`,
        }
      });
    }
    setCoins(newCoins);
  };

  // Effect to initialize non-looping sounds
  useEffect(() => {
    // Coin Sound
    if (!coinSoundRef.current) { // Create only if it doesn't exist
        coinSoundRef.current = new Audio(COIN_SOUND_URL);
        coinSoundRef.current.loop = false;
        coinSoundRef.current.volume = 0.7; // Example volume
    }

    // Game Over Win Sound
    if (!gameOverWinSoundRef.current) {
        gameOverWinSoundRef.current = new Audio(GAMEOVER_WIN_SOUND_URL);
        gameOverWinSoundRef.current.loop = false;
        gameOverWinSoundRef.current.volume = 0.6; // Example volume
    }

    // Game Over Lose Sound
    if (!gameOverLoseSoundRef.current) {
        gameOverLoseSoundRef.current = new Audio(GAMEOVER_LOSE_SOUND_URL);
        gameOverLoseSoundRef.current.loop = false;
        gameOverLoseSoundRef.current.volume = 0.6; // Example volume
    }

    // Button Click Sound (already exists, moved here for consistency)
    if (!buttonClickSoundRef.current) {
        buttonClickSoundRef.current = new Audio(BUTTON_CLICK_SOUND_URL);
        buttonClickSoundRef.current.volume = 0.5;
    }

    // Countdown Sound (already exists, moved here for consistency)
     if (!countdownAudioRef.current) {
        countdownAudioRef.current = new Audio(COUNTDOWN_SOUND_URL);
        countdownAudioRef.current.loop = false;
        countdownAudioRef.current.volume = 0.7; // Example volume
      }


    // Cleanup function to pause sounds when component unmounts
    return () => {
      if (countdownAudioRef.current) countdownAudioRef.current.pause();
      if (coinSoundRef.current) coinSoundRef.current.pause();
      if (gameOverWinSoundRef.current) gameOverWinSoundRef.current.pause();   // Updated cleanup
      if (gameOverLoseSoundRef.current) gameOverLoseSoundRef.current.pause(); // Updated cleanup
      if (buttonClickSoundRef.current) buttonClickSoundRef.current.pause();
      // You might want to nullify refs here if needed
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  // Separate Effect for Initial Creation & Unmount Cleanup of Audio Objects
  useEffect(() => {
      // Create refs on initial mount if they don't exist
      if (!menuMusicRef.current) {
          // Just create the ref placeholder, the playback effect will create the Audio object
          menuMusicRef.current = null;
      }
      if (!gameMusicRef.current) {
          gameMusicRef.current = null;
      }

      // Return a cleanup function that runs ONLY on component unmount
      return () => {
          console.log("Component Unmounting: Pausing and clearing music refs.");
          if (menuMusicRef.current) {
              menuMusicRef.current.pause();
              menuMusicRef.current = null;
          }
          if (gameMusicRef.current) {
              gameMusicRef.current.pause();
              gameMusicRef.current = null;
          }
      };
  }, []); // Empty dependency array ensures this runs only once on mount and cleanup on unmount

  const HighScoreBoard = () => {
    const top = useMemo(() => {
      return loadAllSaves()
        .sort((a, b) => (b.totalWordsFound ?? 0) - (a.totalWordsFound ?? 0))
        .slice(0, 10);
    }, [showSaveMenu, gameState]);

    // Also hide if all scores and total words found are 0
    if (!top.length || top.every(s => (s.highScore === 0 && (s.totalWordsFound === 0 || s.totalWordsFound === undefined)))) return null;

    return (
      <div className="w-full mt-6">
        <h3 className="text-lg font-bold text-indigo-600 mb-2">
          🏆 High Scores - Total Words Found
        </h3>
        {/* Filter out profiles with 0 total words found before mapping */}
        {top.filter(s => (s.totalWordsFound ?? 0) > 0).map((s, i) => (
          <div key={s.saveId} className="flex justify-between px-3 py-1
            odd:bg-gray-50 even:bg-white rounded">
            <span>{i + 1}. {s.playerName}</span>
            <span className="font-bold">{s.totalWordsFound ?? 0}</span>
          </div>
        ))}
      </div>
    );
  };

  // Effect to manage MUSIC lifecycle (Game and Menu)
  useEffect(() => {
    // --- Get Audio Refs ---
    const gameAudio = gameMusicRef.current;
    const menuAudio = menuMusicRef.current;

    // --- Determine Desired States ---
    const menuStates = ['menu', 'shop', 'topics', 'settings', 'results'];
    const isAnyModalOpen = showSaveMenu || showContinuePrompt || showPlayerNameEntry;
    const shouldMenuPlay = musicEnabled && (menuStates.includes(gameState) || isAnyModalOpen);
    const shouldGamePlay = musicEnabled && gameState === 'game' && !isCountingDown;

    // --- Handle Menu Music ---
    if (shouldMenuPlay) {
      if (menuAudio) {
        // If menu audio exists, play it if it's paused
        if (menuAudio.paused) {
          console.log("Menu Music: Resuming playback.");
          menuAudio.play().catch(e => console.error("Menu music resume failed:", e));
        }
        // If it's already playing, do nothing.
      } else {
        // If menu audio doesn't exist, create and play it
        console.log("Menu Music: Creating and starting.");
        const newMenuAudio = new Audio(MENU_MUSIC_URL);
        newMenuAudio.loop = true;
        newMenuAudio.volume = 0.4; // Adjust volume as needed
        menuMusicRef.current = newMenuAudio; // Assign to ref
        newMenuAudio.play().catch(e => console.error("Menu music initial play failed:", e));
      }
      // Ensure Game Music is paused if Menu should play
      if (gameAudio && !gameAudio.paused) {
        console.log("Game Music: Pausing because menu should play.");
        gameAudio.pause();
      }
    } else {
      // If menu music shouldn't play, pause it if it exists and is playing
      if (menuAudio && !menuAudio.paused) {
        console.log("Menu Music: Pausing.");
        menuAudio.pause();
        // Optional: Reset time only when transitioning *out* of menu states?
        // if (gameState === 'game') { menuAudio.currentTime = 0; }
      }
    }

    // --- Handle Game Music ---
    if (shouldGamePlay) {
      if (gameAudio) {
        // If game audio exists, play it if it's paused
        if (gameAudio.paused) {
          console.log("Game Music: Resuming playback.");
          // Reset time for new track feel each game session if desired
          // gameAudio.currentTime = 0;
          gameAudio.play().catch(e => console.error("Game music resume failed:", e));
        }
        // If it's already playing, do nothing.
      } else {
        // If game audio doesn't exist, create and play it
        console.log("Game Music: Creating and starting new track.");
        const newGameAudio = new Audio(pickRandomGameTrack());
        newGameAudio.loop = true;
        newGameAudio.volume = 0.3; // Adjust volume as needed
        gameMusicRef.current = newGameAudio; // Assign to ref
        newGameAudio.play().catch(e => console.error("Game music initial play failed:", e));
      }
       // Ensure Menu Music is paused if Game should play
       if (menuAudio && !menuAudio.paused) {
         console.log("Menu Music: Pausing because game should play.");
         menuAudio.pause();
       }
    } else {
      // If game music shouldn't play, pause it if it exists and is playing
      if (gameAudio && !gameAudio.paused) {
        console.log("Game Music: Pausing.");
        gameAudio.pause();
        // Optionally reset time when game ends/pauses
        // gameAudio.currentTime = 0;
      }
    }

    // --- Global Cleanup ---
    // This cleanup runs when the component unmounts OR before the effect re-runs.
    // We generally want to pause music on unmount.
    return () => {
        // console.log("Music Effect Cleanup"); // Optional: for debugging
        // No explicit pause here might be better to avoid brief silences during state transitions
        // Let the next run of the effect handle pausing/playing.
        // Pause only needed on full component unmount (handled by component lifecycle cleanup if refs are nulled).
    };
  // Dependencies that trigger music state changes:
  }, [gameState, musicEnabled, isCountingDown, showSaveMenu, showContinuePrompt, showPlayerNameEntry]);

  useEffect(() => { // Auto-save
    if (!currentSaveId || gameState === 'game' || isCountingDown) return; // Don't save during active game/countdown
    saveCurrentGameState();
  }, [
    currentSaveId, playerName, credits, purchasedTopics, currentTopic,
    hintTokens, timeExtensions, highScore, totalWordsFound, gamesPlayed,
    creditBoosters, hintsUsedTotal, timeUsedTotal, boostersUsedTotal
    // Removed gameState from here to prevent saving on every minor screen change if not desired
  ]);


  // Render Menu Screen
  const renderMenu = () => (
    <div className="flex flex-col items-center gap-4">
      <h1 className="text-4xl font-bold text-indigo-600 mb-2">TopicLingo</h1>
      <div className="text-lg mb-4 flex items-center gap-2">
        Welcome, {playerName}!
        <button
          onClick={() => {
            playButtonSound();
            setShowPlayerNameEntry(true);
          }}
          className="ml-2 bg-gray-200 hover:bg-gray-300 rounded-full w-6 h-6 flex items-center justify-center text-gray-600"
        >
          ✏️
        </button>
      </div>
      <button
        onClick={startGame}
        className="w-48 py-3 bg-indigo-600 text-white rounded-lg text-lg font-bold hover:bg-indigo-700 transition-colors"
      >
        ▶ Play Now
      </button>
      <button
        onClick={() => { playButtonSound(); setGameState('topics'); }}
        className="w-48 py-3 bg-purple-600 text-white rounded-lg text-lg font-bold hover:bg-purple-700 transition-colors"
      >
        📚 Topics
      </button>
      <button
        onClick={() => { playButtonSound(); setGameState('shop'); }}
        className="w-48 py-3 bg-emerald-600 text-white rounded-lg text-lg font-bold hover:bg-emerald-700 transition-colors"
      >
        🛒 Shop
      </button>
      <button
        onClick={() => { playButtonSound(); setShowSaveMenu(true); }}
        className="w-48 py-3 bg-amber-600 text-white rounded-lg text-lg font-bold hover:bg-amber-700 transition-colors"
      >
        💾 Game Saves
      </button>
      <button
        onClick={() => { playButtonSound(); setGameState('settings');}}
        className="w-48 py-3 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700 transition-colors"
      >
        ⚙️ Settings
      </button>
      <HighScoreBoard />
    </div>
  );

  // Render Settings Screen
  const renderSettings = () => (
    <div className="flex flex-col items-center gap-4 w-full max-w-md">
      <h1 className="text-3xl font-bold text-indigo-600 mb-4">Settings</h1>
      {/* Music Toggle */}
      <div className="w-full flex items-center justify-between mb-4 p-3 bg-gray-100 rounded-lg">
        <label className="font-bold text-gray-700">Enable Music</label>
        <div
          onClick={() => {
            playButtonSound();
            setMusicEnabled(!musicEnabled);
          }}
          className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer ${
            musicEnabled ? 'bg-green-500 justify-end' : 'bg-gray-300 justify-start'
          }`}
        >
          <div className="bg-white w-4 h-4 rounded-full shadow-md"></div>
        </div>
      </div>
      {/* Sound Effects Toggle */}
      <div className="w-full flex items-center justify-between mb-4 p-3 bg-gray-100 rounded-lg">
        <label className="font-bold text-gray-700">Enable Sound Effects</label>
        <div
          onClick={() => {
            if (soundEnabled) playButtonSound(); // Play sound only if turning on or already on
            setSoundEnabled(!soundEnabled);
          }}
          className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer ${
            soundEnabled ? 'bg-green-500 justify-end' : 'bg-gray-300 justify-start'
          }`}
        >
          <div className="bg-white w-4 h-4 rounded-full shadow-md"></div>
        </div>
      </div>
      {/* Animations Toggle */}
      <div className="w-full flex items-center justify-between mb-4 p-3 bg-gray-100 rounded-lg">
        <label className="font-bold text-gray-700">Enable Animations</label>
        <div
          onClick={() => {
            playButtonSound();
            setAnimationsEnabled(!animationsEnabled);
          }}
          className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer ${ // Visual toggle for animations
            animationsEnabled ? 'bg-green-500 justify-end' : 'bg-gray-300 justify-start'
          }`}
        >
          <div className="bg-white w-4 h-4 rounded-full shadow-md"></div>
        </div>
      </div>
      {/* Language Selection */}
      <div className="w-full mb-6">
        <label className="font-bold text-gray-700 block mb-2">Language (Display Only)</label>
        <select
          value={language}
          onChange={(e) => {
            playButtonSound();
            setLanguage(e.target.value);
          }}
          className="w-full p-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="english">English</option>
          {/* Add other language options here if UI text is translated */}
        </select>
      </div>
      {/* Credits Section */}
      <div className="w-full mt-8 p-4 bg-gray-100 rounded-lg">
        <h3 className="font-bold text-gray-700 mb-2">Game Credits</h3>
        <div className="text-sm text-gray-600">
          <p className="mb-2">Design & Development: You!</p>
          <p className="mb-2">Sound Effects: mixkit.co, zapsplat.com</p>
          <p className="mb-2">Music: Respective Artists</p>
          <p>© 2024 TopicLingo</p>
        </div>
      </div>
      <button
        onClick={() => { playButtonSound(); setGameState('menu'); }}
        className="px-4 py-2 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700 mt-4"
      >
        Back to Menu
      </button>
    </div>
  );

  // Render Game Screen
  const renderGame = () => {
    if (isCountingDown && animationsEnabled) { // Only show full countdown if animations are on
      return (
        <div className="flex flex-col items-center justify-center h-64">
          <h2 className="text-4xl font-bold text-indigo-600 animate-pulse">Get Ready!</h2>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-4 w-full max-w-md">
        <div className="flex justify-between w-full mb-4">
          <h2 className="text-xl font-bold text-indigo-600">
            Topic: {formatTopicName(currentTopic)}
          </h2>
          <div className="text-xl font-bold text-amber-500">
            Time: {timeLeft}s
          </div>
        </div>
        <div className="text-3xl font-bold mb-2 text-indigo-700">
          {currentLetters.join(' ').toUpperCase()}
        </div>
        <div className="text-md text-gray-600 mb-4">
          Find words that contain both of these letters!
        </div>
        <div className="text-lg mb-2">
          Words Found: {wordsFound.length} / {possibleWords.length}
        </div>
        <div className="flex gap-2 w-full mb-4">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && checkWord()}
            placeholder="Type a word..."
            className="flex-1 p-2 border-2 border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-500"
            disabled={isCountingDown && !animationsEnabled} // Disable input during short countdown if animations off
          />
          <button
            onClick={checkWord}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700"
            disabled={isCountingDown && !animationsEnabled}
          >
            Submit
          </button>
        </div>
        {message && (
          <div className="text-lg font-bold text-indigo-600 mb-2 text-center h-6"> {/* Fixed height for message area */}
            {message}
          </div>
        )}
        <div className="flex gap-2 mb-4">
          {hintTokens > 0 && (
            <button
              onClick={useHint}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700"
            >
              Use Hint ({hintTokens})
            </button>
          )}
           {timeExtensions > 0 && (
            <button
              onClick={useTimeExtension}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700"
            >
              Add Time ({timeExtensions})
            </button>
          )}
        </div>
        <div className="flex gap-2 mb-4">
          {creditBoosters > 0 && !doubleCreditsActive && (
            <button
              onClick={() => {
                playButtonSound();
                setCreditBoosters(p => p - 1);
                setDoubleCreditsActive(true);
                setBoostersUsedTotal(prev => prev + 1);
                // Credits already earned in the round are NOT retroactively doubled by this logic.
                // Only subsequent points will be.
                setMessage('2× Credits activated for this round!');
                setTimeout(() => setMessage(''), 2000);
              }}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg font-bold hover:bg-yellow-600"
            >
              2× Credits ({creditBoosters})
            </button>
          )}
          {doubleCreditsActive && (
            <span className="px-3 py-1 bg-yellow-200 text-yellow-800 rounded-lg font-semibold">
              ✨ 2× CREDITS ACTIVE ✨
            </span>
          )}
        </div>
        <div className="w-full bg-gray-100 rounded-lg p-4 mb-4 min-h-[80px]"> {/* Min height for found words */}
          <h3 className="font-bold mb-2">Found Words:</h3>
          <div className="flex flex-wrap gap-2">
            {wordsFound.map((word) => (
              <span key={word} className="bg-indigo-500 text-white px-2 py-1 rounded-full text-sm">
                {word}
              </span>
            ))}
            {wordsFound.length === 0 && (
              <span className="text-gray-500 italic">No words found yet</span>
            )}
          </div>
        </div>
        <button
          onClick={() => {
            playButtonSound();
            if (timerRef.current) clearInterval(timerRef.current);
            setGameState('menu');
          }}
          className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700"
        >
          Back to Menu
        </button>
      </div>
    );
  };

  // Render Results Screen
  const renderResults = () => {
    const missedWords = possibleWords.filter(word => !wordsFound.includes(word));
    return (
      <div className="flex flex-col items-center gap-4 w-full max-w-md">
        <h1 className="text-3xl font-bold text-indigo-600 mb-4">Round Complete!</h1>
        <div className="grid grid-cols-3 gap-4 w-full mb-6">
          <div className="bg-gray-100 p-4 rounded-lg text-center">
            <div className="text-gray-600 text-sm">Words Found</div>
            <div className="text-2xl font-bold text-indigo-600">{wordsFound.length}</div>
          </div>
          <div className="bg-gray-100 p-4 rounded-lg text-center">
            <div className="text-gray-600 text-sm">Total Possible</div>
            <div className="text-2xl font-bold text-indigo-600">{possibleWords.length}</div>
          </div>
          <div className="bg-gray-100 p-4 rounded-lg text-center">
            <div className="text-gray-600 text-sm">Credits Earned</div>
            <div className="text-2xl font-bold text-amber-500">{lastRoundEarned}</div> {/* Display lastRoundEarned */}
          </div>
        </div>
        <div className="w-full bg-indigo-50 p-4 rounded-lg mb-6">
          <h3 className="font-bold mb-2 text-indigo-700">Player Statistics ({playerName})</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Total Games Played:</div><div className="text-right font-bold">{gamesPlayed}</div>
            <div>Total Words Ever Found:</div><div className="text-right font-bold">{totalWordsFound}</div>
            <div>High Score (Words/Round):</div><div className="text-right font-bold">{highScore}</div>
            <div>Hints Used (Lifetime):</div><div className="text-right font-bold">{hintsUsedTotal}</div>
            <div>Time Boosts Used (Lifetime):</div><div className="text-right font-bold">{timeUsedTotal}</div>
            <div>2× Boosters Used (Lifetime):</div><div className="text-right font-bold">{boostersUsedTotal}</div>
          </div>
        </div>
        {missedWords.length > 0 && (
          <div className="w-full mb-6">
            <div className="flex justify-between mb-2 items-center">
              <h3 className="font-bold">Words You Missed:</h3>
              {!revealedMissedWords && (
               <button
                onClick={() => {
                  playButtonSound();
                  setRevealedMissedWords(true);
                }}
                className="text-indigo-600 hover:underline text-sm px-2 py-1 bg-indigo-100 rounded hover:bg-indigo-200"
               >
                  Reveal
                </button>
              )}
            </div>
            {revealedMissedWords ? (
              <div className="flex flex-wrap gap-2 bg-gray-100 p-4 rounded-lg">
                {missedWords.map((word) => (
                  <span key={word} className="bg-gray-300 px-2 py-1 rounded-full text-sm">
                    {word}
                  </span>
                ))}
              </div>
            ) : (
              <div className="bg-gray-100 p-4 rounded-lg text-center text-gray-500 italic">
                Missed words are hidden.
              </div>
            )}
          </div>
        )}
        <div className="flex gap-4">
        <button
            onClick={startGame} // Direct to startGame
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700"
          >
            Play Again
          </button>
          <button
            onClick={() => { playButtonSound(); setGameState('menu'); }}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  };

  // Render Topic Selection Screen
  const renderTopics = () => {
    return (
      <div className="flex flex-col items-center gap-4 w-full max-w-md">
        <h1 className="text-3xl font-bold text-indigo-600 mb-2">Select a Topic</h1>
        <div className="text-lg mb-4">Current Topic: <span className="font-bold text-indigo-600">{formatTopicName(currentTopic)}</span></div>
        {message && ( // Message for topic purchase/selection
          <div className="text-lg font-bold text-indigo-600 mb-4 h-6">{message}</div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full mb-6 max-h-[400px] overflow-y-auto p-1"> {/* Scrollable topics */}
          {Object.keys(topicWords).map((topicKey) => {
            const isPurchased = purchasedTopics.includes(topicKey);
            const isSelected = currentTopic === topicKey;
            return (
              <button
                key={topicKey}
                onClick={() => {
                  playButtonSound();
                  if (isPurchased) {
                    setCurrentTopic(topicKey);
                    setMessage(`${formatTopicName(topicKey)} selected!`);
                  } else {
                    if (credits >= 100) { // Assuming 100 credits to unlock a topic
                      setCredits(prev => prev - 100);
                      setPurchasedTopics(prev => [...prev, topicKey]);
                      setCurrentTopic(topicKey);
                      setMessage(`${formatTopicName(topicKey)} purchased & selected!`);
                    } else {
                      setMessage('Not enough credits to unlock!');
                    }
                  }
                  setTimeout(() => setMessage(''), 2000);
                }}
                className={`p-3 rounded-lg relative h-24 flex flex-col justify-center items-center text-center ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-2 border-yellow-400 shadow-lg'
                    : isPurchased
                      ? 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200'
                      : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                } transition-all duration-150 ease-in-out`}
              >
                <div className="font-bold text-sm leading-tight">
                  {formatTopicName(topicKey)}
                </div>
                {!isPurchased && (
                  <div className="bg-amber-500 text-white rounded-full px-2 py-0.5 text-xs mt-1 font-semibold">
                    🔒 100
                  </div>
                )}
                {isSelected && (
                  <div className="absolute -top-1 -right-1 mt-1 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md">
                    ✓
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => { playButtonSound(); setGameState('menu'); }}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700"
        >
          Back to Menu
        </button>
      </div>
    );
  };

  // Render Shop Screen
  const renderShop = () => (
    <div className="flex flex-col items-center gap-4 w-full max-w-md">
      <h1 className="text-3xl font-bold text-indigo-600 mb-2">Shop</h1>
      <div className="text-xl text-amber-500 font-bold mb-4">Your Credits: {credits} 💰</div>
      {message && ( // Message for shop purchases
          <div className="text-lg font-bold text-indigo-600 mb-4 h-6">{message}</div>
        )}
      <div className="w-full space-y-4 mb-6">
        {shopItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center p-4 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors shadow"
          >
            <div className="w-12 h-12 flex items-center justify-center bg-indigo-500 text-white rounded-md text-2xl mr-4">
              {item.icon}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-indigo-700">{item.name}</h3>
              <p className="text-sm text-gray-600" dangerouslySetInnerHTML={{ __html: item.description.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}></p>
            </div>
            <div className="font-bold text-amber-600 mr-4 text-lg">{item.price}</div>
            <button
              onClick={() => buyShopItem(item)}
              disabled={credits < item.price}
              className={`px-3 py-1 text-white rounded-lg text-sm font-bold transition-colors ${
                credits < item.price
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              Buy
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={() => { playButtonSound(); setGameState('menu'); }}
        className="px-4 py-2 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700"
      >
        Back to Menu
      </button>
    </div>
  );

  // Main render
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center p-4 bg-gray-50 font-sans"> {/* Added font-sans */}
      <div className="w-full max-w-md mb-4 flex justify-center items-center">
        <div className="flex items-center gap-2 sm:gap-3"> {/* Responsive gap */}
          <div className="flex items-center gap-1 bg-indigo-100 px-2 py-1 rounded-full shadow-sm">
            <span className="text-indigo-600 text-sm sm:text-base">🔍</span>
            <span className="text-indigo-800 font-bold text-sm sm:text-base">{hintTokens}</span>
          </div>
          <div className="flex items-center gap-1 bg-amber-100 px-2 py-1 rounded-full shadow-sm">
            <span className="text-amber-600 text-sm sm:text-base">⏱️</span>
            <span className="text-amber-800 font-bold text-sm sm:text-base">{timeExtensions}</span>
          </div>
          <div className="flex items-center gap-1 bg-yellow-100 px-2 py-1 rounded-full shadow-sm">
            <span className="text-yellow-600 text-sm sm:text-base">✨×2</span>
            <span className="text-yellow-800 font-bold text-sm sm:text-base">{creditBoosters}</span>
          </div>
          <div className="flex items-center gap-1 bg-emerald-100 px-2 py-1 rounded-full shadow-sm">
            <span className="text-emerald-600 text-sm sm:text-base">💰</span>
            <span className="text-emerald-800 font-bold text-sm sm:text-base">{credits}</span>
          </div>
        </div>
      </div>

      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-5 sm:p-6"> {/* Slightly more padding on larger screens */}
        {gameState === 'menu' && renderMenu()}
        {gameState === 'game' && renderGame()} {/* renderGame now handles its own countdown display */}
        {gameState === 'results' && renderResults()}
        {gameState === 'topics' && renderTopics()}
        {gameState === 'shop' && renderShop()}
        {gameState === 'settings' && renderSettings()}
      </div>

      {showCoinAnimation && animationsEnabled && ( // Only show if animations are on
        <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden"> {/* Higher z-index */}
          <div className="coin-container relative w-full h-full">
            {coins.map(coin => (
              <div key={coin.id} className="coin" style={coin.style}>
                💰
              </div>
            ))}
          </div>
        </div>
      )}

      {showSaveMenu && (
        <SaveSystem
          onLoad={loadGame}
          onNewGame={startNewGame} // Pass the main startNewGame
          onClose={() => setShowSaveMenu(false)}
          currentGameData={getCurrentGameData()}
          setShowPlayerNameEntry={setShowPlayerNameEntry} // To open name entry for "New Game" from save menu
          playButtonSound={playButtonSound}
        />
      )}

      {showPlayerNameEntry && (
      <PlayerNameEntry
          initialName={playerName === 'New Game' ? '' : playerName} // Clear "New Game" placeholder
          onSubmit={(name) => {
            // If called from initial load (no currentSaveId) or "New Game" from SaveSystem
            if (!currentSaveId || name !== playerName) {
                 startNewGame(name); // Creates a new profile and sets it as current
            } else { // Just renaming existing player from menu
                setPlayerName(name);
            }
            setShowPlayerNameEntry(false);
          }}
          onCancel={() => {
            // If cancelling initial name entry and no saves exist, they can't play
            // This case should ideally be handled by ensuring a default profile is made or exiting.
            // For now, just closing.
            if(getExistingSaves().length === 0 && !currentSaveId) {
                startNewGame('Player'); // Create a default player if they cancel initial entry
            }
            setShowPlayerNameEntry(false);
        }}
        />
      )}

      {showContinuePrompt && (
        <ContinueGamePrompt
          onContinue={(saveData) => {
            loadGame(saveData);
            setShowContinuePrompt(false);
          }}
          onNewGame={() => { // This means they chose "New Game" from the continue prompt
            setShowContinuePrompt(false);
            setShowPlayerNameEntry(true); // So, ask for player name
          }}
          playButtonSound={playButtonSound}
        />
      )}
    </div>
  );
};

export default TopicLingo;
