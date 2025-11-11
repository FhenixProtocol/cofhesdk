# Quick start / useEncrypt 

There're two flavours of hooks that help you encrypt values.
Async variation gives you more control, while the Sync can be less verbose and more native to react 

# Pre-requisites
The CoFHE SDK provider must be set up and be a parent to a component consuming any of the useEncrypt hoks

# Minimalistic (async)

Essentially all you need to encrypt is the encryption function:
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

This way you can call the encryption function, handle the results or exceptions the way you wish asynchronously.

But in such case you would likely need to take care of the state storage for results and errors to make them available for render.

Otherwise you can look into the Sync hook option

# Synchronous encryption handling

You can pass the value to encrypt directly to the hook
```
const {
    isConnected,
    api: { encrypt: encryptSync, error, isEncrypting, data: encrypted },
  } = useEncryptSync({ value: '12345678', type: 'uint128' });
```

then at some point you need to trigger the encryption. For example automatically upon render of your component:
```
 useEffect(() => {
    if (isConnected) encryptSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);
```

Then you will be able to access details of the execution synchronously through the lifecycle of the encryption process, should it end with a successful encryption or an error

```
return isEncrypting
    ? 'is encrypting...'
    : error
      ? `error: ${error.message}`
      : encrypted
        ? `encrypted: ${JSON.stringify(encrypted, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v), 2)}`
        : 'no data (mutation function not caled?)';
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

The encryption process is multistage. If you need to track the progress on more granualr level than just whether it's in progress, succeeded or failed, you can access encryption step state like this:
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