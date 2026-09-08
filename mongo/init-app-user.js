const database = process.env.MONGO_APP_DATABASE || 'paris_janitor';
const username = process.env.MONGO_APP_USERNAME;
const password = process.env.MONGO_APP_PASSWORD;

if (!username || !password) {
  print('MONGO_APP_USERNAME ou MONGO_APP_PASSWORD absent : aucun utilisateur applicatif créé.');
} else {
  const target = db.getSiblingDB(database);
  const existing = target.getUser(username);
  if (existing) {
    print('Utilisateur applicatif déjà présent : ' + username);
  } else {
    target.createUser({ user: username, pwd: password, roles: [{ role: 'readWrite', db: database }] });
    print('Utilisateur applicatif créé : ' + username + ' sur ' + database);
  }
}
