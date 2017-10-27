 var CrmFileUploader = (function() {
     function CrmFileUploader(options) {
         this.options = $.extend({}, options);
         this.attchmentList = [];
         this.uploadProgressListener = -1; // ie9的上传进度查询
         generateUploadArea.call(this, this.options);
     }

     /**
      * 判断浏览器是否为IE9以上
      */
     function isUpperIE9() {
         if (
             navigator.appName == "Microsoft Internet Explorer" &&
             navigator.appVersion.indexOf("MSIE 9.0;") > 0
         ) {
             return false;
         }
         return true;
     }

     /**
      * 生成上传区域的模板
      *
      * @param {any} options
      */
     function generateUploadArea(options) {
         options = options || {};

         var html = `
            <!--标识区域-->
            <span class="upload-label fll">${options.labelName || "附件"}：</span>

            <!--上传及显示区域-->
            <div class="upload-area fll">

                <!--附件列表-->
                <ul class="attachment-list clearfix"></ul>

                <!--上传附件的表单
                    ie9下无法在js中获取文件流，因为其没有定义File API。只能用表单提交。注意此时target的值为一个隐藏的
                     iframe的name， 这样可组织表单提交成功后跳转到其他页面
                 -->

                <form id=${isUpperIE9() ? "crm-upload-form" :"ie9-crm-upload-form"} class="clearfix" method="post" enctype="multipart/form-data" action="${options.uploadUrl}" ${!isUpperIE9() ? 'target="hidenIframe"' :""}>
                    <label class="upload-file"><input type="file" name="file" />${options.uploadHint || "添加附件"}</label>
                </form>
        `;

         if (!isUpperIE9()) {
             html += `<iframe name="hidenIframe" id="hidenIframe" style="display:none" src="" frameborder="“0”" scrolling="yes" height="0px" width="0px"></iframe>`;
         }

         html += `</div>`;

         $(options.UPLOAD_WRAPPER_SELECTOR).html(html);
         bindEventHandler.call(this);
     }


     /**
      * 绑定页面点击事件
      */
     function bindEventHandler() {
         var _this = this;
         /**
          * 添加附件按钮点击事件
          */
         $('#crm-upload-form input[type="file"]').change(function(e) {
             // 文件流数组
             var fileStream = $(this).prop('files')[0];

             // 大小不能超过10M
             if (fileStream.size >= 10 * 1024 * 1024) {
                 ccrmUtil.errorMessage('文件大小不能超过10M');
                 $('#crm-upload-form')[0].reset(); // 清空表单
                 return;
             }

             //  jquery-form 提交表单
             $('#crm-upload-form').ajaxSubmit({
                 success: function(response) {
                     handleUploadResponse.call(_this, JSON.parse(response), fileStream.name, '#crm-upload-form');
                 },
                 error: function(err) {
                     $('#crm-upload-form')[0].reset(); // 清空表单
                     ccrmUtil.errorMessage("文件上传失败！");
                 },
             });
             //  testFormData.call(_this, fileStream);
         });


         /**
          * FormData API，只支持到IE11。此函数作实验用
          *
          * @param {any} file
          */
         function testFormData(file) {
             var _this = this;
             var formData = new FormData();
             formData.append("file", file);
             $.ajax({
                 type: "POST",
                 url: _this.options.url,
                 cache: false,
                 data: formData,
                 dataType: "json",
                 processData: false,
                 contentType: false,
                 success: function(response) {
                     handleUploadResponse.call(_this, response, file.name, '#crm-upload-form');
                 },
                 error: function(XMLHttpRequest, textStatus, errorThrown) {
                     if (errorThrown) {
                         console.error(errorThrown);
                     }
                 }
             });
         }

         /**
          *  选择文件后获取文件名
          */
         $('#ie9-crm-upload-form #fileSelector').change(function(e) {
             var ie9FileName = parseFilePath(this); // ie9下的文件名
             $('#ie9-crm-upload-form').submit(); // 提交表单，上传文件
             _this.uploadProgressListener = setInterval(getUploadProgress.bind(_this, ie9FileName), 200);
         });

     }



     /**--------------------------------------------     ie9上传文件   开始    ------------------------------- */

     /**
      * 截取ie9下的文件路径，只取最后2的文件名
      *
      * @param {any} inputElement
      * @returns
      */
     function parseFilePath(inputElement) {
         var filePath = $(inputElement).val();
         var fileName = filePath.split('\\').pop(); // clean from C:\fakepath OR C:\fake_path
         return fileName;
     }

     /**
      * 获取上传文件的进度
      *
      * 如果上传成功了，在隐藏的iframe中的内容里会返回对应的附件id
      */
     function getUploadProgress(ie9FileName) {
         // 获取隐藏的iframe中的内容
         var hidenIframe = $('#hidenIframe')[0];
         var hidenBody = $(hidenIframe.contentDocument).find('body')[0];
         var hidenResponse = $(hidenBody).html();

         // 还没有响应返回
         if (!hidenResponse || hidenResponse.trim() === "") {
             return false;
         }

         $(hidenBody).html(""); // 清空iframe中body的内容

         handleUploadResponse.call(this, JSON.parse(hidenResponse), ie9FileName, '#ie9-crm-upload-form');
         clearInterval(this.uploadProgressListener); // 清除重复任务
         return true; // 已经有响应返回了
     }

     /**--------------------------------------------     ie9上传文件   结束    ------------------------------- */

     /**
      * 处理后台返回的上传文件响应
      *
      * @param {any} responseObj 响应对象
      * @param {any} uploadFormId 表单id
      */
     function handleUploadResponse(responseObj, uploadFileName, uploadFormId) {
         if (responseObj.RTNCOD == "SUC0000") {
             attachmentId = responseObj.attachmentId; // 后台返回的唯一附件id
             this.attchmentList.push({ // 往附件列表中添加一条数据
                 atchId: attachmentId,
                 atchNm: uploadFileName
             });
             appendToAttachmentList.call(this, attachmentId, uploadFileName); // 在页面上将此附件显示，附件id暂时置为空
         } else {
             // 请求失败的分支
             if (responseObj.ERRMSG == "") {
                 console.error("文件上传失败！");
             } else {
                 console.error(responseObj.ERRMSG);
             }
         }
         $(uploadFormId)[0].reset(); // 清空表单
     }


     /**
      * 在页面上的附件列表中添加此附件
      *
      * @param {string} attachmentId 附件id
      * @param {string} fileName 文件名
      */
     function appendToAttachmentList(attachmentId, fileName) {
         var newFileItemStr = '<li><em id="attachment-id" style="display:none">' + attachmentId + '</em><i  class="downloadable-attchment">' + fileName + '</i>;<span></span></li>';
         $(this.options.UPLOAD_WRAPPER_SELECTOR + ' .attachment-list').append(newFileItemStr);

         //  changeHeight(); TODO可选的最终回调函数

         bindDeleteAttachmentHandler.call(this); // 为删除附件列表项中的元素绑定事件
         bindDownloadAttachmentHandler.call(this); // 为下载附件列表项中的元素绑定事件
     }


     /**
      * 为附件列表项中的删除按钮绑定事件
      */
     function bindDeleteAttachmentHandler() {
         var _this = this;
         $(this.options.UPLOAD_WRAPPER_SELECTOR + ' .attachment-list  li span').click(function(e) {
             var attachmentId = parseInt($(this).parent().find('#attachment-id').html().trim()); // 找到对应的附件id

             attchmentList = _this.attchmentList.filter(function(attachment) { //从附件列表中删除这条数据
                 return (attachment.atchId !== attachmentId);
             });

             removeFromAttachmentList($(this).parent()); // 在页面的附件列表中删除这条li元素
         });
     }
     /**
      * 在页面上的附件列表中删除此附件
      *
      * @param {any} attachmentItem 待删除的附件列表项，是一个jquery 查询结果元素
      */
     function removeFromAttachmentList(attachmentItem) {
         attachmentItem.remove();
     }

     /**
      * 为下载附件列表项中的元素绑定事件
      */
     function bindDownloadAttachmentHandler() {
         var _this = this;
         $(this.options.UPLOAD_WRAPPER_SELECTOR + ' .attachment-list  li .downloadable-attchment').click(function(e) {
             e.preventDefault();

             var attachmentId = $(this).parent().find('#attachment-id').html().trim(); // 附件id
             downloadAttachment.call(_this, attachmentId);
             return false;
         });
     }

     /**
      * 下载附件
      *
      * @param {string} attachmentId
      */
     function downloadAttachment(attachmentId) {
         var formHtml = `
            <div id="cmbCallerDiv" style="display: none;"><iframe id="cmbCaller" name="cmbCaller"></iframe></div>
            <form id="cmbCallerForm" method="POST" action="${this.options.downloadUrl}" target="cmbCaller" style="display: none;">
                <input type="hidden" name="attachmentId" value="${attachmentId}">
            </form>
        `;

         $(document.body).append(formHtml);
         $("#cmbCallerForm").submit();
         $("#cmbCallerForm").remove();
     }

     /**
      * 获取附件列表，每个附件对象包含:
      *        atchId: 后台对应的附件id
      *        atchNm： 附件名
      */
     CrmFileUploader.prototype.getAttachmentList = function() {
         return this.attchmentList;
     }

     return CrmFileUploader;
 })();