export function checkPermission(moduleName) {
    const permissions = JSON.parse(sessionStorage.getItem('userPermissions'));

    if (!permissions || !permissions[moduleName]) {
        console.warn(`Acesso negado ao módulo: ${moduleName}. Redirecionando...`);
        window.location.href = 'index.html';
        return false;
    }
    return true;
}
