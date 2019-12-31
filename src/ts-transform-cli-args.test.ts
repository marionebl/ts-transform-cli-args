import Ts from "typescript";
import { Transformer } from "ts-transformer-testing-library";
import { TestCli } from "./test-cli.util";
import { getTransformer } from "./ts-transform-cli-args";

const transformer = new Transformer()
  .addTransformer(getTransformer)
  .setCompilerOptions({ module: Ts.ModuleKind.CommonJS })
  .addMock({
    name: "ts-transform-cli-args",
    content: "export const fromType = <Named = any, Positional = any, Aliases = any>(): any => ()"
  });

const testCli = TestCli.fromTransformer(transformer);

describe("named arguments", () => {
  test("allows empty input by default", async () => {
    const cli = testCli.fromInterface();
    const result = cli([]);
    expect(result).toEqual([null, [{}, []]]);
  });

  test("disallows by default", async () => {
    const cli = testCli.fromInterface();
    const [err] = cli(["--hello='world'"]);
    expect(err.message).toBe(`unknown flag --hello is not allowed`);
  });

  test("validates required string", async () => {
    const cli = testCli.fromInterface({ named: `{  hello: string }` });

    {
      const [err] = cli([]);
      expect(err.message).toBe(`--hello is required but missing`);
    }

    {
      const [err] = cli(["--hello='world'"]);
      expect(err).toBeNull();
    }
  });

  test("validates string", async () => {
    const cli = testCli.fromInterface({ named: `{  hello: string }` });

    {
      const [err] = cli(["--hello"]);
      expect(err.message).toBe(
        `--hello must be of type string. Received true of type boolean`
      );
    }

    {
      const [err] = cli(["--hello='world'"]);
      expect(err).toBeNull();
    }
  });

  test("validates boolean", async () => {
    const cli = testCli.fromInterface({ named: `{  hello: boolean }` });

    {
      const [err] = cli(["--hello='world'"]);
      expect(err.message).toBe(
        `--hello must be of type boolean. Received "world" of type string`
      );
    }

    {
      const [err] = cli(["--hello"]);
      expect(err).toBeNull();
    }
  });

  test("validates number", async () => {
    const cli = testCli.fromInterface({ named: `{  hello: number }` });

    {
      const [err] = cli(["--hello='world'"]);
      expect(err.message).toBe(
        `--hello must be of type number. Received "world" of type string`
      );
    }

    {
      const [err] = cli(["--hello=1337"]);
      expect(err).toBeNull();
    }
  });

  test("validates string literal", async () => {
    const cli = testCli.fromInterface({ named: `{  hello: "world" }` });

    {
      const [err] = cli(["--hello='sun'"]);
      expect(err.message).toBe(
        `--hello must be "world", received "sun"`
      );
    }

    {
      const [err] = cli(["--hello='world'"]);
      expect(err).toBeNull();
    }
  });
});

describe("positional arguments", () => {
  test("disallows by default", async () => {
    const cli = testCli.fromInterface();
    const [err] = cli(["Hello", "World"]);
    expect(err.message).toBe(
      `argument at [0] should never be specified. Received "Hello"`
    );
  });

  test("validates tuple length", async () => {
    const cli = testCli.fromInterface({ positional: `[string, string]` });

    {
      const [err] = cli([]);
      expect(err.message).toBe(
        `requires exactly 2 arguments. Received [] of length 0`
      );
    }

    {
      const [err] = cli(["hello", "world"]);
      expect(err).toBeNull();
    }
  });

  test.skip("validates tuple range", async () => {
    const cli = testCli.fromInterface({ positional: `[string, string, string?]` });

    {
      const [err] = cli(["leet", "leet", "leet", "leet"]);
      expect(err.message).toBe(
        `requires 2 to 3 arguments. Received ["leet","leet","leet","leet"] of length 4`
      );
    }

    {
      const [err] = cli(["leet", "leet", "leet"]);
      expect(err).toBeNull();
    }

    {
      const [err] = cli(["leet", "leet"]);
      expect(err).toBeNull();
    }
  });

  test("validates tuple member type string", async () => {
    const cli = testCli.fromInterface({ positional: `[string]` });

    {
      const [err] = cli(["1337"]);
      expect(err.message).toBe(
        `argument at [0] must be of type string. Received 1337 of type number`
      );
    }

    {
      const [err] = cli(["leet"]);
      expect(err).toBeNull();
    }
  });

  test("validates tuple member type number", async () => {
    const cli = testCli.fromInterface({ positional: `[number]` });

    {
      const [err] = cli(["leet"]);
      expect(err.message).toBe(
        `argument at [0] must be of type number. Received "leet" of type string`
      );
    }

    {
      const [err] = cli(["1337"]);
      expect(err).toBe(null);
    }
  });


  test.skip("validates tuple member type boolean", async () => {
    const cli = testCli.fromInterface({ positional: `[boolean]` });

    {
      const [err] = cli(["1337"]);
      expect(err.message).toBe(
        `argument at [0] must be of type boolean. Received 1337 of type number`
      );
    }

    {
      const [err] = cli(["true"]);
      expect(err).toBeNull();
    }
  });
});