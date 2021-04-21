# orderpdf

Create order PDF in Javascript because Firefox on Android does not support
printing yet (see [mozilla-mobile/fenix issue #3709](https://github.com/mozilla-mobile/fenix/issues/3709)).

Under the hood this uses [pdfmake](https://pdfmake.org/). [pdf.ts](./pdf.ts)
takes care of creating the actual PDF and [script.ts](./script.ts) of the
"user"-side.

## Installation

Running `make` should be sufficient. The generated files can be found in
`build/`.

### Prerequisites

  * [TypeScript](https://www.typescriptlang.org/)
  * [npm](https://www.npmjs.com/) (only used for downloading Javascript dependencies)
  * [esbuild](https://github.com/evanw/esbuild)
  * [sassc](https://github.com/sass/sassc)

Alternatively you can use [nix-shell](https://nixos.org/).
