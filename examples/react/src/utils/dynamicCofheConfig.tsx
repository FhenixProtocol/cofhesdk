import { CofhesdkConfigWithReact, createCofhesdkConfig, FloatingButtonPosition } from '@cofhe/react';

import { baseSepolia, sepolia } from '@cofhe/sdk/chains';
import React, { useMemo, useState } from 'react';

const initialSdkConfig = createCofhesdkConfig({
  supportedChains: [sepolia, baseSepolia],
  // useWorkers: true, // Enable Web Workers
  react: {
    recordTransactionHistory: true, // Enable activity page in floating button
    // pinnedTokens: {
    //   11155111: '0xd38AB9f1563316DeD5d3B3d5e727d55f410d492E',
    // },
  },
});

// const cofheSdkClient = createCofhesdkClient(cofheConfig);

type DynamicCofheConfigContext = {
  position?: FloatingButtonPosition;
  setPosition: (position: FloatingButtonPosition) => void;
  darkMode?: boolean;
  setDarkMode: (isDarkMode: boolean) => void;
  //
  resultingConfig: CofhesdkConfigWithReact;
};
const DymamicCofheConfigContext = React.createContext<DynamicCofheConfigContext>({
  position: undefined,
  setPosition: () => {},

  darkMode: undefined,
  setDarkMode: () => {},

  //
  resultingConfig: initialSdkConfig,
});
export const useDynamicCofheConfigContext = () => {
  return React.useContext(DymamicCofheConfigContext);
};

export const DynamicCofheConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [position, setPosition] = useState<FloatingButtonPosition>();

  const [darkMode, setDarkMode] = useState<boolean>();

  const resultingConfig = useMemo<CofhesdkConfigWithReact>(
    () => ({
      ...initialSdkConfig,
      react: {
        ...initialSdkConfig.react,
        position: position ?? initialSdkConfig.react.position,
        darkMode: darkMode ?? initialSdkConfig.react.darkMode,
      },
    }),
    [position, darkMode],
  );
  return (
    <DymamicCofheConfigContext.Provider
      value={{
        position,
        setPosition,
        darkMode,
        setDarkMode,

        resultingConfig,
      }}
    >
      {children}
    </DymamicCofheConfigContext.Provider>
  );
};
