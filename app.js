
var express = require("express");

//var connection = require('./sql_connector'); // 追加
var pool = require('./sql_connector'); // 追加

var app = express();

/**
 * SSL用-----------------------------------------------------------------------
 */
                                                                                                                                                                    
var fs = require('fs');
var https = require('https');
var options = {
  key: fs.readFileSync('/etc/letsencrypt/live/robberygirl.info/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/robberygirl.info/cert.pem'),
  ca: fs.readFileSync('/etc/letsencrypt/live/robberygirl.info/chain.pem')
};
var https_server = https.createServer(options, app);

/**
 * Line用-----------------------------------------------------------------------
 */

const line = require('@line/bot-sdk');
const config = {
    channelAccessToken: '******',
    channelSecret: '*******',
};

const client = new line.Client(config);

//今日の占いコーナー
app.post('/callback', line.middleware(config), (req, res) => {
    Promise
      .all(req.body.events.map(handleEvent))
      .then((result) => res.json(result))
      .catch((err) => {
        console.error(err);
        res.status(500).end();
      });
  });
  
  // event handler
  function handleEvent(event) {
    if (event.type !== 'message' || event.message.type !== 'text') {
      return Promise.resolve(null);
    }
  
    if (event.message.text.includes("占")) {
        rand_list_1 = ['大凶','凶','吉','末吉','小吉','中吉','大吉',];
        rand_list_2 = ['タンポポを生で食べるといいでしょう','運命の人はなんと、異性です','次の占いから￥100かかります'];

        str_1 = rand_list_1[Math.floor( Math.random() * rand_list_1.length)]
        str_2 = rand_list_2[Math.floor( Math.random() * rand_list_2.length)]

        oracle = "あなたの運勢は" + str_1 + "です。\n" + str_2   
    } else if (event.message.text.includes("おすすめ")){
        rand_list = ['甲殻類はかに','麺類はラーメン','映画はとなりのトトロ','調味料は塩'];
        
        str = rand_list[Math.floor( Math.random() * rand_list.length)]
        oracle = "おすすめの" + str + "です。" 
    }　else if (event.message.text.includes("やって")){
        oracle = "自分でやって。" 
    } else {
        oracle = "すみません、よくわかりません" 
    }
    const echo = { type: 'text', text: oracle };
    return client.replyMessage(event.replyToken, echo);
  }
  
//-----------------------------------------------------------------------

//画像ファイル置き場の設定Static?
app.use('/images', express.static('images'));
app.use('/css', express.static('css'));

//POST処理に必要
const bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({ extended: true }))

//バリデーションに必要
//npm install express-validator
const { validationResult } = require('express-validator');
const appValidator = require('./appValidator');

// テンプレートエンジンの指定
app.set("view engine", "ejs");

//ハッシュ関数
const crypto = require('crypto');

/**
 * 認証の確認
 */
function isAuthenticated(req, res, next){
    if (req.isAuthenticated()) {
        return next();
    } else {  
        res.redirect('/login');  
    }
}

/**
 * 定期処理-----------------------------------------------------------------------
 */
// npm install node-cron --save
const cron = require('node-cron');
// cron.schedule('* * * * * ', () => {//毎分(テスト用）
//     console.log(('aaa'));
// });
cron.schedule('0 0 9 * * *', () => {//毎日９時に更新
    //古いイベントを非表示
    var now = new Date();
    var now_month = now.getMonth()+1;
    var now_day = now.getDate();
    query = 'SELECT * FROM events';
    pool.getConnection(function(err, connection){
        connection.query(query, function(err, rows) {
            //ID→名前に変換
            for(let i = 0; i < rows.length; i++) {
                rec_date = rows[i].date;
                rec_month = rec_date.substr(5,2);
                rec_day = rec_date.substr(8,2);
    
                if (Number(now_month) > Number(rec_month)) {
                    query = 'UPDATE  events SET  deleted = 1 WHERE id=' + String(rows[i].id)
                    connection.query(query, function(err, rows) {});
                } else if (Number(now_month) == Number(rec_month)) {
                    if (Number(now_day) > Number(rec_day)) {
                        query = 'UPDATE  events SET  deleted = 1 WHERE id=' + String(rows[i].id)
                        connection.query(query, function(err, rows) {});
                    }
                }
            }
            console.log(('DELETE proccess successed!'));
            connection.release();//プールの開放
        });
    });
});

