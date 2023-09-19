import utility from "../utility.js";
import ini from "../parser/ini.js";
import { createReadStream } from "node:fs";
import csv from "../parser/csv.js";
import json from "../parser/json.js";

// const path = `${utility.rootFolder()}/data/ini/generic2.ini`;

// const lexer = new ini.StringLexer();
// const syntax = ini.GENERIC;
// const params = new ini.Params();
// const parser = new ini.Parser();
// const format = new ini.JSFormat();
// const format2 = new ini.StringFormat();
// const format3 = new ini.FileFormat("./file.ini");

// const rs = createReadStream(path);
// rs.on('data', chunk => {
//   lexer.process(String(chunk), syntax, params);
// }).on("end", () => {
//   lexer.end(syntax, params);
//   // console.log("crossed")
//   const e = parser.parse(lexer, syntax, params);
//   e.format(format, syntax, params);
//   e.format(format2, syntax, params);
//   e.format(format3, syntax, params);
//   console.log(format.data());
//   console.log(format2.data());
// });

const path = `${utility.rootFolder()}/data/ini/properties/sample5.properties`;
const rs = createReadStream(path);

const iniLexer = new ini.StringLexer();
const iniSyntax = ini.PROPERTIES;
const iniParams = new ini.Params();
const iniParser = new ini.Parser();
const iniFormatter = new ini.JSFormat();
const iniConvOptions = { writableObjectMode: false, readableObjectMode: true };
const iniToMemory = new ini.Converter(iniConvOptions, iniLexer, iniParser, iniSyntax, iniParams);

const toMemoryJson = new json.Converter(iniSyntax, iniParams, iniFormatter);

const csvJsFormat = new csv.JSFormat();
const csvSyntax = csv.RFC_4180;
const csvParams = new csv.Params();
const csvParser = new csv.Parser();
const csvJSONLexer = new csv.JSONLexer();
const csvConvOptions = { writableObjectMode: true, readableObjectMode: true };
const memoryJsonToCsv = new csv.Converter(csvConvOptions, csvJSONLexer, csvParser, csvSyntax, csvParams);

const memorizeCsv = (chunk: csv.Expression) => chunk.format(csvJsFormat, csvSyntax, csvParams);
const log = () => console.log(csvJsFormat.data());

rs.pipe(iniToMemory).pipe(toMemoryJson).pipe(memoryJsonToCsv).on("data", memorizeCsv).on("end", log).on("error", e => console.log(e));

