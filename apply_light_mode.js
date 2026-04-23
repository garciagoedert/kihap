const fs = require('fs');
const path = require('path');

const directories = ['members', 'members/js'];

const replacements = [
    { regex: /<html([^>]*)class="dark"([^>]*)>/g, replacement: '<html$1$2>' },
    { regex: /<body class="bg-\[#111111\] text-gray-200">/g, replacement: '<body class="bg-gray-50 dark:bg-[#111111] text-gray-900 dark:text-gray-200 transition-colors duration-300">' },
    { regex: /<body class="bg-\[#0a0a0a\] text-gray-200 min-h-screen">/g, replacement: '<body class="bg-gray-50 dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-200 min-h-screen transition-colors duration-300">' },
    { regex: /bg-\[#111111\]/g, replacement: 'bg-gray-50 dark:bg-[#111111]' },
    { regex: /bg-\[#1a1a1a\]/g, replacement: 'bg-white dark:bg-[#1a1a1a]' },
    { regex: /bg-\[#141414\]/g, replacement: 'bg-white dark:bg-[#141414]' },
    { regex: /bg-\[#0a0a0a\]/g, replacement: 'bg-white dark:bg-[#0a0a0a]' },
    { regex: /bg-\[#1e1e1e\]/g, replacement: 'bg-white dark:bg-[#1e1e1e]' },
    { regex: /border-\[#1a1a1a\]/g, replacement: 'border-gray-200 dark:border-[#1a1a1a]' },
    { regex: /border-gray-800/g, replacement: 'border-gray-200 dark:border-gray-800' },
    { regex: /border-\[#222\]/g, replacement: 'border-gray-200 dark:border-[#222]' },
    { regex: /border-\[#333\]/g, replacement: 'border-gray-300 dark:border-[#333]' },
    { regex: /text-gray-200/g, replacement: 'text-gray-800 dark:text-gray-200' },
    { regex: /text-gray-300/g, replacement: 'text-gray-700 dark:text-gray-300' },
    { regex: /text-gray-400/g, replacement: 'text-gray-500 dark:text-gray-400' }
];

const scriptTag = `
    <script>
        if (localStorage.getItem('theme') === 'light' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: light)').matches)) {
            document.documentElement.classList.remove('dark');
        } else {
            document.documentElement.classList.add('dark');
        }
    </script>
</head>`;

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    if (filePath.endsWith('.html') && !filePath.includes('notification-container.html') && !filePath.includes('header.html') && !filePath.includes('sidebar.html') && !filePath.includes('bottom-nav.html')) {
        // Only add script to full HTML pages
        if (content.includes('</head>') && !content.includes('localStorage.getItem(\'theme\')')) {
            content = content.replace('</head>', scriptTag);
        }
    }

    for (let r of replacements) {
        // Don't replace body again if it was already handled by specific regex
        if (r.regex.toString().includes('body')) {
           content = content.replace(r.regex, r.replacement);
        } else {
           // We need to be careful with simple replacements not to double replace.
           // E.g. if we already replaced bg-[#1a1a1a] to bg-white dark:bg-[#1a1a1a], a second run shouldn't replace it again.
           // Using simple string replacement logic that ignores already replaced parts is tricky.
           // However, since it's a one-off script, we can just run it.
           // Let's ensure we don't replace inside 'dark:'
           let parts = content.split(/(dark:[a-zA-Z0-9_#-]+)/);
           for (let i = 0; i < parts.length; i++) {
               if (i % 2 === 0) {
                   parts[i] = parts[i].replace(r.regex, r.replacement);
               }
           }
           content = parts.join('');
        }
    }

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated: ${filePath}`);
    }
}

directories.forEach(dir => {
    const fullDir = path.join(__dirname, dir);
    if (fs.existsSync(fullDir)) {
        fs.readdirSync(fullDir).forEach(file => {
            const filePath = path.join(fullDir, file);
            if (fs.statSync(filePath).isFile() && (file.endsWith('.html') || file.endsWith('.js'))) {
                processFile(filePath);
            }
        });
    }
});
