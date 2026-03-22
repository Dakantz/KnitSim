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
