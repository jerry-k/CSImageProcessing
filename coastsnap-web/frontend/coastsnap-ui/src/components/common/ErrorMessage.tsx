
interface ErrorMessageProps {
  error: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ error }) => {
  if (!error) return null;
  
  return (
    <p style={{ color: 'red', marginTop: '1rem' }}>
      Error: {error}
    </p>
  );
};