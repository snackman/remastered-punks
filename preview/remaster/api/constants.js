export const SPRITE_SIZE = 24;
export const SPRITESHEET_COLS = 25;
export const PUNKS_COLS = 100;

// Sprite IDs - Female versions (f, s)
export const FEMALE_SPRITE_IDS = {
  // Base heads by skin tone
  'base_Light': 24, 'base_Medium': 23, 'base_Dark': 22, 'base_Albino': 25,
  // Eyewear
  'Regular Shades': 317,
  '3D Glasses': 302,
  'Big Shades': 304,
  'Classic Shades': 306,
  'Eye Mask': 308,
  'Eye Patch': 310,
  'Horned Rim Glasses': 312,
  'Nerd Glasses': 314,
  'Small Shades': 319,
  'VR': 321,
  'Welding Goggles': 322,
  // Eyes
  'Blue Eye Shadow': 334,
  'Green Eye Shadow': 335,
  'Purple Eye Shadow': 337,
  'Clown Eyes Blue': 339,
  'Clown Eyes Green': 341,
  // Blemish
  'Mole': 345,
  'Rosy Cheeks': 347,
  'Spots': 349,
  // Earring
  'Earring': 357,
  // Mouth
  'Black Lipstick': 363,
  'Hot Lipstick': 364,
  'Purple Lipstick': 365,
  // MouthProp
  'Cigarette': 369,
  'Medical Mask': 371,
  'Pipe': 373,
  'Vape': 375,
  // Neck
  'Choker': 380,
  'Gold Chain': 382,
  'Silver Chain': 384,
  // Headgear
  'Bandana': 404,
  'Headband': 416,
  'Knitted Cap': 422,
  'Pilot Helmet': 423,
  'Tassle Hat': 426,
  'Tiara': 427,
  'Cap': 548,
  'Do-rag': 412,
  'Beanie': 406,
  'Cap Forward': 408,
  'Cowboy Hat': 410,
  'Fedora': 414,
  'Police Cap': 425,
  'Top Hat': 429,
  'Hoodie': 420,
  // Hair
  'Blonde Short': 633,
  'Crazy Hair': 635,
  'Dark Hair': 637,
  'Frumpy Hair': 639,
  'Half Shaved': 640,
  'Messy Hair': 642,
  'Mohawk': 644,
  'Mohawk Dark': 646,
  'Mohawk Thin': 648,
  'Orange Side': 649,
  'Pigtails': 651,
  'Pink With Hat': 652,
  'Red Mohawk': 655,
  'Straight Hair': 658,
  'Straight Hair Blonde': 659,
  'Straight Hair Dark': 660,
  'Stringy Hair': 662,
  'Wild Blonde': 664,
  'Wild Hair': 666,
  'Wild White Hair': 668,
  'Blonde Bob': 749,
  'Clown Hair Green': 810,
  'Purple Hair': 654,
  'Shaved Head': 657,
};

