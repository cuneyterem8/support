# Jack Games support center

Static, accessible support and privacy pages for Snake Jack and Pulsar Jack. This repository contains no hosted game code, client-side JavaScript, analytics, or remote resources.

## Public routes

| Game | English support | English privacy | Turkish support | Turkish privacy |
| --- | --- | --- | --- | --- |
| Snake Jack | `/snake-jack/` | `/snake-jack/privacy/` | `/tr/snake-jack/` | `/tr/snake-jack/privacy/` |
| Pulsar Jack | `/pulsar-jack/` | `/pulsar-jack/privacy/` | `/tr/pulsar-jack/` | `/tr/pulsar-jack/privacy/` |

The repository root is a language-aware selector for both games.

## Local checks

Run the static contract:

```shell
node --test tests/site.test.mjs
```

Serve the pages locally when a manual check is needed:

```shell
python -m http.server 8080 --bind 127.0.0.1
```

Contact: [cuneyterem8@gmail.com](mailto:cuneyterem8@gmail.com)
