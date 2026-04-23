// Gerenciador de Tema (Light/Dark Mode)
export function initThemeManager() {
    // A inicialização inicial já é feita pelo script inline no <head> para evitar flash.
    // Esta função serve para expor o toggle.
    window.toggleTheme = function() {
        if (document.documentElement.classList.contains('dark')) {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        } else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        }
    };
}
