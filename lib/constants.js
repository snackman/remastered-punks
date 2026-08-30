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
  // Nose
  'Clown Nose': 351,
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
  // Nose
  'Clown Nose': 350,
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
// `smoke` is topmost: a cigarette/pipe/vape sticks out in front of everything
// (hoodie, shades, beard) as it does in the original punks.
export const LAYER_ORDER = ['base', 'cheeks', 'blemish', 'hair', 'beard', 'eyes', 'nose', 'mouth', 'mouthprop', 'earring', 'headgear', 'eyewear', 'neck', 'smoke'];

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
  'Cigarette': 'smoke', 'Pipe': 'smoke', 'Vape': 'smoke', 'Medical Mask': 'mouthprop',
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
  'Blonde Bob', 'Blonde Short', 'Crazy Hair', 'Messy Hair',
  'Orange Side', 'Pigtails', 'Stringy Hair',
  'Wild Blonde', 'Wild White Hair', 'Clown Hair Green',
  'Shaved Head'  // Also exposes the ear
]);

// Hair traits that cover the ear (no ear remaster needed) - FEMALE ONLY
export const EAR_COVERING_HAIR = new Set([
  'Dark Hair', 'Frumpy Hair', 'Half Shaved', 'Pink With Hat',
  'Purple Hair', 'Straight Hair', 'Straight Hair Blonde',
  'Straight Hair Dark', 'Tassle Hat', 'Wild Hair'
]);

// Eyewear whose frame covers the ear, so no ear remaster applies even when the
// hairstyle would otherwise expose the ear - FEMALE ONLY
export const EAR_COVERING_EYEWEAR = new Set([
  'Big Shades',
  'VR',        // the VR headset wraps around and covers the ear
  'Eye Mask'   // the eye-mask strap covers the ear
]);

// Skin colors
export const SKIN_COLORS = {
  'Light': {r: 219, g: 177, b: 128, shadowR: 210, shadowG: 157, shadowB: 96},
  'Medium': {r: 174, g: 139, b: 97, shadowR: 167, shadowG: 124, shadowB: 71},
  'Dark': {r: 113, g: 63, b: 29, shadowR: 114, shadowG: 55, shadowB: 9},
  'Albino': {r: 234, g: 217, b: 217, shadowR: 201, shadowG: 178, shadowB: 178},
};

// Fill colors for traits that cover the ear area
export const TRAIT_FILL_COLORS = {
  // Bald females - the shifted ear leaves a gap in the head outline at the top;
  // fill it black so the outline stays connected (matches ear-visible hairstyles).
  'Bald': {r: 0, g: 0, b: 0},
  'Shaved Head': {r: 0, g: 0, b: 0},
  'Headband': {fills: [
    {x: 7, y: 0, r: 0, g: 0, b: 0},
    {x: 7, y: 2, useSkinColor: true},
    {x: 7, y: 3, useSkinColor: true},
  ]},
  'Blonde Bob': {fills: [
    {x: 7, y: 0, r: 255, g: 246, b: 142},
    {x: 7, y: 1, useSkinColor: true},  // ear skin pixel below the top one (7,12)
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
    {x: 6, y: 4, r: 0, g: 0, b: 0},  // black pixel lower-left of the ear
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
    {x: 6, r: 40, g: 177, b: 67},
    {x: 7, r: 0, g: 0, b: 0},
    {x: 7, y: -1, r: 40, g: 177, b: 67},
    {x: 6, y: 4, r: 0, g: 0, b: 0},  // extend head outline one pixel below the ear
  ]},
};

// Corrections for spritesheet colors that differ from the canonical punks.png art.
// Maps a trait -> list of {from:[r,g,b], to:[r,g,b]} recolor rules applied to that
// trait's sprite before compositing, so the remaster matches the original punk.
// Corrections applied to a trait's sprite before compositing. Each rule is
// either colour-based ({from:[r,g,b], to:[r,g,b]}) or position-based
// ({at:[x,y], to:[r,g,b]} - paint a specific pixel regardless of its colour).
export const SPRITE_COLOR_CORRECTIONS = {
  'Clown Hair Green': [
    // Spritesheet Clown Hair Green is a dark forest green; the real punks use a
    // brighter green. Recolor so the remastered hair matches the original.
    { from: [21, 112, 4], to: [40, 177, 67] },
    // The sprite is missing the black hair strand below-right of the right eye
    // (it's green in the sheet but black in every original). Paint it back.
    { at: [17, 14], to: [0, 0, 0] },
  ],
  'Crazy Hair': [
    // The MALE Crazy Hair sprite is missing the black pixel at the upper-left of
    // the ear (5,11) that every original male Crazy Hair punk has. The female
    // sprite already has it, so this rule is male-only.
    { at: [5, 11], to: [0, 0, 0], gender: 'Male' },
  ],
};

// Beards whose sprite paints a non-black pixel at the frown corner (10,19). For
// these, the original CryptoPunk draws the beard over the frown, but our `mouth`
// layer draws the frown on top - so the frown stays visible through the beard.
// That is a curated remaster: males with Frown + one of these beards (and no
// Medical Mask, which would cover it) show the frown where the original hid it.
export const FROWN_REMASTER_BEARDS = new Set([
  'Big Beard', 'Front Beard', 'Front Beard Dark', 'Handlebars', 'Normal Beard',
]);

// CryptoPunks contract address
export const CRYPTOPUNKS_ADDRESS = '0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB';
