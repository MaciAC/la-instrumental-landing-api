const bcrypt = require('bcrypt');

const password = process.argv[2];
const saltRounds = process.env.SALT_ROUNDS || 10;

if (!password) {
  console.error('Usage: node generate-password-hash.js <password>');
  process.exit(1);
}

bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    process.exit(1);
  }
  console.log('Hashed password:');
  console.log(hash);
  console.log('\nAdd this to your .env file as:');
  console.log(`ADMIN_PASSWORD=${hash}`);
});