/**
 * ログイン周り処理-----------------------------------------------------------------------
 */
var passport = require('passport');
const flash    = require('connect-flash');
app.use(flash());
//処理本体
var LocalStrategy = require('passport-local').Strategy;
passport.use(new LocalStrategy(function(username, password, done){
    try {
        //認証情報からクエリを作成し、パスワードを比較
        query = 'SELECT * FROM entrants WHERE username = ' + '"' + String(username) + '"';
        confirm_password = '';
        password = crypto.createHash('sha512').update(password).digest('hex');//パスワードのハッシュ化
        pool.getConnection(function(err, connection){
            connection.query(query, function(err, rows) {
                if(rows.length > 0){
                    confirm_password = rows[0].password;
                    ses_id = rows[0].id;
                    connection.release();//プールの開放
                    if (password == confirm_password) {
                        return done(null, ses_id);
                    } else {
                        return done(null, false);
                    }
               } else {
                return done(null, false);
               }
            });
        });
    } catch (e) {
        res.redirect('/login');
        connection.release();//プールの開放
        console.log(e)
    }
}));

/**
 *セッション管理-----------------------------------------------------------------------
 */
var session = require('express-session');
app.use(session({
    secret: '*****',
}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, done) {
    done(null, user);
});
passport.deserializeUser(function(user, done) {
    done(null, user);
});

/**
 * 会員登録-----------------------------------------------------------------------
 */
//GET
app.get("/entry/:invitation_id", function (req, res) {
    res.render('entry', {
        user_name: 'ようこそ ゲストさん',
        invitation_id: req.params.invitation_id
    });
    res.end();
   
});
app.post('/entry/:invitation_id', function(req, res) {
    var username = req.body.username
    var password = req.body.password
    var name = req.body.name
    var favorite = req.body.favorite
    var invitation_id = req.params.invitation_id

    if(req.body.line_id === undefined ||req.body.line_id === null){
        var line_id = ''
    } else {
        var line_id = req.body.line_id
    }
    
    pass_hash = crypto.createHash('sha512').update(password).digest('hex');//passのハッシュ化

    query = 'INSERT INTO entrants(username, password, name, favorite, invitation_id,line_id) VALUES' +
            '(' + '"'+username+'",' + '"'+pass_hash+'",'+ '"'+name+'",'+ '"'+favorite+'",'
            + invitation_id + ',"' + line_id + '")';
    pool.getConnection(function(err, connection){
        connection.query(query, function(err, rows) {
            console.log(query);
            connection.release();//プールの開放
        });
        res.redirect('/login');
    });
});

/**
 * ログイン画面-----------------------------------------------------------------------
 */
//GET
app.get("/login", function (req, res) {
    res.render('login', {
        user_name: 'ようこそ ゲストさん'
    });
    res.end();
});
app.post('/login',
    passport.authenticate('local',{
        failureRedirect: '/login',
    }),
    function(req, res) {
        pool.getConnection(function(err, connection){
            query = 'SELECT * FROM entrants'　+ ' WHERE id = ' + String(req.session.passport.user);
            connection.query(query, function(err, rows) {
                console.log(rows[0].name + " is login");
                //user_name = 'ようこそ ' + rows[0].name + 'さん'
                connection.release();//プールの開放
            });
            res.redirect('/');
        });
    }
);

/**
 * ログアウト処理-----------------------------------------------------------------------
 */
app.get('/logout', function(req, res, next) {
    message = 'id:' + String(req.session.passport.user) + 'is logout'
    console.log(message);
    req.logout();
    res.redirect('/');
});

/**
 * ホーム画面（GET）-----------------------------------------------------------------------
 */
app.get("/", isAuthenticated, function (req, res) {
    pool.getConnection(function(err, connection){
        query = 'SELECT * FROM entrants'　+ ' WHERE id = ' + String(req.session.passport.user);
        connection.query(query, function(err, rows) {
            user_name = 'ようこそ ' + rows[0].name + 'さん'
        });
        query = 'SELECT * FROM events WHERE events.deleted = 0';
        connection.query(query, function(err, rows) {
            for(let i = 0; i < rows.length; i++) {
                if (rows[i].create_by == req.session.passport.user) {
                    rows[i].create_by = '作成！';
                } else {
                    rows[i].create_by = '';
                }
            }
            res.render('index', {
                user_name: user_name,
                eventList: rows
            });
            res.end();
            connection.release();//プールの開放
        });
    });
});

