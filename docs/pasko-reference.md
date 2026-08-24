# PASKO Reference architecture

PASKO Reference separates scientific reference data from performance classification.

- `PUBLISHED_DISTRIBUTION` stores a publication's mean and SD. It never creates percentile scores.
- `POOLED_ESTIMATE` stores a pooled mean and its confidence interval. The CI describes uncertainty of the pooled mean, not an athlete range.
- `EMPIRICAL_PERCENTILE` is the only type that may store P10/P25/P50/P75/P90 and drive interpolation.
- `REFERENCE_RANGE` stores an explicitly supported low/high range.
- `CONTEXT_ONLY` provides interpretation without a performance judgement.
- `NO_REFERENCE` records an intentional absence, rather than pretending configuration is missing.

System profiles are immutable product data. Scientific revisions create a new profile/version; v1.0 is never edited in place. An Organization can clone a readable system profile. The clone records `baseProfileId`, owns copied entries, and may be edited without changing the scientific parent. A Team explicitly selects either a system profile or a custom profile belonging to its Organization. A null selection uses the system vertical fallback for display only and does not assert demographic compatibility.

Legacy `Norm` rows are atomically migrated into `LEGACY_IMPORTED` as `EMPIRICAL_PERCENTILE`; their anchors and provenance are preserved exactly. Literature distributions never receive fabricated P10–P90 values. Current-reference display is live, while already stored TestResult scores and PB semantics remain unchanged.

## PASKO Reference v1.0 sources

- `PALAO_2014_ELITE_REACH` — Palao, Manzanares & Valadés (2014), DOI `10.2478/hukin-2014-0128`.
- `KOZINC_2021_MALE_VOLLEYBALL` — Kozinc, Pleša & Šarabon (2021), DOI `10.3390/ijerph182211754`.
- `CIN_2021_PRO_VOLLEYBALL` — Cin et al. (2021), DOI `10.5336/sportsci.2020-79052`. Sprint/T-test aggregates are explicitly marked PASKO-derived and approximate.
- `MATLOSZ_2023_BODY_FAT` — systematic review and meta-analysis (2023), DOI `10.1080/15502783.2023.2246414`.

The catalogue is fully offline. DOI and PMID are metadata; runtime internet access is never required.
