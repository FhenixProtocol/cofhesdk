---
'@cofhe/react': patch
---

Corrects the unshield form in `CofheFloatingButtonWithProvider` to clear the previous error and show "Preparing unshielding transaction..." when a new unshield starts. Previously a rejected wallet signature kept "User rejected the request." on screen through the next attempt.
