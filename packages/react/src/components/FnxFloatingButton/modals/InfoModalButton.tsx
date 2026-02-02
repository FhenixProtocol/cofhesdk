import { FaCircleInfo } from 'react-icons/fa6';

export const InfoModalButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
    >
      <FaCircleInfo />
    </button>
  );
};
