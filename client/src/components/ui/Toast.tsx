import React from 'react';
import { toast, ToastContainer as ReactToastifyContainer } from 'react-toastify';
import type { ToastOptions } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Re-export toast directly from react-toastify
export { toast };
export type { ToastOptions };

export interface ToastProps {
  position?: 'top-right' | 'top-center' | 'top-left' | 'bottom-right' | 'bottom-center' | 'bottom-left';
}

export const ToastContainer: React.FC<ToastProps> = ({ position = 'top-right' }) => {
  return (
    <ReactToastifyContainer
      position={position}
      autoClose={3500}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="colored"
    />
  );
};
