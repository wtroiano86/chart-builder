# Troubleshooting

| Symptom | Check |
| --- | --- |
| Chart is denied | Authentication, custom authorization, tenant scope |
| Unknown adapter or manifest mismatch | Register identical manifests in PHP and JavaScript; rebuild published assets |
| Unsupported feature | Compare the series, encoding, coordinate and requested features with the selected manifest |
| Blank initial area | Container width, deferred prop name, error state, browser console |
| Empty prepared rows fail | Declare dimensions explicitly for empty data |
| String measure fails validation | Convert deliberately or use a string dimension; prepared datasets do not coerce numeric text |
| Wrong date bounds | Store UTC; set reporting timezone; form Until is inclusive, query until exclusive |
| Category limit error | Use top ranking, narrow the range, or provide prepared data |
| Export button absent | A live handle and a manifest-supported format/mode are both required |
| Filter change loses table state | Use one shared coordinator and distinct chart names; avoid bypassing managed filters |
| Stale data persists | Look at the stale indicator and applied filters; retry the latest intent |
| Package missing from npm/Composer | Use the local path repository and SDK tarball before first release |

When reporting an issue, include a minimal PHP definition, sanitized envelope, adapter/manifest versions, database driver, React/Inertia versions and the reference ID if present. Never include credentials or tenant data. [Testing](../development/testing.md) describes the development gallery and contract server.
