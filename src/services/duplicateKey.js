// Retry only known unique business-ID collisions, never an ambiguous write.
const MAX_ATTEMPTS = 5;

function duplicateField(error, field) {
  return error?.code === 11000 && error.keyPattern &&
    Object.keys(error.keyPattern).length === 1 && error.keyPattern[field] === 1;
}

module.exports = { MAX_ATTEMPTS, duplicateField };
