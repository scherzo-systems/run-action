# Scherzo Run Action

This directory is the canonical source for the standalone
`scherzo-systems/run-action` GitHub Action. The Action bootstraps the exact CLI release
recorded in `release-evidence.json`, translates the eight GitHub Run Action V1 inputs,
runs one local workflow, validates its complete Portable Artifact Set, and projects the
eight declared outputs.

Callers must prepare `GITHUB_WORKSPACE`, any workflow harnesses, and all environment
authority required by the workflow. The Action does not check out source, install a
harness, retry a workflow, publish an artifact, or request a credential.

## Development

Use Node 24.16 and npm 11.13. Install the committed lockfile and run the complete package
check:

    npm ci
    npm run check

Generate the committed GitHub runtime and third-party license inventory with:

    npm run build

`npm run check` formats, type-checks, lints, and tests the authoritative TypeScript, then
rebuilds the bundle and license inventory in clean temporary directories and requires
byte equality with `dist/index.cjs` and `dist/licenses.txt`.

## Public distribution

The complete tracked tree in this directory is the canonical inventory for the root of
`scherzo-systems/run-action`. Export rejects links and missing or empty generated bundle
files. The dedicated checkoutless publication child validates canonical source and the
complete expected public ancestry before it can read the repository-scoped mirror key.
An exact tree repeat is a credential-free no-op; a changed tree may add one ordinary
fast-forward commit.

`.github/workflows/check.yml` defines the public `Public source` check and live behavior
jobs named `ubuntu-24.04`, `ubuntu-24.04-arm`, and `macos-15`. No supported customer
example exists in this initial candidate: a later example can be added only after the
first public mirror commit passes those checks, and it must pin that real full 40-hex
mirror SHA.

Public bytes are persistent. Operators follow the canonical
`docs/operations/run-action-publication.md` procedure to stop triggers and writers,
revoke the dedicated key, remove advertising, and publish a reviewed corrective
fast-forward when needed.

## Release evidence

`release-evidence.json` is a closed observation of the official, non-draft,
non-prerelease `scherzo-systems/scherzo-cloud-cli` v0.15.0 release. It records release ID
373161961, tag commit `a4ff9e99b8fe6c78f1944acf376b65d62842b9ed`, canonical source
revision `0e849fc9dbd366d57d612923ac3f877a70e70c81`, Version Schema 1 build
identity, the checksum asset, and the exact three supported archive identities and
inventories. Runtime selection imports that file directly; it performs no `latest`
lookup or ambient/source-build fallback.
