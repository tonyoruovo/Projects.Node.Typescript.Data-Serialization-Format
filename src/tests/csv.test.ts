import csv from "../parser/csv.js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createReadStream } from "node:fs";
import json from "../parser/json.js";

const path = resolve(
  fileURLToPath(new URL(".", import.meta.url).toString()),
  "./test.csv"
);

// lexer test
const rs = createReadStream(path);
// rs.pipe(process.stdout);
// const format = new csv.StringFormat();
const format2 = new csv.JSFormat();
const syntax = csv.RFC_4180;
const params = new csv.Params();
const parser = new csv.Parser();
const t = new csv.Converter(
  {
    writableObjectMode: false,
    readableObjectMode: true,
  },
  new csv.StringLexer(),
  parser,
  syntax,
  params
);
rs.pipe(t).pipe(new json.Converter(syntax, params, format2))
  // .on("data", (chunk) => {
  //   (chunk as csv.Expression).format(format, syntax, params);
  //   (chunk as csv.Expression).format(format2, syntax, params);
  // })
  // .on("end", () => {
  //   process.stdout.write(format.data());
  //   console.table(params.header);
  //   console.table(format2.data());
  // });
// const data = [{
//   "sibling1": "row1 column1",
//   "sibling2": "row1 column2",
//   "sibling3": [ "row1 column3", null ],
//   "sibling4": "row1 column5"
// }, {
//   "sibling1": "row2 column1",
//   "sibling2": "row2 column2",
//   "sibling3": [ "row2 column3", [ "row2 column4" ] ],
//   "sibling4": "row2 column5"
// }, {
//   "sibling1": "row3 column1",
//   "sibling2": "row3 column2",
//   "sibling3": [ null, [ "row3 column4" ] ],
//   "sibling4": "row3 column5"
// }];
// const data = [{
//   "sibling1": "row1 column1",
//   "sibling2": "row1 column2",
//   "sibling3": {
//       "child1": "row1 column3",
//       "child2": null
//   },
//   "sibling4": "row1 column5"
// }, {
//   "sibling1": "row2 column1",
//   "sibling2": "row2 column2",
//   "sibling3": {
//       "child1": "row2 column3",
//       "child2": {
//           "grandchild1": "row2 column4"
//       }
//   },
//   "sibling4": "row2 column5"
// }, {
//   "sibling1": "row3 column1",
//   "sibling2": "row3 column2",
//   "sibling3": {
//       "child1": null,
//       "child2": {
//           "grandchild1": "row3 column4"
//       }
//   },
//   "sibling4": "row3 column5"
// }];
// const l = new csv.JSONLexer();
// params.header = ["sibling1","sibling2","sibling3#0","sibling3#1#0","sibling4"]
// params.header = ["sibling1","sibling2","sibling3.child1","sibling3.child2.grandchild1","sibling4"]
// l.process(data, syntax, params);
// console.log(params.header);
// console.table(l.processed());
// while(l.hasTokens()){
//   const x = parser.parse(l, syntax, params);
//   x.format(format, syntax, params);
//   x.format(format2, syntax, params);
// }
// console.log(format.data());
// console.log(format2.data());
