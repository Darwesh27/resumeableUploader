/**
 * FileController
 *
 * @module      :: Controller
 * @description	:: A set of functions called `actions`.
 *
 *                 Actions contain code telling Sails how to respond to a certain type of request.
 *                 (i.e. do stuff, then send some JSON, show an HTML page, or redirect to another URL)
 *
 *                 You can configure the blueprint URLs which trigger these actions (`config/controllers.js`)
 *                 and/or override them with custom routes (`config/routes.js`)
 *
 *                 NOTE: The code you write here supports both HTTP and Socket.io automatically.
 *
 * @docs        :: http://sailsjs.org/#!documentation/controllers
 */

var fs = require('fs');
var util = require('util');
var exec = require('child_process').exec;

module.exports = {
    
  
  /**
   * Action blueprints:
   *    `/file/start`
   */
    start: function (req, res) {
        var socket = req.socket;
        var file;
        
        // look for the file in database.
        File.find({
            name: req.param("name"),
        }).done(function (err, fs) {
            if(fs.length != 0) {
                fs[0].data = "";
                fs[0].downloaded = 0;
                fs[0].save(function(err){});
                file = fs[0]
            }
            else { // If this is the first time create a new file..
                File.create ({
                    name : req.param("name"),
                    fileSize: req.param("size"),
                    data: "",
                    downloaded: 0,
                }).done(function(err, f) {
                    file = f
                });
            }
        }); // end of .done()
        
        var place = 0;
        try{
            var Stat = fs.statSync('Temp/' +  file.name);
            if(Stat.isFile())
            {
                file.downloaded = Stat.size;
                place = Stat.size / 524288;
                file.save(function(err){});
            }
        }
        catch(er){} //It's a New File
    	//socket.emit('MoreData', { 'Place' : Place, Percent : 0 });
        res.json({ 'place' : place, 'percent' : 0 });
  },


  /**
   * Action blueprints:
   *    `/file/upload`
   */
   upload: function (req, res) {
       var file;
        console.log("Uploading..!!");
        var Name = req.param('name');
        File.find({
            name: req.param("name"),
        }).done(function (err, files) {
            if(files.length != 0) {
                file = files[0];
            }
        });
        file.downloaded += req.param('data').length;
        file.data += req.param('data');
       	file.save(function(err){});
       
        // create a file handler
        var fs = require('fs');
        var hand;
        fs.open("Temp/" + file.name, "a", 0755, function(err, fd){
            if(err)
            {
                console.log(err);
            }
            else
            {
                hand = fd; //We store the file handler so we can write to it later
                if(file.downloaded == file.fileSize) //If File is Fully Uploaded
                {
                    fs.write(hand, file.data , null, 'Binary', function(err, Writen){
                        //Get Thumbnail Here
                        var inp = fs.createReadStream("Temp/" + Name);
                        var out = fs.createWriteStream("Video/" + Name);
                        util.pump(inp, out, function(){
                            fs.unlink("Temp/" + Name, function () { //This Deletes The Temporary File
                                //Moving File Completed
                            });
                        });
                        
                        exec("ffmpeg -i Video/" + Name  + " -ss 01:30 -r 1 -an -vframes 1 -f mjpeg Video/" + Name  + ".jpg", function(err){
                            res.json({'Image' : 'Video/' + file.name + '.jpg'});
                        });
                    });
                }
                else if(file.data.length > 10485760){ //If the Data Buffer reaches 10MB
                    fs.write(hand, file.data, null, 'Binary', function(err, Writen){
                        file.data = ""; //Reset The Buffer
                        file.save(function(err){});
                        
                        var Place = file.downloaded / 524288;
                        var Percent = (file.downloaded / file.fileSize) * 100;
                        
                        res.json({ 'place' : Place, 'percent' :  Percent});
                    });
                }
                else
                {
                    var Place =file.downloaded / 524288;
                    var Percent = (file.downloaded / file.fileSize) * 100;
                    
                    res.json({ 'place' : Place, 'percent' :  Percent});
                }
            }
        });
       	
       
   
  },
    
  /**
   * Overrides for the settings in `config/controllers.js`
   * (specific to FileController)
   */
  _config: {}

  
};
