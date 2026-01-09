# @cofhe/react

# Error handling

In general, there're 3 types of error origins:

1. errors during execution of a queryFn or mutateFn from within useQuery / useMutation
2. synchronous errors during render (f.x. inside useEffect or render function)
3. asynchronous errors (f.x. from within an event handler or some callback)

When you use CofheProvider, it consolidates all of these in the ErrorBoundary logic, but only for the errors that are instance of CofhesdkError.

Specifically:
the 1st group - queryFn and mutateFn errors - are escalated to the ErrorBoundary via a global default `throwOnError` checker fn.

the 2nd group are naturally passed to the CofheErrorBoundary because that's normal React behavior.
NB: both CofhesdkErrors and other errors are passed to CofheErrorBoundary. If there's no registered handler for the specifically thrown error, it'll be re-thrown, which will produce the same default behavior as if the CofheErrorBoundary doesn't exist for non-CofhesdkErrors.

the 3rd group are directed to CofheErrorBoundary by listenning to `unhandledrejection` events.

# What exactly types of errors are consolidated in the CofheErrorBoundary?

- CofhesdkErrors thrown by internal queryFn and mutateFn
- _all_ synchronous errors during render of any of the children (it passes through errors it doesn't know how to handle, including those that come from the consuming dApp)
- uncaught CofhesdkErrors (the rest - non-CofhesdkErrors - are passed through in the event listener)

# Notes

- CofheSDK consumers shouldn't throw instances of CofhesdkError. That's for internal usage.
- Calls that can produce a `CofhesdkErrorBoundary`-familiar errors should be considered for conditioning by a check "is currently handling cofhesdk error on UI?" (`useIsCofheErrorActive`).

If such an error is active in the ErrorBoundary, the action should be blocked until that error is gone (i.e. reset), otherwise it can produce another error while dealing the current error.

F.x. throwing a CofhesdkErrorBoundary-familiar error from a useEffect would cause "errors log overload" (lots of never-ending error logs) and will crash the UI, _because the fallback will keep trying re-rendering the whole dApp along with error-handling UI_, including the effect that thrown the error.

In other words: while in `CofhesdkErrorBoundary` mode, avoid possibility of throwing `CofhesdkErrorBoundary`-familiar errors by checking `useIsCofheErrorActive`.

- CofheSDK consumer dApp's errors belonging to the 2nd group will be passed to CofheErrorBoundary, but since it doesn't know how to handle them, they'll be re-thrown, which resembles the default behavior