// Sprite IDs - Male versions (u, l or m, l)
export const MALE_SPRITE_IDS = {
  // Base heads by skin tone
  'base_Light': 7, 'base_Medium': 6, 'base_Dark': 5, 'base_Albino': 8,
  // Non-human bases (no skin tone)
  'base_Zombie': 30, 'base_Ape': 35, 'base_Alien': 41,
  // Eyewear
  'Regular Shades': 315,
  '3D Glasses': 301,
  'Big Shades': 303,
  'Classic Shades': 305,
  'Eye Mask': 307,
  'Eye Patch': 309,
  'Horned Rim Glasses': 311,
  'Nerd Glasses': 313,
  'Small Shades': 318,
  'VR': 320,
  // Eyes
  'Clown Eyes Blue': 338,
  'Clown Eyes Green': 340,
  // Blemish
  'Mole': 344,
  'Rosy Cheeks': 346,
  'Spots': 348,
  // Earring
  'Earring': 356,
  // Mouth
  'Buck Teeth': 360,
  'Frown': 361,
  'Smile': 362,
  // MouthProp
  'Cigarette': 368,
  'Medical Mask': 370,
  'Pipe': 372,
  'Vape': 374,
  // Neck
  'Gold Chain': 381,
  'Silver Chain': 383,
  // Beard (male-only)
  'Big Beard': 387,
  'Chinstrap': 388,
  'Front Beard': 389,
  'Front Beard Dark': 390,
  'Goat': 391,
  'Handlebars': 392,
  'Luxurious Beard': 393,
  'Mustache': 396,
  'Muttonchops': 397,
  'Normal Beard': 398,
  'Normal Beard Black': 399,
  'Shadow Beard': 401,
  // Headgear
  'Bandana': 403,
  'Headband': 415,
  'Knitted Cap': 421,
  'Cap': 547,
  'Do-rag': 411,
  'Beanie': 405,
  'Cap Forward': 407,
  'Cowboy Hat': 409,
  'Fedora': 413,
  'Police Cap': 424,
  'Top Hat': 428,
  'Hoodie': 418,
  // Hair
  'Crazy Hair': 634,
  'Frumpy Hair': 638,
  'Messy Hair': 641,
  'Mohawk': 643,
  'Mohawk Dark': 645,
  'Mohawk Thin': 647,
  'Stringy Hair': 661,
  'Wild Hair': 665,
  'Peak Spike': 650,
  'Purple Hair': 653,
  'Shaved Head': 656,
  'Vampire Hair': 663,
  'Clown Hair Green': 795,
};

// Layer order for compositing
export const LAYER_ORDER = ['base', 'cheeks', 'blemish', 'hair', 'beard', 'eyes', 'eyewear', 'nose', 'mouth', 'mouthprop', 'earring', 'headgear', 'neck'];

// Map trait names to layers
export const TRAIT_TO_LAYER = {
  'Rosy Cheeks': 'cheeks',
  'Mole': 'blemish', 'Spots': 'blemish',
  'Blonde Bob': 'hair', 'Blonde Short': 'hair', 'Clown Hair Green': 'hair',
  'Crazy Hair': 'hair', 'Dark Hair': 'hair', 'Frumpy Hair': 'hair',
  'Half Shaved': 'hair', 'Messy Hair': 'hair', 'Mohawk': 'hair',
  'Mohawk Dark': 'hair', 'Mohawk Thin': 'hair', 'Orange Side': 'hair',
  'Pigtails': 'hair', 'Pink With Hat': 'hair', 'Red Mohawk': 'hair',
  'Straight Hair': 'hair', 'Straight Hair Blonde': 'hair',
  'Straight Hair Dark': 'hair', 'Stringy Hair': 'hair',
  'Wild Blonde': 'hair', 'Wild Hair': 'hair', 'Wild White Hair': 'hair',
  'Peak Spike': 'hair', 'Purple Hair': 'hair', 'Shaved Head': 'hair', 'Vampire Hair': 'hair',
  'Front Beard': 'beard', 'Front Beard Dark': 'beard',
  'Big Beard': 'beard', 'Chinstrap': 'beard', 'Goat': 'beard', 'Handlebars': 'beard',
  'Luxurious Beard': 'beard', 'Mustache': 'beard', 'Muttonchops': 'beard',
  'Normal Beard': 'beard', 'Normal Beard Black': 'beard', 'Shadow Beard': 'beard',
  'Buck Teeth': 'mouth', 'Frown': 'mouth', 'Smile': 'mouth',
  'Blue Eye Shadow': 'eyes', 'Green Eye Shadow': 'eyes',
  'Purple Eye Shadow': 'eyes', 'Clown Eyes Blue': 'eyes', 'Clown Eyes Green': 'eyes',
  'Regular Shades': 'eyewear', 'Big Shades': 'eyewear',
  'Classic Shades': 'eyewear', 'Nerd Glasses': 'eyewear',
  'Horned Rim Glasses': 'eyewear', '3D Glasses': 'eyewear',
  'VR': 'eyewear', 'Welding Goggles': 'eyewear', 'Small Shades': 'eyewear',
  'Eye Mask': 'eyewear', 'Eye Patch': 'eyewear',
  'Clown Nose': 'nose',
  'Hot Lipstick': 'mouth', 'Black Lipstick': 'mouth', 'Purple Lipstick': 'mouth',
  'Cigarette': 'mouthprop', 'Pipe': 'mouthprop', 'Vape': 'mouthprop', 'Medical Mask': 'mouthprop',
  'Earring': 'earring',
  'Bandana': 'headgear', 'Headband': 'headgear', 'Cap': 'headgear',
  'Knitted Cap': 'headgear', 'Pilot Helmet': 'headgear',
  'Tassle Hat': 'headgear', 'Tiara': 'headgear',
  'Do-rag': 'headgear', 'Beanie': 'headgear', 'Cap Forward': 'headgear',
  'Cowboy Hat': 'headgear', 'Fedora': 'headgear', 'Police Cap': 'headgear',
  'Top Hat': 'headgear', 'Hoodie': 'headgear',
  'Choker': 'neck', 'Gold Chain': 'neck', 'Silver Chain': 'neck',
};

