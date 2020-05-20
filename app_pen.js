
const express = require("express");

const pool = require('./sql_connector'); // 追加

const app = express();

// クエリ宣言
let query = '';
let who = ''

//画像ファイル置き場の設定Static?
app.use('/images', express.static('images'));
app.use('/css', express.static('css'));

//POST処理に必要？
const bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({ extended: true }))

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
 * ログイン周り処理-----------------------------------------------------------------------
 */
const passport = require('passport');
const flash    = require('connect-flash');
app.use(flash());
//処理本体
const LocalStrategy = require('passport-local').Strategy;
passport.use(new LocalStrategy(function(username, password, done){
    try {
        //認証情報からクエリを作成し、パスワードを比較
        query = 'SELECT * FROM entrants WHERE username = ' + '"' + String(username) + '"';
        let confirm_password = '';
        let crp_password = crypto.createHash('sha512').update(password).digest('hex');//パスワードのハッシュ化
        pool.getConnection(function(err, connection){
            connection.query(query, function(err, rows) {
                if(rows.length > 0){
                    confirm_password = rows[0].password;
                    let ses_id = rows[0].id;
                    connection.release();//プールの開放
                    if (crp_password == confirm_password) {
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
        console.log(e)
    }
}));

/**
 *セッション管理-----------------------------------------------------------------------
 */
const session = require('express-session');
app.use(session({
    secret: '******',
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
    let username = req.body.username
    let password = req.body.password
    let name = req.body.name
    let favorite = req.body.favorite
    let invitation_id = req.params.invitation_id
    let line_id = ''

    if(req.body.line_id === undefined ||req.body.line_id === null){
        line_id = ''
    } else {
        line_id = req.body.line_id
    }
    
    let pass_hash = crypto.createHash('sha512').update(password).digest('hex');//passのハッシュ化

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
            let query = 'SELECT * FROM entrants'　+ ' WHERE id = ' + String(req.session.passport.user);
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
    let message = 'id:' + String(req.session.passport.user) + 'is logout'
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
        let username = '';
        connection.query(query, function(err, rows) {
            user_name = 'ようこそ ' + rows[0].name + 'さん';
        });
        query = 'SELECT * FROM entrants';
        connection.query(query, function(err, rows) {
            //ID→名前に変換
            for(let i = 0; i < rows.length; i++) {
                let targ_index = rows[i].invitation_id;
    
                let targ = rows.filter(function(item, index){
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
            let user_name = 'ようこそ ' + rows[0].name + 'さん';
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
        let name = req.body.name
        let favorite = req.body.favorite
        let line_id = ''

        if(req.body.line_id === undefined ||req.body.line_id === null){
            line_id = ''
        } else {
            line_id = req.body.line_id
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
        let user_name = '';

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
    
    let title = req.body.title
    let description = req.body.description
    let location = req.body.location
    let date = req.body.date
    let start_time = req.body.start_time
    let end_time = req.body.end_time
    let max_length = req.body.maxlength
    let fee = req.body.fee
    let create_by = req.session.passport.user
    let my_event_id = 1
    let error_flag = false
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
                    let line_message = "新イベントが登録されました🦀\n\n" +
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
        let username = ''
        let create_by_name = ''
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
        let events_list = [];
        connection.query(query, function(err, rows) {
            //時刻表示を簡略化(ついでに主催者名を上書き)
            for(let i = 0; i < rows.length; i++) {
                let start_time = rows[i].start_time;
                let end_time = rows[i].end_time;
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
            let entry_display_flag = "";
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
        let user_name = ''
        connection.query(query, function(err, rows) {
            user_name = 'ようこそ ' + rows[0].name + 'さん'
        });
        //参加費を取得
        let fee = 0;
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
        who = '24歳 男性';
    } else {
        let who_age = Math.floor( Math.random() * 70 + 1);
        let who_sex = ['歳 男性','歳 女性'];
        let who_job = ['会社員','学生','アルバイト'];

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
        let user_name = '';
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
    let create_by = req.session.passport.user;
    let message = req.body.message;
    let event_id = req.params.id;

    let redirect_url = '/event_detail/' + String(event_id) + '/chat';

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

        let name = req.body.name;
        let username = req.body.username;
        let password = req.body.password;

        let pass_hash = crypto.createHash('sha512').update(password).digest('hex');//passのハッシュ化

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

//https_server.listen(443);
app.listen(9029);

//cssの読み込み
function getCss(req, res) {
    let url = req.url;
    console.log(url)
    if ('/' == url) {
        fs.readFile('./css.html', 'UTF-8', function (err, data) {
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.write(data);
        res.end();
        });
    } else if ('./css/bg_image.css' == url) {
        console.log('success!css')
      fs.readFile('./css/bg_image.css', 'UTF-8', function (err, data) {
      res.writeHead(200, {'Content-Type': 'text/css'});
      res.write(data);
      res.end();
      });
    }
}

