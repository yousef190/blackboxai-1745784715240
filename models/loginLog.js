const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function logLoginAttempt(user_id, ip_address) {
  const query = `
    INSERT INTO login_logs (user_id, ip_address)
    VALUES ($1, $2)
  `;
  await pool.query(query, [user_id, ip_address]);
}

module.exports = {
  logLoginAttempt,
};
