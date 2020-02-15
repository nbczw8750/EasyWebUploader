class EasyWebUploader {
    constructor(opt){

        this.options = {
            "elem": "",
            success:function (obj,file,response) { //上传成功回调
                
            },
            error:function (obj,file,response) { //上传失败回调
                
            },
            complete:function (obj,file,response) { //上传完成回调
                
            },
            response:{
                statusName:'code',
                statusCode:{
                    success:1,
                    error:0
                },
                msgName:'msg',
                dataName:'data'
            }

        };
        this.options = Object.assign(this.options,opt);

        this.webuploaderoptions = {
            // 选完文件后，是否自动上传。
            auto: true,
            // swf文件路径
            swf: '',

            // 文件接收服务端。
            server: '',

            // 选择文件的按钮。可选。
            // 内部根据当前运行是创建，可能是input元素，也可能是flash.
            pick: this.options.elem+" .file-item-picker .picker-btn",

            // 不压缩image, 默认如果是jpeg，文件上传前会压缩一把再上传！
            resize: false,
            compress:false
        };
        this.fileNumLimit = this.options.fileNumLimit || 0;


        this.$elem = $(this.options.elem);

        this.init();


        // this.files = new Array();
    }
    //获取图片的Blob值
    getImageBlob(url, cb) {
        var xhr  = new XMLHttpRequest();
        xhr.open("get", url, true);
        xhr.responseType = "blob";
        xhr.onload = function() {
            if (this.status == 200) {
                if(cb) cb(this.response);
            }
        };
        xhr.send();
    }
    init(){
        let _this = this;
        this.theme = new EasyWebUploaderPicTheme({
            elem: this.options.elem,
            fileNumLimit:this.fileNumLimit
        });
        this.theme.init(); //初始化页面效果 按钮

        let data = this.theme.getOriValue(); //初始化数据
        for(let i in data){
            data[i].name = data[i].name || data[i].url.substring(data[i].url.lastIndexOf("/")+1) || "";

            let file = new WebUploader.File(data[i]);
            // //此处是关键，将文件状态改为'已上传完成'
            file.setStatus('complete');
            this.theme.renderItem(false,file); //初始化文件
            this.theme.setData(file,data[i]); //初始化文件信息
        }
    }


    create(){
        // TODO 生成webuploader实例化

        if (!WebUploader.Uploader.support()) {
            var error = "上传控件不支持您的浏览器！请尝试升级flash版本或者使用Chrome引擎的浏览器。<a target='_blank' href='http://se.360.cn'>下载页面</a>";
            if (window.console) {
                window.console.log(error);
            }
            this.$elem.text(error);
            return;
        }
        this.register();//注册事件

        this.webuploaderoptions = Object.assign(this.webuploaderoptions,this.options);
        this.uploader = WebUploader.create(this.webuploaderoptions);
        this.uploader.fileNum = this.theme.getFileCount();
        this.theme.setUploader(this.uploader);
        this.theme.setValue();//设置数据库存储的值
        this.initEvent();
        this.$elem = this.theme.$elem;
        return this;
    }

    register(){
        let _this = this;
        let md5Server = this.options.md5Server || "";
        if (md5Server){

            WebUploader.Uploader.register({
                'before-send-file': 'beforeSendFile' //整个文件上传前
            },{
                init: function( options ) {},
                beforeSendFile: function( file ) {
                    var that = this;
                    var deferred = WebUploader.Deferred();
                    //上传前请求服务端,判断文件是否已经上传过
                    // file.md5 =  md5[file.id]; // 用来判断上传的文件和源文件是否一致，有没有改过。 jpg图片 如果被压缩（创建组件时compress:false 则不会压缩），那么就可能不一致导致无法上传，这个时候可以不传md5，则不会验证 重要！！！
                    $.post(md5Server, { md5:  file.md5 },
                        function(response){
                            if (response[_this.options.response.statusName] == _this.options.response.statusCode.success) {
                                // file.setStatus('complete');
                                //跳过如果存在则跳过
                                that.owner.skipFile( file );

                                // 秒传效果
                                let msg = "";
                                if(response && response[_this.options.response.msgName]){
                                    msg = response[_this.options.response.msgName];
                                }
                                _this.theme.uploadSuccess(file,msg || "秒传");
                                // 成功回调
                                _this.options.success(_this.theme,file,response);
                            }
                            file.data = response[_this.options.response.dataName];
                            // 继续后面行为
                            deferred.resolve();
                        });
                    return deferred.promise();
                }
            })
        }

        let chunksMergeServer = this.options.chunksMergeServer || "";
        if (chunksMergeServer){
            WebUploader.Uploader.register({
                "after-send-file": "afterSendFile"
            },{
                init: function( options ) {},
                afterSendFile: function (file) {
                    //合并文件
                    let chunksTotal = 0;
                    if (file.getStatus() != 'complete' && (chunksTotal = Math.ceil(file.size / _this.options.chunkSize)) >= 1) {
                        //合并请求
                        var deferred = WebUploader.Deferred();
                        let data = file.data;
                        data.chunks = chunksTotal;
                        data.name = file.source.name;
                        data.ext = file.ext;
                        data.md5 = file.md5;
                        $.ajax({
                            type: "POST"
                            , url: chunksMergeServer
                            , data: data
                            , cache: false
                            , dataType: "json"
                        }).then(function (response, textStatus, jqXHR) {
                            if (response[_this.options.response.statusName] == _this.options.response.statusCode.success) {
                                deferred.resolve();
                            } else {
                                // 秒传效果
                                let msg = "";
                                if(response && response[_this.options.response.msgName]){
                                    msg = response[_this.options.response.msgName];
                                }
                                _this.theme.uploadSuccess(file,msg || "上传成功");
                                deferred.reject();
                            }
                        }, function (jqXHR, textStatus, errorThrown) {
                            deferred.reject();
                        });

                        return deferred.promise();
                    }

                }
            });
        }

        let chunkCheckServer = this.options.chunkCheckServer || "";
        if (chunkCheckServer){
            WebUploader.Uploader.register({
                "before-send": "beforeSend"
            },{
                init: function( options ) {},
                beforeSend: function (block) {
                    //分片验证是否已传过，用于断点续传
                    var deferred = WebUploader.Deferred();
                    let data = block.file.data; // 唯一标识符，用作断点续传 file.data.uuid
                    data.name = block.file.source.name;
                    data.chunk = block.chunk;
                    data.ext = block.file.ext;
                    data.size = block.end - block.start;

                    $.ajax({
                        type: "POST"
                        , url: chunkCheckServer
                        , data: data
                        , cache: false
                        , dataType: "json"
                    }).then(function (response, textStatus, jqXHR) {
                        if (response[_this.options.response.statusName] == _this.options.response.statusCode.success) { //未上传 检测通过
                            deferred.resolve(); // 继续后面行为
                        } else {
                            deferred.reject();
                        }
                    }, function (jqXHR, textStatus, errorThrown) {    //任何形式的验证失败，都触发重新上传
                        deferred.resolve();
                    });

                    return deferred.promise();
                }
            })
        }
    }

    initEvent(){
        this.beforeFileQueuedEvent();
        this.fileQueuedEvent();
        this.uploadBeforeSendEvent();
        this.uploadProgressEvent();
        this.uploadAcceptEvent();
        this.uploadSuccessEvent();
        this.uploadErrorEvent();
        this.uploadCompleteEvent();
        this.errorEvent();
        return this;
    }

    /**
     * 加入队列之前的事件
     */
    beforeFileQueuedEvent(){
        let _this = this;
        this.uploader.on("beforeFileQueued",function (file) {
            if (_this.fileNumLimit && _this.uploader.fileNum >= _this.fileNumLimit){
                _this.theme.setQueueErrorMessage("超过最大上传数量"+_this.fileNumLimit);
                return false;
            }else if(this.fileNumLimit && this.uploader.fileNum + 1 == this.fileNumLimit){
                this.theme.hidePicker();
            }

        });
    }

    /**
     * 当文件被加入队列以后触发。
     */
    fileQueuedEvent(){
        let _this = this;
        this.uploader.on("fileQueued",function (file) {
            _this.theme.fileQueued(file);
            _this.uploader.fileNum++;
            _this.uploader.md5File( file )// 及时显示进度
                .progress(function(percentage) {
                    _this.theme.fileQueuedMd5FileProgress(file,percentage);
                })
                // 完成
                .then(function(val) {
                    file.md5 = val;
                });
        })
    }
    uploadBeforeSendEvent(){
        let _this = this;
        this.uploader.on("uploadBeforeSend",function (block, data) {
            data = block.file.data; // 唯一标识符，用作断点续传 file.data.uuid
            data.md5 = block.file.md5;//md5
            data._ajax = true;

        });
    }
    /**
     * 上传进度事件
     */
    uploadProgressEvent(){
        let _this = this;
        this.uploader.on("uploadProgress",function (file,percentage) {
            _this.theme.uploadProgress(file,percentage);
        })
    }

    /**
     * 上传分片返回数据
     */
    uploadAcceptEvent(){
        let _this = this;
        this.uploader.on("uploadAccept",function (file, res) {
            if(res[_this.options.response.statusName] == _this.options.response.statusCode.success){
                return true;
            }else{
                return false;
            }
        });
    }
    uploadSuccessEvent(){
        // 文件上传成功
        let _this = this;
        this.uploader.on("uploadSuccess",function (file, res) {
            if(res){
                _this.theme.uploadSuccess(file,res[_this.options.response.msgName]);
                _this.theme.setData(file,res[_this.options.response.dataName]);//设置回调的data值
                _this.theme.setValue();
                _this.options.success(_this.theme,file,res);
            }
        });
    }

    /**
     * 不管成功或者失败，文件上传完成时触发。
     */
    uploadCompleteEvent(){
        let _this = this;
        this.uploader.on("uploadComplete",function (file) {
            _this.theme.uploadComplete(file);
            _this.options.complete(_this.theme,file);
        });
    }

    /**
     * 错误类型。
     */
    errorEvent(){
        this.uploader.on("error",function (type) {
            if (window.console) {
                window.console.log(type);
            }
        })
    }
    uploadErrorEvent(){
        let _this = this;
        this.uploader.on("uploadError",function (file,reason) {
            _this.theme.uploadError(file,reason);
            _this.options.error(_this.theme,file,reason);
        })
    }



}

