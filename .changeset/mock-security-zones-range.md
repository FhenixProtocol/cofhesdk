---
'@cofhe/mock-contracts': patch
---

`MockTaskManager.setSecurityZones` now rejects an inverted range (`min > max`) with `InvalidSecurityZone`, like the TaskManager. Previously the range was stored and every FHE operation then reverted with `InvalidSecurityZone`. `setSecurityZoneMin` and `setSecurityZoneMax` revert with the same arguments as the TaskManager.
