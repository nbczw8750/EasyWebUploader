class EasyWebUploader {
    constructor(opt){

        this.options = {
            "elem": "",
            success:null,
            error:null,
            complete:null,
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
        this.theme.init(); //初始化页面效果
        // if (uploader.fileNum >= this.fileNumLimit){
        //     // this.theme.hidePicker();
        // }
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
        // console.log(this.webuploader_options);
        this.uploader = WebUploader.create(this.webuploaderoptions);
        this.uploader.fileNum = this.theme.getFileCount();
        this.theme.setUploader(this.uploader);
        this.initEvent();
        this.$elem = this.theme.$elem;
        return this;
    }

    register(){
        let _this = this;
        let md5Server = this.options.md5Server || "";
        console.log(md5Server);
        if (md5Server){

            WebUploader.Uploader.register({
                'before-send-file': 'beforeSendFile' //整个文件上传前
            },{
                init: function( options ) {},
                beforeSendFile: function( file ) {
                    var that = this;
                    var deferred = WebUploader.Deferred();
//                console.log(file);
//                console.log(file.id)
                    //上传前请求服务端,判断文件是否已经上传过
                    // file.md5 =  md5[file.id]; // 用来判断上传的文件和源文件是否一致，有没有改过。 jpg图片 如果被压缩（创建组件时compress:false 则不会压缩），那么就可能不一致导致无法上传，这个时候可以不传md5，则不会验证 重要！！！
                    $.post(md5Server, { md5:  file.md5 },
                        function(response){
//                            console.log("upload",response)

                            console.log(file,"file md5Check");
                            if (response[_this.options.response.statusName] == _this.options.response.statusCode.success) {
                                // file.setStatus('complete');
                                //跳过如果存在则跳过
                                that.owner.skipFile( file );
                                // alert(response.msg);

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
                    console.log(file,"file 合并文件");
                    let chunksTotal = 0;
                    if (file.getStatus() != 'complete' && (chunksTotal = Math.ceil(file.size / _this.options.chunkSize)) >= 1) {
                        //合并请求
                        var deferred = WebUploader.Deferred();
                        let data = {
                            chunks: chunksTotal
                            , name: file.source.name
                            , ext: file.ext
                            , md5:  file.md5
                        };
                        data = Object.assign(data,file.data);
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
//                        console.log("chen2gg")
                        }, function (jqXHR, textStatus, errorThrown) {
                            deferred.reject();
                        });

                        return deferred.promise();
                    }

                }
            });
        }
    }

    initEvent(){
        this.beforeFileQueuedEvent();
        this.fileQueuedEvent();
        this.uploadBeforeSendEvent();
        this.uploadProgressEvent();
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
            // console.log( _this.uploader.fileNum," >=", _this.fileNumLimit);
            if (_this.fileNumLimit && _this.uploader.fileNum >= _this.fileNumLimit){
                // console.log("超数量")
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
            // console.log("当有文件添加进来的时候",file)
            // console.log(_this.getFiles().length,">",_this.fileNumLimit)
            // console.log(_this.uploader.getFiles(),"当有文件添加进来的时候");
            _this.theme.fileQueued(file);
            _this.uploader.fileNum++;
            _this.uploader.md5File( file )// 及时显示进度
                .progress(function(percentage) {
                    _this.theme.fileQueuedMd5FileProgress(file,percentage);
                })
                // 完成
                .then(function(val) {
                    file.md5 = val;
                    // console.log("md5:",val)
                });
        })
    }
    uploadBeforeSendEvent(){
        let _this = this;
        this.uploader.on("uploadBeforeSend",function (block, data) {
            data.md5 = block.file.md5;//md5
            //唯一标识符，用作断点续传
            data.uuid = block.file.uuid;
            data._ajax = true;
        });
    }
    /**
     *
     */
    uploadProgressEvent(){
        let _this = this;
        this.uploader.on("uploadProgress",function (file,percentage) {
            _this.theme.uploadProgress(file,percentage);
        })
    }
    uploadSuccessEvent(){
        // 文件上传成功
        let _this = this;
        this.uploader.on("uploadSuccess",function (file, res) {
            if(res){
                _this.theme.uploadSuccess(file,res[_this.options.response.msgName]);
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
            // console.log("文件上传完成时触发",file)
            _this.theme.uploadComplete(file);
            _this.options.complete(_this.theme,file);
        });
    }

    /**
     * 错误类型。
     */
    errorEvent(){
        this.uploader.on("error",function (type) {
            console.log(type,"type");
        })
    }
    uploadErrorEvent(){
        let _this = this;
        this.uploader.on("uploadError",function (file,reason) {
            // console.log(file,reason,"uploadError");
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
            "tpl": {
                "item": '<div class="file-item" >'
                            +'<div class="file-header">'
                                +'<div class="file-info" title="{{ name }}">{{ name }}</div>'
                                +'<a class="file-delete">×</a>'
                            +'</div>'
                            +'<div class="file-preview"></div>'
                            +'<div class="file-progress"><div class="file-progress-bar"></div></div>'
                            +'<div class="file-message"></div>'
                        +'</div>',
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
            this.options.name = this.$elem.attr("name");
        }
        this.$elem.replaceWith($widget);
        this.$elem = $widget;
        this.build();
        return this
    }

    getOriValue(){
        let value = this.$elem.attr("value");
        if (value){
            // console.log(value,"value")
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
        this.$elem.html(addBtnTpl);
        let value = this.getOriValue();
        if (value){
            for(let i in value){
                value[i].name = value[i].name || value[i].url.substring(value[i].url.lastIndexOf("/")+1) || "";
                let file = new WebUploader.File(value[i]);
                // //此处是关键，将文件状态改为'已上传完成'
                file.setStatus('complete');
                this.renderItem(false,file);
            }

            // console.log(this.getFileCount()," >=", this.fileNumLimit)
            // if (this.getFileCount() >= this.fileNumLimit){
            //     this.hidePicker();
            // }
        }
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
        // console.log("uploadSuccess",res,file.getStatus());
        // let msg = "";
        // if(res && res[this.options.response.msgName]){
        //     msg = res[this.options.response.msgName];
        // }
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
            // console.log(file.id);
            this.uploader.removeFile(file, true);
            this.uploader.fileNum--;
            // this.showPicker();
        }
    }
    /**
     * 处理文件的预览效果
     * @param isFile 是否为file对象
     * @param data
     * @returns {*}
     */
    renderItem(isFile,data){
        let _this = this;
        let str = this.options.tpl.item;
        let $item = $(str);
        let name = data.name || "";
        // console.log(data,"data")
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
    setValue(file,value){

    }
}
