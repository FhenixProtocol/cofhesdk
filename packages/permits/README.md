# `@cofhesdk/permits`

This package is primarily used internally by `@cofhesdk/core` but can also be imported independently.
Creates and manages CoFHE access permits, which are included in an off-chain decryption request to authenticate the requesting user.
Permits can be generated for self-usage, or to be shared. Shared permits must be imported by the recipient.
Prepares the EIP712 signature that validates the permit.
