import * as requireFromString from "require-from-string";
import * as Ts from "typescript";
import { transform } from "ts-transformer-testing-library";
import { getTransformer } from "./ts-transform-cli-args";

const mock = {
  name: "ts-transform-cli-args",
  content: "export const fromType = <T>(): any => ()"
};

const options = {
  transform: getTransformer,
  compilerOptions: {
    module: Ts.ModuleKind.CommonJS
  },
  mocks: [mock]
};

test("creates basic schema", () => {
  let result = transform(
    `
    import * as Flags from "ts-transform-cli-args";

    export interface A {
      _: string[];
      flag: boolean;
    }

    export const cli = Flags.fromType<A>();
  `,
    options
  );

  const { cli } = requireFromString(result);

  expect(cli([])).toEqual(expect.objectContaining({ message: "--flag is required" }));
  expect(cli(["--flag"])).toEqual(expect.objectContaining({ flag: true }));
  expect(cli(["--no-flag"])).toEqual(expect.objectContaining({ flag: false }));
  expect(cli(["--flag", "--unknown"])).toEqual(expect.objectContaining({ message: "unknown flag --unknown is not allowed" }));
  expect(cli(["--flag=1", "--unknown"])).toEqual(expect.objectContaining({ message: "--flag expected a boolean" }));
});
