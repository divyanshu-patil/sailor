export type SignupFormState = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

// Simple client-side gates for the "Next" button on each step — Clerk still
// does the real validation server-side when signUp.create() is called.
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;