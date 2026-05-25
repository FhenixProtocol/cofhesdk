import {
    type InvalidateQueryFilters,
    type QueryClient,
    type QueryFunctionContext,
    type QueryKey,
} from '@tanstack/react-query';
import { useInvalidationContextStore } from '@/stores/invalidationContextStore';

export type InvalidationContextQueryFilters = InvalidateQueryFilters & {
    queryKey: QueryKey;
};

export type QueryFunctionWithInvalidationContext<
    TQueryKey extends QueryKey = QueryKey,
    TContext = unknown,
    TData = unknown,
> = (context: QueryFunctionContext<TQueryKey> & { invalidationContext: TContext | undefined }) => Promise<TData> | TData;

export function invalidateQueriesWithContext<TContext>(
    queryClient: QueryClient,
    filters: InvalidationContextQueryFilters,
    context: TContext
) {
    useInvalidationContextStore.getState().set({
        queryKey: filters.queryKey,
        context,
    });

    return queryClient.invalidateQueries(filters);
}

export function findMatchingInvalidationContext<TContext>(queryKey: QueryKey) {
    const match = useInvalidationContextStore.getState().findMatching(queryKey);

    return {
        match,
        context: match?.context as TContext | undefined,
    };
}

export function consumeInvalidationContext(match: { key: string } | undefined) {
    if (!match) return;
    useInvalidationContextStore.getState().remove(match.key);
}

export function withInvalidationContext<TQueryKey extends QueryKey, TContext, TData>(
    queryFn: QueryFunctionWithInvalidationContext<TQueryKey, TContext, TData>
) {
    return async (queryFnContext: QueryFunctionContext<TQueryKey>) => {
        const { match, context } = findMatchingInvalidationContext<TContext>(queryFnContext.queryKey);
        const result = await queryFn({
            ...queryFnContext,
            invalidationContext: context,
        });

        consumeInvalidationContext(match);
        return result;
    };
}