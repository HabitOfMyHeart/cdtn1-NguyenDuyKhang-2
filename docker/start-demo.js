const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { mongo: { MongoClient } } = require('mongoose');

const DEMO_URI = 'mongodb://db:27017/mekong_bt3_demo';

function runNodeScript(script) {
  const result = spawnSync(process.execPath, [path.join(__dirname, '..', script)], {
    stdio: 'inherit', timeout: 60000, env: process.env
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Docker initialization step failed: ${script}`);
  }
}

/** Single-instance Docker-only initialization; never target the host database. */
async function initializeDemo({ uri, client, run = runNodeScript } = {}) {
  if (uri !== DEMO_URI) throw new Error('Startup requires the isolated Docker demo database.');
  const connection = client || new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000
  });
  try {
    await connection.connect();
    const metadata = connection.db('mekong_bt3_demo').collection('_bt3_deployment');
    const marker = await metadata.findOne({ _id: 'sample-v1' });
    if (marker) {
      if (marker.version !== 1 || marker.complete !== true) {
        throw new Error('Unknown Docker initialization metadata; preserve data and investigate.');
      }
      return 'existing';
    }
    run('migrations/001_init_collections.js');
    run('seeds/seed_l2_data.js');
    await metadata.updateOne({ _id: 'sample-v1' }, {
      $set: { version: 1, complete: true }
    }, { upsert: true });
    return 'initialized';
  } finally {
    await connection.close();
  }
}

if (require.main === module) {
  // Validate credentials/configuration before any database initialization.
  Promise.resolve().then(() => {
    require('../src/config').getConfig();
    return initializeDemo({ uri: process.env.MONGODB_URI });
  }).then((state) => {
    console.log(`Docker demo database: ${state}.`);
    return require('../src/server').startServer();
  }).catch((error) => {
    // Child migration/seed output identifies its step; never print environment values.
    console.error(error.name === 'ConfigError'
      ? 'Docker demo configuration invalid. Check the environment-variable names in the guide.'
      : 'Docker demo startup failed. Check database and initialization logs.');
    process.exitCode = 1;
  });
}

module.exports = { initializeDemo };
