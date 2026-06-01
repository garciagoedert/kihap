import re

with open('intranet/trello.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Finalidades badges
content = content.replace(
    'class="bg-gray-700 text-gray-300 text-[10px] px-1.5 py-0.5 rounded"',
    'class="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-[10px] px-1.5 py-0.5 rounded"'
)
content = content.replace(
    'class="bg-gray-700 text-gray-300 text-[10px] px-2 py-1 rounded tracking-wide uppercase"',
    'class="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-[10px] px-2 py-1 rounded tracking-wide uppercase"'
)

# 2. Responsáveis details modal
content = content.replace(
    'class="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg p-1.5 pr-3 w-fit"><span class="shrink-0">${photo}</span><span class="text-sm font-medium text-gray-200"',
    'class="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1.5 pr-3 w-fit shadow-sm"><span class="shrink-0">${photo}</span><span class="text-sm font-medium text-gray-900 dark:text-gray-200"'
)

# 3. Comments section 
# Attachment link
content = content.replace(
    'class="flex items-center gap-2 bg-gray-900 border border-gray-700 p-2 rounded hover:bg-gray-800 transition-colors w-fit"',
    'class="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-fit"'
)
# Author name
content = content.replace(
    '<span class="text-sm font-semibold text-gray-200">${c.authorName || \'Usuário\'}</span>',
    '<span class="text-sm font-semibold text-gray-900 dark:text-gray-200">${c.authorName || \'Usuário\'}</span>'
)
# Bubble background
content = content.replace(
    'class="text-sm text-gray-300 mt-0.5 bg-gray-800/80 p-2.5 rounded-r-lg rounded-bl-lg break-words whitespace-pre-wrap shadow-sm border border-gray-700/50"',
    'class="text-sm text-gray-800 dark:text-gray-300 mt-0.5 bg-white dark:bg-gray-800/80 p-2.5 rounded-r-lg rounded-bl-lg break-words whitespace-pre-wrap shadow-sm border border-gray-200 dark:border-gray-700/50"'
)
# Image border
content = content.replace(
    'class="max-w-full rounded-lg border border-gray-700 cursor-pointer hover:opacity-90 transition-opacity"',
    'class="max-w-full rounded-lg border border-gray-300 dark:border-gray-700 cursor-pointer hover:opacity-90 transition-opacity"'
)

# 4. Assignees styling inside cards and dropdowns
content = content.replace(
    'class="w-6 h-6 rounded-full border-2 border-gray-800 object-cover relative hover:z-10 bg-gray-700 shadow-sm"',
    'class="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 object-cover relative hover:z-10 bg-gray-200 dark:bg-gray-700 shadow-sm"'
)
content = content.replace(
    'class="w-6 h-6 rounded-full bg-blue-700 flex items-center justify-center text-[10px] font-bold text-white border-2 border-gray-800 relative hover:z-10 shadow-sm"',
    'class="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white border-2 border-white dark:border-gray-800 relative hover:z-10 shadow-sm"'
)
content = content.replace(
    'class="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-[9px] font-bold text-white border-2 border-gray-800 relative z-10 shadow-sm"',
    'class="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[9px] font-bold text-gray-800 dark:text-white border-2 border-white dark:border-gray-800 relative z-10 shadow-sm"'
)
content = content.replace(
    'class="w-6 h-6 rounded-full border border-gray-800 object-cover shadow-sm mr-2"',
    'class="w-6 h-6 rounded-full border border-white dark:border-gray-800 object-cover shadow-sm mr-2"'
)
content = content.replace(
    'class="w-6 h-6 rounded-full bg-blue-700 flex items-center justify-center text-[10px] font-bold text-white border border-gray-800 shadow-sm mr-2"',
    'class="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white border border-white dark:border-gray-800 shadow-sm mr-2"'
)

with open('intranet/trello.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
