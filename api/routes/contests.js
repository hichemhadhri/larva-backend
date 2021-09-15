const express = require("express");
const router = express.Router();
const mongoose = require('mongoose')
const multer = require('multer');
const Post = require("../models/post")
const Contest = require("../models/contest")

const checkAuth = require('../middlewares/check_auth');

const User = require("../models/user");

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
      cb(null, './uploads/');
    },
    filename: function(req, file, cb) {
      cb(null, new Date().toISOString() + file.originalname);
    }
  });

  const upload = multer({
    storage: storage,
  
  });


//create new contest
router.post("/new",checkAuth,upload.single("file"), async (req,res,next)=>{

    try{
        const contest = new Contest({
            _id : new mongoose.Types.ObjectId(),
              description : req.body.description,
              title : req.body.title,
              domaines : req.body.domaines.split(",") ,
              creatorName : req.userData.user.surname + " " + req.userData.user.name,
              creatorRef : req.userData.user._id,
              mediaUrl : req.file.filename, 
              deadline : req.body.deadline, 
              prize : req.body.prize, 
              
          })
        var contestSaved = await contest.save()

        res.status(200).json({
            result : contestSaved
          })


    }catch(err){
    console.log(err.message)
    const error = new Error(err.message)
    error.status = 500 
    next(error)
}
})

//delete given contest 
router.delete("/:contestId",checkAuth,async (req,res,next)=>{
    try{
     await Contest.findByIdAndRemove(req.params.contestId).exec()
     res.status(200).json({
       message : "contest has been deleted"
     })
    }catch(err){
      const error = new Error(err.message)
      error.status = 500 
      next(error)
  }
  });


  router.get('/',checkAuth,async (req,res,next)=>{
    try{
       const contests = await Contest.find().exec()

       res.status(200).json(contests)

       }catch(err){
         const error = new Error(err.message)
         error.status = 500 
         next(error)
     }

  })

  //contest details
  router.get("/:contestId",checkAuth,async (req,res,next)=>{
      try{
        const contest = await Contest.findById(req.params.contestId).exec()

 
        res.status(200).json(contest)
 
        }catch(err){
          const error = new Error(err.message)
          error.status = 500 
          next(error)
      }
 
  })


module.exports = router ; 