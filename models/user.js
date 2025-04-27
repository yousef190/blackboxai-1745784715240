const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Password policy regex: min 8 chars, uppercase, lowercase, number, special char
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$/;

async function createUser({ username, email, password, github_id = null, auth_method }) {
  if (auth_method === 'manual') {
    if (!passwordRegex.test(password)) {
      throw new Error('Password does not meet security requirements.');
    }
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const query = `
      INSERT INTO users (username, email, password, github_id, auth_method)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, username, email, github_id, auth_method, created_at
    `;
    const values = [username, email, hashedPassword, github_id, auth_method];
    const { rows } = await pool.query(query, values);
    return rows[0];
  } else if (auth_method === 'github') {
    // For OAuth users, password is null
    const query = `
      INSERT INTO users (username, email, password, github_id, auth_method)
      VALUES ($1, $2, NULL, $3, $4)
      ON CONFLICT (github_id) DO NOTHING
      RETURNING id, username, email, github_id, auth_method, created_at
    `;
    const values = [username, email, github_id, auth_method];
    const { rows } = await pool.query(query, values);
    return rows[0];
  } else {
    throw new Error('Invalid authentication method.');
  }
}

async function findUserByUsernameOrEmail(identifier) {
  const query = `
    SELECT * FROM users WHERE username = $1 OR email = $1
  `;
  const { rows } = await pool.query(query, [identifier]);
  return rows[0];
}

async function findUserById(id) {
  const query = `
    SELECT * FROM users WHERE id = $1
  `;
  const { rows } = await pool.query(query, [id]);
  return rows[0];
}

async function findUserByGitHubId(github_id) {
  const query = `
    SELECT * FROM users WHERE github_id = $1
  `;
  const { rows } = await pool.query(query, [github_id]);
  return rows[0];
}

async function verifyPassword(user, password) {
  if (!user || !user.password) return false;
  return await bcrypt.compare(password, user.password);
}

module.exports = {
  createUser,
  findUserByUsernameOrEmail,
  findUserById,
  findUserByGitHubId,
  verifyPassword,
  passwordRegex,
};