class EasyWebUploaderPicTheme{
    constructor(opts){
        this._fileStatus =  {
            inited: "inited",  //初始状态
            queued: "queued",  //已经进入队列, 等待上传
            progress: "progress",  //上传中
            complete: "complete",  //上传完成
            error: "error",  //上传出错，可重试
            interrupt: "interrupt",  //上传中断，可续传
            invalid: "invalid",  //文件不合格，不能重试上传。会自动从队列中移除
            cancelled: "cancelled"  //文件被移除
        };
        this.options = {
            elem :"",
            "tpl": '<div class="file-item" >'
                        +'<div class="file-header">'
                            +'<div class="file-info" title="{{ name }}">{{ name }}</div>'
                            +'<a class="file-delete">×</a>'
                        +'</div>'
                        +'<div class="file-preview"></div>'
                        +'<div class="file-progress"><div class="file-progress-bar"></div></div>'
                        +'<div class="file-message"></div>'
                    +'</div>'
        };
        this.options = Object.assign(this.options,opts);
        this.uploader = null;
    }
    init(){
        this.$elem = $(this.options.elem);
        let $widget = $("<div></div>");
        $widget.attr("id",this.$elem.attr("id"));
        $widget.attr("class",this.$elem.attr("class")).addClass("easywebuploader");
        $widget.attr("value",this.$elem.attr("value"));
        if (this.$elem.attr("name")){
            $widget.append("<input name='"+this.$elem.attr("name")+"' type='hidden'>");
            $widget.attr("name",this.$elem.attr("name"));
        }
        this.$elem.replaceWith($widget);
        this.$elem = $widget;


        this.build();
        return this
    }

