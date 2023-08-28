// const { default: info } = await import("../../.bin/parser/test.json", {
//     assert: {
//       type: "json",
//     },
//   });
// import { createRequire } from "node:module";
// const require = createRequire(import.meta.url);
// const j = require("../../.bin/parser/test.json");
// for (let i = 0; i < j.Sheet1.length; i++) {
//   console.log(j.Sheet1[i]);

import json from "../../parser/json.js";
import {resolve} from "node:path";
import { fileURLToPath } from "node:url";
import { createReadStream, ReadStream } from "node:fs";

const path = resolve(fileURLToPath(new URL(".", import.meta.url).toString()), "test2.json");

// const sample = "\"\\\\u2023\u2023\\\"\t\\\"\"";

// const rs = ReadStream.from(sample, {
//     highWaterMark: 10
// });

// lexer test
const lexer = new json.StringLexer();
const rs = createReadStream(path, "utf-8");
rs//.pipe(process.stdout)
.on("data", c => lexer.process(c as any, null as any, null as any))
.on("end", () => {lexer.end(null as any, null as any); lexer.processed().forEach(x => console.log(x));});
// console.log(sample);
// rs.pipe(process.stdout);