/**
 * メンバ一覧(GET) -----------------------------------------------------------------------
 */
app.get('/user_add', isAuthenticated, function(req, res) {
    pool.getConnection(function(err, connection){
        query = 'SELECT * FROM entrants'　+ ' WHERE id = ' + String(req.session.passport.user);
        connection.query(query, function(err, rows) {
            user_name = 'ようこそ ' + rows[0].name + 'さん'
        });
        query = 'SELECT * FROM entrants';
        connection.query(query, function(err, rows) {
            //ID→名前に変換
            for(let i = 0; i < rows.length; i++) {
                targ_index = rows[i].invitation_id;
    
                targ = rows.filter(function(item, index){
                      if (item.id == targ_index) return true;
                });
                rows[i].invitation_id = targ[0].name;
            }
            
            res.render('user_add', {
                user_name: user_name,
                invitation_id: 'https://robberygirl.info/entry/'+ String(req.session.passport.user),
                boardList: rows
            });
            connection.release();//プールの開放
            res.end();
        });
    });
});

/**
 * メンバー情報の編集-----------------------------------------------------------------------
 */
//GET
app.get("/entrant_edit", function (req, res) {
    pool.getConnection(function(err, connection){
        query = 'SELECT * FROM entrants'　+ ' WHERE id = ' + String(req.session.passport.user);
        connection.query(query, function(err, rows) {
            user_name = 'ようこそ ' + rows[0].name + 'さん';
            res.render('entrant_edit', {
                user_name:user_name,
                user_id:rows[0].id,
                userList: rows,
            });
            res.end();
            connection.release();//プールの開放
        });
    });
});
app.post('/entrant_edit', function(req, res) {

    if (req.body.id == req.session.passport.user) {
        var name = req.body.name
        var favorite = req.body.favorite

        if(req.body.line_id === undefined ||req.body.line_id === null){
            var line_id = ''
        } else {
            var line_id = req.body.line_id
        }

        query = 'UPDATE limemints.entrants SET name = "' + name + '", ' +
                'favorite = "' + favorite + '", ' + 'line_id = "' + line_id + '"' +
                ' WHERE id = ' + String(req.session.passport.user);
        pool.getConnection(function(err, connection){
            connection.query(query, function(err, rows) {
                console.log(query);
                connection.release();//プールの開放
            });
            res.redirect('/user_add');
        });
    } else {
        res.redirect('/user_add');
    }
});

/**
 * イベント追加 -----------------------------------------------------------------------
 */
//GET
app.get('/event_add', isAuthenticated, function(req, res) {
    pool.getConnection(function(err, connection){
        query = 'SELECT * FROM entrants'　+ ' WHERE id = ' + String(req.session.passport.user);
        connection.query(query, function(err, rows) {
            user_name = 'ようこそ ' + rows[0].name + 'さん'
        });
        res.render('event_add', {
            user_name: user_name,
        });
        connection.release();//プールの開放
        res.end();
    });
});
//POST
app.post('/event_add', isAuthenticated, function(req, res) {
    //バリデーションエラーを返す
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.send('データ登録に失敗しました');
    }
    
    var title = req.body.title
    var description = req.body.description
    var location = req.body.location
    var date = req.body.date
    var start_time = req.body.start_time
    var end_time = req.body.end_time
    var max_length = req.body.maxlength
    var fee = req.body.fee
    var create_by = req.session.passport.user
    var my_event_id = 1
    var error_flag = false
    pool.getConnection(function(err, connection){
        query = 'INSERT INTO events(title,description,date,start_time,end_time,maxlength,fee,location,create_by) VALUES (' +
            '"'+title+'",' + '"'+description+'",' + '"'+date+'",' + '"'+start_time+'",' + '"'+end_time+'",' +
            '"'+max_length+'",' + '"'+fee+'",' + '"'+location+'",' + '"'+create_by+'"' + ')';
        connection.query(query, function(err, rows) {
            if (err) {
                error_flag = true;
            }
            console.log(query);
        });

        if (!error_flag) {
            //最新のイベントレコードを取得
            query = 'SELECT * FROM events ORDER BY id DESC LIMIT 1;'
            connection.query(query, function(err, rows) {
                my_event_id = rows[0].id;
                //event_entrantsに自信を追加
                query = 'INSERT INTO entrant_events(entrant_id,event_id) VALUES (' + String(create_by) + ',' +  String(my_event_id) + ')';
                connection.query(query, function(err, rows) {
                    console.log(query);
                    //ライン通知
                    line_message = "新イベントが登録されました🦀\n\n" +
                                   "タイトル: " + String(title) + "\n" +
                                   "開催日: " + String(date) + "\n" +
                                   "場所: " + String(location) + "\n\n" +
                                   "詳細はページから確認してください↓\n"+
                                   "https://robberygirl.info"

                    client.broadcast({
                        type: "text",
                        text: line_message
                    })
                    res.redirect('/');
                });
                connection.release();//プールの開放
            });
        }
    });
});

