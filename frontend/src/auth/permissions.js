export function canAccess(user, roles) {
  if (!user?.role) {
    return false;
  }

  if (user.role === "admin") {
    return true;
  }

  return roles.includes(user.role);
}
