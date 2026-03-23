import { Toaster } from 'react-hot-toast';

/** Toaster global com visual alinhado ao tema VARzea (fundo escuro). */
export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      containerStyle={{ top: '4.5rem' }}
      toastOptions={{
        duration: 4000,
        style: {
          background: 'rgba(12, 22, 26, 0.96)',
          color: '#e8f4ef',
          border: '1px solid rgba(0, 230, 118, 0.28)',
          borderRadius: '10px',
          fontSize: '0.95rem',
          maxWidth: 'min(92vw, 26rem)',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.45)',
        },
        success: {
          iconTheme: { primary: '#00e676', secondary: '#05080a' },
        },
        error: {
          iconTheme: { primary: '#ff5252', secondary: '#05080a' },
        },
      }}
    />
  );
}