/**
 * イベント詳細（GET）-----------------------------------------------------------------------
 */
app.get('/event_detail/:id', isAuthenticated, function(req, res) {
    pool.getConnection(function(err, connection){
        query = 'SELECT * FROM entrants'　+ ' WHERE id = ' + String(req.session.passport.user);
        connection.query(query, function(err, rows) {
            user_name = 'ようこそ ' + rows[0].name + 'さん'
        });
        //主催者名を取得
        query = 'SELECT * FROM entrants INNER JOIN events ON ' +
            'entrants.id = events.create_by AND events.id = '
            + String(req.params.id);
        connection.query(query, function(err, rows) {
            create_by_name = rows[0].name;
        });
        //イベント詳細を取得
        query = 'SELECT * FROM events'　+ ' WHERE id = ' + String(req.params.id);
        var events_list = [];
        connection.query(query, function(err, rows) {
            //時刻表示を簡略化(ついでに主催者名を上書き)
            for(let i = 0; i < rows.length; i++) {
                start_time = rows[i].start_time;
                end_time = rows[i].end_time;
                rows[i].start_time = start_time + ' 〜 ' + end_time;
                rows[i].create_by = create_by_name;
            }
            events_list = rows
        });
        query = 'SELECT * FROM entrants INNER JOIN entrant_events ON ' +
            'entrants.id = entrant_events.entrant_id AND entrant_events.event_id = '
            + String(req.params.id);
        //参加者一覧を取得
        connection.query(query, function(err, rows) {
            //自分が参加しているか調べる
            entry_display_flag = "";
            for(let i = 0; i < rows.length; i++) {
                if (rows[i].id == req.session.passport.user) {
                    entry_display_flag = "disabled";
                    break
                }
            }
            res.render('event_detail', {
                user_name: user_name,
                event_id: req.params.id,
                sub_title: '参加者一覧',
                eventList: events_list,
                entrantList: rows,
                entry_display_flag: entry_display_flag
            });
            res.end();
            connection.release();//プールの開放
        });
    });
});

/**
 * イベント参加処理 -----------------------------------------------------------------------
 */
app.post('/event_detail/:id/event_entry', function(req, res) {
    pool.getConnection(function(err, connection){
        query = 'INSERT INTO entrant_events(entrant_id,event_id) VALUES (' + String(req.session.passport.user) + ',' +  String(req.params.id) + ')';
        connection.query(query, function(err, rows) {
            connection.release();//プールの開放
        });
    });
    res.redirect('/');
});

/**
 * 集計画面 -----------------------------------------------------------------------
 */
app.get('/event_detail/:id/amount', isAuthenticated,function(req, res) {
    pool.getConnection(function(err, connection){
        query = 'SELECT * FROM entrants'　+ ' WHERE id = ' + String(req.session.passport.user);
        connection.query(query, function(err, rows) {
            user_name = 'ようこそ ' + rows[0].name + 'さん'
        });
        //参加費を取得
        var fee = 0;
        query = 'SELECT * FROM events WHERE id =' + String(req.params.id);
        connection.query(query, function(err, rows) {
            fee = rows[0].fee;
        });
        //参加者一覧を取得
        query = 'SELECT * FROM entrants INNER JOIN entrant_events ON ' +
            'entrants.id = entrant_events.entrant_id AND entrant_events.event_id = '
            + String(req.params.id);
        connection.query(query, function(err, rows) {
            res.render('amount', {
                user_name: user_name,
                fee: fee,
                entrantList: rows
            });
            res.end();
            connection.release();//プールの開放
        });
    });
});

/**
 *  クレーム -----------------------------------------------------------------------
 */