    /**
     * 获取原始数据
     * @returns {*}
     */
    getOriValue(){
        let value = this.$elem.attr("value");
        if (value){
            if (value.substring(0, 1) != '['){
                value = '[' + value + ']';
            }
            value = (new Function('return ' + value))();
        }
        return value;
    }

    /**
     * 设置上传类 实例化对象
     * @param uploader
     * @returns {EasyWebUploaderPicTheme}
     */
    setUploader(uploader){
        this.uploader = uploader;
        return this;
    }
    build(){
        //TODO 生成html结构
        let addBtnTpl = '<div class="file-item-picker"> <div class="picker-btn">+</div> <div class="queued-message"></div></div>';
        this.$elem.append(addBtnTpl);
        // let value = this.getOriValue();
        // if (value){
        //     for(let i in value){
        //         value[i].name = value[i].name || value[i].url.substring(value[i].url.lastIndexOf("/")+1) || "";
        //         let file = new WebUploader.File(value[i]);
        //         // //此处是关键，将文件状态改为'已上传完成'
        //         file.setStatus('complete');
        //         this.renderItem(false,file);
        //         this.setData(file,value);
        //     }
        //
        // }
    }

    getFileCount(){
        return this.$elem.find(".file-item").length || 0;
    }
    getItem(file) {  //获取$item
        return $("#" + file.id);
    }
    /**
     * 设置状态
     * @param file
     * @param state
     */
    setItemState(file,state){
        let $item = this.getItem(file);
        for(let index in this._fileStatus){
            $item.removeClass(this._fileStatus[index]);
        }
        $item.addClass(this._fileStatus[state]);
    }

    /**
     * 设置上传成功描述
     * @param file
     * @param msg
     */
    setSuccessMessage(file,msg){
        let $item = this.getItem(file);
        $item.find(".file-message").show().addClass("file-message-success").text(msg || "上传成功");
    }

    /**
     * 设置上传失败描述
     * @param file
     * @param msg
     */
    setErrorMessage(file,msg){
        let $item = this.getItem(file);
        $item.find(".file-message").show().addClass("file-message-error").text(msg || "上传失败");
    }

    /**
     * 加入队列成功提示
     * @param msg
     */
    setQueueSuccessMessage(msg){
        this.$elem.find(".queued-message").addClass("queued-message-success").text(msg).show().fadeOut(5000);
    }

