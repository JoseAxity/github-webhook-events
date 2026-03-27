// validaciones.js

/**
 * Valida si la combinación de origen y destino es permitida para PRs.
 * @param {string} origen - Rama origen
 * @param {string} destino - Rama destino
 * @returns {boolean} true si la combinación es permitida
 */
export function isValidBranchCombination(origen, destino) {
  if (
    (/^revert.*/.test(origen) && destino === "develop") ||
    (/^revert.*/.test(origen) && destino === "staging") ||
    (/^revert.*/.test(origen) && destino === "main") ||
    (/^feature.*/.test(origen) && destino === "develop") ||
    (/^bugfix.*/.test(origen) && destino === "staging") ||
    (origen === "develop" && destino === "staging") ||
    (origen === "staging" && destino === "main") ||
    (/^hotfix.*/.test(origen) && destino === "main") ||
    (/^wip.*/.test(origen) && /^feature.*/.test(destino)) ||
    (/^cherryp.*/.test(origen) && destino === "staging") ||
    (origen === "develop" && /^wip.*/.test(destino)) ||
    (origen === "develop" && /^feature.*/.test(destino))
  ) {
    return true;
  }
  return false;
}
