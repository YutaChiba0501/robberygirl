
const { check } = require('express-validator');

module.exports = [
  check('max_length').isInt().withMessage('人数上限は数値を入力してください'),
  check('fee').isInt().withMessage('参加費は数値を入力してください'),
];