// netlify/functions/db.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = {
  // Fonction pour les requêtes simples (utilisée par les autres fichiers)
  query: (text, params) => pool.query(text, params),
  
  // Fonction pour obtenir un client afin de gérer les transactions (ce qui manquait)
  getClient: () => pool.connect(),
};
