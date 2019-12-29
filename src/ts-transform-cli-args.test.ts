import requireFromString from "require-from-string";
import Ts from "typescript";
import { Transformer } from "ts-transformer-testing-library";
import { FromType } from "./types";
import { getTransformer } from "./ts-transform-cli-args";

const transformer = new Transformer()
  .addTransformer(getTransformer)
  .setCompilerOptions({ module: Ts.ModuleKind.CommonJS })
  .addMock({
    name: "ts-transform-cli-args",
    content: "export const fromType = <T = any, V = any>(): any => ()"
  });

const getCli = (source: string): FromType => {
  const result = transformer.transform(source);
  const { cli } = requireFromString(result);
  return cli as FromType;
};

test("allows empty input by default", () => {
  const cli = getCli(`
    import { fromType } from "ts-transform-cli-args";
    export const cli = fromType();
  `);

  const result = cli([]);
  expect(result).toEqual([null, [{}, []]]);
});

test("disallows positional arguments by default", () => {
  const cli = getCli(`
    import { fromType } from "ts-transform-cli-args";
    export const cli = fromType();
  `);

  const [err] = cli(["Hello", "World"]);
  expect(err.message).toBe(`argument at [0] should never be specified. Received "Hello"`);
});

test("disallows named arguments by default", () => {
  const cli = getCli(`
    import { fromType } from "ts-transform-cli-args";
    export const cli = fromType();
  `);

  const [err] = cli(["--hello='world'"]);
  expect(err.message).toBe(`unknown flag --hello is not allowed`);
});