const DEMO_URI = 'mongodb://db:27017/mekong_bt3_demo';

/**
 * The live smoke test writes fixtures and must only target the isolated Docker
 * demo. Checking the connection URI alone cannot prove where HTTP requests go.
 *
 * @param {{uri: string|undefined, inContainer: boolean}} environment
 * @returns {void}
 * @throws {Error} When the URI or runtime is outside the Docker app container.
 */
function assertSmokeEnvironment({ uri, inContainer }) {
  if (uri !== DEMO_URI) {
    throw new Error('Smoke verification requires the isolated Docker demo database.');
  }
  if (!inContainer) {
    throw new Error('Smoke verification must run inside the isolated Docker app container.');
  }
}

module.exports = { assertSmokeEnvironment, DEMO_URI };
