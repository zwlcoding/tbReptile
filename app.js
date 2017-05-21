let express = require('express');
let app = express();

var serveIndex = require('serve-index');
let fs = require('fs')
let nodeExcel = require('excel-export');
let async = require('async');
let charset = require('superagent-charset');
let superagent = require('superagent');
charset(superagent)

//删除左右两端的空格
function formatData(str){
    str =  str.replace(/(^\s*)|(\s*$)/g, "");
    str = JSON.parse(str.substring(1, str.length -1))
    return str
}


app.use('/download', serveIndex(__dirname+'/views/download', {'icons': true}))
app.use(express.static('views'));

// app.get('/', function (req, res) {
//     res.send('server work!');
// });


// 并发连接计数器
var concurrencyCount = 0;

//需要抓取的接口列表
var urlsList = []

//所有数据
var allData = []

//初始化算出所有需要抓取的链接
var initFetch = function( id, final ){
    urlsList = []
    allData = []
    concurrencyCount = 0
    superagent
        .get('http://rate.taobao.com/feedRateList.htm?auctionNumId=' + id +'&currentPageNum=1&pageSize=1')
        .charset('gbk')
        .end(function(err,res){
            if(err){
                throw err
            }
            try{
                var data = formatData(res.text)
                var pages = parseInt((data.total / 20).toFixed(0))
                console.log('共 ' + pages + ' 页评论')
                for(let i = 1; i <= pages; i++){
                    var item = 'http://rate.taobao.com/feedRateList.htm?auctionNumId=' + id +'&currentPageNum=' + i + '&pageSize=20'
                    urlsList.push(item)
                }
                fetchQueue(urlsList, final)
            }catch (e){
                throw e
            }
        })
}

//任务队列
var fetchQueue = function( urls, final ){

    //并发任务，最大为3
    async.mapLimit(urls, 3, function (url, callback) {
        fetchUrl(url, callback);
    }, function (err, result) {
        console.log('已完成所有任务！！！！');
        //console.log(result);
        //console.log(allData)
        createExcel(allData, final)
    })
}

//任务详情
var fetchUrl = function (url, callback) {
    concurrencyCount++;
    console.log('正在进行第 ', concurrencyCount, ' 个任务，正在抓取的是', url);
    getData(url, function(){
        callback(null, url + ' 已完成')
    })
};

//获取数据
var getData = function( url, cb ){
    superagent
        .get( url )
        .charset('gbk')//转GBK编码
        .end(function(err, res){
            if(err){
                throw err
            }
            var data = formatData(res.text)
            //console.log(data.comments)
            allData = allData.concat(data.comments)
            if(cb){
                cb()
            }
        })
}


//创建 excel
var createExcel = function(data, final){
    var conf ={};
    conf.stylesXmlFile = "styles.xml";
    conf.name = "mysheet";
    conf.cols = [
        {caption:'昵称', type:'string'},
        {caption:'时间', type:'string'},
        {caption:'评论', type:'string'}
    ]

    let confRows = []
    for(let i = 0; i < allData.length; i++){
        let item = allData[i]
        let rowItem = [ item.user.nick, item.date, item.content ]
        confRows.push(rowItem)
    }
    conf.rows = confRows


    //console.log(confRows)

    if(final){
        console.log('已完成excel生成')
        final( conf )
    }
}

app.get('/getComment/:id', function(req, res){
    let id = req.params.id
    initFetch( id, function(data){
        let result = nodeExcel.execute(data);
        fs.writeFileSync('./views/download/' + id + ".xlsx",  result, 'binary');
        return res.json(data)
    })

})

//启动服务
let server = app.listen(3000, function () {
    let host = server.address().address;
    let port = server.address().port;

    console.log('Example app listening at http://%s:%s', host, port);
});
