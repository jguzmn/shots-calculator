const platformAdminRoles = ["super_admin"];
const clientAdminRoles = ["super_admin", "admin_cliente"];
const bottleManagerRoles = ["super_admin", "admin_cliente", "demo"];
const validUserRoles = ["super_admin", "admin_cliente", "usuario_cliente", "solo_lectura", "demo"];

function hasRole(user, roles) {
  return Boolean(user && roles.includes(user.rol));
}

function isPlatformAdmin(user) {
  return hasRole(user, platformAdminRoles);
}

function isClientAdmin(user) {
  return hasRole(user, clientAdminRoles);
}

function canManageBottles(user) {
  return hasRole(user, bottleManagerRoles);
}

module.exports = {
  bottleManagerRoles,
  canManageBottles,
  clientAdminRoles,
  hasRole,
  isClientAdmin,
  isPlatformAdmin,
  platformAdminRoles,
  validUserRoles
};
