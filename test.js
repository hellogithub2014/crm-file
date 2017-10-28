window.onload = function() {
    let uploader = new CrmFileUploader({
        uploadUrl: 'xxx',
        downloadUrl: 'xxx',
        UPLOAD_WRAPPER_SELECTOR: '#crm-file-upload-wrapper',
    });

    $('#getAllAttachment').click(function() {
        console.log(uploader.getAttachmentList());
    });
};
