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

### Routes

```sh
routess routes list --limit 20 --offset 0
routess routes public
routess routes get <id>
routess routes update <id> --name "New name" --tags "gravel,long"
routess routes update <id> --visibility public --confirm
routess routes favourite <id>
routess routes delete <id> --confirm
```

### GPX

```sh
routess routes gpx <id-or-share-token> -o route.gpx
routess routes import ./ride.gpx --activity cycle
routess routes create --from payload.json
```

### Collections

```sh
routess collections list
routess collections create --name "Alps 2026"
routess collections set-routes <id> --routes 12,7,31
routess collections get <id-or-share-token>
routess collections delete <id> --confirm
```

### Loop generation

```sh
routess generate --start 50.8467,4.3525 --activity cycle --distance 40
routess generate --start 50.8467,4.3525 --activity run --distance 10 --save --name "Morning loop"
routess generate --start 50.8467,4.3525 --activity cycle --distance 60 --gpx-dir ./candidates
```

Generation works without a token; `--save` needs a `write` token.

### Account

```sh
routess auth whoami
routess tokens list
routess tokens revoke <id>
routess export -o backup.zip
```

Use `--json` for machine-readable output. Exit codes and agent guidance are documented in `docs/skills/routess.skill.md`.
