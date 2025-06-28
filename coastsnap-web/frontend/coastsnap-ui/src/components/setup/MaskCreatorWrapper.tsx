import { MaskCreator } from './MaskCreator';
import { useStatusStore } from '../../stores/useStatusStore';
import api from '../../services/api';

export function MaskCreatorWrapper() {
  const { setStatusMessage, setErrorMessage } = useStatusStore();

  const handleSaveMask = async (polygons: number[][][]) => {
    try {
      await api.saveMask(polygons);
      setStatusMessage('ROI mask saved successfully');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save mask');
    }
  };

  return <MaskCreator onSave={handleSaveMask} setStatus={setStatusMessage} />;
}