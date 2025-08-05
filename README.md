# Data Serialization Format Library

## Summary
A comprehensive TypeScript library for data serialization and deserialization, supporting multiple data formats including CSV, INI, JSON, TOML, XML, and YAML. The library provides high-performance streaming capabilities and flexible conversion between different formats while maintaining data integrity.

## Detailed Description

### Core Features

1. **Multi-Format Support**
   - CSV (RFC 4180 compliant)
   - INI (with variants including Unix-style and Properties)
   - JSON
   - TOML
   - XML
   - YAML
   - Future support planned for HOCON, Recfiles, CSON, JSON5, UBJSON, BSON, Smile, and CUE

2. **High-Performance Design**
   - Streaming-based processing for handling large files
   - Memory-efficient parsing using extrinsic states
   - Support for different character encodings (UTF-8, UTF-16, etc.)
   - Planned SIMD (Single Instruction, Multiple Data) optimization

3. **Flexible Architecture**
   - Modular parser design
   - Extensible format conversion system
   - Custom syntax support
   - Configurable formatting options

4. **Error Handling**
   - Robust error detection and reporting
   - Detailed parsing error messages
   - Syntax validation
   - Format-specific error handling

5. **Data Integrity**
   - Preserves data types during conversion
   - Handles special characters and escape sequences
   - Maintains formatting preferences
   - Supports bidirectional conversion

## Real-World Use Cases

### 1. Configuration Management System

**Scenario**: A company needs to manage configurations across different services that use various config formats.

```typescript
// Convert legacy .properties files to modern TOML format
import ini from "../parser/ini.js";
import toml from "../parser/toml.js";
import { createReadStream } from "node:fs";

const propertiesFile = createReadStream("config/legacy.properties");
const iniLexer = new ini.StringLexer();
const iniSyntax = ini.PROPERTIES;
const iniParams = new ini.Params();
const iniParser = new ini.Parser();
const iniFormatter = new ini.JSFormat();
const iniToMemory = new ini.Converter(
  { writableObjectMode: false, readableObjectMode: true },
  iniLexer,
  iniParser,
  iniSyntax,
  iniParams
);

const tomlFormat = new toml.FileFormat("config/modern.toml");
const tomlSyntax = new toml.SyntaxBuilder().build();
const tomlParams = new toml.Params();
const tomlParser = new toml.Parser();
const memoryToToml = new toml.Converter(
  { writableObjectMode: true, readableObjectMode: false },
  iniFormatter,
  tomlParser,
  tomlSyntax,
  tomlParams
);

propertiesFile.pipe(iniToMemory).pipe(memoryToToml);
```

### 2. Data Integration Pipeline

**Scenario**: An e-commerce platform needs to process product data from multiple suppliers in different formats.

```typescript
// Convert supplier CSV data to standardized JSON format
import csv from "../parser/csv.js";
import json from "../parser/json.js";
import { createReadStream, createWriteStream } from "node:fs";

async function processSupplierData(csvPath: string, jsonPath: string) {
  const csvInput = createReadStream(csvPath);
  const jsonOutput = createWriteStream(jsonPath);

  const csvLexer = new csv.StringLexer();
  const csvSyntax = csv.RFC_4180;
  const csvParams = new csv.Params();
  const csvParser = new csv.Parser();
  const csvFormatter = new csv.JSFormat();
  
  const csvToMemory = new csv.Converter(
    { writableObjectMode: false, readableObjectMode: true },
    csvLexer,
    csvParser,
    csvSyntax,
    csvParams
  );

  const jsonFormat = new json.FileFormat(jsonPath);
  const jsonSyntax = new json.SyntaxBuilder().build();
  const jsonParams = new json.Params();
  const memoryToJson = new json.Converter(
    { writableObjectMode: true, readableObjectMode: false },
    csvFormatter,
    jsonSyntax,
    jsonParams
  );

  await new Promise((resolve, reject) => {
    csvInput
      .pipe(csvToMemory)
      .pipe(memoryToJson)
      .pipe(jsonOutput)
      .on('finish', resolve)
      .on('error', reject);
  });
}
```

### 3. Log Analysis System

**Scenario**: A monitoring system needs to process logs in various formats and convert them to a standardized format for analysis.

```typescript
// Convert various log formats to YAML for analysis
import { createReadStream } from "node:fs";
import ini from "../parser/ini.js";
import yaml from "../parser/yaml.js";

function convertLogToYaml(logPath: string, format: 'ini' | 'properties') {
  const logStream = createReadStream(logPath);
  
  const iniLexer = new ini.StringLexer();
  const iniSyntax = format === 'ini' ? ini.UNIX : ini.PROPERTIES;
  const iniParams = new ini.Params();
  const iniParser = new ini.Parser();
  const iniFormatter = new ini.JSFormat();
  
  const iniToMemory = new ini.Converter(
    { writableObjectMode: false, readableObjectMode: true },
    iniLexer,
    iniParser,
    iniSyntax,
    iniParams
  );

  const yamlFormat = new yaml.StringFormat();
  const yamlSyntax = new yaml.SyntaxBuilder().build();
  const yamlParams = new yaml.Params();
  const memoryToYaml = new yaml.Converter(
    { writableObjectMode: true, readableObjectMode: false },
    iniFormatter,
    yamlSyntax,
    yamlParams
  );

  return logStream
    .pipe(iniToMemory)
    .pipe(memoryToYaml);
}
```

## Technical Details

### Memory Management
The library implements an "extrinsicity" pattern to manage memory efficiently:
- Objects maintain minimal internal state
- State information is passed externally through parameters
- Prevents memory bloat with large data sets
- Enables processing of large files on devices with limited RAM

### Streaming Architecture
- Uses Node.js streams for efficient data processing
- Supports both synchronous and asynchronous operations
- Implements custom queuing strategies for memory management
- Provides backpressure handling

### Parser Implementation
- Uses Pratt parsing algorithm for efficient token processing
- Plans to implement SIMD-based parsing for improved performance
- Supports custom token handlers and syntax rules
- Implements robust error handling and recovery

### Format Handling
Each supported format includes:
- Lexer for tokenization
- Parser for syntax analysis
- Formatter for output generation
- Syntax definitions for format rules
- Parameter configurations for customization

## Best Practices

1. **Memory Management**
   ```typescript
   // Use streaming for large files
   const largeFileStream = createReadStream('large-file.csv')
     .pipe(csvToMemory)
     .pipe(memoryToJson);
   ```

2. **Error Handling**
   ```typescript
   // Implement proper error handling
   converter
     .on('error', (error) => {
       if (error instanceof parser.ParseError) {
         // Handle parsing errors
       } else if (error instanceof parser.SyntaxError) {
         // Handle syntax errors
       }
     });
   ```

3. **Format Configuration**
   ```typescript
   // Configure format-specific parameters
   const csvParams = new csv.Params({
     delimiter: ',',
     quote: '"',
     escape: '\\',
     header: true
   });
   ```

## Future Enhancements

1. **Performance Optimization**
   - Implementation of SIMD-based parsing
   - Smart linked object trees for memory management
   - Improved streaming capabilities

2. **Format Support**
   - Additional format implementations
   - Enhanced format validation
   - Extended format conversion options

3. **Developer Tools**
   - Format validation tools
   - Performance monitoring
   - Debug logging options
