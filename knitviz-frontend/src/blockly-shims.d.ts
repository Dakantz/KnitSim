declare module "blockly" {
  const Blockly: any;
  export = Blockly;
}

declare module "blockly/javascript" {
  export const javascriptGenerator: any;
}

declare module "@blockly/field-colour" {
  export const colourBlend: any;
}
