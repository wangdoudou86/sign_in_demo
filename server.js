var http = require('http')
var fs = require('fs')
var url = require('url')
var port = process.argv[2]

if (!port) {
  console.log('请指定端口号好不啦？\nnode server.js 8888 这样不会吗？')
  process.exit(1)
}

var server = http.createServer(function (request, response) {
  var parsedUrl = url.parse(request.url, true)
  var pathWithQuery = request.url
  var queryString = ''
  if (pathWithQuery.indexOf('?') >= 0) { queryString = pathWithQuery.substring(pathWithQuery.indexOf('?')) }
  var path = parsedUrl.pathname
  var query = parsedUrl.query
  var method = request.method

  /******** 从这里开始看，上面不要看 ************/



  if (path === '/') {
    let string = fs.readFileSync('./index.html', 'utf8')
    let cookies = request.headers.cookie.split('; ') //携带多个cookie的情况
    let hash = {}
    for(let i=0;i<cookies.length;i++){
       let parts = cookies[i].split('=') // ['sign_in_email','1@qq.com']
       let key = parts[0]
       let value = parts[1]
       hash[key] = value
    }
    let email = hash.sign_in_email
    let users = fs.readFileSync('./db/users', 'utf8')
    users = JSON.parse(users) //一定不要忘了解析
    let foundUser
    for(let i=0;i<users.length;i++){
        if(users[i].email === email){ //为什么password一直是1？因为这里忘了用“===”
          foundUser = users[i]
          break
        }
    }
    if(foundUser){
      string = string.replace('__userName__',foundUser.email)
    }else{
      string = string.replace('__userName__','不知道')      
    }
    response.statusCode = 200
    response.setHeader('Content-Type', 'text/html;charset=utf-8')
    response.write(string)
    response.end()
  } else if (path === '/sign_up.html' && method === 'GET') {
    let string = fs.readFileSync('./sign_up.html', 'utf8')
    response.statusCode = 200
    response.setHeader('Content-Type', 'text/html;charset=utf-8')
    response.write(string)
    response.end()
  } else if (path === '/sign_up.html' && method === 'POST') {
    readBody(request).then((body) => { //这里body只是表示变量名，代表这个函数的所有信息，可换成其他任意变量名
      let strings = body.split('&') //["email=1","password=2","password_confirmation=3"]
      let hash = {}
      strings.forEach((string) => {
        let parts = string.split('=')//["email","1"]
        let key = parts[0]
        let value = parts[1]
        hash[key] = decodeURIComponent(value) //hash["email"]=1
      })
      // let email = hash['email']
      // let password = hash['password']
      // let password_confirmation = hash['password_confirmation']
      let { email, password, password_confirmation } = hash //这一句等价于上面三句
      if (email.indexOf('@') === -1) {
        response.setHeader('Content-Type', 'application/json;charset=utf-8')
        response.statusCode = 400
        response.write(`{
          "error":{
            "email":"invalid"
          }  
        }`)//写上error是为了前后端更好地合作
      } else if (password !== password_confirmation) {
        response.statusCode = 400
        response.write('password not match')
      } else {
        var users = fs.readFileSync('./db/users', 'utf8')
        try {
          users = JSON.parse(users)//解析JSON字符串
        } catch (exception) {
          users = [] //如果try里的有问题就执行catch的语句
        }
        let inUse = false
        for (let i = 0; i < users.length; i++) {
          let user = users[i]
          if (user.email === email) {
            inUse = true
            break
          }
        }
        if (inUse) {
          response.setHeader('Content-Type', 'application/json;charset=utf-8')
          response.statusCode = 400
          response.write(`{
            "error":{
              "email":"email in use"
            }  
          }`)
        } else {
          users.push({ email, password })//push进去对象,实际开发中不能直接这样存密码
          var usersString = JSON.stringify(users)//将一个JavaScript值(对象或者数组)转换为一个 JSON字符串
          fs.writeFileSync('./db/users', usersString)//不能以对象或数组形式存储，对象是内存里的东西
          response.statusCode = 200
        }
        response.end()
      }
      response.end()
    })
  } else if (path === '/sign_in.html' && method === 'GET') {
    let string = fs.readFileSync('./sign_in.html', 'utf8')
    response.statusCode = 200
    response.setHeader('Content-Type', 'text/html;charset=utf-8')
    response.write(string)
    response.end()
  } else if (path === '/sign_in.html' && method === 'POST') {
    readBody(request).then((body) => {
      let strings = body.split('&')
      let hash = {}
      strings.forEach((string) => {
        let parts = string.split('=')//["email","1"]
        let key = parts[0]
        let value = parts[1]
        hash[key] = decodeURIComponent(value) //hash["email"]=1
      })
      let { email, password } = hash
      var users = fs.readFileSync('./db/users', 'utf8')
      try {
        users = JSON.parse(users)
      } catch (exception) {
        users = []
      }  
      let found = false
      let match = false
      for (let i = 0; i < users.length; i++) {
        
        if (users[i].email === email && users[i].password === password) {
          found = true
          match = true
          break  //一定要跳出遍历或者自己遍历完再去验证有没有找到匹配的邮箱密码，如果在循环中验证，会每一组邮箱返回一个状态码     
        }else if(users[i].email === email && users[i].password !== password){
           found = true
           match = false
           break
        }
      }
      if (found && match) {
        response.statusCode = 200
        response.setHeader('Set-Cookie',`sign_in_email=${email};HttpOnly`)
      } else if(found && !match){
        response.setHeader('Content-Type', 'application/json;charset=utf-8')
          response.statusCode = 400  //这个状态码会显示在前端   
          response.write(`{
            "error":{
              "password":"password wrong"
            }  
          }`) 
      }else{
        response.setHeader('Content-Type', 'application/json;charset=utf-8')
        response.statusCode = 400      
        response.write(`{
          "error":{
            "email":"email not in use"
          }  
        }`)   
      }
      response.end()
    })

  } else if (path === '/main.js') { //http路径必须是绝对路径
    let string = fs.readFileSync('./main.js', 'utf8')
    response.statusCode = 200
    response.setHeader('Content-Type', 'text/javascript;charset=utf-8')
    response.write(string)
    response.end()
  } else if (path === '/xxx') {
    response.statusCode = 200
    response.setHeader('Content-Type', 'text/json;charset=utf-8')
    response.setHeader('Access-Control-Allow-Origin', 'http://doudou.com:8001')
    response.write(`
    {
      "note":{
        "to": "小谷",
        "from": "方方",
        "heading": "打招呼",
        "content": "hi"
      }
    }
    `)
    response.end()
  } else {
    response.statusCode = 404
    response.setHeader('Content-Type', 'text/html;charset=utf-8')
    response.write('你要找的东西不在这里了啦！')
    response.end()
  }

  /******** 代码结束，下面不要看 ************/
})

//读取请求体
function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = []
    request.on('data', (chunk) => {
      body.push(chunk)
    }).on('end', () => {
      body = Buffer.concat(body).toString()
      resolve(body)
    })
  })
}


server.listen(port)
console.log('监听 ' + port + ' 成功\n请打开 http://localhost:' + port)
