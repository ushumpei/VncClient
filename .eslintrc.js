module.exports = {
  parser: 'babel-eslint',
  extends: ['standard', 'plugin:flowtype/recommended', 'plugin:prettier/recommended', 'plugin:react/recommended'],
  plugins: ['flowtype', 'react'],
  rules: {
    'react/jsx-filename-extension': [1, { extensions: ['.js', '.jsx'] }],
    'prettier/prettier': [
      'error',
      {
        singleQuote: true,
        semi: false
      }
    ]
  }
};
