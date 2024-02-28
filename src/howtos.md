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
    type: "json",
  },
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

function* n(obj: any, path = [] as (number | string)[], mod = 0): Generator {
  if (Array.isArray(obj)) {
    let i = 0;
    for (const e of obj) {
      yield* n(e, [...path, i]);
      i++;
    }
  } else if (typeof obj === "object" && obj !== null) {
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
});
ReadStream.from(n(json)).pipe(tt).pipe(process.stdout);
```

# Pipe results of Cmdlets from powershell to node.js function `require('fs').readFileSync`
## Print raw string to output
```PS
echo '{"type":"Bar","id":"1","title":"Foo"}' | node -p "JSON.stringify( JSON.parse(require('fs').readFileSync(0) ), 0, 1 )"
```
outputs
```txt
{
 "type": "Bar",
 "id": "1",
 "title": "Foo"
}
```
The formatting was done by node.js function `JSON.stringify`.
## Use node.js function `console.log` to give colour formatting to string on the output
```PS
 echo '{"type":"Bar","id":"1","title":"Foo"}' | node -p "console.log( JSON.parse(require('fs').readFileSync(0) ))"
```
outputs
```js
{ type: 'Bar', id: '1', title: 'Foo' }
undefined
```
The colour formatting was done by node.js function `console.log`
# Curl syntax
## Upload a file with cURL:
```powershell
# The short command is -T
curl -T file https://example.com
# Note that [1-1000] is a pattern meaning 'img1', 'img2', ..., 'img999', 'img1000'
curl -T "img[1-1000].png" ftp://ftp.example.com/
# The long command is --upload-file
# Note that {file1,file2} is a pattern meaning:
# curl --upload-file file1  https://example.com && curl --upload-file file2 https://example.com
curl --upload-file "{file1,file2}" https://example.com
```
## Specify an option file for cURL using `-K`, `--config`
```
# --- Example file ---
# this is a comment
url = "example.com"
output = "C:\\Projects\\WebDev.Javascript.Inventory-App\\server\\data\\curlhere.html"
user-agent = "superagent/1.0"
# and fetch another URL too
url = "C:\\Projects\\WebDev.Javascript.Inventory-App\\server\\data\\manpage.html"
-O
referer = "http://nowhereatall.example.com/"
# --- End of example file ---
```
Note that every option ditches the trailing `--` using only the letter portion of the option e.g `--url` becomes `url`. This example file can then be used in curl:
```powershell
curl --config file.txt https://example.com
```
## Send data in the body of a request with curl using `-d`, `--data`
(HTTP MQTT) Sends the specified data in a POST request to the HTTP server, in the same way that a browser does when a user has filled in an HTML form and presses the submit button. This makes curl pass the data to the server using the content-type application/x-www-form-urlencoded.\
\
If any of these options is used more than once on the same command line, the data pieces specified are merged with a separating `&-symbol`. Thus, using `-d name=daniel -d skill=lousy` would generate a post chunk that looks like `name=daniel&skill=lousy`.\
\
If you start the data with the letter `@`, the rest should be a file name to read the data from, or `-` if you want curl to read the data from stdin. Posting data from a file named 'foobar' would thus be done with, `--data @foobar`. When `--data` is told to read from a file like that, carriage returns and newlines are stripped out. If you do not want the `@` character to have a special interpretation use `--data-raw` instead.\
```powershell
curl -d "name=curl" https://example.com
curl -d "name=curl" -d "tool=cmdline" https://example.com
curl -d @filename https://example.com
```
## Send data in request body as a html form using `-F`, `--form`
(HTTP SMTP IMAP) For HTTP protocol family, this lets curl emulate a filled-in form in which a user has pressed the submit button. This causes curl to POST data using the `Content-Type multipart/form-data` according to RFC 2388.\
\
This enables uploading of binary files etc. To force the 'content' part to be a file, prefix the file name with an `@` sign. To just get the content part from a file, prefix the file name with the symbol `<`. The difference between `@` and `<` is then that `@` makes a file get attached in the post as a file upload, while the `<` makes a text field and just get the contents for that text field from a file.\
\
Tell curl to read content from stdin instead of a file by using - as filename. This goes for both `@` and `<` constructs. When stdin is used, the contents is buffered in memory first by curl to determine its size and allow a possible resend. Defining a part's data from a named non-regular file (such as a named pipe or similar) is not subject to buffering and is instead read at transmission time; since the full size is unknown before the transfer starts, such data is sent as chunks by HTTP and rejected by IMAP.\
\
### send an image to an HTTP server, where 'profile' is the name of the form-field to which the file portrait.jpg is the input:
```
curl -F profile=@portrait.jpg https://example.com/upload.cgi
curl --form profile=@portrait.jpg https://example.com/upload.cgi
```
### send your name and shoe size in two text fields to the server:
```
curl -F name=John -F shoesize=11 https://example.com/
```
### send your essay in a text field to the server. Send it as a plain text field, but get the contents for it from a local file:
```
curl -F "story=<hugefile.txt" https://example.com/
```
You can also tell curl what `Content-Type` to use by using `type=`, in a manner similar to:
```
curl -F "web=@index.html;type=text/html" example.com
```
or
```
curl -F "name=daniel;type=text/foo" example.com
```
You can also explicitly change the name field of a file upload part by setting `filename=`, like this:
```
curl -F "file=@localfile;filename=nameinpost" example.com
```
You can add custom headers to the field by setting headers=, like
```
curl -F "submit=OK;headers=\"X-submit-type: OK\"" example.com
```
or
```
curl -F "submit=OK;headers=@headerfile" example.com
```
The `headers=` keyword may appear more that once and above notes about quoting apply. When headers are read from a file, Empty lines and lines starting with `#` are comments and ignored; each header can be folded by splitting between two words and starting the continuation line with a space; embedded carriage-returns and trailing spaces are stripped. Here is an example of a header file contents:
```
# This file contain two headers.
X-header-1: this is a header
# The following header is folded.
X-header-2: this is
  another header
```
## Send request with specified headers
You may specify any number of extra headers. Note that if you should add a custom header that has the same name as one of the internal ones curl would use, your externally set header is used instead of the internal one. This allows you to make even trickier stuff than curl would normally do. You should not replace internally set headers without knowing perfectly well what you are doing. Remove an internal header by giving a replacement without content on the right side of the colon, as in: -H `Host:`. If you send the custom header with no-value then its header must be terminated with a semicolon, such as -H `X-Custom-Header;` to send `X-Custom-Header:`.
```powershell
curl -H "X-First-Name: Joe" https://example.com
curl -H "User-Agent: yes-please/2000" https://example.com
curl -H "Host:" https://example.com
curl -H @headers.txt https://example.com
```
## Write curl output to a file instead of a standard output
Write output to `<file>` instead of stdout. If you are using {} or [] to fetch multiple documents, you should quote the URL and you can use '#' followed by a number in the `<file>` specifier. That variable is replaced with the current string for the URL being fetched. Like in:
```powershell
curl "http://{one,two}.example.com" -o "file_#1.txt"
```
or use several variables like:
```powershell
curl "http://{site,host}.host[1-5].example" -o "#1_#2"
```
To suppress response bodies, you can redirect output to /dev/null (linux):
```powershell
curl example.com -o /dev/null
```
Or for Windows:
```powershell
curl example.com -o nul
```
```powershell
curl -o file https://example.com
curl "http://{one,two}.example.com" -o "file_#1.txt"
curl "http://{site,host}.host[1-5].example" -o "#1_#2"
curl -o file https://example.com -o file2 https://example.net
```
## Build and append a query string to a url in cURL
```powershell
curl --url-query name=val https://example.com
curl --url-query =encodethis http://example.net/foo
curl --url-query name@file https://example.com
curl --url-query @fileonly https://example.com
curl --url-query "+name=%20foo" https://example.com
```
## Send request using http method
```powershell
# for HTTP GET
# short form is -G
curl --get https://example.com 
curl --get -d "tool=curl" -d "age=old" https://example.com
# for HTTP HEAD
# long form is --head
curl -I https://example.com
```
## Specify a request method with cURL `-X`, `--request`
```powershell
curl -X "DELETE" https://example.com
curl -X "POST" https://example.com
curl -X "HEAD" https://example.com
curl -X "GET" https://example.com
curl -X "PUT" https://example.com
```
