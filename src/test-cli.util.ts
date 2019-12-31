import requireFromString from "require-from-string";
import { Transformer } from "ts-transformer-testing-library";
import { FromType } from "./types";

export interface InterfaceDescriptor {
  positional: string;
  named: string;
}

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

  public fromInterface(descriptor?: Partial<InterfaceDescriptor>): FromType {
    if (!descriptor) {
      return this.fromModule(`
        import { fromType } from "ts-transform-cli-args";
        export const cli = fromType();
      `);
    }

    return this.fromModule(`
      import { fromType } from "ts-transform-cli-args";
      export const cli = fromType<${[
        descriptor.named || "{}",
        descriptor.positional || "[]"
      ]}>();
    `);
  }
}
