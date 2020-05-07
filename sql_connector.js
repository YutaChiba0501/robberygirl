var mysql = require('mysql');

var dbConfig = {
  host: 'localhost',
  user: '*****',
  password: '*****',
  database: 'limemints',
  charset: 'utf8mb4'
};

//コネクションプール
var pool = mysql.createPool(dbConfig);

module.exports = pool;