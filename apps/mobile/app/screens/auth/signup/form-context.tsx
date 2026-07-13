import { createContext, useContext, useState, useMemo, ReactNode } from "react";
import { useNativeState } from "@expo/ui/swift-ui";
import {
  EMAIL_REGEX,
  MIN_PASSWORD_LENGTH,
  SignupFormState,
} from "./types/types";
const COMMON_TLD_REGEX = /\.(com|in|co|org|net|edu|gov|io|ai|dev|app|me)$/i;
type SignupFormContextValue = {
  firstNameState: string;
  lastNameState: string;
  emailState: string;
  passwordState: string;
  setFirstNameState: React.Dispatch<React.SetStateAction<string>>;
  setLastNameState: React.Dispatch<React.SetStateAction<string>>;
  setEmailState: React.Dispatch<React.SetStateAction<string>>;
  setPasswordState: React.Dispatch<React.SetStateAction<string>>;
  isNameValid: boolean;
  isEmailValid: boolean;
  isPasswordValid: boolean;
  emailValidationRequested: boolean;
  setEmailValidationRequested: React.Dispatch<React.SetStateAction<boolean>>;
  errorMessage: string | null;
  setErrorMessage: (message: string | null) => void;
  getSnapshot: () => SignupFormState;
};

const SignupFormContext = createContext<SignupFormContextValue | null>(null);

export function SignupFormProvider({ children }: { children: ReactNode }) {
  const [firstNameState, setFirstNameState] = useState("");
  const [lastNameState, setLastNameState] = useState("");
  const [emailState, setEmailState] = useState("");
  const [passwordState, setPasswordState] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailValidationRequested, setEmailValidationRequested] =
    useState(false);
  const isNameValid = firstNameState.trim().length > 0;
  const email = emailState.trim();
  const isEmailValid = EMAIL_REGEX.test(email) && COMMON_TLD_REGEX.test(email);
  const isPasswordValid = passwordState.length >= MIN_PASSWORD_LENGTH;

  const getSnapshot = (): SignupFormState => ({
    firstName: firstNameState.trim(),
    lastName: lastNameState.trim(),
    email: emailState.trim(),
    password: passwordState,
  });

  const value = useMemo<SignupFormContextValue>(
    () => ({
      firstNameState,
      lastNameState,
      emailState,
      passwordState,
      setFirstNameState,
      setLastNameState,
      setEmailState,
      setPasswordState,
      isNameValid,
      isEmailValid,
      isPasswordValid,
      errorMessage,
      emailValidationRequested,
      setEmailValidationRequested,
      setErrorMessage,
      getSnapshot,
    }),
    [
      firstNameState,
      lastNameState,
      emailState,
      passwordState,
      setFirstNameState,
      setLastNameState,
      setEmailState,
      setPasswordState,
      emailValidationRequested,
      setEmailValidationRequested,
      isNameValid,
      isEmailValid,
      isPasswordValid,
      errorMessage,
    ],
  );

  return (
    <SignupFormContext.Provider value={value}>
      {children}
    </SignupFormContext.Provider>
  );
}

export function useSignupForm() {
  const ctx = useContext(SignupFormContext);
  if (!ctx) {
    throw new Error("useSignupForm must be used within a SignupFormProvider");
  }
  return ctx;
}
