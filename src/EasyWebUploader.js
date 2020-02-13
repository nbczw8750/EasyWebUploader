class EasyWebUploader {
    constructor(opt){

        this.options = {
            "elem": "",
            success:null,
            error:null,
            complete:null
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

        if (!WebUploader.Uploader.support()) {
            var error = "上传控件不支持您的浏览器！请尝试升级flash版本或者使用Chrome引擎的浏览器。<a target='_blank' href='http://se.360.cn'>下载页面</a>";
            if (window.console) {
                window.console.log(error);
            }
            this.$elem.text(error);
            return;
        }

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
        let uploader = this.create(); //创建上传类实例化
        uploader.fileNum = this.theme.getFileCount();
        this.theme.setUploader(uploader);
        this.uploader = uploader;
        this.initEvent();


        this.$elem = this.theme.$elem;
        // if (uploader.fileNum >= this.fileNumLimit){
        //     // this.theme.hidePicker();
        // }
    }


    create(){
        // TODO 生成webuploader实例化
        this.webuploaderoptions = Object.assign(this.webuploaderoptions,this.options);
        // console.log(this.webuploader_options);
        return WebUploader.create(this.webuploaderoptions);
    }

    initEvent(){
        this.beforeFileQueuedEvent();
        this.fileQueuedEvent();
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
        })
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
            _this.theme.uploadSuccess(file,res);
            _this.options.success(_this.theme,file,res);
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
        let value = this.getOriValue()
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
     * @param res
     */
    uploadSuccess(file, res){
        if (res[this.options.response.statusName] == this.options.response.statusCode.success){
            this.setSuccessMessage(file,res[this.options.response.msgName]);
        }else{
            this.setErrorMessage(file,res[this.options.response.msgName]);
        }
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
