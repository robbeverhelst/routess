# Routess CLI

Command-line interface for Routess.

## Install

```sh
npm install -g routess
```

## Authenticate

Create a Personal Access Token in the Routess web app under **Settings -> API Tokens**, then run:

```sh
routess auth login --token routess_pat_...
```

CI and agent environments can skip local storage and provide the token directly:

```sh
export ROUTESS_TOKEN=routess_pat_...
```

## Commands

```sh
routess auth whoami
routess routes list
routess routes get <id>
routess routes update <id> --name "New name"
routess routes update <id> --visibility public --confirm
routess routes delete <id> --confirm
```

Use `--json` for machine-readable output.
