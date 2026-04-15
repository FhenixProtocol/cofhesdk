import type { CSSProperties, SVGProps } from 'react';
import {
  MdArrowBack,
  MdCheck,
  MdClose,
  MdContentCopy,
  MdKeyboardArrowDown,
  MdKeyboardArrowRight,
  MdLock,
  MdPublic,
  MdSecurity,
} from 'react-icons/md';
import type { IconType } from 'react-icons';

type MaterialFontSize = 'inherit' | 'small' | 'medium' | 'large';

type MaterialIconProps = Omit<SVGProps<SVGSVGElement>, 'ref'> & {
  sx?: CSSProperties;
  fontSize?: MaterialFontSize;
};

const fontSizeMap: Record<MaterialFontSize, string | number> = {
  inherit: '1em',
  small: 20,
  medium: 24,
  large: 35,
};

const createMaterialIcon = (Component: IconType) => {
  const MaterialIcon = ({ sx, fontSize = 'medium', style, ...props }: MaterialIconProps) => {
    const mergedStyle = {
      fontSize: fontSizeMap[fontSize],
      ...sx,
      ...style,
    } satisfies CSSProperties;

    return <Component {...props} style={mergedStyle} />;
  };

  return MaterialIcon;
};

export const ArrowBackIcon = createMaterialIcon(MdArrowBack);
export const CheckIcon = createMaterialIcon(MdCheck);
export const CloseIcon = createMaterialIcon(MdClose);
export const ContentCopyIcon = createMaterialIcon(MdContentCopy);
export const KeyboardArrowDownIcon = createMaterialIcon(MdKeyboardArrowDown);
export const KeyboardArrowRightIcon = createMaterialIcon(MdKeyboardArrowRight);
export const LockIcon = createMaterialIcon(MdLock);
export const PublicIcon = createMaterialIcon(MdPublic);
export const SecurityIcon = createMaterialIcon(MdSecurity);
