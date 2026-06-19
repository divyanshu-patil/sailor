import { selectIsAuthenticated, useAuthStore } from "@/store/auth-store";
import React from "react";

const useAuthenticated = (): boolean => {
  return useAuthStore(selectIsAuthenticated);
};

export default useAuthenticated;
