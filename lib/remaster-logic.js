// Shared remaster logic - no canvas dependencies
// Both API and frontend import from here

import {
  EAR_VISIBLE_HAIRSTYLES,
  EAR_COVERING_HAIR,
  EAR_COVERING_EYEWEAR,
  FROWN_REMASTER_BEARDS,
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
    // A Pilot Helmet is a hard helmet that fully covers the ears.
    const hasPilotHelmet = punk.accessories.includes('Pilot Helmet');
    // Big Shades (and other wide eyewear) hide the ear entirely, so no ear remaster
    const hasEarCoveringEyewear = punk.accessories.some(a => EAR_COVERING_EYEWEAR.has(a));

    // Neither a 3D Glasses frame nor a Medical Mask covers the ear alone, but
    // together they do (the frame takes the top ear pixel, the mask the bottom).
    const comboCoversEar = punk.accessories.includes('3D Glasses')
      && punk.accessories.includes('Medical Mask');

    // Determine if ear is visible: has an ear-visible trait (or is bald), and no
    // eyewear/helmet covering the ear.
    const earIsVisible = !hasEarCoveringEyewear && !comboCoversEar && !hasPilotHelmet
      && (earVisibleTrait || (!hasEarCoveringHair && !hasHoodie));

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

    // Frown remaster: the frown stays visible through a beard that the original
    // draws over it (see FROWN_REMASTER_BEARDS). A Medical Mask would cover the
    // frown, so it's excluded.
    if (punk.accessories.includes('Frown')
        && !punk.accessories.includes('Medical Mask')
        && punk.accessories.some(a => FROWN_REMASTER_BEARDS.has(a))) {
      remasters.push({type: 'frown', trait: 'Frown', description: 'Frown kept visible over the beard'});
    }
  }

  return remasters;
}

// Check if a punk has any remasters available
export function hasRemasters(punk) {
  return getRemasters(punk).length > 0;
}
