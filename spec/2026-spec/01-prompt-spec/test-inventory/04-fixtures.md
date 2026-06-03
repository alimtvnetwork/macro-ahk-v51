# Fixtures Catalog

Path: `tests/fixtures/prompts/`.

| Fixture | Purpose |
|---|---|
| `minimal/` | Single prompt, no variables — happy path |
| `with-variables/` | All variable types (string, number, boolean, enum) + defaults |
| `sensitive/` | `sensitive: true` variables — masking test |
| `invalid-info-json/` | Schema-violating `info.json` — loader error path |
| `invalid-prompt-md/` | Body > 64 KB — size limit test |
| `import-zip.zip` | End-to-end import round-trip |
| `duplicate-ids/` | Two prompts share `id` — conflict path |
| `host-overrides.json` | Sample settings override blob |
| `queue-100/` | 100 pre-built tasks — capacity test |

Loader fixtures must round-trip: `parse → emit → parse` byte-equal.
