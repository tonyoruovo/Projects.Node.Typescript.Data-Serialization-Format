import utility from "../utility.js";
import ini from "../parser/ini.js";
import { createReadStream } from "node:fs";

const path = `${utility.rootFolder()}/data/ini/generic2.ini`;

const lexer = new ini.StringLexer();
const syntax = ini.GENERIC;
const params = new ini.Params();
const parser = new ini.Parser();
const format = new ini.JSFormat();
const format2 = new ini.StringFormat();
const format3 = new ini.FileFormat("./file.ini");

const rs = createReadStream(path);
rs.on('data', chunk => {
  lexer.process(String(chunk), syntax, params);
}).on("end", () => {
  lexer.end(syntax, params);
  // console.log("crossed")
  const e = parser.parse(lexer, syntax, params);
  e.format(format, syntax, params);
  e.format(format2, syntax, params);
  e.format(format3, syntax, params);
  console.log(format.data());
  console.log(format2.data());
});
