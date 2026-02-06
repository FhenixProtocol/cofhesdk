import { type TokenListMode } from '../FnxFloatingButtonContext.js';

import { isPageWithProps, type FloatingButtonPage, type PageState } from '../pagesConfig/types.js';

type PageStateWithoutTokenProp = Omit<PageState, 'props'> & { props?: Omit<PageState['props'], 'token'> };

export type TokenListPageProps = { title?: string; backToPageState: PageStateWithoutTokenProp; mode: TokenListMode };
