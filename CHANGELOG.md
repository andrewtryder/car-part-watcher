# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0](https://github.com/andrewtryder/car-part-watcher/compare/v0.2.0...v0.3.0) (2026-10-03)

### Features

- **auth:** allow explicit console authentication opt-out
  ([ac6677f](https://github.com/andrewtryder/car-part-watcher/commit/ac6677f0dd2676fce67f247e7e2985e3889c82be))
- **auth:** default console authentication to enabled
  ([e4ac6f2](https://github.com/andrewtryder/car-part-watcher/commit/e4ac6f2dd7842fef12431d0f0f8d72bbdc4f499d))
- improve visibility into failed scheduled runs
  ([f0f0c01](https://github.com/andrewtryder/car-part-watcher/commit/f0f0c0196e8dbe2fd11001f0a54ffc39949a0409))
- improve visibility into failed scheduled runs
  ([001eaf6](https://github.com/andrewtryder/car-part-watcher/commit/001eaf6169b8e73ae597a4d3169266034c080b5e))

### Bug Fixes

- **security:** avoid logging Browserless credential state
  ([3691428](https://github.com/andrewtryder/car-part-watcher/commit/3691428eb17f452710b181f682bdf45af392ac0c))
- **security:** avoid logging Browserless credential state
  ([d1b7124](https://github.com/andrewtryder/car-part-watcher/commit/d1b7124e81d47af91343ca11e7ccbc1f1e45ca84))

### Refactoring

- atomic reconciliation outbox and modular HTTP route boundaries
  ([38eeab7](https://github.com/andrewtryder/car-part-watcher/commit/38eeab71b480e9ed0c8c7e6b5acbce74f7717402))
- atomic reconciliation outbox and modular HTTP route boundaries
  ([10d568d](https://github.com/andrewtryder/car-part-watcher/commit/10d568d1a2569e571a134560a504b0ee6959d9f8))
- complete modernization program
  ([a19243e](https://github.com/andrewtryder/car-part-watcher/commit/a19243e160dc993e838d318c3931836e0049b0db))
- complete modernization program
  ([601ca84](https://github.com/andrewtryder/car-part-watcher/commit/601ca84d52620d3c6fe252b1e40b633f719333a1))
- rename production spike types to CarPartSearch types
  ([2a6e745](https://github.com/andrewtryder/car-part-watcher/commit/2a6e7457229d144f29e57be2f7e706397c3bbc07))

## [0.2.0](https://github.com/andrewtryder/car-part-watcher/compare/v0.1.0...v0.2.0) (2026-10-03)

### Features

- add catalog and watch console
  ([42834a3](https://github.com/andrewtryder/car-part-watcher/commit/42834a36eb88d5aa15b2afe578ef8b6c616ebd6f))
- add column header sorting, sort dropdown, and 500+ listing limit
  ([7d7fa9f](https://github.com/andrewtryder/car-part-watcher/commit/7d7fa9f7baf66678eac6c5f7ddb63b344ab10dec))
- add console routing foundation
  ([e2acbc1](https://github.com/andrewtryder/car-part-watcher/commit/e2acbc1bc536e67681623e6f6b8dbe38ea59e12b))
- add manual watch run control
  ([aac2025](https://github.com/andrewtryder/car-part-watcher/commit/aac2025987b847bde99e877f3ac6d7f30c9577ca))
- add React dashboard console
  ([4756555](https://github.com/andrewtryder/car-part-watcher/commit/4756555cf52f48f5f63bacd27f86f1d0c744f776))
- add read-only rebaseline preflight
  ([0f88220](https://github.com/andrewtryder/car-part-watcher/commit/0f88220a958138307c3da956bac8addce016546d))
- add saved search detail page
  ([7a1cde4](https://github.com/andrewtryder/car-part-watcher/commit/7a1cde49655ebfa4f37b9f5f2d140251a8a28bee))
- add saved search management UI
  ([b3be048](https://github.com/andrewtryder/car-part-watcher/commit/b3be048369024f1ead1e1f8fe4b81162f7acdb2d))
- add watch listing and global run queries
  ([b15028e](https://github.com/andrewtryder/car-part-watcher/commit/b15028ec981ea4f4b53c7eec98afa2d78c9a0365))
- complete run history and new parts inbox
  ([0429632](https://github.com/andrewtryder/car-part-watcher/commit/04296325295a28d447387972d03243e631c1cb75))
- implement 3x retry with backoff and 10-minute hard run timeout cap
  ([3335e22](https://github.com/andrewtryder/car-part-watcher/commit/3335e22ede89d9632d6acbd325829f9cab13e578))
- make console auth opt-in
  ([adcd037](https://github.com/andrewtryder/car-part-watcher/commit/adcd037f4ec9beb80328fd4565c8ff7b544f0724))
- protect console with basic auth
  ([d2a8552](https://github.com/andrewtryder/car-part-watcher/commit/d2a85529c8f36bfb2e5b4a83c6df80cec7b5009a))
- reconcile manual watch listings
  ([f19d680](https://github.com/andrewtryder/car-part-watcher/commit/f19d6805612e45f4f3b70ed87ccf8e4a6f18983b))
- schedule watches and persist notification outbox
  ([044c165](https://github.com/andrewtryder/car-part-watcher/commit/044c16559e40ba02cfe300b7c1f08caae5e77c6f))
- send new listing email notifications
  ([94916e6](https://github.com/andrewtryder/car-part-watcher/commit/94916e6caafb4886d7451b0336319bf35dcb4692))
- track listing changes across runs with modified badge and diffs
  ([4cfa21a](https://github.com/andrewtryder/car-part-watcher/commit/4cfa21abec855be6ecb5dfb571a81d9403b0288f))
- **web:** implement Wonder ops-console redesign
  ([dab4430](https://github.com/andrewtryder/car-part-watcher/commit/dab443053c280fb58a8810b421a8b5c9faab35b3))

### Bug Fixes

- attach manual run controls on initial load
  ([a313725](https://github.com/andrewtryder/car-part-watcher/commit/a31372500e775881124031c4710dd9795d2c5031))
- automatically recover stale or interrupted search runs
  ([57bfbb5](https://github.com/andrewtryder/car-part-watcher/commit/57bfbb592cc1b45916ec6022f7653b8c3ab3479e))
- **ci:** pin correct release-please-action v4.1.3 commit SHA
  ([cbbc925](https://github.com/andrewtryder/car-part-watcher/commit/cbbc9253c889dbce94bdbb8204e65bda1fa18e47))
- expose corrected listing metadata in console
  ([b0a55ca](https://github.com/andrewtryder/car-part-watcher/commit/b0a55ca73f49fc6670f63f25de4d6d35be26baf8))
- finalize collision-safe car-part v2 identity
  ([6f455cd](https://github.com/andrewtryder/car-part-watcher/commit/6f455cdee27f5decd2aa9432b88afbfbea32b9ce))
- guard email test delivery
  ([319ed2e](https://github.com/andrewtryder/car-part-watcher/commit/319ed2ed33ae3ba76b523a59b5bad675e11f939d))
- limit manual run listing response
  ([bbe68a1](https://github.com/andrewtryder/car-part-watcher/commit/bbe68a165b2e08a4d08eaa7d31865ad4bdadcc9b))
- **notifications:** enforce canonical outbox event contract
  ([78fe7d8](https://github.com/andrewtryder/car-part-watcher/commit/78fe7d8d523fa63bdcf0d644bf3a030effc580aa))
- persist quote URL in listing inserts
  ([6a7cb24](https://github.com/andrewtryder/car-part-watcher/commit/6a7cb24701907767af27f9192804310473131121))
- prepare corrected car-part parser and safe rebaseline
  ([fbc3f75](https://github.com/andrewtryder/car-part-watcher/commit/fbc3f7582a1dd2dd6519d46022cc1b4d29f8b6eb))
- recover recycler name from quote context
  ([a29a6bc](https://github.com/andrewtryder/car-part-watcher/commit/a29a6bc3c05ea0db8f59d054db3c99ac39cde65e))
- restore notification read-state foundation
  ([fbb41eb](https://github.com/andrewtryder/car-part-watcher/commit/fbb41eb221766f0d9205ca26842baa37b635c5c1))
- restore notification read-state foundation
  ([a0c8291](https://github.com/andrewtryder/car-part-watcher/commit/a0c8291dd0f2406c1711af1f462f6db881a8b150))
- run postgres migrations during deploy
  ([53ed4bd](https://github.com/andrewtryder/car-part-watcher/commit/53ed4bd5ace86384d860fce3e3f88ba54039e399))
- use corrected car-part identity and resettable baselines
  ([53f7c95](https://github.com/andrewtryder/car-part-watcher/commit/53f7c9519fc699055c4860d19a41dfc6d2901d9a))

## 0.1.0 (2026-10-02)

### Features

- Initial release baseline for Car Part Watcher.
