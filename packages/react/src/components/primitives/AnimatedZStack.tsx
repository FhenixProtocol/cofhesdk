// eslint-disable-next-line no-redeclare
import React from 'react';
import { cn } from '@/utils';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';

type AnimatedZStackItemProps = {
  children?: ReactNode;
  stackOffset: number;
  stackScale: number;
  index: number;
  length: number;
  className?: string;
};

const AnimatedZStackItem: React.FC<AnimatedZStackItemProps> = ({
  children,
  stackOffset,
  stackScale,
  index,
  length,
  className,
}) => {
  // Primary item is always index 0, and does not translate on entry/exit
  // Additional items animate in from the bottom and out to the bottom
  // All items animate opacity
  const isPrimaryItem = index === 0;
  const entryStyle = isPrimaryItem
    ? {
        opacity: 0,
      }
    : {
        opacity: 0,
        top: stackOffset,
        scale: 1 + stackScale,
      };

  // invIndex is the depth of the card in the stack
  // As the length of the stack increases, the depth of the card decreases
  // Deeper items scale down and move up
  const invIndex = length - index - 1;
  const animStyle = {
    opacity: 1,
    top: invIndex * -stackOffset,
    scale: 1 - invIndex * stackScale,
    zIndex: index,
  };

  return (
    <motion.div
      className={cn('w-full h-full absolute origin-top', invIndex === 0 && 'events-none', className)}
      initial={entryStyle}
      exit={entryStyle}
      animate={animStyle}
    >
      {children}
    </motion.div>
  );
};

type AnimatedZStackProps = {
  children?: ReactNode;
  stackOffset?: number;
  stackScale?: number;
  itemClassName?: string;
};

export const AnimatedZStack: React.FC<AnimatedZStackProps> = ({
  children,
  stackOffset = 8,
  stackScale = 0.05,
  itemClassName,
}) => {
  const filteredChildren = React.Children.toArray(children).filter(Boolean);

  return (
    <AnimatePresence>
      {filteredChildren.map((child, index) => (
        <AnimatedZStackItem
          key={index}
          stackOffset={stackOffset}
          stackScale={stackScale}
          index={index}
          length={filteredChildren.length}
          className={itemClassName}
        >
          {child}
        </AnimatedZStackItem>
      ))}
    </AnimatePresence>
  );
};
