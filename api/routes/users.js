const express = require("express");

const router = express.Router();
const mongoose = require('mongoose')
const User = require("../models/user")
const bcrypt = require('bcrypt');
const jwt  = require('jsonwebtoken');
const check_auth = require("../middlewares/check_auth");
const s3 = require("../models/aws");
const multer = require('multer');



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





//sign up route
router.post("/sign",async (req,res,next)=>  {
    try{
   const existingUsers = await  User.find({mail : req.body.mail}).exec();
   if(existingUsers.length >=1){
      const error = new Error("User with email already exists")
      error.status = 409 ;
      next(error);
   }
   else{
    const  hashedPassword = await bcrypt.hash(req.body.password,10)
    const newUser = new User({
        _id : new mongoose.Types.ObjectId(),
        mail : req.body.mail,
        name : req.body.name,
        surname : req.body.surname,
        password : hashedPassword,
        age : req.body.age,
        sexe : req.body.sexe,
    });
    var user =  await newUser.save()
    var token = await jwt.sign(
       {user : result}
    ,
    process.env.JWT_KEY,{
        expiresIn : "1d"
    }
    );
    return  res.status(200).json({
            user : user,
            token : token
        })
    }   
    }catch(err){
        const error = new Error(err.message)
        error.status = 500 
        next(error)
    }
});

//login route
router.post("/login", async(req,res,next)=>{
    var error;
    try{
        const user  = await User.find({mail: req.body.mail}).exec()
        if(user.length== 0 ) {
            error = new Error("User with email  not found ")
            error.status = 404
            throw error
        } 
            
        const validatePassword = await bcrypt.compare(req.body.password,user[0].password)
        if(validatePassword){
            var token = await jwt.sign(
               {user : user[0]}
            ,
            process.env.JWT_KEY,{
                expiresIn : "1d"
            }
            );
            res.status(200).json({
                user : user[0],
                token : token 
            })
        }else{
            error =  new Error("Password is wrong")
            error.status= 401
            throw error
        }

       

    }catch(err){
        const error = new Error(err.message)
        
        error.status =  err.status
        next(error)
    }


});


/**
 * return User with Id 'id'
 */
router.get("/:id",async (req,res,next)=> {
    try {
    const user = await User.findById(req.params.id).exec();   
    console.log(user.sexe)
    res.status(200).json({
        id : user._id,
        pdp : user.userPdp,
        name : user.name, 
        surname : user.surname, 
        favorites : user.favorites,
        sexe : user.sexe, 
        pubs : user.pubs,
        pubsPhotos : user.pubsPhotos,
        following : user.following,
        followers : user.followers,
        description : user.description
    })
    }catch(err){
        const error = new Error(err.message)
        
        error.status =  err.status
        next(error)
    }

});


/**
 * Change profile picture
 */
 router.post("/:id",upload.single("file"),async (req,res,next)=> {
    try {
        const fileStream = fs.createReadStream(req.file.path)
        const uploadParams = {
         Bucket : process.env.S3_USERS_BUCKET,
         Body : fileStream,
         Key : req.file.filename
        }
        
        const upRes = await  s3.upload(uploadParams).promise();
        await unlinkFile(req.file.path)
        
        const newPdp = {
            userPdp : `users/${upRes.Key}`
        }
        //retrieve user and change pdp
        const user  = await User.findByIdAndUpdate(req.params.id,newPdp).exec()

        res.status(200).json({
            message : 'Update Successful'
        });


    }catch(err){
        const error = new Error(err.message)
        
        error.status =  err.status
        next(error)
    }

});



// return user pdp  (no need for checkAuth)
router.get("/:key",async (req,res,next)=>{
    try{
      
      const downloadParams = {
        Key: req.params.key,
        Bucket: process.env.S3_USERS_BUCKET
      }
  
      s3.getObject(downloadParams).createReadStream().pipe(res)
    }catch(err){
      const error = new Error(err.message)
      error.status = 500 
      next(error)
  }
  });
  
  
  
  


module.exports = router ; 