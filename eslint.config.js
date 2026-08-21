// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  {
    // Üretilmiş çıktılar ve başka runtime'a ait kod lint edilmez.
    ignores: [
      'dist/**', // expo export çıktısı
      'web/**', // sahayabak.com statik export'u (minified bundle)
      '.expo/**', // expo'nun ürettiği tipler ve cache
      'supabase/functions/**', // Deno: URL import'ları ve Deno global'i
    ],
  },

  expoConfig,

  {
    // Node üzerinde çalışan build/config scriptleri (CommonJS).
    // expoConfig bunlara React Native/browser global'lerini verdiği için
    // __dirname gibi Node global'leri no-undef hatası üretiyordu.
    files: ['scripts/**/*.js', '*.config.js', '*.config.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'writable',
        module: 'writable',
        process: 'readonly',
        require: 'readonly',
      },
    },
  },
]);
