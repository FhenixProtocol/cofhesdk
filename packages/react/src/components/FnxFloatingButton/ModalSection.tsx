import { AnimatePresence, motion } from 'motion/react';

import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext';

const CARD_COLORS = ['#266678', '#cb7c7a', ' #36a18b', '#cda35f', '#747474'];
const CARD_OFFSET = 10;
const SCALE_FACTOR = 0.06;

export const ModalSection: React.FC = () => {
  const { modalStack, popModal } = useFnxFloatingButtonContext();
  return (
    <div className="absolute top-0 left-0 flex items-center justify-center h-[350px]">
      <ul className="relative w-[350] h-[220]">
        <AnimatePresence>
          {modalStack.map((modal, index) => {
            return (
              <motion.li
                key={index}
                className="absolute top-0 left-0 w-[350px] h-[220px] rounded-lg origin-top-center list-none"
                style={{ backgroundColor: CARD_COLORS[index] }}
                initial={{ opacity: 0 }}
                exit={{ opacity: 0 }}
                animate={{
                  opacity: 1,
                  top: index * -CARD_OFFSET,
                  scale: 1 - index * SCALE_FACTOR,
                  zIndex: CARD_COLORS.length - index,
                }}
                onClick={() => popModal()}
              />
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
};
