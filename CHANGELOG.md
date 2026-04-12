## [1.5.1](https://github.com/Tenrashi/qsave/compare/v1.5.0...v1.5.1) (2026-04-12)

### Bug Fixes

- remove registry key detection that showed false "registry only" badges ([38e89e1](https://github.com/Tenrashi/qsave/commit/38e89e1cbdec804bc72e199a7668bbac41ef1d6e))

# [1.5.0](https://github.com/Tenrashi/qsave/compare/v1.4.2...v1.5.0) (2026-04-12)

### Bug Fixes

- rename uuid_v4 to temp_id with atomic counter, validate content-length on download ([e44ef99](https://github.com/Tenrashi/qsave/commit/e44ef99e3c3de7c9dd077a3a549b25385d26aaf9))

### Features

- resume partial downloads via Range header and safe backoff_for(0) ([5bf7fe4](https://github.com/Tenrashi/qsave/commit/5bf7fe4345689f6a03ead072c45b433f5efe114b))
- stream restore downloads and extraction through Rust ([a315f2c](https://github.com/Tenrashi/qsave/commit/a315f2c6a21cf46e35051f7ded113aecacd14afc))

## [1.4.2](https://github.com/Tenrashi/qsave/compare/v1.4.1...v1.4.2) (2026-04-09)

### Bug Fixes

- upload large saves in chunks via Drive resumable protocol ([#57](https://github.com/Tenrashi/qsave/issues/57)) ([9386456](https://github.com/Tenrashi/qsave/commit/93864567cc34261b369701a5a337adbad4695be3))

## [1.4.1](https://github.com/Tenrashi/qsave/compare/v1.4.0...v1.4.1) (2026-04-06)

### Bug Fixes

- deduplicate files from overlapping save paths before zipping ([a386536](https://github.com/Tenrashi/qsave/commit/a386536f78785437de65bfca73340f80302eb0d4))

# [1.4.0](https://github.com/Tenrashi/qsave/compare/v1.3.3...v1.4.0) (2026-04-06)

### Bug Fixes

- delete temp file only after upload succeeds, deduplicate resolve_files ([08a1f35](https://github.com/Tenrashi/qsave/commit/08a1f35d40a1764017101507acdae078c1ce654b))
- stream large saves instead of loading everything into memory ([1366561](https://github.com/Tenrashi/qsave/commit/136656143013a905a40a0e27f6362b9257971c47))

### Features

- surface error details in toasts, sync history, and log file ([e68773d](https://github.com/Tenrashi/qsave/commit/e68773dec1040d2196dca1167d74d466fb663aeb))

## [1.3.3](https://github.com/Tenrashi/qsave/compare/v1.3.2...v1.3.3) (2026-04-06)

### Bug Fixes

- upload large archives via native reqwest instead of WebView fetch ([#54](https://github.com/Tenrashi/qsave/issues/54)) ([eb175ea](https://github.com/Tenrashi/qsave/commit/eb175ea5723b17b64fe537cfa33b03fdd7d37dc0))

## [1.3.2](https://github.com/Tenrashi/qsave/compare/v1.3.1...v1.3.2) (2026-04-06)

### Bug Fixes

- write zip to temp file to avoid OOM on large save uploads ([#53](https://github.com/Tenrashi/qsave/issues/53)) ([4845503](https://github.com/Tenrashi/qsave/commit/4845503da5418e69f1fac117fe6001326830ea90))

## [1.3.1](https://github.com/Tenrashi/qsave/compare/v1.3.0...v1.3.1) (2026-04-06)

### Bug Fixes

- use resumable upload, dedup nested saves, normalize Windows paths ([d26a250](https://github.com/Tenrashi/qsave/commit/d26a250c56b63e18e084279f2e57458451a4799f))

# [1.3.0](https://github.com/Tenrashi/qsave/compare/v1.2.0...v1.3.0) (2026-04-06)

### Bug Fixes

- guard Epic matching behind Steam/GOG install check ([23659a5](https://github.com/Tenrashi/qsave/commit/23659a5ab6a8f5fcfb228992e079c34501cacea7))

### Features

- add Epic Games Store detection ([c229892](https://github.com/Tenrashi/qsave/commit/c2298925135e6ed6faf5155629a445a3438be721))

# [1.2.0](https://github.com/Tenrashi/qsave/compare/v1.1.3...v1.2.0) (2026-04-06)

### Bug Fixes

- bump manifest size limit, defer etag save until parse succeeds ([cf249a2](https://github.com/Tenrashi/qsave/commit/cf249a21f740139f54ecec733016133fd7250187))
- drop serde(flatten) \_rest field from ManifestEntry ([d04e12f](https://github.com/Tenrashi/qsave/commit/d04e12f6a401b72b852421175eaf2cd69e16959a))
- extract isRegistryOnly util, reuse HTTP client, fix quadratic placeholder replace ([e99d231](https://github.com/Tenrashi/qsave/commit/e99d23102b837f6033a7b7d199aff295a97e42b1))
- harden manifest download, resolve, and alias logic ([b5545ab](https://github.com/Tenrashi/qsave/commit/b5545ab2df280f9a923de4638d2c8f8e034cb6c8))
- harden manifest merge, resolve placeholders, and flag registry-only games ([b1ad516](https://github.com/Tenrashi/qsave/commit/b1ad516019095f4a9cd59c354f71a5cff7adb477))
- remove unused tags field from FileEntryMeta ([58231a4](https://github.com/Tenrashi/qsave/commit/58231a41334f7e9c4a8dcda66b2c5f209d7f502e))

### Features

- add registry path support and secondary manifest detection ([6e4197e](https://github.com/Tenrashi/qsave/commit/6e4197e9bf8112f8019a41c5406a0d831d7dfade))
- implement ludusavi manifest compliance (base, when, aliases, etag) ([8f9d687](https://github.com/Tenrashi/qsave/commit/8f9d687af376bcd7c2d547f6414f965bc9e77e30))

## [1.1.3](https://github.com/Tenrashi/qsave/compare/v1.1.2...v1.1.3) (2026-04-05)

### Bug Fixes

- security hardening from audit ([#46](https://github.com/Tenrashi/qsave/issues/46)) ([88d122f](https://github.com/Tenrashi/qsave/commit/88d122ffed93d99fc1e7aacbb1f8f32327e63f4f))

## [1.1.2](https://github.com/Tenrashi/qsave/compare/v1.1.1...v1.1.2) (2026-04-04)

### Bug Fixes

- move conflict actions to dialog footer and improve spacing ([#44](https://github.com/Tenrashi/qsave/issues/44)) ([fe5e120](https://github.com/Tenrashi/qsave/commit/fe5e120cd7c2fe4debb380fce1c67d4c8ad9a2eb))

## [1.1.1](https://github.com/Tenrashi/qsave/compare/v1.1.0...v1.1.1) (2026-04-04)

### Bug Fixes

- clamp zip entry indices for cross-platform restore ([7a81e51](https://github.com/Tenrashi/qsave/commit/7a81e514abee56eb5bb5e9d175caf0eec82356d9))
- detect sync conflicts when no prior sync exists on device ([e7b8871](https://github.com/Tenrashi/qsave/commit/e7b887177187586bd38b4b4fa6ffae0bc707d30d))

# [1.1.0](https://github.com/Tenrashi/qsave/compare/v1.0.10...v1.1.0) (2026-04-04)

### Features

- show cached game list instantly on app launch while rescanning ([#42](https://github.com/Tenrashi/qsave/issues/42)) ([6c7368f](https://github.com/Tenrashi/qsave/commit/6c7368f527875139f20c7fecf1690731cc68e33c))

## [1.0.10](https://github.com/Tenrashi/qsave/compare/v1.0.9...v1.0.10) (2026-04-04)

### Bug Fixes

- skip system notifications when app window is focused ([#41](https://github.com/Tenrashi/qsave/issues/41)) ([1cb27b8](https://github.com/Tenrashi/qsave/commit/1cb27b8d350948527a0ce12ce5569109ecd8b483))

## [1.0.9](https://github.com/Tenrashi/qsave/compare/v1.0.8...v1.0.9) (2026-04-04)

### Bug Fixes

- cache keychain tokens in memory to avoid repeated macOS password prompts ([#40](https://github.com/Tenrashi/qsave/issues/40)) ([9022539](https://github.com/Tenrashi/qsave/commit/90225393919659ce970b04a3e4f98cf452f80609))

## [1.0.8](https://github.com/Tenrashi/qsave/compare/v1.0.7...v1.0.8) (2026-04-02)

### Bug Fixes

- improve sync conflict dialog layout for narrow viewports ([#39](https://github.com/Tenrashi/qsave/issues/39)) ([aac2351](https://github.com/Tenrashi/qsave/commit/aac23512e670f4b04693a6db02ba550a818f2211))

## [1.0.7](https://github.com/Tenrashi/qsave/compare/v1.0.6...v1.0.7) (2026-04-02)

### Bug Fixes

- exclude .DS_Store files from save backups ([#38](https://github.com/Tenrashi/qsave/issues/38)) ([c2bc06a](https://github.com/Tenrashi/qsave/commit/c2bc06a55260670564cd9b50ef5bc4ca95c0fa66))

## [1.0.6](https://github.com/Tenrashi/qsave/compare/v1.0.5...v1.0.6) (2026-04-02)

### Bug Fixes

- correct tray icon behavior on macOS and Windows ([#37](https://github.com/Tenrashi/qsave/issues/37)) ([f51fbe0](https://github.com/Tenrashi/qsave/commit/f51fbe03f2597c84b86bda73f047544271e1dccf))

## [1.0.5](https://github.com/Tenrashi/qsave/compare/v1.0.4...v1.0.5) (2026-04-01)

### Bug Fixes

- enable updater artifact generation for auto-updates ([#34](https://github.com/Tenrashi/qsave/issues/34)) ([016e4d4](https://github.com/Tenrashi/qsave/commit/016e4d45e363ce60834a67dc25a5677de0fb4b08))

## [1.0.4](https://github.com/Tenrashi/qsave/compare/v1.0.3...v1.0.4) (2026-03-31)

### Bug Fixes

- resolve Windows compatibility issues across backend and frontend ([#33](https://github.com/Tenrashi/qsave/issues/33)) ([dc8877c](https://github.com/Tenrashi/qsave/commit/dc8877c0fffcb311455513a8e9ad98a3da5c9304))

## [1.0.3](https://github.com/Tenrashi/qsave/compare/v1.0.2...v1.0.3) (2026-03-31)

### Bug Fixes

- add contents write permission to release workflow ([a8bc078](https://github.com/Tenrashi/qsave/commit/a8bc07825aa055ad84a4e2957940d02ce026cb4f))

## [1.0.2](https://github.com/Tenrashi/qsave/compare/v1.0.1...v1.0.2) (2026-03-31)

### Bug Fixes

- ensure v prefix on tag when dispatching release build ([1009686](https://github.com/Tenrashi/qsave/commit/100968634d6f0217aaedcfcf5bee0dc2cf862a3c))

## [1.0.1](https://github.com/Tenrashi/qsave/compare/v1.0.0...v1.0.1) (2026-03-31)

### Bug Fixes

- include Cargo.lock in semantic-release version sync ([73ba342](https://github.com/Tenrashi/qsave/commit/73ba3425f70713343fe6b3852cfc479d261357bb))

# 1.0.0 (2026-03-31)

### Bug Fixes

- add missing i18n keys for manual game feature and fix virtualizer scroll ref ([c2baa70](https://github.com/Tenrashi/qsave/commit/c2baa70eed57271454595fe9fd6f86f05f0caf94))
- add workflow_dispatch trigger to release workflow ([08baae0](https://github.com/Tenrashi/qsave/commit/08baae0a9e41a10c9ad1c744cca4f4a490624238))
- autosync bugs, i18n notifications, disable sync when unchanged, hide WIP autosync UI ([a851809](https://github.com/Tenrashi/qsave/commit/a851809d36f96fb5f2462b82e57694fee6e5c0ca))
- autosync bugs, i18n notifications, disable sync when unchanged, remove wip autosync ([81e9f12](https://github.com/Tenrashi/qsave/commit/81e9f12abe4634223a207435502ad2dea6058092))
- cancel stale queries before optimistic update on cloud-only restore ([65aea88](https://github.com/Tenrashi/qsave/commit/65aea8835226534f06585b42a08be98eacca60b8))
- consolidate keychain into single entry ([53d3120](https://github.com/Tenrashi/qsave/commit/53d3120ce9f44de9e6a8833619165ae5ac766265))
- consolidate keychain into single entry and read tokens from in-memory store ([8930982](https://github.com/Tenrashi/qsave/commit/893098281c5bfbf3f4cb3f1a92cc6c56b19d1d95))
- exclude system folders from backed-up game names ([e1f241b](https://github.com/Tenrashi/qsave/commit/e1f241b7e20eedbbdb22d15eded94622b7237846))
- guard conflict check against double-click, preserve hash on restore, clean up nits ([775ef24](https://github.com/Tenrashi/qsave/commit/775ef24d59431c687d628f27150cf7aa636083eb))
- harden cross-device sync — race conditions, query injection, type safety ([47f4592](https://github.com/Tenrashi/qsave/commit/47f459231b0bbc12e6e1bccd9c957b593de69069))
- pin lodash-es to 4.17.21 to fix broken 4.18.0 release ([4576165](https://github.com/Tenrashi/qsave/commit/4576165bfaada93aca14e04963c9931477c1d913))
- preserve watch state of filtered-out games in batch toggle ([d0dc51c](https://github.com/Tenrashi/qsave/commit/d0dc51c8ddd7c4b040ce069f5c2885575a0a6141))
- remove duplicate steps key in release workflow ([f27b990](https://github.com/Tenrashi/qsave/commit/f27b990847d41c8fde96cff23f6b9a9fd1b8ea4d))
- remove duplicate steps/env block from merge ([50c0810](https://github.com/Tenrashi/qsave/commit/50c0810a32b9ee551d1ab3926c0f67e573773501))
- toggle macOS dock visibility when window is shown or hidden ([f943f52](https://github.com/Tenrashi/qsave/commit/f943f527fe445979a708d6f63d35fbae6fc6b105))
- trigger release build via workflow_dispatch after semantic-release ([8edcbaf](https://github.com/Tenrashi/qsave/commit/8edcbaf0361592ce0b003a26a7d2865149ae7f94))
- validate ensureDevicesFolder cache against Drive, move deleteGameBackup to operations ([bf7672c](https://github.com/Tenrashi/qsave/commit/bf7672cec6f1c1a94d8ddee82d0d12fd8da1badc))
- widen CSP img-src to allow all Steam CDN subdomains ([a40f352](https://github.com/Tenrashi/qsave/commit/a40f35281ebbe88eb5f1304191c7db592638e500))
- widen CSP img-src to allow all Steam CDN subdomains ([eb542ad](https://github.com/Tenrashi/qsave/commit/eb542ade79d1833335a9cfd738cc96961d2b1262))

### Features

- add auto-updater with Tauri updater plugin ([#21](https://github.com/Tenrashi/qsave/issues/21)) ([ea18ee3](https://github.com/Tenrashi/qsave/commit/ea18ee32ecb07349559e8a05f35445f7b0c1ea80))
- add autostart toggle and rework global watch to batch per-game state ([0b71c71](https://github.com/Tenrashi/qsave/commit/0b71c712491224ff3fb51007b1ef93674e7325da))
- add content-hash conflict detection for sync and restore ([bdb3a59](https://github.com/Tenrashi/qsave/commit/bdb3a599d97dc9e73592f21a79a3db1b735abf56))
- add content-hash conflict detection for sync and restore ([a854a3b](https://github.com/Tenrashi/qsave/commit/a854a3bbae185db687b01aa915a35d8634ed67e7))
- add coverage reporting, ESLint, husky pre-commit, and reach 90% test coverage ([#9](https://github.com/Tenrashi/qsave/issues/9)) ([12acb53](https://github.com/Tenrashi/qsave/commit/12acb530b83878cdf1d7ed4fb0a8eb54930b5de1))
- add delete backup from cloud with confirmation dialog ([#10](https://github.com/Tenrashi/qsave/issues/10)) ([5c4a85c](https://github.com/Tenrashi/qsave/commit/5c4a85c419b0d82cfca3ac1f04729eccfd998f49))
- add device ID, centralized devices.json, and relative-path hashing for cross-device manual game sync ([383934a](https://github.com/Tenrashi/qsave/commit/383934ab3a5444c002079096944996b93d146e04))
- add device ID, centralized devices.json, and relative-path hashing for cross-device manual game sync ([b4ca5bd](https://github.com/Tenrashi/qsave/commit/b4ca5bd9e3377da54b212c8894fdc1b9f27dda77))
- add platform detection and fix Steam Cloud badge accuracy ([ee4325a](https://github.com/Tenrashi/qsave/commit/ee4325a89e18ec66c1c43fb01755c911d8c7f188))
- add platform detection and fix Steam Cloud badge accuracy ([d3955e9](https://github.com/Tenrashi/qsave/commit/d3955e9514619275a4dead43ea8ddcae3f7e8332))
- add semantic-release for automated versioning and changelog ([997d2e1](https://github.com/Tenrashi/qsave/commit/997d2e184d04b93fb3058043136705afdc6b01b4))
- add semantic-release for automated versioning and changelog ([0ced72c](https://github.com/Tenrashi/qsave/commit/0ced72c84cf2f398989f08fa9f1487d083445490))
- add sonner toast component ([#19](https://github.com/Tenrashi/qsave/issues/19)) ([9d1d155](https://github.com/Tenrashi/qsave/commit/9d1d1554a3e71609a9320164b3d03cf4baeb80d1))
- add Steam header banners to game cards ([65d50bc](https://github.com/Tenrashi/qsave/commit/65d50bc0e81b258f7468d90bfb5c47674acfa2d4))
- add Steam header banners to game cards ([7be66f2](https://github.com/Tenrashi/qsave/commit/7be66f24bbc3cdf7f215b1199104cabfde24175c))
- add toggle to hide/show Steam Cloud games in game list ([#14](https://github.com/Tenrashi/qsave/issues/14)) ([49e3c33](https://github.com/Tenrashi/qsave/commit/49e3c33572ce602ada99bd6c375755ab69276626))
- cache ludusavi manifest locally and add secondary manifest sources ([#8](https://github.com/Tenrashi/qsave/issues/8)) ([6bf571d](https://github.com/Tenrashi/qsave/commit/6bf571da4490a5559b7bf63e2c5fd7eca9d3bf27))
- initial project setup ([a3600f9](https://github.com/Tenrashi/qsave/commit/a3600f981abffd34a95d23206a56d6389e5279ef))
- manual game path adding with native folder picker ([78cc4ac](https://github.com/Tenrashi/qsave/commit/78cc4ac70d44577e91d5fdeb58fea3c7528ab3cf))
- manual game path adding with native folder picker ([eb5ecef](https://github.com/Tenrashi/qsave/commit/eb5ecef146ece3a49e3141bb58545b9ff7b4c711))
- multi-disk scanning, UX improvements, and code quality pass ([c379db1](https://github.com/Tenrashi/qsave/commit/c379db110e748795b46fa210c641d2a7ff692c1d))
- per-game auto-sync, notifications, and localized path detection ([f03d484](https://github.com/Tenrashi/qsave/commit/f03d48452d40c4c45f96cd5516b2bfbd956735cb))
- per-game auto-sync, notifications, and localized path detection ([2f559fa](https://github.com/Tenrashi/qsave/commit/2f559fa0b75a06745d1734bc5cbdadc5c0e032cd))
- replace app icons with new QSave branding ([023d3bd](https://github.com/Tenrashi/qsave/commit/023d3bdeae90a76f1e52af0f44339b2d9e1808fa))
- replace app icons with new QSave branding ([db2cda8](https://github.com/Tenrashi/qsave/commit/db2cda8a5595775db5b0227f54adc79492c7e5a1))
- resolve <storeUserId> placeholder as wildcard to detect more game saves ([#13](https://github.com/Tenrashi/qsave/issues/13)) ([7b3bc6e](https://github.com/Tenrashi/qsave/commit/7b3bc6e444dc04eb4d07f5a3b2e0ce26487cf96c))
- restore from cloud, remove game confirmation, and project restructure ([b0b28c4](https://github.com/Tenrashi/qsave/commit/b0b28c47c234d9bcb47249a773e592cfcef11315))
- restore from cloud, remove game confirmation, and project restructure ([23cb545](https://github.com/Tenrashi/qsave/commit/23cb545d04c19e6818584a64ecffdf68cb29a581))
- show cloud-only games for cross-device restore ([#12](https://github.com/Tenrashi/qsave/issues/12)) ([#12](https://github.com/Tenrashi/qsave/issues/12)) ([3714d8e](https://github.com/Tenrashi/qsave/commit/3714d8ec2381bd8d00fbb048963e31343b5abf3c))

# 1.0.0-alpha.1 (2026-03-31)

### Bug Fixes

- add missing i18n keys for manual game feature and fix virtualizer scroll ref ([c2baa70](https://github.com/Tenrashi/qsave/commit/c2baa70eed57271454595fe9fd6f86f05f0caf94))
- autosync bugs, i18n notifications, disable sync when unchanged, hide WIP autosync UI ([a851809](https://github.com/Tenrashi/qsave/commit/a851809d36f96fb5f2462b82e57694fee6e5c0ca))
- autosync bugs, i18n notifications, disable sync when unchanged, remove wip autosync ([81e9f12](https://github.com/Tenrashi/qsave/commit/81e9f12abe4634223a207435502ad2dea6058092))
- cancel stale queries before optimistic update on cloud-only restore ([65aea88](https://github.com/Tenrashi/qsave/commit/65aea8835226534f06585b42a08be98eacca60b8))
- consolidate keychain into single entry ([53d3120](https://github.com/Tenrashi/qsave/commit/53d3120ce9f44de9e6a8833619165ae5ac766265))
- consolidate keychain into single entry and read tokens from in-memory store ([8930982](https://github.com/Tenrashi/qsave/commit/893098281c5bfbf3f4cb3f1a92cc6c56b19d1d95))
- exclude system folders from backed-up game names ([e1f241b](https://github.com/Tenrashi/qsave/commit/e1f241b7e20eedbbdb22d15eded94622b7237846))
- guard conflict check against double-click, preserve hash on restore, clean up nits ([775ef24](https://github.com/Tenrashi/qsave/commit/775ef24d59431c687d628f27150cf7aa636083eb))
- harden cross-device sync — race conditions, query injection, type safety ([47f4592](https://github.com/Tenrashi/qsave/commit/47f459231b0bbc12e6e1bccd9c957b593de69069))
- pin lodash-es to 4.17.21 to fix broken 4.18.0 release ([4576165](https://github.com/Tenrashi/qsave/commit/4576165bfaada93aca14e04963c9931477c1d913))
- preserve watch state of filtered-out games in batch toggle ([d0dc51c](https://github.com/Tenrashi/qsave/commit/d0dc51c8ddd7c4b040ce069f5c2885575a0a6141))
- toggle macOS dock visibility when window is shown or hidden ([f943f52](https://github.com/Tenrashi/qsave/commit/f943f527fe445979a708d6f63d35fbae6fc6b105))
- validate ensureDevicesFolder cache against Drive, move deleteGameBackup to operations ([bf7672c](https://github.com/Tenrashi/qsave/commit/bf7672cec6f1c1a94d8ddee82d0d12fd8da1badc))
- widen CSP img-src to allow all Steam CDN subdomains ([a40f352](https://github.com/Tenrashi/qsave/commit/a40f35281ebbe88eb5f1304191c7db592638e500))
- widen CSP img-src to allow all Steam CDN subdomains ([eb542ad](https://github.com/Tenrashi/qsave/commit/eb542ade79d1833335a9cfd738cc96961d2b1262))

### Features

- add auto-updater with Tauri updater plugin ([#21](https://github.com/Tenrashi/qsave/issues/21)) ([ea18ee3](https://github.com/Tenrashi/qsave/commit/ea18ee32ecb07349559e8a05f35445f7b0c1ea80))
- add autostart toggle and rework global watch to batch per-game state ([0b71c71](https://github.com/Tenrashi/qsave/commit/0b71c712491224ff3fb51007b1ef93674e7325da))
- add content-hash conflict detection for sync and restore ([bdb3a59](https://github.com/Tenrashi/qsave/commit/bdb3a599d97dc9e73592f21a79a3db1b735abf56))
- add content-hash conflict detection for sync and restore ([a854a3b](https://github.com/Tenrashi/qsave/commit/a854a3bbae185db687b01aa915a35d8634ed67e7))
- add coverage reporting, ESLint, husky pre-commit, and reach 90% test coverage ([#9](https://github.com/Tenrashi/qsave/issues/9)) ([12acb53](https://github.com/Tenrashi/qsave/commit/12acb530b83878cdf1d7ed4fb0a8eb54930b5de1))
- add delete backup from cloud with confirmation dialog ([#10](https://github.com/Tenrashi/qsave/issues/10)) ([5c4a85c](https://github.com/Tenrashi/qsave/commit/5c4a85c419b0d82cfca3ac1f04729eccfd998f49))
- add device ID, centralized devices.json, and relative-path hashing for cross-device manual game sync ([383934a](https://github.com/Tenrashi/qsave/commit/383934ab3a5444c002079096944996b93d146e04))
- add device ID, centralized devices.json, and relative-path hashing for cross-device manual game sync ([b4ca5bd](https://github.com/Tenrashi/qsave/commit/b4ca5bd9e3377da54b212c8894fdc1b9f27dda77))
- add platform detection and fix Steam Cloud badge accuracy ([ee4325a](https://github.com/Tenrashi/qsave/commit/ee4325a89e18ec66c1c43fb01755c911d8c7f188))
- add platform detection and fix Steam Cloud badge accuracy ([d3955e9](https://github.com/Tenrashi/qsave/commit/d3955e9514619275a4dead43ea8ddcae3f7e8332))
- add semantic-release for automated versioning and changelog ([997d2e1](https://github.com/Tenrashi/qsave/commit/997d2e184d04b93fb3058043136705afdc6b01b4))
- add semantic-release for automated versioning and changelog ([0ced72c](https://github.com/Tenrashi/qsave/commit/0ced72c84cf2f398989f08fa9f1487d083445490))
- add sonner toast component ([#19](https://github.com/Tenrashi/qsave/issues/19)) ([9d1d155](https://github.com/Tenrashi/qsave/commit/9d1d1554a3e71609a9320164b3d03cf4baeb80d1))
- add Steam header banners to game cards ([65d50bc](https://github.com/Tenrashi/qsave/commit/65d50bc0e81b258f7468d90bfb5c47674acfa2d4))
- add Steam header banners to game cards ([7be66f2](https://github.com/Tenrashi/qsave/commit/7be66f24bbc3cdf7f215b1199104cabfde24175c))
- add toggle to hide/show Steam Cloud games in game list ([#14](https://github.com/Tenrashi/qsave/issues/14)) ([49e3c33](https://github.com/Tenrashi/qsave/commit/49e3c33572ce602ada99bd6c375755ab69276626))
- cache ludusavi manifest locally and add secondary manifest sources ([#8](https://github.com/Tenrashi/qsave/issues/8)) ([6bf571d](https://github.com/Tenrashi/qsave/commit/6bf571da4490a5559b7bf63e2c5fd7eca9d3bf27))
- initial project setup ([a3600f9](https://github.com/Tenrashi/qsave/commit/a3600f981abffd34a95d23206a56d6389e5279ef))
- manual game path adding with native folder picker ([78cc4ac](https://github.com/Tenrashi/qsave/commit/78cc4ac70d44577e91d5fdeb58fea3c7528ab3cf))
- manual game path adding with native folder picker ([eb5ecef](https://github.com/Tenrashi/qsave/commit/eb5ecef146ece3a49e3141bb58545b9ff7b4c711))
- multi-disk scanning, UX improvements, and code quality pass ([c379db1](https://github.com/Tenrashi/qsave/commit/c379db110e748795b46fa210c641d2a7ff692c1d))
- per-game auto-sync, notifications, and localized path detection ([f03d484](https://github.com/Tenrashi/qsave/commit/f03d48452d40c4c45f96cd5516b2bfbd956735cb))
- per-game auto-sync, notifications, and localized path detection ([2f559fa](https://github.com/Tenrashi/qsave/commit/2f559fa0b75a06745d1734bc5cbdadc5c0e032cd))
- replace app icons with new QSave branding ([023d3bd](https://github.com/Tenrashi/qsave/commit/023d3bdeae90a76f1e52af0f44339b2d9e1808fa))
- replace app icons with new QSave branding ([db2cda8](https://github.com/Tenrashi/qsave/commit/db2cda8a5595775db5b0227f54adc79492c7e5a1))
- resolve <storeUserId> placeholder as wildcard to detect more game saves ([#13](https://github.com/Tenrashi/qsave/issues/13)) ([7b3bc6e](https://github.com/Tenrashi/qsave/commit/7b3bc6e444dc04eb4d07f5a3b2e0ce26487cf96c))
- restore from cloud, remove game confirmation, and project restructure ([b0b28c4](https://github.com/Tenrashi/qsave/commit/b0b28c47c234d9bcb47249a773e592cfcef11315))
- restore from cloud, remove game confirmation, and project restructure ([23cb545](https://github.com/Tenrashi/qsave/commit/23cb545d04c19e6818584a64ecffdf68cb29a581))
- show cloud-only games for cross-device restore ([#12](https://github.com/Tenrashi/qsave/issues/12)) ([#12](https://github.com/Tenrashi/qsave/issues/12)) ([3714d8e](https://github.com/Tenrashi/qsave/commit/3714d8ec2381bd8d00fbb048963e31343b5abf3c))
