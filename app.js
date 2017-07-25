var colors = require('colors');
colors.setTheme({
    silly: 'rainbow',
    input: 'grey',
    verbose: 'cyan',
    prompt: 'red',
    info: 'green',
    data: 'blue',
    help: 'cyan',
    warn: 'yellow',
    debug: 'magenta',
    error: 'red'
});
var node = {
    async: require('async'),
    cheerio: require('cheerio'),
    fs: require('fs'),
    mkdirp: require('mkdirp'),
    path: require('path'),
    request: require('request'),
    url: require('url')
};
var Spider = {
    /**
     * 配置选项
     */
    options: {
        // 网站地址
        uri: '',
        // 保存到此文件夹
        saveTo: './tomiaaa',
        // 从第几页开始下载
        startPage: 100,
        // 到第一页结束
        endPage: 12,
        // 图片并行下载上限
        downLimit: 2
    },
    posts: [],
    /**
     * 开始下载（程序入口函数）
     */
    start() {
        var async = node.async;
        async.waterfall([
            this.getPages.bind(this),
            this.downAllImages.bind(this)
        ], (err, result) => {
            if (err) {
                console.log('error: %s'.error, err.message);
            } else {
                console.log('success: 下载完毕'.info);
            }
        });
    },
    /**
     * 爬取所有页面
     */
    getPages(callback) {
        var async = node.async;
        var i = this.options.startPage;
        async.doWhilst((callback) => {
            var uri = this.options.uri + '' + i;
            async.waterfall([
                this.downPage.bind(this, uri, i),
                this.parsePage.bind(this)
            ], callback);
            i--;
        }, (page) => this.options.endPage = page, callback);
    },
    /**
     * 下载单个页面
     */
    downPage(uri, curpage, callback) {
        console.log('开始下载页面：%s', uri);
        var options = {
            url: uri,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.54 Safari/537.36',
                'Cookie': 'lang_set=zh;'
            }
        };
        node.request(options, (err, res, body) => {
            if (!err) console.log('下载页面成功：%s'.info, uri);
            var page = {
                page: curpage,
                uri: uri,
                html: body
            };
            callback(err, page);
        });
    },
    /**
     * 解析单个页面并获取数据
     */
    parsePage(page, callback) {
        console.log('开始分析页面数据：%s', page.uri);
        var $ = node.cheerio.load(page.html);
        var $posts = $('.gallery-icon').find('a');
        var self = this;
        var src = [];
        $posts.each(function() {
            var href = $(this).attr('href');
            src.push(href)
        });
        self.posts.push({
            loc: src,
            title: "rosi-" + page.page
        });
        console.log('分析页面数据成功，共%d张图片'.info, $posts.length);
        callback(null, page.page);
    },
    /**
     * 下载全部图片
     */
    downAllImages(page, callback) {
        var async = node.async;
        console.log('开始全力下载所有图片，共%d篇', this.posts.length);
        async.eachSeries(this.posts, this.downPostImages.bind(this), callback);
    },
    /**
     * 下载单个页面的图片
     * @param  {Object} post
     */
    downPostImages(post, callback) {
        var async = node.async;
        async.waterfall([
            this.mkdir.bind(this, post),
            this.downImages.bind(this),
        ], callback);
    },
    /**
     * 创建目录
     */
    mkdir(post, callback) {
        var path = node.path;
        post.dir = path.join(this.options.saveTo, post.title);
        console.log('准备创建目录：%s', post.dir);
        if (node.fs.existsSync(post.dir)) {
            callback(null, post);
            console.log('目录：%s 已经存在'.error, post.dir);
            return;
        }
        node.mkdirp(post.dir, function(err) {
            callback(err, post);
            console.log('目录：%s 创建成功'.info, post.dir);
        });
    },
    /**
     * 下载post图片列表中的图片
     */
    downImages(post, callback) {
        console.log('发现%d张图片，准备开始下载...', post.loc.length);
        node.async.eachLimit(post.loc, this.options.downLimit, this.downImage.bind(this, post), callback);
    },
    /**
     * 下载单个图片
     */
    downImage(post, imgsrc, callback) {
        var url = node.url.parse(imgsrc);
        var fileName = node.path.basename(url.pathname);
        var toPath = node.path.join(post.dir, fileName);
        console.log('开始下载图片：%s，保存到：%s', fileName, post.dir);
        node.request(encodeURI(imgsrc)).pipe(node.fs.createWriteStream(toPath)).on('close', () => {
            console.log('图片下载成功：%s'.info, imgsrc);
            callback();
        }).on('error', callback);
    }
};
Spider.start();
