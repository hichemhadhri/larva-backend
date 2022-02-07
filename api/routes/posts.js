const express = require("express");
const router = express.Router();
const mongoose = require('mongoose')
const multer = require('multer');
const Post = require("../models/post")
const FormData = require("form-data");
const rgb2hex = require('rgb2hex');
const fs = require("fs")
const s3 = require("../models/aws");








const checkAuth = require('../middlewares/check_auth');

const User = require("../models/user");

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
      cb(null, './uploads/');
    },
    filename: function(req, file, cb) {
      cb(null,  file.originalname);
    }
  });

  const upload = multer({
    storage: storage,
  
  });


//create new  post
router.post("/new",checkAuth , upload.single("file") ,async (req,res,next)=>{

  const fileStream = fs.createReadStream(req.file.path)
  const uploadParams = {
    Bucket : process.env.S3_BUCKET,
    body : fileStream,
    Key : req.file.filename
  }

  try{
    

          const upRes = await  s3.upload(uploadParams).promise()

          await unlinkFile(req.file.path)

          const post = new Post({
            _id : new mongoose.Types.ObjectId(),
            backgroundColor : req.body.backgroundColor ,
              description : req.body.description,
              title : req.body.title,
              contests: req.body.contests,
              domaine : req.body.domaine,
              type : req.file.mimetype,
              authorName : req.userData.user.surname + " " + req.userData.user.name,
              authorPdp : req.userData.user.userPdp,
              authorRef : req.userData.user._id,
              mediaUrl : `posts/${upRes.Key}`
          })
          
          var postSaved = await post.save()
          await User.findByIdAndUpdate(req.userData.user._id,{$push: { pubs: postSaved._id ,pubsPhotos : postSaved.mediaUrl }}).exec();
         
          res.status(200).json({
            result : postSaved
          })
    
  
   
  }catch(err){
    console.log(err.message)
    const error = new Error(err.message)
    error.status = 500 
    next(error)
}
});


//delete given post 
router.delete("/:postId",checkAuth,async (req,res,next)=>{
  try{
   await Post.findByIdAndRemove(req.params.postId).exec()
   res.status(200).json({
     message : "post has been deleted"
   })
  }catch(err){
    const error = new Error(err.message)
    error.status = 500 
    next(error)
}
});


//return list of posts
router.get("/wall",checkAuth,async (req,res,next)=>{
  try{
  const posts = await Post.find().exec()
  res.status(200).json(posts)
  }catch(err){
    const error = new Error(err.message)
    error.status = 500 
    next(error)
}
})








module.exports = router ; 