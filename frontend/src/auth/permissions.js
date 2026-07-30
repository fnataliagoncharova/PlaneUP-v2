export function isAdminLikeRole(role) {
  return role === "admin" || role === "demo_admin";
}

export function isAdminLikeUser(user) {
  return isAdminLikeRole(user?.role);
}

export function canAccess(user, roles) {
  if (!user?.role) {
    return false;
  }

  if (isAdminLikeRole(user.role)) {
    return true;
  }

  return roles.includes(user.role);
}