    /**
     * 加入队列失败提示
     * @param msg
     */
    setQueueErrorMessage(msg){
        this.$elem.find(".queued-message").addClass("queued-message-error").text(msg).show().fadeOut(5000);
    }

    /**
     * 显示上传按钮
     */
    showPicker(){
        this.$elem.find(".file-item-picker").show();
    }

    /**
     * 隐藏上传按钮
     */
    hidePicker(){
        this.$elem.find(".file-item-picker").hide();
    }
    /**
     * 上传成功
     * @param file
     * @param msg
     */
    uploadSuccess(file, msg){
        this.setSuccessMessage(file,msg);
    }

    /**
     * 上传完成
     * @param file
     */
    uploadComplete(file){
        this.setItemState(file,"complete"); //完成状态标识
    }

    /**
     * 上传进度中
     * @param file
     * @param percentage
     */
    uploadProgress(file,percentage){
        let $item = this.getItem(file);
        this.setItemState(file,"progress"); //上传中状态标识
        let $percent = $item.find('.file-progress .file-progress-bar');
        $percent.css('width', percentage * 100 + '%');
    }

    /**
     * 上传失败
     * @param file
     * @param reason
     */
    uploadError(file,reason){
        this.setItemState(file,"error");
        this.setErrorMessage(file,reason);
    }

    /**
     * 加入队列
     * @param file
     */
    fileQueued(file){
        let _this = this;
        let tpl = this.renderItem(true,file);
    }

    /**
     * 读取文件md5进度显示
     * @param file
     * @param percentage
     */
    fileQueuedMd5FileProgress(file,percentage){
        let $item = this.getItem(file);
        this.setItemState(file,"queued"); //上传中状态标识
        let $percent = $item.find('.file-progress .file-progress-bar');
        $percent.css('width', percentage * 100 + '%');
    }


    /**
     * 删除文件事件
     * @param file
     */
    deleteFileEvent(file){
        let $item = this.getItem(file);
        $item.remove();
        if(this.uploader) {
            this.uploader.removeFile(file, true);
            this.uploader.fileNum--;
        }
        this.setValue();
    }
    /**
     * 处理文件的预览效果
     * @param isFile 是否为file对象
     * @param data
     * @returns {*}
     */
    renderItem(isFile,data){
        let _this = this;
        let str = this.options.tpl;
        let $item = $(str);
        let name = data.name || "";
        let $preview = "";
        if (!isFile) {
            if(/(.jpg|.png|.gif|.bmp|.jpeg)$/.test(name.toLocaleLowerCase())) {
                $preview = $('<img src="'+ data.source.url + '"/>');
            } else {
                $preview = this.getThumbErrorPreview();
            }
            $item.attr("id",data.id );
            $item.find(".file-preview").html($preview);
        } else {
            $item.attr("id",data.id);
            this.showPreview($item,data);
        }
        $item.find(".file-info").attr("title",name).html(name);
        // $item.find(".file-preview").html(preview);
        this.$elem.find(".file-item-picker").before($item);
        $item.find(".file-delete").click(function () {
            _this.deleteFileEvent(data);
        });
        return $item;
    }
    showPreview($item, file){
        let $preview = $('<img />');
        $item.find(".file-preview").html($preview);
        // 缩略图大小
        // var thumbnailWidth = this.getActualThumbnailWidth(), thumbnailHeight = this.getActualThumbnailHeight();
        // this.setItemStyle($item);  //设置item宽高
        let self = this;
        this.uploader.makeThumb(file, function (error, src) {
            if (error) {
                $preview.replaceWith(self.getThumbErrorPreview());
                // $preview.replaceWith(self.getThumbErrorPreview(file.name, self.thumbnailHeight, self.thumbnailWidth));
                return;
            }
            $preview.attr('src', src);

        });
    }
    getThumbErrorPreview(){
        return $('不能预览');
    }
    setUrl(file,url){
        let $item = this.getItem(file);
        if(/(.jpg|.png|.gif|.bmp|.jpeg)$/.test(url.toLocaleLowerCase())) {
            $item.find("img").attr("src",url);
        }else{
            $item.find("a").attr("href",url);
        }
    }

    /**
     * 在元素上设置文件信息值
     * @param file
     * @param data
     */
    setData(file,data){
        if(file){
            let $item = this.getItem(file);
            $item.data(data);
        }

    }

    /**
     * 设置表单提交值
     */
    setValue(){
        let items = this.$elem.children(".file-item");
        let values = new Array();
        items.each(function (i,n) {
            let data = $(this).data();
            data.value && values.push(data.value);
        });
        // this.$elem.find(".file-item").data("value");
        this.$elem.find("input[type=hidden]").val(values.join());
    }
}
