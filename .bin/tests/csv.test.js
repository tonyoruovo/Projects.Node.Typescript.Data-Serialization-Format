import csv from "../parser/csv.js";
import { createReadStream } from "node:fs";
import json from "../parser/json.js";
import ini from "../parser/ini.js";
import utility from "../utility.js";
const path = `${utility.rootFolder()}/data/csv/test.csv`;
// lexer test
const rs = createReadStream(path);
// rs.pipe(process.stdout);
const csvSyntax = csv.RFC_4180;
const csvParams = new csv.Params();
const csvParser = new csv.Parser();
const iniJsFormat = new ini.JSFormat();
const iniSyntax = ini.UNIX;
const iniParams = new ini.Params();
const iniParser = new ini.Parser();
const iniJSONLexer = new ini.JSONLexer();
rs.pipe(new csv.Converter({
    writableObjectMode: false,
    readableObjectMode: true,
}, new csv.StringLexer(), csvParser, csvSyntax, csvParams)).pipe(new json.Converter(csvSyntax, csvParams, new csv.JSFormat()))
    .pipe(new ini.Converter({
    writableObjectMode: true,
    readableObjectMode: true,
}, iniJSONLexer, iniParser, iniSyntax, iniParams))
    .on("data", (chunk) => {
    chunk.format(iniJsFormat, iniSyntax, iniParams);
    // e.format(iniJsFormat, iniSyntax, iniParams);
})
    .on("end", () => {
    console.log(iniJsFormat.data());
});
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