// Hairstyles where ear is visible (need ear remaster) - FEMALE ONLY
export const EAR_VISIBLE_HAIRSTYLES = new Set([
  'Mohawk', 'Mohawk Dark', 'Mohawk Thin', 'Red Mohawk',
  'Bandana', 'Headband', 'Cap', 'Knitted Cap', 'Tiara',
  'Welding Goggles',
  'Blonde Bob', 'Blonde Short', 'Crazy Hair', 'Messy Hair',
  'Orange Side', 'Pigtails', 'Stringy Hair',
  'Wild Blonde', 'Wild White Hair', 'Clown Hair Green'
]);

// Skin colors
export const SKIN_COLORS = {
  'Light': {r: 219, g: 177, b: 128, shadowR: 201, shadowG: 175, shadowB: 145},
  'Medium': {r: 174, g: 139, b: 97, shadowR: 156, shadowG: 124, shadowB: 88},
  'Dark': {r: 113, g: 63, b: 29, shadowR: 96, shadowG: 53, shadowB: 24},
  'Albino': {r: 234, g: 217, b: 217, shadowR: 223, shadowG: 206, shadowB: 206},
};

// Fill colors for traits that cover the ear area
export const TRAIT_FILL_COLORS = {
  'Headband': {fills: [
    {x: 7, y: 0, r: 0, g: 0, b: 0},
    {x: 7, y: 2, useSkinColor: true},
    {x: 7, y: 3, useSkinColor: true},
  ]},
  'Blonde Bob': {fills: [
    {x: 7, y: 0, r: 255, g: 246, b: 142},
    {x: 7, y: 2, useSkinColor: true},
    {x: 7, y: 3, useSkinColor: true},
  ], extraEarSkin: true},
  'Blonde Short': {fills: [
    {x: 7, r: 0, g: 0, b: 0},
    {x: 7, y: 1, r: 255, g: 246, b: 142},
    {x: 7, y: 2, useSkinColor: true},
    {x: 6, y: 3, r: 255, g: 246, b: 142},
    {x: 6, y: 4, r: 0, g: 0, b: 0},
    {x: 7, y: 4, r: 255, g: 246, b: 142},
    {x: 6, y: 5, r: 99, g: 133, b: 150},
    {x: 7, y: 5, r: 0, g: 0, b: 0},
  ], extraEarSkin: true, shiftPixel: {x: 7, y: 14}},
  'Crazy Hair': {fills: [
    {x: 6, r: 226, g: 38, b: 38},
    {x: 7, r: 0, g: 0, b: 0},
    {x: 7, y: -1, r: 226, g: 38, b: 38},
  ]},
  'Orange Side': {fills: [
    {x: 6, r: 99, g: 133, b: 150},
    {x: 6, y: 4, r: 99, g: 133, b: 150},
  ]},
  'Wild Blonde': {fills: [
    {x: 6, r: 255, g: 246, b: 142},
    {x: 7, r: 255, g: 246, b: 142},
  ]},
  'Clown Hair Green': {fills: [
    {x: 6, r: 21, g: 112, b: 4},
    {x: 7, r: 0, g: 0, b: 0},
    {x: 7, y: -1, r: 21, g: 112, b: 4},
  ]},
};
