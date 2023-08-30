import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import ini from "../parser/ini.js";
import { createReadStream } from "node:fs";

const lexer = new ini.StringLexer();
const syntax = ini.WINAPI;
const params = new ini.Params();
const parser = new ini.Parser();
const format = new ini.JSFormat();
const format2 = new ini.StringFormat();
// const format3 = new ini.FileFormat("./file.ini");
const converter = new ini.Converter({}, lexer, parser, syntax, params);

const path = resolve(
    fileURLToPath(new URL(".", import.meta.url).toString()),
    "./test.ini"
  );
  
  // lexer test
  const rs = createReadStream(path);

  rs.pipe(converter).on("data", (chunk: any) => {
    (chunk as ini.Expression).format(format, syntax, params);
    (chunk as ini.Expression).format(format2, syntax, params);
  })
  .on("end", () => {
    // process.stdout.write(format.data());
    // console.table(params.header);
    console.table(format2.data());
    console.table(format.data());
  });
