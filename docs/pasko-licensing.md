# PASKO licensing foundation

## v1.0 release policy: FROZEN / ENFORCEMENT OFF

`packages/core/product-identity.json` sets `licensingEnforcement: false`. This is build/product configuration, not an environment override. All VOLLEYBALL v1.0 features and Demo are available regardless of missing, invalid, expired or valid license files. New installations proceed to First Run; configured installations proceed to Login. `/license` redirects into that normal flow; no activation or trial-expiry banner is required.

LicenseStore, actual license-state diagnostics, Ed25519 verification, public keys 2026_01/2026_03, activation IPC and the separate Issuer remain intact. Authentication, Installation ID, safeStorage, database migrations and recovery authorization are unchanged. Re-enable enforcement by changing the single product field to `true` and rebuilding both desktop and web; rerun the enforced-policy acceptance tests before release. Do not use an external environment variable to toggle this policy.

Licensing authorizes a club installation to use PASKO Performance. It is separate from LocalUser authentication, the Recovery Key and the immutable Installation ID.

## Offline license

The license is a deterministic UTF-8 JSON envelope containing a versioned payload and an Ed25519 signature. Payload keys are serialized canonically before signing. The client contains a versioned set of public verification keys only; production signing happens outside this repository and outside the distributed application. No shared HMAC or production private key is used by the client.

Claims include product, volleyball vertical, Installation ID, customer metadata, validity period, plan and a conservative feature set. Unknown key IDs, malformed files, signature changes, wrong product/vertical/installation and invalid dates fail closed. A perpetual license has `expiresAt: null`.

The activated envelope is stored outside PostgreSQL under product-controlled LocalAppData and is reverified at every packaged startup. Replacement is atomic: an invalid candidate never replaces the installed valid license. The mutable last-known-valid UTC instant is protected with the existing Windows `safeStorage`. A clock movement backwards by more than 24 hours produces `CLOCK_ROLLBACK_SUSPECTED`. Offline time checks reduce casual rollback but cannot make the local clock tamper-proof.

Supported states are `UNLICENSED`, `VALID`, `EXPIRED`, `INVALID`, `WRONG_INSTALLATION`, `NOT_YET_VALID` and `CLOCK_ROLLBACK_SUSPECTED`.

## Restricted mode and data access

Only `VALID` permits business mutations. Restricted mode keeps license activation/replacement, login, backup/export, diagnostics, password recovery, internal Recovery Mode and safe shutdown available. It never deletes, resets or mutates business data. Normal operational pages are not rendered behind an activation modal.

Fresh installations activate before Club/Team/Season/Admin setup. Existing configured installations enter activation without rerunning setup. Replacing a currently valid license requires the current local administrator password. A development bypass is accepted only by a non-Desktop development/test runtime; packaged Desktop ignores it.

## Recovery and portability

User Backup excludes the license entitlement. Internal database snapshots also do not move it because the license store is outside PostgreSQL. Recovery, diagnostics and support export remain available without a valid license. Support data contains only sanitized license status and claims, never the full signed envelope or `safeStorage` contents.

A license is bound to the Installation ID, not MAC address, disk serial, Windows account, IP address, LocalUser or Organization display name. Copying it to another installation yields `WRONG_INSTALLATION`. `maxDevices` is contractual metadata in this offline phase; multi-device counting requires a future server.

## Deferred server capabilities

Key rotation is supported through key IDs and a verification-key set. Issuance, deactivation, transfer, reissue, device counting, billing and subscriptions are deferred to a future licensing service. No telemetry, DNS or HTTP call is made by offline verification.
