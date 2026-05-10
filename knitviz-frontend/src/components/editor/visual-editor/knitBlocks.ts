import * as Blockly from "blockly";
import { javascriptGenerator } from "blockly/javascript";
import { colourBlend } from "@blockly/field-colour";

let isRegistered = false;

const patternPresets = {
  repeatWithKnit: {
    kind: "block",
    type: "knit_repeat",
    fields: {
      TIMES: 3,
    },
    inputs: {
      DO: {
        block: {
          type: "knit_knit_color",
          fields: {
            STITCHES: 4,
            COLOR: "#ff0000",
          },
        },
      },
    },
  },
  stripedPattern: {
    kind: "block",
    type: "knit_row",
    inputs: {
      DO: {
        block: {
          type: "knit_knit_color",
          fields: {
            STITCHES: 24,
            COLOR: "#ffff00",
          },
        },
      },
    },
    next: {
      block: {
        type: "knit_repeat",
        fields: {
          TIMES: 10,
        },
        inputs: {
          DO: {
            block: {
              type: "knit_row",
              inputs: {
                DO: {
                  block: {
                    type: "knit_knit_color",
                    fields: {
                      STITCHES: 6,
                      COLOR: "#0000ff",
                    },
                    next: {
                      block: {
                        type: "knit_purl_color",
                        fields: {
                          STITCHES: 4,
                          COLOR: "#ff0000",
                        },
                        next: {
                          block: {
                            type: "knit_knit_color",
                            fields: {
                              STITCHES: 4,
                              COLOR: "#0000ff",
                            },
                            next: {
                              block: {
                                type: "knit_purl_color",
                                fields: {
                                  STITCHES: 4,
                                  COLOR: "#ff0000",
                                },
                                next: {
                                  block: {
                                    type: "knit_knit_color",
                                    fields: {
                                      STITCHES: 6,
                                      COLOR: "#0000ff",
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        next: {
          block: {
            type: "knit_row",
            inputs: {
              DO: {
                block: {
                  type: "knit_knit_color",
                  fields: {
                    STITCHES: 24,
                    COLOR: "#ffff00",
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

const blockDefinitions = Blockly.common.createBlockDefinitionsFromJsonArray([
  {
    type: "knit_cast_on",
    message0: "Cast on %1 stitches (%2)",
    args0: [
      {
        type: "field_number",
        name: "STITCHES",
        value: 24,
        min: 1,
      },
      {
        type: "field_dropdown",
        name: "MODE",
        options: [
          ["Flat", "FLAT"],
          ["Round", "ROUND"],
        ],
      },
    ],
    nextStatement: null,
    colour: 230,
  },
  {
    type: "knit_row",
    message0: "Row",
    message1: "do %1",
    message2: "then end row",
    args1: [{ type: "input_statement", name: "DO" }],
    previousStatement: null,
    nextStatement: null,
    colour: 210,
  },
  {
    type: "knit_repeat",
    message0: "Repeat %1 times",
    message1: "do %1",
    args0: [{ type: "field_number", name: "TIMES", value: 3, min: 1 }],
    args1: [{ type: "input_statement", name: "DO" }],
    previousStatement: null,
    nextStatement: null,
    colour: 120,
  },
  {
    type: "knit_knit_color",
    message0: "Knit %1 stitches in %2",
    args0: [
      { type: "field_number", name: "STITCHES", value: 4, min: 1 },
      { type: "field_colour", name: "COLOR", colour: "#3366ff" },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 185,
  },
  {
    type: "knit_purl_color",
    message0: "Purl %1 stitches in %2",
    args0: [
      { type: "field_number", name: "STITCHES", value: 4, min: 1 },
      { type: "field_colour", name: "COLOR", colour: "#7ca9ff" },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 185,
  },
  {
    type: "knit_end_row",
    message0: "End row",
    previousStatement: null,
    nextStatement: null,
    colour: 160,
  },
]);

const registerGenerators = () => {
  javascriptGenerator.forBlock.knit_cast_on = function (block) {
    const stitches = block.getFieldValue("STITCHES");
    const mode = block.getFieldValue("MODE");
    return `state.cast_on(${stitches}, '${mode === "ROUND" ? "round" : "flat"}')\n`;
  };

  javascriptGenerator.forBlock.knit_knit_color = function (block) {
    const stitches = block.getFieldValue("STITCHES");
    const color = block.getFieldValue("COLOR");
    return `state.color('${color}', 1)\nstate.knit(${stitches}, 'KNIT')\n`;
  };

  javascriptGenerator.forBlock.knit_purl_color = function (block) {
    const stitches = block.getFieldValue("STITCHES");
    const color = block.getFieldValue("COLOR");
    return `state.color('${color}', 1)\nstate.knit(${stitches}, 'PURL')\n`;
  };

  javascriptGenerator.forBlock.knit_row = function (block) {
    const doCode = javascriptGenerator.statementToCode(block, "DO");
    return `${doCode}state.end_row()\n`;
  };

  javascriptGenerator.forBlock.knit_repeat = function (block) {
    const times = block.getFieldValue("TIMES");
    const doCode = javascriptGenerator.statementToCode(block, "DO");
    return `for (let i = 0; i < ${times}; i++) {\n${doCode}}\n`;
  };

  javascriptGenerator.forBlock.knit_end_row = function () {
    return "state.end_row()\n";
  };
};

export const ensureKnitBlocklyRegistered = () => {
  if (isRegistered) {
    return;
  }

  colourBlend.installBlock({
    javascript: javascriptGenerator,
  });
  Blockly.common.defineBlocks(blockDefinitions);
  registerGenerators();
  isRegistered = true;
};

export const knitToolbox = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "Setup",
      contents: [{ kind: "block", type: "knit_cast_on" }],
    },
    {
      kind: "category",
      name: "Rows",
      contents: [
        { kind: "block", type: "knit_row" },
        { kind: "block", type: "knit_repeat" },
        { kind: "block", type: "knit_knit_color" },
        { kind: "block", type: "knit_purl_color" },
        { kind: "block", type: "knit_end_row" },
      ],
    },
    {
      kind: "category",
      name: "Presets",
      contents: [patternPresets.repeatWithKnit, patternPresets.stripedPattern],
    },
  ],
} as any;

export const workspaceToKnitCode = (workspace: any) => {
  const code = javascriptGenerator.workspaceToCode(workspace);
  return code.replace(/state\./g, "this.");
};
