# Quick start / useEncrypt

There are two flavours of hooks that help you encrypt values.
The async variation gives you more control, while the sync variation is less verbose and more native to React.

## Prerequisites
The CoFHE SDK provider must be set up and be a parent to any component that consumes the `useEncrypt` hooks.

# Minimalistic (async)

Essentially, all you need to encrypt is the encryption function:
```
  const {
    api: { encrypt: encryptAsync },
  } = useEncryptAsync();

```

You can then use it inside your effect function:
```
import type { FheTypeValue } from '@cofhe/react';

  // ...
  async function handleEncrypt(value: string, type: FheTypeValue) {    
    try {
      const result = await encryptAsync({ value, type });      
    } catch (err) {      
      throw err;
    }
  }
  // ...
```

This way you can call the encryption function and handle results or exceptions asynchronously.

In that case, you'll likely need to manage state for results and errors so they can be rendered.

Otherwise, you can use the sync hook option.

# Synchronous encryption handling

You can pass the value to encrypt directly to the hook.
```
const {
    isConnected,
    api: { encrypt: encryptSync, error, isEncrypting, data: encrypted },
  } = useEncryptSync({ value: '12345678', type: 'uint128' });
```

Then, at some point you need to trigger the encryption. For example, automatically when your component renders:
```
 useEffect(() => {
    if (isConnected) encryptSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);
```

Then you will be able to access details of the execution synchronously through the lifecycle of the encryption process, whether it ends successfully or with an error.

```
return isEncrypting
    ? 'is encrypting...'
    : error
      ? `error: ${error.message}`
      : encrypted
        ? `encrypted: ${JSON.stringify(encrypted, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v), 2)}`
  : 'no data (mutation function not called?)';
```

# Extras

## Lifecycle callbacks

```
  const {
    api: { encrypt: encryptAsync },
  } = useEncryptAsync({
    onError: (err) => {
      console.error('Encryption error (from callback args):', err);
    },
    onSuccess: (data) => {
      console.log('Encryption success (from callback args):', data);
    },
    onMutate(variables, context) {
      console.log('Encryption started (from callback args):', { variables });
    },
  });

```

## Detailed encryption progress

The encryption process is multi-stage. If you need to track progress at a more granular level than just whether it's in progress, succeeded, or failed, you can access encryption step state like this:
```
const {    
    stepsState: { lastStep },
    api: { encrypt: encryptAsync },
  } = useEncryptAsync()
```

E.g.
```
 return lastStep?.step === 'verify' && lastStep.context?.isEnd
    ? `Encryption completed successfully!`
    : `Current encryption step: ${lastStep?.step}`;
```