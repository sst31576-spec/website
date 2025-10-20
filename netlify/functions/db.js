// Ce fichier gère la connexion à votre base de données PostgreSQL.
const { Pool } = require('pg');

// La 'pool' gère plusieurs connexions simultanément.
// Elle utilisera automatiquement la variable d'environnement DATABASE_URL
// que vous devez configurer dans votre tableau de bord Netlify.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = {
  // Fonction pour exécuter des requêtes SQL
  query: (text, params) => pool.query(text, params),
  // Fonction pour obtenir un client pour les transactions
  getClient: () => pool.connect(),
};
