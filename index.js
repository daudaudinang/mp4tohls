const express = require('express');
const fileUpload = require("express-fileupload");
const ffmpeg = require("fluent-ffmpeg");
var session = require('express-session');
var fs = require("fs");
var path = require('path');

const app = express();

app.use(express.static(path.join(__dirname,'tmp')));
app.use(session({
    secret: 'keyboard cat', // Mã bảo mật của session
    resave: false,
    saveUninitialized: true
    // cookie: { secure: true }
}));

ffmpeg.setFfmpegPath("./ffmpeg/bin/ffmpeg.exe");

ffmpeg.setFfprobePath("./ffmpeg/bin/ffprobe.exe");

console.log(ffmpeg);

app.use(
    fileUpload({
        useTempFiles: true,
        tempFileDir: "/tmp/",
    })
);

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});

app.post("/convert", (req, res) => {
    let file = req.files.file;
    let fileName = Date.now() + "_" + file.name.split(".")[0];
    req.session.fileName = fileName;
    file.mv("tmp/" + fileName, (err) => {
        if(err) return res.send(err);
        console.log("File Upload Successfully");
    });

    ffmpeg('tmp/'+fileName)
    .outputOptions([
        '-f hls',
        '-max_muxing_queue_size 2048',
        '-hls_time 1',
        '-hls_list_size 0',
        '-hls_segment_filename', 'tmp/'+fileName+'-fileSequence%d.ts',
        '-hls_base_url','http://localhost:3000/'
    ])
    .output('tmp/'+fileName+'.m3u8')
    .on('start', function (commandLine) {
        console.log('Spawned Ffmpeg with command: ' + commandLine);
    })
    .on('error', function (err, stdout, stderr) {
        console.log('An error occurred: ' + err.message, err, stderr);
    })
    .on('progress', function (progress) {
        console.log('Processing: ' + progress.percent + '% done');
    })
    .on('end', function (err, stdout, stderr) {
        console.log('Finished processing!' /*, err, stdout, stderr*/);
        res.redirect('/download');
    })
    .run();
});

app.get("/download", (req, res) => {
    res.sendFile(__dirname + "/download.html");
});

app.get("/download2", (req, res) => {
    res.download(__dirname + '/tmp/' + req.session.fileName + '.m3u8', function(err){
        if(err) throw err;
    });
    // Xoá file .m3u8 và session, chỉ lưu những file segment để người dùng có thể xem
    fs.unlink(__dirname + '/tmp/' + req.session.fileName + '.m3u8', function (err) {
        if (err) console.log(err);
    });
    fs.unlink(__dirname + '/tmp/' + req.session.fileName, function (err) {
        if (err) console.log(err);
    });
    req.session.destroy(function(err){
        console.log(err);
    });
});

app.listen(3000, () => {
    console.log("App is listening on port 3000");
})
