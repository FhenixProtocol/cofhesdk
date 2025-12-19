import {
  CofhesdkConfigWithReact,
  createCofhesdkConfig,
  FloatingButtonPosition,
  FloatingButtonSize,
} from '@cofhe/react';

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
  buttonSize?: FloatingButtonSize;
  setButtonSize: (buttonSize: FloatingButtonSize) => void;
  darkMode?: boolean;
  setDarkMode: (isDarkMode: boolean) => void;
  //
  resultingConfig: CofhesdkConfigWithReact;
};
const DymamicCofheConfigContext = React.createContext<DynamicCofheConfigContext>({
  position: undefined,
  setPosition: () => {},
  buttonSize: undefined,
  setButtonSize: () => {},
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
  const [buttonSize, setButtonSize] = useState<FloatingButtonSize>();
  const [darkMode, setDarkMode] = useState<boolean>();

  const resultingConfig = useMemo<CofhesdkConfigWithReact>(
    () => ({
      ...initialSdkConfig,
      react: {
        ...initialSdkConfig.react,
        position: position ?? initialSdkConfig.react.position,
      },
    }),
    [position],
  );
  return (
    <DymamicCofheConfigContext.Provider
      value={{
        position,
        setPosition,
        buttonSize,
        setButtonSize,
        darkMode,
        setDarkMode,

        resultingConfig,
      }}
    >
      {children}
    </DymamicCofheConfigContext.Provider>
  );
};
