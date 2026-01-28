const fs = require('fs');

const regularShadesFemale = JSON.parse(fs.readFileSync('data/eligible-punks.json'));
const frontBeardDark = JSON.parse(fs.readFileSync('data/front-beard-dark.json'));
const choker = JSON.parse(fs.readFileSync('data/choker.json'));
const smallShades = JSON.parse(fs.readFileSync('data/small-shades.json'));
const earVisibleFemale = JSON.parse(fs.readFileSync('data/ear-visible-female.json'));

const mapping = {};

regularShadesFemale.forEach(id => {
  mapping[id] = mapping[id] || [];
  mapping[id].push('regular-shades-female');
});

frontBeardDark.forEach(id => {
  mapping[id] = mapping[id] || [];
  mapping[id].push('front-beard-dark');
});

choker.forEach(id => {
  mapping[id] = mapping[id] || [];
  mapping[id].push('choker');
});

smallShades.forEach(id => {
  mapping[id] = mapping[id] || [];
  mapping[id].push('small-shades');
});

earVisibleFemale.forEach(id => {
  mapping[id] = mapping[id] || [];
  mapping[id].push('ear-visible');
});

fs.writeFileSync('data/punk-modifications.json', JSON.stringify(mapping, null, 2));

// Stats
const counts = {};
Object.values(mapping).forEach(mods => {
  const key = mods.length;
  counts[key] = (counts[key] || 0) + 1;
});

console.log('Modification counts:');
Object.entries(counts).sort((a,b) => a[0] - b[0]).forEach(([k,v]) => {
  console.log(`  ${k} modification(s): ${v} punks`);
});
console.log(`\nTotal punks: ${Object.keys(mapping).length}`);
