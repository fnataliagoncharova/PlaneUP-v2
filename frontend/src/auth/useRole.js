import { useCallback } from "react";

import { useAuth } from "./AuthContext";
import { canAccess } from "./permissions";


export function useRole() {
  const { user } = useAuth();

  const is = useCallback((roles) => canAccess(user, roles), [user]);

  return {
    user,
    is,
  };
}
