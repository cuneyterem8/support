# Jack Games support center

Static, accessible support and privacy pages for Blast the Squares, Snake Jack and Pulsar Jack. This repository contains no hosted game code, client-side JavaScript, analytics, or remote resources. External policy links are ordinary navigation links.

## Public routes

| Game | English support | English privacy | Turkish support | Turkish privacy |
| --- | --- | --- | --- | --- |
| Snake Jack | `/snake-jack/` | `/snake-jack/privacy/` | `/tr/snake-jack/` | `/tr/snake-jack/privacy/` |
| Pulsar Jack | `/pulsar-jack/` | `/pulsar-jack/privacy/` | `/tr/pulsar-jack/` | `/tr/pulsar-jack/privacy/` |

The repository root is a bilingual selector for all three games.

Blast the Squares (Kareleri Patlat) routes: `/blast-the-squares/`, `/blast-the-squares/privacy/`, `/blast-the-squares/terms/`; Turkish equivalents start with `/tr/`.

Live base URL: https://cuneyterem8.github.io/support/ . Blast the Squares publisher: Mihriban Erem; support and technical operations: Cüneyt Erem, cuneyterem8@gmail.com. Other games retain their existing identity information.

Advertising account setup: use Google AdMob only, owned by Mihriban Erem using mihriii.aslan@gmail.com. AppLovin/MAX is deferred. The account and iOS rewarded unit are created. The user confirmed a one-year payment hold; its exact end date is not known. Do not remove the hold. Production readiness approval remains pending. The technical support contact and GitHub/Codemagic ownership remain unchanged. Do not store bank details, tax identifiers, or account credentials in this repository.

The Blast the Squares policy covers AdMob-enabled iOS builds (including test SDK requests), UMP/ATT choices, and earlier demo-only versions. AppLovin is not an active data partner. The shared ad authorization file will need to live at the hostname root (`https://cuneyterem8.github.io/app-ads.txt`), not just under `/support/`; the Google publisher entry and root hosting are still pending. Unpublished iOS apps can be tested with Google test ads before App Store release; production serving needs Google's readiness process.

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
