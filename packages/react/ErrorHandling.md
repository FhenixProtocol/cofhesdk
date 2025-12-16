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

# Notes
- CofheSDK consumers shouldn't throw instances of CofhesdkError. That's for internal usage.
- Calls that can produce a CofhesdkError should be conditioned by a check "is currently handling cofhesdk error via UI" (`useIsCofheErrorActive`). If such an error is active in the ErrorBoundary, such actions should be blocked until that error is gone (i.e. reset)  
- CofheSDK consumer dApp's errors belonging to the 2nd group will be passed to CofheErrorBoundary, but since it doesn't know how to handle them, they'll be re-thrown, which resembles the default behavior (TODO: make sure, check one more scenario -- wrapping dApp's ErrorBoundary) 