app.get('/claim',isAuthenticated,function(req, res) {
    pool.getConnection(function(err, connection){
        query = 'SELECT * FROM claims'
        connection.query(query, function(err, rows) {
            res.render('claim', {
                user_name: 'ようこそ 匿名 さん',
                claimList: rows,
            });
            res.end();
            connection.release();//プールの開放
        });
    });
});
app.post('/claim',isAuthenticated,function(req, res) {

    if (req.session.passport.user == 1) {
        who = '24歳 男性 管理者';
    } else {
        who_age = Math.floor( Math.random() * 70 + 1);
        who_sex = ['歳 男性','歳 女性','歳 女性','歳 男性','歳 女性'];
        who_job = ['会社員','学生','アルバイト'];

        who = String(who_age) + who_sex[Math.floor( Math.random() * who_sex.length)] + who_job[Math.floor( Math.random() * who_job.length)];
    }
    
    query = 'INSERT INTO claims(content,create_by) VALUES (' + '"' +　String(req.body.claim_content) + '",' +  '"' + who + '")';
    pool.getConnection(function(err, connection){
        connection.query(query, function(err, rows) {
            console.log(query);
            connection.release();//プールの開放
        });
    });
    res.redirect('/claim');
});

/**
 * チャットルーム -----------------------------------------------------------------------
 */
app.get('/event_detail/:id/chat',isAuthenticated,function(req, res) {
    pool.getConnection(function(err, connection){
        query = 'SELECT * FROM entrants'　+ ' WHERE id = ' + String(req.session.passport.user);
        connection.query(query, function(err, rows) {
            user_name = 'ようこそ ' + rows[0].name + 'さん'
        });
        query = 'SELECT * FROM chats INNER JOIN entrants ON ' +
            'entrants.id = chats.create_by AND chats.event_id = ' + String(req.params.id) + ' ORDER BY chats.chat_id ASC;'
        connection.query(query, function(err, rows) {
            res.render('chats', {
                event_id: req.params.id,
                user_name: user_name,
                chatList: rows,
            });
            res.end();
            connection.release();//プールの開放
        });
    });
});
app.post('/event_detail/:id/chat',isAuthenticated,function(req, res) {
    create_by = req.session.passport.user;
    message = req.body.message;
    event_id = req.params.id;

    redirect_url = '/event_detail/' + String(event_id) + '/chat';

    query = 'INSERT INTO chats(message, event_id, create_by) VALUES (' + '"' +
            String(message) + '","' + String(event_id) + '",' +  '"' + String(create_by) + '")';
    pool.getConnection(function(err, connection){
        connection.query(query, function(err, rows) {
            console.log(query);
            connection.release();//プールの開放
        });
    });
    res.redirect(redirect_url);
});


/**
 * パスワードリセット -----------------------------------------------------------------------
 */
app.get('/pass_reset/:name',isAuthenticated,function(req, res) {
    pool.getConnection(function(err, connection){
        query = 'SELECT * FROM entrants WHERE name = "' + req.params.name + '";'
        connection.query(query, function(err, rows) {
            res.render('pass_reset', {
                user_name: 'ようこそ 管理者 さん',
                user_data: rows
            });
            connection.release();//プールの開放
        });
    });
});
app.post('/pass_reset',isAuthenticated,function(req, res) {

    if (req.session.passport.user == 1) {

        name = req.body.name;
        username = req.body.username;
        password = req.body.password;

        pass_hash = crypto.createHash('sha512').update(password).digest('hex');//passのハッシュ化

        pool.getConnection(function(err, connection){
            query = 'UPDATE entrants SET password = "' + pass_hash + '", username = "' +
            username + '"' + ' WHERE name = "' + name + '";'
            connection.query(query, function(err, rows) {
                connection.release();//プールの開放
            });
        });
        res.redirect('/');
    } 

});

app.on('request', getCss);

https_server.listen(443);

//cssの読み込み
function getCss(req, res) {
    var url = req.url;
    if ('/' == url) {
        fs.readFile('./css.html', 'UTF-8', function (err, data) {
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.write(data);
        res.end();
        });
    } else if ('./css/bg_image.css' == url) {
      fs.readFile('./css/bg_image.css', 'UTF-8', function (err, data) {
      res.writeHead(200, {'Content-Type': 'text/css'});
      res.write(data);
      res.end();
      });
    }
}

