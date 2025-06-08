export const eslintConfig = {
  rules: {
    // Turn off problematic rules for Monaco
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    'react/prop-types': 'off',
    'react/display-name': 'off',
    'no-unreachable': 'off',
    'no-unused-vars': 'off'
  },
  
  ignorePatterns: [
    'node_modules',
    'dist',
    '*.d.ts'
  ],
  
  diagnosticCodesToIgnore: [
    1108, // Unreachable code detected
    2304, // Cannot find name
    2307, // Cannot find module
    2339, // Property does not exist
    2345, // Argument of type 'X' is not assignable to parameter of type 'Y'
    2531, // Object is possibly 'null'
    2532, // Object is possibly 'undefined'
    7027, // Unreachable code detected
    6133, // Variable is declared but never used
    6196, // 'x' is declared but never used
  ]
};
