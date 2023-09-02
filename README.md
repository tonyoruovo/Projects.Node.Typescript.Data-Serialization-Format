# Projects.Node.Typescript.Data-Serialization-Format

### Typescript usage for csv to ini
```ts
import csv from "../parser/csv.js";
import { createReadStream } from "node:fs";
import json from "../parser/json.js";
import ini from "../parser/ini.js";
import utility from "../utility.js";

const path = `${utility.rootFolder()}/data/csv/test.csv`;
const rs = createReadStream(path);

const csvLexer = new csv.StringLexer();
const csvSyntax = csv.RFC_4180;
const csvParams = new csv.Params();
const csvParser = new csv.Parser();
const csvFormatter = new csv.JSFormat();
const csvConvOptions = { writableObjectMode: false, readableObjectMode: true };
const csvToMemory = new csv.Converter(csvConvOptions, csvLexer, csvParser, csvSyntax, csvParams);

const toMemoryJson = new json.Converter(csvSyntax, csvParams, csvFormatter);

/*Use ini.StringFormat() for strictly strings and ini.FileFormat(filename) for writing the result to a file named 'filename'*/
const iniJsFormat = new ini.JSFormat();
const iniSyntax = ini.UNIX;// can also be 'new ini.SyntaxBuilder().build()'
const iniParams = new ini.Params();
const iniParser = new ini.Parser();
const iniJSONLexer = new ini.JSONLexer();
const iniConvOptions = { writableObjectMode: true, readableObjectMode: true };
const memoryJsonToIni = new ini.Converter(iniConvOptions, iniJSONLexer, iniParser, iniSyntax, iniParams);

const memorizeIni = (chunk: ini.Expression) => chunk.format(iniJsFormat, iniSyntax, iniParams);
const log = () => console.log(iniJsFormat.data());

rs.pipe(csvToMemory).pipe(toMemoryJson).pipe(memoryJsonToIni).on("data", memorizeIni).on("end", log);
```
