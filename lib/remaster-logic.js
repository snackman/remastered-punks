// Shared remaster logic - no canvas dependencies
// Both API and frontend import from here

import {
  EAR_VISIBLE_HAIRSTYLES,
  EAR_COVERING_HAIR,
} from './constants.js';

// Get list of remasters applicable to a punk
export function getRemasters(punk) {
  const remasters = [];
  const isFemale = punk.gender === 'Female';
  const isMale = punk.gender === 'Male';

  if (isFemale) {
    // Check for ear-visible hairstyles
    const earVisibleTrait = punk.accessories.find(a => EAR_VISIBLE_HAIRSTYLES.has(a));

    // Check if punk has any trait that covers the ear
    const hasEarCoveringHair = punk.accessories.some(a => EAR_COVERING_HAIR.has(a));
    const hasHoodie = punk.accessories.includes('Hoodie');

    // Determine if ear is visible: either has ear-visible trait, or is bald (no ear-covering traits)
    const earIsVisible = earVisibleTrait || (!hasEarCoveringHair && !hasHoodie);

    if (earIsVisible) {
      // Use the ear-visible trait if present, otherwise 'Bald' for bald punks
      const earTrait = earVisibleTrait || 'Bald';
      remasters.push({type: 'ear', trait: earTrait, description: 'Ear shifted down 1px'});

      // If Regular Shades present, shift it too
      if (punk.accessories.includes('Regular Shades')) {
        remasters.push({type: 'shades', trait: 'Regular Shades', description: 'Regular Shades shifted down 1px'});
      }

      // If Earring present, shift it too
      if (punk.accessories.includes('Earring')) {
        remasters.push({type: 'earring', trait: 'Earring', description: 'Earring shifted down 1px'});
      }
    }

    // Choker remaster
    if (punk.accessories.includes('Choker')) {
      remasters.push({type: 'choker', trait: 'Choker', description: 'Choker replaced with 3 centered pixels'});
    }
  }

  if (isMale) {
    // Front Beard remaster
    if (punk.accessories.includes('Front Beard')) {
      remasters.push({type: 'frontBeard', trait: 'Front Beard', description: 'Added beard pixels at chin'});
    }
    if (punk.accessories.includes('Front Beard Dark')) {
      remasters.push({type: 'frontBeardDark', trait: 'Front Beard Dark', description: 'Added beard pixels at chin'});
    }

    // Small Shades remaster
    if (punk.accessories.includes('Small Shades')) {
      remasters.push({type: 'smallShades', trait: 'Small Shades', description: 'Added nose bridge pixels'});
    }
  }

  return remasters;
}

// Check if a punk has any remasters available
export function hasRemasters(punk) {
  return getRemasters(punk).length > 0;
}
