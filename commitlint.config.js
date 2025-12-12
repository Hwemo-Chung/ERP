module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation only
        'style',    // Code style (formatting, semicolons, etc.)
        'refactor', // Code change that neither fixes a bug nor adds a feature
        'perf',     // Performance improvement
        'test',     // Adding or updating tests
        'build',    // Build system or external dependencies
        'ci',       // CI configuration files and scripts
        'chore',    // Other changes that don't modify src or test files
        'revert',   // Reverts a previous commit
      ],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'api',          // Backend API
        'mobile',       // Mobile/PWA frontend
        'prisma',       // Database schema
        'auth',         // Authentication
        'orders',       // Order management
        'users',        // User management
        'reports',      // Reporting
        'notifications',// Push notifications
        'offline',      // Offline functionality
        'deps',         // Dependencies
        'config',       // Configuration
        'release',      // Release related
      ],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 100],
  },
};
