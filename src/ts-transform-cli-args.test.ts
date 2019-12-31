import Ts from "typescript";
import { Transformer } from "ts-transformer-testing-library";
import { TestCli } from "./test-cli.util";
import { getTransformer } from "./ts-transform-cli-args";

const transformer = new Transformer()
  .addTransformer(getTransformer)
  .setCompilerOptions({ module: Ts.ModuleKind.CommonJS })
  .addMock({
    name: "ts-transform-cli-args",
    content: "export const fromType = <T = any, V = any>(): any => ()"
  });

const testCli = TestCli.fromTransformer(transformer);

test.concurrent("allows empty input by default", async () => {
  const cli = testCli.fromInterface();
  const result = cli([]);
  expect(result).toEqual([null, [{}, []]]);
});

test.concurrent("disallows positional arguments by default", async () => {
  const cli = testCli.fromInterface();
  const [err] = cli(["Hello", "World"]);
  expect(err.message).toBe(
    `argument at [0] should never be specified. Received "Hello"`
  );
});

test.concurrent("disallows named arguments by default", async () => {
  const cli = testCli.fromInterface();
  const [err] = cli(["--hello='world'"]);
  expect(err.message).toBe(`unknown flag --hello is not allowed`);
});

test.concurrent("requires declared named arguments", async () => {
  const cli = testCli.fromInterface({ named: `{  hello: string }` });
  const [err] = cli([]);
  expect(err.message).toBe(`--hello is required but missing`);
});

test.concurrent("validates declared string named argument", async () => {
  const cli = testCli.fromInterface({ named: `{  hello: string }` });
  const [err] = cli(["--hello"]);
  expect(err.message).toBe(
    `--hello must be of type string. Received true of type boolean`
  );
});

test.concurrent("validates declared boolean named argument", async () => {
  const cli = testCli.fromInterface({ named: `{  hello: boolean }` });
  const [err] = cli(["--hello='world'"]);
  expect(err.message).toBe(
    `--hello must be of type boolean. Received "world" of type string`
  );
});

test.concurrent("validates declared number named argument", async () => {
  const cli = testCli.fromInterface({ named: `{  hello: number }` });
  const [err] = cli(["--hello='world'"]);
  expect(err.message).toBe(
    `--hello must be of type number. Received "world" of type string`
  );
});

test.concurrent("validates tuple positional argument length", async () => {
  const cli = testCli.fromInterface({ positional: `[string, string]` });
  const [err] = cli([]);
  expect(err.message).toBe(
    `requires exactly 2 arguments. Received [] of length 0`
  );
});

test.concurrent("validates tuple positional argument range", async () => {
  const cli = testCli.fromInterface({ positional: `[string, string, string?]` });
  const [err] = cli(["leet", "leet", "leet", "leet"]);
  expect(err.message).toBe(
    `requires 2 to 3 arguments. Received ["leet","leet","leet","leet"] of length 4`
  );
});

test.concurrent("validates tuple positional argument type", async () => {
  const cli = testCli.fromInterface({ positional: `[string]` });
  const [err] = cli(["1337"]);
  expect(err.message).toBe(
    `argument at [0] must be of type string. Received 1337 of type number`
  );
});
