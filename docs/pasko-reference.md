# PASKO Reference architecture

PASKO Reference separates scientific reference data from performance classification.

- `PUBLISHED_DISTRIBUTION` stores a publication's mean and SD. It never creates percentile scores.
  Player Profile can use a separately labelled standardized reference score: `50 + 10 * z`, where `z = (value - mean) / SD` for higher-is-better and `(mean - value) / SD` for lower-is-better. No normal CDF or inferred empirical anchors are used. Finite mean, positive finite SD, provenance and an explicitly confirmed compatible team/profile version are required. Age-specific references require the player's birth date and compatibility at the measurement date (adult: 18+). Missing/invalid/unconfirmed inputs remain unscored; contextual/pooled references are not scored.
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

## Player Profile compatibility and presentation

Team/profile compatibility is an explicit operator declaration, recorded using the existing AuditLog with action `REFERENCE_PROFILE_COMPATIBILITY_CONFIRMED`. Player/Team currently have no sex field: sex must not be inferred from names or a system fallback. The operator confirms the reference's sport, sex, age group, level and protocol compatibility for the team; a sex-specific reference must not be confirmed for a mixed/incompatible team. Confirmation is tied to team, profile ID, version and demographic metadata. Existing selections must be confirmed once. The known synthetic adult male Demo cohort gets the same declaration through an idempotent, Demo-only bootstrap; existing results are not reset or rewritten.

Each category averages only supported available scores, retaining the raw standardized score without clipping. The radar geometry alone clamps to 0–100. Tooltips distinguish empirical percentile from standardized reference score and the page links to the selected version and sources. A category with no supported data stays empty without affecting other categories. Strong sides require a raw category score >=60; growth zones require <=40 (40–60 otherwise is near the reference mean for standardized scores). No arbitrary top/bottom three are invented. An average mixing empirical and standardized values is a composite, not itself an empirical percentile or a population SD claim.
