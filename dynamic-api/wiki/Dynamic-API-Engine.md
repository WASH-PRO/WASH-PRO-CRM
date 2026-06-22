Full guide: [Dynamic API Engine](https://dynamic-api-platform.github.io/Dynamic-API-Platform/dynamic-api-engine/)

Endpoints defined in MongoDB are served at runtime without restart.

## Schema types

`string`, `number`, `boolean`, `object`, `array`, `datetime`, `json`

## Data sharing

GET and POST on same path share `EndpointData` via `resourcePath`.

## Features

- Schema validation on write
- Path parameters (`:id`)
- Auto docs and examples
- Built-in API tester
