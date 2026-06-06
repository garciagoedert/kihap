const fs = require('fs');
let content = fs.readFileSync('intranet/suporte.html', 'utf-8');

// Specific compound classes
content = content.replace(/group-hover:text-white/g, 'group-hover:text-gray-900 dark:group-hover:text-white');

// General text classes
content = content.replace(/(?<![:-])text-white/g, 'text-gray-900 dark:text-white');
content = content.replace(/(?<![:-])text-gray-300/g, 'text-gray-600 dark:text-gray-300');
content = content.replace(/(?<![:-])text-gray-400/g, 'text-gray-500 dark:text-gray-400');
content = content.replace(/(?<![:-])text-gray-200/g, 'text-gray-700 dark:text-gray-200');

// Backgrounds
content = content.replace(/bg-\[#1a1a1a\]/g, 'bg-white dark:bg-[#1a1a1a]');
content = content.replace(/hover:bg-\[#252525\]/g, 'hover:bg-gray-50 dark:hover:bg-[#252525]');
content = content.replace(/(?<![:-])bg-gray-800/g, 'bg-gray-100 dark:bg-gray-800');
content = content.replace(/bg-\[#161616\]/g, 'bg-gray-50 dark:bg-[#161616]');
content = content.replace(/hover:bg-\[#222\]/g, 'hover:bg-gray-50 dark:hover:bg-[#222]');

// Borders
content = content.replace(/(?<![:-])border-gray-800/g, 'border-gray-200 dark:border-gray-800');
content = content.replace(/(?<![:-])border-gray-700/g, 'border-gray-300 dark:border-gray-700');
content = content.replace(/hover:border-gray-700/g, 'hover:border-gray-300 dark:hover:border-gray-700');
content = content.replace(/hover:border-gray-600/g, 'hover:border-gray-300 dark:hover:border-gray-600');

// Accent colors
['green', 'yellow', 'red', 'blue', 'purple', 'cyan', 'orange'].forEach(color => {
    content = content.replace(new RegExp(`(?<![:-])text-${color}-300`, 'g'), `text-${color}-700 dark:text-${color}-300`);
    content = content.replace(new RegExp(`(?<![:-])text-${color}-400`, 'g'), `text-${color}-600 dark:text-${color}-400`);
    content = content.replace(new RegExp(`hover:text-${color}-300`, 'g'), `hover:text-${color}-800 dark:hover:text-${color}-300`);
});

fs.writeFileSync('intranet/suporte.html', content);
console.log('Fixed themes in suporte.html');
