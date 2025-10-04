// Ponto de entrada principal para as Firebase Functions.

// Carrega as funções da API EVO
const evoFunctions = require('./evo.js');

// Exporta todas as funções encontradas em evo.js
Object.keys(evoFunctions).forEach(key => {
  exports[key] = evoFunctions[key];
});

// Você pode adicionar outras funções aqui no futuro, se necessário.
// Exemplo:
// const outrasFuncoes = require('./outras.js');
// Object.keys(outrasFuncoes).forEach(key => {
//   exports[key] = outrasFuncoes[key];
// });
