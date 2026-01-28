# Punk Remaster Tool Plan

## Overview
Create a page where users enter their punk ID and see the remastered version. If no remastered traits, show "no traits to remaster".

## New Page: `preview/remaster.html`

### UI Components
1. **Punk ID Input**: Text field for punk ID (0-9999)
2. **Remaster Button**: Triggers the lookup and rendering
3. **Display Area**: Shows original vs remastered side by side
4. **Message Area**: Shows "no traits to remaster" when applicable

### Data Requirements
1. **Punk Attributes**: Load from `data/punks-attributes/original/cryptopunks.csv`
   - Parse to get traits for each punk ID
   - Determine gender (Female vs Male type)
   - Determine skin tone (Light, Medium, Dark, Albino based on type)

2. **Punk Sprites**: Load from `data/cryptopunks-assets/punks/config/punks-24x24.png`
   - Can composite from traits, or extract directly from main punk sprite sheet

### Remastered Traits List

**Female Ear Remasters** (shift ear down 1px + fill pixels):
- Mohawk, Mohawk Dark, Mohawk Thin, Red Mohawk
- Bandana, Headband, Cap, Knitted Cap, Tiara
- Welding Goggles
- Blonde Bob, Blonde Short, Crazy Hair, Messy Hair
- Orange Side, Pigtails, Stringy Hair
- Wild Blonde, Wild White Hair, Clown Hair Green

**Traits to Shift** (when ear is visible):
- Regular Shades: shift down 1px
- Earring: shift down 1px

**Male Remasters**:
- Front Beard: add beard pixels at (10,20) and (14,20)
- Front Beard Dark: same as Front Beard
- Small Shades: add black pixels at (11,12) and (11,13)

**Female Remasters**:
- Choker: replace with 3 pixels at x=9,10,11, y=22

### Implementation Steps

#### Step 1: Create HTML Structure
- Copy base structure from traits.html
- Add input field for punk ID
- Add button and display containers

#### Step 2: Load Punk Data
- Fetch and parse cryptopunks.csv
- Create lookup map: punkId -> {type, traits[]}
- Map type to gender and skin tone

#### Step 3: Detect Applicable Remasters
```javascript
function getRemasters(punkData) {
  const remasters = [];
  const isFemale = punkData.type.includes('Female');

  // Check for ear-visible hairstyles (female only)
  // Check for shades/earring
  // Check for male traits
  // Check for choker

  return remasters;
}
```

#### Step 4: Apply Remasters
Reuse existing logic from traits.html:
- `shiftEarOnBase()` for ear remasters
- `shiftSpriteDown()` for shades/earring
- Pixel additions for Front Beard, Small Shades, Choker
- Use TRAIT_FILL_COLORS for per-trait fill configurations

#### Step 5: Render Comparison
- Composite original punk from traits
- Composite remastered punk with modifications
- Display side by side with zoom

#### Step 6: Handle No Remasters
- If getRemasters() returns empty array
- Display "No traits to remaster" message
- Optionally still show the original punk

### Skin Tone Mapping
From punk type in CSV:
- "Human Female 1" / "Human 1" -> varies, need to check actual mapping
- Look at existing base sprite IDs for reference

### Files to Reference
- `preview/traits.html` - all remaster logic already implemented
- `data/punks-attributes/original/cryptopunks.csv` - punk traits
- `preview/composite.html` - may have useful compositing code

### Testing
- Test with punks that have various remastered traits
- Test with punk that has no remastered traits
- Test with both male and female punks
- Verify all skin tones render correctly
