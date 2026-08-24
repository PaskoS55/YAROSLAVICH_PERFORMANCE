# PASKO License Issuer

`PASKO License Issuer` is a private, offline Windows x64 operator tool. It is not part of PASKO Performance and must never be sent to clubs. The customer application receives only a signed `*.pasko-license`; it never receives the Issuer, ledger, passphrase, or private key.

## Architecture and workflow

The hardened Electron renderer has no Node integration, filesystem, shell, crypto, or network access. Narrow IPC invokes native file dialogs and main-process operations. Ed25519 private-key loading, decryption, signing, self-verification, atomic output, and ledger updates occur only in the trusted main process. The Issuer has no Next.js, PostgreSQL, Prisma, telemetry, analytics, updater, HTTP, or cloud dependency.

1. Receive the Installation ID shown by the club application.
2. Select the encrypted external private key and matching public metadata.
3. Enter customer metadata, plan, validity, features, and one Installation ID.
4. Review the exact UTC claims and type `ВЫПУСТИТЬ ЛИЦЕНЗИЮ`.
5. Enter the key passphrase for this signing operation. It is not stored.
6. Save the atomically written license and communicate its SHA-256 and non-secret summary to the club.
7. Optionally verify the saved license and compare its Installation ID.

TRIAL defaults to 30 days and cannot be perpetual through the normal workflow. STANDARD, PRO, and ENTERPRISE may have an explicit expiration or be perpetual. A perpetual offline license cannot be remotely revoked; the operator must make that choice deliberately.

## Key security and ceremony

Production authority material is external to Git, this repository, customer releases, Issuer releases, CI, logs, screenshots, and ledgers. An authority uses Ed25519, an AES-256-CBC encrypted PKCS#8 private PEM, SPKI public PEM, and a SHA-256 fingerprint of public SPKI DER. Passphrases must contain at least 20 characters and should be retained separately in a trusted password manager.

Never assign different key material to an existing key ID. `PASKO_LICENSE_KEY_2026_01` remains retained as the previous public verification key. `PASKO_LICENSE_KEY_2026_02` was never used to issue licenses and has been retired. The current production signing key ID is `PASKO_LICENSE_KEY_2026_03`; only its public verification key and public-key fingerprint may enter the customer client. Private signing keys, seeds, passphrases, and other secret material must remain outside the client, repository, and documentation. Production key generation is never part of tests, packaging, CI, or ordinary builds.

Keep a primary encrypted offline private-key copy and a second encrypted offline backup, with the passphrase stored separately. The tool does not make automatic backups. Cloud-synchronised and repository destinations are rejected.

If a private key is lost, existing licenses continue verifying but new licenses cannot be issued under that key. Create a new key ID and ship its public key in a new customer release while retaining old public keys. If compromise is suspected, stop issuing under that key. Offline licenses have no remote revocation service, so compromise response is necessarily limited.

## Ledger and offline limitations

The operator ledger is JSONL under the Issuer-specific LocalAppData directory. It contains non-secret issuance metadata and license SHA-256 only. It is not an authority for customer verification and contains neither private key nor passphrase. Reissuing for an existing Installation ID is allowed with a warning and always creates a new license ID.

Each v1 license is bound to one Installation ID. `maxDevices` is contractual metadata, not an online counter. Transfer requires a newly issued license. Clock protection is local and cannot provide server-grade tamper resistance. Signed dates and entitlements remain usable fully offline.

## Build and verification

```powershell
npm run issuer:release
npm run issuer:verify
```

The separate generated `issuer-release/` directory contains the deterministic Issuer installer, checksum, and manifest. It must contain no production/test private key, customer license, ledger, customer database, PostgreSQL, Prisma, or customer application runtime.

Production-key compatibility selftest is a local manual ceremony gate: use a disposable Installation ID and `PASKO INTERNAL RC SELFTEST`, confirm client state `VALID`, delete the temporary license, then rescan both packages. It must never use a real customer or CI.
