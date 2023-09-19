
# Importing json directly to javascript
The following are ways that we can import json into javascript:

## Import using commonJS `require`
```js
const json = require("./package.json");
//use the json value here ...
```

## Using the `JSON.parse` function
```js
import { readFile } from "fs";
const json = JSON.parse(readFile(new URL("./package.json", import.meta.url)));
//use the json value here ...
```

## Using ES6 syntax
There are multiple ways to do this such as:

### Using static import assertion
```js
import json from "./package.json" assert { type: "json" };
//use the json value here ...
```

### Using dynamic import assertion
```js
const { default: json } = await import("./package.json", {
  assert: {
    type: "json"
  }
});
//use the json value here ...
```

### Using the upcoming beta for import attribute (alternative to import assertion)
```js
import json from "./package.json" with { "type": "json" };
//use the json value here ...
```

### Using require function from commonJS in ES6
```js
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const json = require("./package.json");
//use the json value here ...
```
# Create a generator from a composite value
Composite values are arrays and objects. Each index and property may be streamed using the following method:
```ts
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const json = require("./package.json");

function* n(obj:any, path = [] as (number|string)[], mod = 0): Generator {
  if(Array.isArray(obj)){
    let i = 0;
    for (const e of obj) {
      yield* n(e, [...path, i]);
      i++;
    }
  } else if(typeof obj === "object" && obj !== null){
    for (const k in obj) {
      yield* n(obj[k], [...path, k]);
    }
  } else {
    yield [...path, obj];
  }
}
const tt = new Transform({
  writableObjectMode: true,
  readableObjectMode: false,
  transform(chunk, encoding, callback) {
    callback(null, JSON.stringify(chunk, null, 2));
  },
})
ReadStream.from(n(json)).pipe(tt).pipe(process.stdout);
```