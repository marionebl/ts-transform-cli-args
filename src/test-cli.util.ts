import requireFromString from "require-from-string";
import { Transformer } from "ts-transformer-testing-library";
import { FromType } from "./types";

export class TestCli {
  private constructor(private transformer: Transformer) {}

  public static fromTransformer(transformer: Transformer): TestCli {
    return new TestCli(transformer);
  }

  public fromModule(moduleSource: string): FromType {
    const result = this.transformer.transform(moduleSource);
    const { cli } = requireFromString(result);
    return cli as FromType;
  }

  public fromInterface(interfaceSource?: string): FromType {
    const interfaceDeclaration =
      typeof interfaceSource === "string" ? `<${interfaceSource}>` : "";

    return this.fromModule(`
      import { fromType } from "ts-transform-cli-args";
      export const cli = fromType${interfaceDeclaration}();
    `);
  }
}
