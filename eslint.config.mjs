import nextVitals from 'eslint-config-next/core-web-vitals';

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'out/**', 'build/**', 'coverage/**', 'next-env.d.ts'] },
  ...nextVitals,
  {
    rules: {
      // Current screens fetch their initial data in effects and update local UI state.
      'react-hooks/set-state-in-effect': 'off',
      // The booking countdown initializes and refreshes from the wall clock.
      'react-hooks/purity': 'off',
    },
  },
];

export default config;
