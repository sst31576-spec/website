// netlify/functions/db_logs.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.OODATABASE_URL, // Cette ligne est la plus importante
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
};
