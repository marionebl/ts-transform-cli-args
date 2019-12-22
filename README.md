# ts-transform-cli-args

> Derive a strict argument parser from TypeScript interfaces


```ts
// cli.ts
import * as CliArgs from "ts-transform-cli-args";

interface SomeInterface {
  _: string[],
  flagA: string;
  flagB: number;
  flagC?: boolean;
}

const parseArguments = CliArgs.fromType<SomeInterface>();
const argumentsResult = parseArgument(process.env.slice(2));

if (argumentsResult instanceof Error) {
  console.error(argumentsResult.message);
  process.exit(1);
}

console.log(argumentsResult);
// argumentsResult refined to SomeInterface 
```

```
$ node lib/cli.js
--flagA is required

$ node lib/cli.js --flagA=a
--flagB is required

$ node lib/cli.js --flagA=a --flagB=1 --flagC=1
--flagB must be boolean

$ node lib/cli.js --flagA=a --flagB=1
{ _: [], flagA: 'a', flagB: 1 }

$ node lib/cli.js --flagA=a --flagB=1 --flagC
{ _: [], flagA: 'a', flagB: 1, flagC: true }
```


## Installation

```
yarn add ts-transform-cli-args ttypescript -D
yarn add yargs-parser
```

## Usage

```
// tsconfig.json
{
  "compilerOptions": {
    "target": "es2015",
    "plugins": [
      {
        "transform": "ts-transform-cli-args",
        "type": "program"
      }
    ]
  }
}
```

See [TTypeScript](https://github.com/cevek/ttypescript#how-to-use) for docs about integration with other toolchains.