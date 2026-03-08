/**
 * Increments version number following semantic rules:
 * 1.0.6 -> 1.0.7
 * 1.0.9 -> 1.1.0
 * 1.9.9 -> 2.0.0
 */
function incrementVersion(version) {
    let parts = version.split('.').map(Number);
    if (parts.length !== 3) return "1.0.0";
    
    parts[2]++; // Increment patch
    
    if (parts[2] > 9) {
        parts[2] = 0;
        parts[1]++; // Increment minor
    }
    
    if (parts[1] > 9) {
        parts[1] = 0;
        parts[0]++; // Increment major
    }
    
    return parts.join('.');
}

module.exports = { incrementVersion };
