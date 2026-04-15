import { Button } from '../components';

export const AddCustomTokenButton: React.FC<{
  label?: string;
  onClick?: () => void;
}> = ({ label = 'Import token', onClick }) => <Button variant="outline" size="sm" label={label} onClick={onClick} />;
