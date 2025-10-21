// Project-level module shims (discovered by tsc include)
declare module 'react-day-picker';
declare module 'embla-carousel-react';
declare module 'recharts';
declare module 'cmdk';
declare module 'vaul';
declare module 'react-hook-form';
declare module 'input-otp';
declare module 'react-resizable-panels';
declare module '@hookform/resolvers/zod';

// Minimal types for OTP input context used in the project
declare module 'input-otp' {
  export const OTPInput: any;
  export const OTPInputContext: any;
}

export {};
