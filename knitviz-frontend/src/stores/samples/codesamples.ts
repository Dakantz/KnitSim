import { defineStore } from "pinia";

const codeSampleMap: Record<string, string> = {
  "Simple Flat": `this.cast_on(24)
for (let row = 0; row < 16; row++) {
  this.color(row % 2 === 0 ? '#3366ff' : '#ff7a59')
  this.knit(24, row % 2 === 0 ? 'knit' : 'purl')
  this.end_row()
}`,
  Beanie: `this.cast_on(24, 'round')
let stitches = 24
for (let i = 0; i < 8; i++) {
  this.color('#6b8afd')
  this.knit(stitches, 'knit')
  this.end_row()
  stitches -= 2
}`,
  "Ribbed Panel": `this.cast_on(28, 'flat')
for (let row = 0; row < 14; row++) {
  this.color(row % 2 === 0 ? '#3f6fcf' : '#6ea9ff')
  for (let section = 0; section < 7; section++) {
    const stitch = section % 2 === 0 ? 'knit' : 'purl'
    this.knit(4, stitch)
  }
  this.end_row()
}`
};

const sampleNames = Object.keys(codeSampleMap);

export const useCodeSamplesStore = defineStore("codeSamples", () => {
  const getSample = (name: string) => {
    return codeSampleMap[name] ?? "";
  };

  return {
    samples: codeSampleMap,
    names: sampleNames,
    getSample,
  };
});
