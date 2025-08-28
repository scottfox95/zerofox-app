// Secure logging utility for production environments
const isDev = process.env.NODE_ENV !== 'production';

export const secureLog = {
  info: (message: string, ...args: any[]) => {
    if (isDev) {
      console.log(message, ...args);
    }
  },
  
  warn: (message: string, ...args: any[]) => {
    if (isDev) {
      console.warn(message, ...args);
    }
  },
  
  error: (message: string, ...args: any[]) => {
    // Always log errors, but sanitize in production
    if (isDev) {
      console.error(message, ...args);
    } else {
      console.error(message); // Only log the message, not potentially sensitive args
    }
  },
  
  debug: (message: string, ...args: any[]) => {
    if (isDev) {
      console.log(`🔍 DEBUG: ${message}`, ...args);
    }
  }
};